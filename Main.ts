import { prisma, PrismaClient, t_StockNameList } from '@prisma/client'
import { GetStockCurrent2, Stock, GetStockCurrent, GetSinaStockByList } from './sinaStockInterface'
import { GetStockNameList, GetStockNameByCode, UpdateAllCodeName, GetAllStockCode, AddStockDayLog } from './dbBll'
import { Console } from 'console';
import { formatISO } from "date-fns";


// const dataurl = "https://qt.gtimg.cn/q=sz002415";

async function main() {

  // UpdateAllCodeName();
  // var mStock =await GetStockNameByCode('sz002415');

  // console.log(mStock.StockName);
  // var res = await GetStockCurrent2('sz002415,sh600741')
  // var res : t_StockNameList[]=await GetAllStockCode()

  // var res = await GetStockNameByCode("sh600741")

  // res.LastUpdate.setHours(res.LastUpdate.getHours() - 8);
  // console.log(res.LastUpdate.toString());

  // var res ="TestInfo";
  // console.log(res.indexOf("y"))
  runDayLog()

}


async function runDayLog() {

  //判断当前时段是否需要执行任务
  // if (isStopRunning()) {
  //   // console.log("不在任务时段")
  //   return;
  // }

  //获取库中所有stockcode
  var Lcodes = await GetAllStockCode()//数据库获取所有股票代码

  var Lstocks = await GetSinaStockByList(Lcodes);//接口获取所有数据

  console.log(Lstocks.length)

  //写入数据库
  await AddStockDayLog(Lstocks)
}

function isStopRunning() {

  let dTime = new Date();
  // console.log('timestamp: ' + dTime.getHours());
  // console.log('timestamp: ' + dTime.getDay());
  if (dTime.getDay() > 5) {//周六周日不需要运行
    return true;
  }

  if (dTime.getHours() < 9 || dTime.getHours() > 16) {//小于9点 超过16点的情况
    return true;
  }

  if (dTime.getHours() > 11 && dTime.getHours() <= 11) {//中午 11:30-13:00
    return true;
  }

  if (dTime.getHours() == 11) {
    if (dTime.getMinutes() > 30) {
      return true
    }
  }

  if (dTime.getHours() == 9 && dTime.getMinutes() < 31) {//9:30 开盘前
    return true
  }

  if (dTime.getHours() == 15 && dTime.getMinutes() > 10) {//15:10 收盘后
    return true
  }

  return false;
}

main()
  .catch((e) => {
    throw e
  })
  .finally(async () => {
    //  await prisma.$disconnect()
  })