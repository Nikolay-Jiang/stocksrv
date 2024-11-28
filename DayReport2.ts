import { t_StockDayReport, Prisma } from '@prisma/client'
import { GetAllStockCode, GetStockDayLogForRpt, BulkStockDayReport } from './dbBll'

//补报表功能，请修改开始和结束时间
async function main() {

    var beginday: Date = new Date("2021-12-12");
    var endday: Date = new Date("2022-01-01")

    while (endday > beginday) {
        var ReportDay = beginday;
        ReportDay.setHours(8);
        console.log(ReportDay.toLocaleDateString());

        await DoDayRpt(ReportDay);

        beginday.setDate(beginday.getDate() + 1);
    }

}

async function DoDayRpt(dReportDay: Date) {



    var dEnd = new Date(dReportDay.toUTCString());
    Object.assign(dEnd, dReportDay)
    dEnd.setDate(dEnd.getDate() + 1);

    // 1.GetDayLogListForRpt(RptDay,rptday+1)
    var Lstockdaylog = await GetStockDayLogForRpt(dReportDay, dEnd)

    // 2.if length==0 no data to report
    if (Lstockdaylog == null || Lstockdaylog == undefined || Lstockdaylog.length == 0) {
        console.log(new Date().toString() + "DoReport 被调用，但是没有数据可供生成");
        return
    }

    console.log("len:" + Lstockdaylog.length)

    // 3.do rpt
    var LstockName = await GetAllStockCode()
    if (LstockName.length == 0) {
        return;
    }
    let LdayReport: Array<t_StockDayReport> = [];

    for (let i = 0; i < LstockName.length; i++) {
        const element = LstockName[i];
        var mDayLogTemp = Lstockdaylog.find(myobj => myobj.StockCode == element.StockCode)

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

        if (mDayLogTemp.TradingVolume != undefined && mDayLogTemp.TradingPrice != undefined) {
            tradingvol = parseFloat(mDayLogTemp.TradingVolume);
            tradingprice = parseFloat(mDayLogTemp.TradingPrice);
            if (parseFloat(mDayLogTemp.TradingVolume) > 0) {
                tradingpriceAvg = tradingprice / tradingvol
            }
        }

        var mDayRpt: t_StockDayReport = {
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
        LdayReport[i] = mDayRpt;

        //await AddStockDayReport(mDayRpt);
    }

    await BulkStockDayReport(LdayReport);
    console.log(LdayReport.length);
    console.log(new Date().toString() + "DoReport 生成成功！");
    return;
}
main()
    .catch((e) => {
        throw e
    })
    .finally(async () => {
    })