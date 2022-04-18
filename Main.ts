import { prisma, PrismaClient, t_StockNameList, t_StockDayReport, Prisma } from '@prisma/client'
import { GetStockCurrent2, Stock, GetStockCurrent, GetSinaStockByList } from './sinaStockInterface'
import { GetStockNameList, GetStockNameByCode, UpdateAllCodeName, GetAllStockCode, AddStockDayLog, GetStockDayLogForRpt, AddStockDayReport, GetStockDayReportList } from './dbBll'
import { parse } from 'superagent';


// const dataurl = "https://qt.gtimg.cn/q=sz002415";

async function main() {

  // UpdateAllCodeName();


  var ReportDay = new Date();
  ReportDay.setHours(8)
  ReportDay.setMinutes(0)
  ReportDay.setSeconds(0)
  // console.log(ReportDay.toLocaleString())

  // const res= await GetStockDayReportList();
  // console.log(res[0].StockCode)
  // var dEnd = new Date();
  // Object.assign(dEnd,ReportDay)
  // dEnd.setDate(dEnd.getDate()+1);

  // console.log(dEnd.toDateString()+"|" +ReportDay.toDateString());

}

main()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    //  await prisma.$disconnect()
  })