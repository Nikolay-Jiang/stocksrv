//独立模块 每日拉取数据模块 

// import { prisma, PrismaClient } from '@prisma/client'
import { GetSinaStockByList } from './sinaStockInterface'
import { GetAllStockCode, AddStockDayLog } from './dbBll'

async function main() {

    runDayLog() 
  }

  async function runDayLog() {

    //判断当前时段是否需要执行任务
    if (isStopRunning()) {
      console.log("不在任务时段")
      return;
    }
  
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
    if (dTime.getDay() > 5 || dTime.getDay()<1) {//周六周日不需要运行
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
      
    })