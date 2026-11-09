import { t_StockDayReport, Prisma } from '@prisma/client'
import logger from './logger';
import { GetAllStockCode, GetStockDayLogForRpt, BulkStockDayReport, prisma } from './dbBll'
import { addDays, dateOnly } from './timeUtil';

//补报表功能，请修改开始和结束时间
async function main() {

    let beginday: Date = new Date(Date.UTC(2021, 11, 12));
    const endday: Date = new Date(Date.UTC(2022, 0, 1));

    while (endday > beginday) {
        const ReportDay = dateOnly(beginday);
        logger.info(ReportDay.toISOString().slice(0, 10));

        await DoDayRpt(ReportDay);

        beginday = addDays(beginday, 1);
    }

}

async function DoDayRpt(dReportDay: Date) {

    const dEnd = addDays(dReportDay, 1);

    // 1.GetDayLogListForRpt(RptDay,rptday+1)
    const Lstockdaylog = await GetStockDayLogForRpt(dReportDay, dEnd)

    // 2.if length==0 no data to report
    if (Lstockdaylog == null || Lstockdaylog == undefined || Lstockdaylog.length == 0) {
        logger.info(new Date().toString() + "DoReport 被调用，但是没有数据可供生成");
        return
    }

    logger.info("len:" + Lstockdaylog.length)

    // 3.do rpt
    const LstockName = await GetAllStockCode()
    if (LstockName.length == 0) {
        return;
    }
    let LdayReport: Array<t_StockDayReport> = [];

    for (let i = 0; i < LstockName.length; i++) {
        const element = LstockName[i];
        const mDayLogTemp = Lstockdaylog.find(myobj => myobj.StockCode == element.StockCode)

        if (mDayLogTemp == null || mDayLogTemp == undefined) {//无数据情况
            continue;
        }

        let fRatePricetemp: number = 0;
        let fRatetemp: number = 0;
        let memo: string | null = null;
        let tradingvol = 0;
        let tradingprice = 0;
        let tradingpriceAvg = 0;
        if (mDayLogTemp?.CurrentPrice != undefined && Number(mDayLogTemp.CurrentPrice) > 0) {
            if (mDayLogTemp.TodayMaxPrice != undefined && mDayLogTemp.TodayMinPrice != undefined && Number(mDayLogTemp.TodayMinPrice) > 0) {//过滤掉 停牌情况
                fRatePricetemp = parseFloat((Number(mDayLogTemp.TodayMaxPrice) - Number(mDayLogTemp.TodayMinPrice)).toFixed(2))
                fRatetemp = parseFloat((fRatePricetemp / Number(mDayLogTemp.TodayMinPrice)).toFixed(2))
            }

        }
        if (mDayLogTemp.TodayMaxPrice != undefined && Number(mDayLogTemp.TodayMaxPrice) == 0) {
            memo = "停牌";
        }

        if (mDayLogTemp.TradingVolume != null && mDayLogTemp.TradingPrice != null) {
            tradingvol = Number(mDayLogTemp.TradingVolume);
            tradingprice = Number(mDayLogTemp.TradingPrice);
            if (Number(mDayLogTemp.TradingVolume) > 0) {
                tradingpriceAvg = tradingprice / tradingvol
            }
        }

        const mDayRpt: t_StockDayReport = {
            StockCode: mDayLogTemp.StockCode,
            ReportDay: dReportDay,
            TodayOpenPrice: mDayLogTemp.TodayOpeningPrice,
            TodayMaxPrice: mDayLogTemp.TodayMaxPrice,
            TodayMinPrice: mDayLogTemp.TodayMinPrice,
            TodayClosePrice: mDayLogTemp.CurrentPrice,
            Rate: new Prisma.Decimal(fRatetemp),
            RatePrice: new Prisma.Decimal(fRatePricetemp),
            Memo: memo,
            TradingVol: new Prisma.Decimal(tradingvol),
            TradingPrice: new Prisma.Decimal(tradingprice),
            TradingPriceAvg: new Prisma.Decimal(tradingpriceAvg.toFixed(2)),
            MA: new Prisma.Decimal(-1),
            bollUP: new Prisma.Decimal(-1),
            bollDown: new Prisma.Decimal(-1),
            WIDTH: new Prisma.Decimal(-1),
            BB: new Prisma.Decimal(-1),
            RSI7: new Prisma.Decimal(-1),
            RSI14: new Prisma.Decimal(-1)

        }
        LdayReport.push(mDayRpt);

        //await AddStockDayReport(mDayRpt);
    }

    await BulkStockDayReport(LdayReport);
    logger.info(LdayReport.length);
    logger.info(new Date().toString() + "DoReport 生成成功！");
    return;
}
main()
    .catch((e) => {
        throw e
    })
    .finally(async () => {
      await prisma.$disconnect()
    })
