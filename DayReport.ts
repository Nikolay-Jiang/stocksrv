import { t_StockDayReport, Prisma } from '@prisma/client'
import logger from './logger';
import { GetAllStockCode, GetStockDayLogForRpt, AddStockDayReport, prisma } from './dbBll'


async function main() {

  let ReportDay = new Date();
  ReportDay.setHours(8)
  ReportDay.setMinutes(0)
  ReportDay.setSeconds(0)
  ReportDay.setMilliseconds(0)
  DoDayRpt(ReportDay);
}

async function DoDayRpt(dReportDay: Date) {

  let dEnd = new Date();
  Object.assign(dEnd, dReportDay)
  dEnd.setDate(dEnd.getDate() + 1);

  // 1.GetDayLogListForRpt(RptDay,rptday+1)
  let Lstockdaylog = await GetStockDayLogForRpt(dReportDay, dEnd)

  // 2.if length==0 no data to report
  if (Lstockdaylog.length == 0) {
    logger.info(new Date().toString() + "DoReport 被调用，但是没有数据可供生成");
    return
  }

  logger.info("len:" + Lstockdaylog.length)

  // 3.do rpt
  let LstockName = await GetAllStockCode()
  if (LstockName.length == 0) {
    return;
  }

    for (let i = 0; i < LstockName.length; i++) {
        const element = LstockName[i];
        let mDayLogTemp = Lstockdaylog.find(myobj => myobj.StockCode == element.StockCode)

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
        if (mDayLogTemp.StockCode.includes("sh688")) {//科创版的交易量精确度个位数,需要修正
          tradingprice=tradingprice*100;
        }
        tradingpriceAvg = tradingprice / tradingvol
      }
    }

    let mDayRpt: t_StockDayReport = {
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

    await AddStockDayReport(mDayRpt);
  }

  logger.info(new Date().toString() + "DoReport 生成成功！");

}
main()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
