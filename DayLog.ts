//独立模块 每日拉取数据模块 
import logger from './logger';

// import { prisma, PrismaClient } from '@prisma/client'
import { GettencentStockByList } from './tencentStockInterface'
import { GetAllStockCode, AddStockDayLog, prisma } from './dbBll'

async function main() {

    runDayLog() 
  }

  async function runDayLog() {

    //判断当前时段是否需要执行任务
    if (isStopRunning()) {
      logger.info("不在任务时段")
      return;
    }
  
    //获取库中所有stockcode
    const Lcodes = await GetAllStockCode()//数据库获取所有股票代码
  
    // var Lstocks = await GetSinaStockByList(Lcodes);//接口获取所有数据
    let Lstocks = await GettencentStockByList(Lcodes);//接口获取所有数据
  
    logger.info(Lstocks.length)
  
    //写入数据库
    await AddStockDayLog(Lstocks)
  }
  
  function isStopRunning() {
  
    let dTime = new Date();
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
      await prisma.$disconnect()
    })
