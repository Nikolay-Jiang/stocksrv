import { Prisma, PrismaClient, t_StockDayLog, t_StockNameList, t_StockDayReport, t_StockKLine } from '@prisma/client'
import logger from './logger';
// import { GetStockCurrent2, Stock, GetStockCurrent } from './sinaStockInterface'
import { Stock, GetStockCurrent } from './tencentStockInterface'
import { dateOnly, formatWallClock, todayWallClock } from './timeUtil';



export const prisma = new PrismaClient();

/** 数值字符串 → Decimal；空值/NaN/非法值返回 null */
function toDecimalOrNull(value: string | null | undefined): Prisma.Decimal | null {
    if (value == null) return null;
    const text = String(value).trim();
    if (!text || text == '-' || /^nan$/i.test(text)) return null;
    try {
        return new Prisma.Decimal(text);
    } catch {
        return null;
    }
}

/** 价格字符串 → Decimal；超长（异常行情）按旧逻辑记为 9999，空值返回 null */
function toPrice(value: string | null | undefined): Prisma.Decimal | null {
    if (value == null) return null;
    const text = String(value).trim();
    if (!text) return null;
    try {
        return new Prisma.Decimal(text.length > 7 ? "9999" : text);
    } catch {
        return null;
    }
}

/** 百分比字符串（如 "12.34%"）→ Decimal；"NaN%" 返回 null */
function toPercent(value: string | null | undefined): Prisma.Decimal | null {
    if (value == null) return null;
    const text = String(value).trim().replace(/%$/, '');
    if (!text || /^nan$/i.test(text)) return null;
    try {
        return new Prisma.Decimal(text);
    } catch {
        return null;
    }
}

//#region StockDayLog
export async function AddStockDayLog(Lstock: Stock[]) {

    const dTemp = todayWallClock()
    const Lstockdaylog: Array<t_StockDayLog> = [];
    logger.info("开始写入..." + formatWallClock(dTemp))
    for (let index = 0; index < Lstock.length; index++) {

        const element = Lstock[index];
        if (element == null || !element.stockcode) {
            continue;
        }
        if (!element.stockname || element.stockname.indexOf("退") >= 0) {//过滤已退市
            continue;
        }
        if (!(element.SearchTime instanceof Date) || isNaN(element.SearchTime.getTime())) {
            continue;
        }

        if (element.SearchTime.getUTCMonth() < dTemp.getUTCMonth()) {//停牌或已退市
            continue;
        }

        if (element.SearchTime.getUTCDate() != dTemp.getUTCDate()) {//停牌或已退市
            continue;
        }

        if (element.SearchTime.getUTCHours() < dTemp.getUTCHours()) {//判断停牌情况，9点会被记录一次，后续跳过
            continue;
        }

        try {
            const mDayLog: t_StockDayLog = {
                StockCode: element.stockcode,
                SearchTime: element.SearchTime,
                CurrentPrice: toPrice(element.CurrentPrice),
                YesterdayClosingPrice: toPrice(element.YesterdayClosingPrice),
                TodayOpeningPrice: toPrice(element.TodayOpeningPrice),
                TodayMinPrice: toPrice(element.TodayMinPrice),
                TodayMaxPrice: toPrice(element.TodayMaxPrice),
                TradingVolume: toDecimalOrNull(element.TradingVolume),
                TradingPrice: toDecimalOrNull(element.TradingPrice),
                BidBuyPrice: toDecimalOrNull(element.BidBuyPrice),
                BidSellPrice: toDecimalOrNull(element.BidSellPrice),
                SellBuyRate: toPercent(element.SellBuyRate)
            }
            Lstockdaylog.push(mDayLog);
        } catch (error) {
            logger.info("error:" + Lstock[index].stockcode + error)
        }

    }

    if (Lstockdaylog.length == 0) {
        return;
    }

    logger.info(Lstockdaylog.length);
    await BulkStockDayLog(Lstockdaylog);

}

export async function GetStockDayLogForRpt(dBegin: Date, dEnd: Date): Promise<t_StockDayLog[]> {

    // 每个交易日在 14:59:59 之后只保留最后一笔累计快照
    const start = new Date(Date.UTC(
        dBegin.getUTCFullYear(), dBegin.getUTCMonth(), dBegin.getUTCDate(), 14, 59, 59
    ));
    const end = new Date(Date.UTC(
        dEnd.getUTCFullYear(), dEnd.getUTCMonth(), dEnd.getUTCDate(), 0, 0, 0
    ));

    const rows = await prisma.t_StockDayLog.findMany({
        where: {
            SearchTime: { gte: start, lt: end },
        },
    });

    // 同一只股票可能命中 15:00 / 15:05 等多笔，取最新一笔
    const latest = new Map<string, t_StockDayLog>();
    for (const row of rows) {
        const current = latest.get(row.StockCode);
        if (current == null || row.SearchTime > current.SearchTime) {
            latest.set(row.StockCode, row);
        }
    }

    logger.info(`GetStockDayLogForRpt rows=${rows.length} stocks=${latest.size}`);
    return Array.from(latest.values());
}

//#endregion

//#region StockNameList
export function GetStockNameList(): Promise<t_StockNameList[]> {
    return prisma.t_StockNameList.findMany()
}

export function GetStockNameByCode(sCode: string): any {

    return prisma.t_StockNameList.findUnique({ where: { StockCode: sCode } })

}

export function GetAllStockCode(): any {
    const res = prisma.t_StockNameList.findMany({ select: { StockCode: true } })
    return res;
}

//更新所有板块 股票名称
export async function UpdateAllCodeName() {
    let iBegin = 600000;
    let iEnd = 604000;
    UpdateCodeName(iBegin, iEnd, "sh");//沪指

    //更新沪创业
    iBegin = 688001;
    iEnd = 688999;
    UpdateCodeName(iBegin, iEnd, "sh");//沪科创板

    //更新深创业
    iBegin = 300001;
    iEnd = 301000;
    UpdateCodeName(iBegin, iEnd, "sz");//沪创业板

    //更新深
    iBegin = 1;
    iEnd = 3000;
    UpdateCodeName(iBegin, iEnd, "sz0");//深指
}


//scodeType= sz0
async function UpdateCodeName(iBegin: number, iEnd: number, sCodeType: string) {

    for (let i = iBegin; i < iEnd; i++) {
        let sCode: string = sCodeType == "sz0" ? GetSZCode(i) : sCodeType + i.toString();

        const mStock = await GetStockCurrent(sCode);


        if (mStock != null && mStock.stockcode != undefined) {
            const mStockCurrent = await GetStockNameByCode(sCode);
            // mStockCurrent
            if (mStockCurrent == null) {
                logger.info("addNew:" + sCode + "|" + mStock.stockname);
                const post = await prisma.t_StockNameList.create({
                    data: {
                        StockCode: sCode,
                        StockName: mStock.stockname,
                        LastUpdate: mStock.SearchTime
                    },
                })
            }
            else {
                if (mStockCurrent.StockName != mStock.stockname) {
                    logger.info("update!" + sCode + "|" + mStock.stockname)

                    const post = await prisma.t_StockNameList.update({
                        where: { StockCode: sCode },
                        data: {
                            StockName: mStock.stockname,
                            LastUpdate: mStock.SearchTime
                        },
                    })
                }
            }
        }
    }
}

function GetSZCode(i: number): string {
    let sCode = i.toString();
    while (sCode.length < 6) {
        sCode = "0" + sCode;
    }
    return "sz" + sCode;
}



//#endregion

//#region StockDayReport
export async function AddStockDayReport(mStockDayReport: t_StockDayReport) {

    try {
        const res = await prisma.t_StockDayReport.create({
            data: {
                StockCode: mStockDayReport.StockCode,
                ReportDay: mStockDayReport.ReportDay,
                TodayOpenPrice: mStockDayReport.TodayOpenPrice,
                TodayMaxPrice: mStockDayReport.TodayMaxPrice,
                TodayMinPrice: mStockDayReport.TodayMinPrice,
                TodayClosePrice: mStockDayReport.TodayClosePrice,
                Rate: mStockDayReport.Rate,
                RatePrice: mStockDayReport.RatePrice,
                Memo: mStockDayReport.Memo,
                TradingVol: mStockDayReport.TradingVol,
                TradingPrice: mStockDayReport.TradingPrice,
                TradingPriceAvg: mStockDayReport.TradingPriceAvg
            },
        })
        // logger.info(mStockDayReport.StockCode+"|"+mStockDayReport.ReportDay)
    } catch (error) {
        logger.info(mStockDayReport.StockCode + "|" + mStockDayReport.Rate);
        logger.info("error:" + error);
    }

}

export async function BulkStockDayLog(LStockDayLog: t_StockDayLog[]) {

    try {
        const res = await prisma.t_StockDayLog.createMany({ data: LStockDayLog }
        )
    } catch (error) {
        logger.info("error:" + error);
    }

}


export async function BulkStockDayReport(LStockDayReport: t_StockDayReport[]) {

    try {
        const res = await prisma.t_StockDayReport.createMany({ data: LStockDayReport }
        )
    } catch (error) {
        logger.info("error:" + error);
    }

}

export async function UpdateDayRpt(stockdayrpt: t_StockDayReport) {

    try {
        const res = await prisma.t_StockDayReport.update({
            where: {
                StockCode_ReportDay: {
                    StockCode: stockdayrpt.StockCode,
                    ReportDay: stockdayrpt.ReportDay,
                }

            },
            data: stockdayrpt
        })
    } catch (error) {
        logger.info("error:", stockdayrpt.StockCode, stockdayrpt.BB, stockdayrpt.WIDTH, error);
    }
}

export async function GetStockdayRptByCondition(endday: Date, stockcode: string, count: number): Promise<t_StockDayReport[]> {
    return prisma.t_StockDayReport.findMany({
        where: {
            StockCode: stockcode,
            ReportDay: { lte: dateOnly(endday) },
        },
        orderBy: { ReportDay: 'desc' },
        take: Math.max(1, Math.trunc(count)),
    });
}


export function GetStockDayReportList(): any {
    return prisma.t_StockDayReport.findMany()
}

//#region KLineStorage
export async function GetKLineData(stockCode: string, period: string, startDate: string, endDate: string): Promise<t_StockKLine[]> {
    const res = await prisma.t_StockKLine.findMany({
        where: {
            StockCode: stockCode,
            Period: period,
            TradeTime: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        },
        orderBy: { TradeTime: 'asc' }
    });
    return res;
}

export async function GetKLineDataMulti(stockCodes: string[], period: string, startDate: string, endDate: string): Promise<t_StockKLine[]> {
    const res = await prisma.t_StockKLine.findMany({
        where: {
            StockCode: { in: stockCodes },
            Period: period,
            TradeTime: {
                gte: new Date(startDate),
                lte: new Date(endDate)
            }
        },
        orderBy: { TradeTime: 'asc' }
    });
    return res;
}

export async function GetLatestKLine(stockCode: string, period: string, count: number): Promise<t_StockKLine[]> {
    const res = await prisma.t_StockKLine.findMany({
        where: {
            StockCode: stockCode,
            Period: period
        },
        orderBy: { TradeTime: 'desc' },
        take: count
    });
    return res;
}

export async function GetKLineDateRange(stockCode: string, period: string): Promise<{ min: Date, max: Date } | null> {
    const result = await prisma.t_StockKLine.aggregate({
        _min: { TradeTime: true },
        _max: { TradeTime: true },
        where: {
            StockCode: stockCode,
            Period: period
        }
    });
    const min: Date | null = result._min.TradeTime;
    const max: Date | null = result._max.TradeTime;
    if (!min || !max) {
        return null;
    }
    return { min, max };
}
//#endregion
