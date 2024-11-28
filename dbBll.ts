import { Prisma, PrismaClient, t_StockDayLog, t_StockNameList, t_StockDayReport } from '@prisma/client'
// import { GetStockCurrent2, Stock, GetStockCurrent } from './sinaStockInterface'
import { Stock, GetStockCurrent } from './tencentStockInterface'



const prisma = new PrismaClient();

export function GetTradeList(): any {
    var res = prisma.t_TradeLog.findMany({ select: { KeyID: true } })
    return res;
}

//#region StockDayLog
export async function AddStockDayLog(Lstock: Stock[]) {

    let dTemp = new Date()
    let Lstockdaylog: Array<t_StockDayLog> = [];
    console.log("开始写入..." + dTemp.toString())
    for (let index = 0; index < Lstock.length; index++) {

        const element = Lstock[index];
        if (element.stockname.indexOf("退") >= 0) {//过滤已退市
            continue;
        }

        if (element.SearchTime.getMonth() < dTemp.getMonth()) {//停牌或已退市
            continue;
        }

        if (element.SearchTime.getDate() != dTemp.getDate()) {//停牌或已退市
            continue;
        }

        if (element.SearchTime.getHours() < dTemp.getHours()) {//判断停牌情况，9点会被记录一次，后续跳过
            continue;
        }

        element.SearchTime.setHours(element.SearchTime.getHours() + 8);//修正只存UTC 问题



        try {
            var mDayLog: t_StockDayLog = {
                StockCode: element.stockcode,
                SearchTime: element.SearchTime,
                CurrentPrice: new Prisma.Decimal(element.CurrentPrice.length > 7 ? "9999" : element.CurrentPrice),
                YesterdayClosingPrice: new Prisma.Decimal(element.YesterdayClosingPrice.length > 7 ? "9999" : element.YesterdayClosingPrice),
                TodayOpeningPrice: new Prisma.Decimal(element.TodayOpeningPrice.length > 7 ? "9999" : element.TodayOpeningPrice),
                TodayMinPrice: new Prisma.Decimal(element.TodayMinPrice.length > 7 ? "9999" : element.TodayMinPrice),
                TodayMaxPrice: new Prisma.Decimal(element.TodayMaxPrice.length > 7 ? "9999" : element.TodayMaxPrice),
                TradingVolume: element.TradingVolume,
                TradingPrice: element.TradingPrice,
                BidBuyPrice: new Prisma.Decimal(element.BidBuyPrice),
                BidSellPrice: new Prisma.Decimal(element.BidSellPrice),
                SellBuyRate: element.SellBuyRate,
                HighLowRate: null,
                HighLowPrice: null
            }
            Lstockdaylog[index] = mDayLog;
        } catch (error) {
            console.log("error:" + Lstock[index].stockcode + error)
        }

    }

    Lstockdaylog = Lstockdaylog.filter(res => { return res != undefined })

    if (Lstockdaylog.length == 0) {
        return;
    }

    console.log(Lstockdaylog.length);
    await BulkStockDayLog(Lstockdaylog);

}

export async function GetStockDayLogForRpt(dBegin: Date, dEnd: Date): Promise<t_StockDayLog[]> {

    dBegin = new Date(dBegin.getFullYear() + "-" + (dBegin.getMonth() + 1) + "-" + dBegin.getDate() + " " + "14:59:59");
    dEnd = new Date(dEnd.getFullYear() + "-" + (dEnd.getMonth() + 1) + "-" + dEnd.getDate() + " " + "00:00:00")

    //处理存取时只认utc 问题
    dBegin.setHours(dBegin.getHours() + 8);
    dEnd.setHours(dEnd.getHours() + 8);
    const sqlstr = `SELECT * FROM t_StockDayLog WHERE searchtime > = '${dBegin.getFullYear() + "-" + (dBegin.getMonth() + 1) + "-" + dBegin.getDate() + " " + "14:59:59"}' and searchtime < '${dEnd.getFullYear() + "-" + (dEnd.getMonth() + 1) + "-" + dEnd.getDate() + " " + "00:00:00"}';`;
    console.log(sqlstr);
    const result = await prisma.$queryRawUnsafe<t_StockDayLog[]>(sqlstr)
    return result;

    // // 格式化时间范围并处理 UTC 偏移问题
    // const startTime = addHours(new Date(`${format(dBegin, 'yyyy-MM-dd')} 14:59:59`), 8);
    // const endTime = addHours(new Date(`${format(dEnd, 'yyyy-MM-dd')} 00:00:00`), 8);



    // // 使用参数化查询，防止 SQL 注入
    // const sql = `
    //     SELECT * 
    //     FROM t_StockDayLog 
    //     WHERE searchtime >= $1 AND searchtime < $2;
    // `;
    // console.log(`Query: ${sql}, Parameters: [${startTime}, ${endTime}]`);

    // // 使用参数化查询
    // const result = await prisma.$queryRaw<t_StockDayLog[]>(sql, startTime, endTime);
    // return result;


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
    var res = prisma.t_StockNameList.findMany({ select: { StockCode: true } })
    return res;
}

//更新所有板块 股票名称
export async function UpdateAllCodeName() {
    var iBegin = 600000;
    var iEnd = 604000;
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

        var mStock = await GetStockCurrent(sCode);


        if (mStock != null && mStock.stockcode != undefined) {
            var mStockCurrent = await GetStockNameByCode(sCode);
            // mStockCurrent
            if (mStockCurrent == null) {
                console.log("addNew:" + sCode + "|" + mStock.stockname);
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
                    console.log("update!" + sCode + "|" + mStock.stockname)

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
        // console.log(mStockDayReport.StockCode+"|"+mStockDayReport.ReportDay)
    } catch (error) {
        console.log(mStockDayReport.StockCode + "|" + mStockDayReport.Rate);
        console.log("error:" + error);
    }

}

export async function BulkStockDayLog(LStockDayLog: t_StockDayLog[]) {

    try {
        const res = await prisma.t_StockDayLog.createMany({ data: LStockDayLog }
        )
    } catch (error) {
        console.log("error:" + error);
    }

}


export async function BulkStockDayReport(LStockDayReport: t_StockDayReport[]) {

    try {
        const res = await prisma.t_StockDayReport.createMany({ data: LStockDayReport }
        )
    } catch (error) {
        console.log("error:" + error);
    }

}

export async function BulkUpdateStockDayReport(LStockDayReport: t_StockDayReport[]) {

    try {
        const res = await prisma.t_StockDayReport.updateMany({ data: LStockDayReport }
        )
    } catch (error) {
        console.log("error:" + error);
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
        console.log("error:", stockdayrpt.StockCode, stockdayrpt.BB, stockdayrpt.WIDTH, error);
    }
}

export async function GetStockdayRptByCondition(endday: Date, stockcode: string, count: number): Promise<t_StockDayReport[]> {
    const sqlstr = `SELECT top ${count} * FROM t_StockDayReport WHERE ReportDay <= '${endday.getFullYear() + "-" + (endday.getMonth() + 1) + "-" + endday.getDate() + " " + "00:00:00"}' and stockcode='${stockcode}' order by ReportDay desc;`;
    // console.log(sqlstr);
    const result = await prisma.$queryRawUnsafe<t_StockDayReport[]>(sqlstr)
    return result;
}


export function GetStockDayReportList(): any {
    return prisma.t_StockDayReport.findMany()
}

//#endregion