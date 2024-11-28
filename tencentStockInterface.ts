import { resolveTxt } from 'dns';
import { resolve } from 'path';
import superagent, { parse } from 'superagent';
import { Prisma, PrismaClient, t_StockNameList } from '@prisma/client'

// const dataurl = "https://qt.gtimg.cn/q=sz002415";
const dataurl = "https://qt.gtimg.cn/q=";
let TempWebData = '';

///单个股票查询接口
export function GetStockCurrent(stockcode: string): Promise<Stock> {

    if (stockcode.length > 8) {
        throw new Error("股票代码异常！");
    }


    return GetWebData(stockcode).then((result: string) => {

        // console.log(result);
        var mStock = Parse(result);
        return mStock;
    });

    // return mStock;//无数据
}

///多个股票接口查询 用‘,’ 分割
export function GetStockCurrent2(stockcodes: string): Promise<Stock[]> {

    if (stockcodes.length < 8) {
        throw new Error("股票代码异常！");
    }

    return GetWebData(stockcodes).then((result: string) => {

        var ArrayInfo: string[] = result.split(';');

        var Lstock: Array<Stock> = [];
        var iIndex = 0;
        // console.log(result);
        ArrayInfo.forEach(element => {
            var mStock = Parse(element);
            if (mStock.stockcode == undefined) {
                return;
            }
            Lstock[iIndex] = mStock;
            iIndex++;
        });

        return Lstock;
    });

}

export async function GettencentStockByList(lstockcode: t_StockNameList[]): Promise<Stock[]> {

    var Lstock: Array<Stock> = [];

    if (lstockcode.length < 1) {
        return Lstock
    }

    let iCount = 1;
    let strCodes = "";

    for (let index = 0; index < lstockcode.length; index++) {

        strCodes = strCodes + "," + lstockcode[index].StockCode;
        const element = lstockcode[index];
        iCount++;
        if (iCount == 20) { //一次读取20条
            var res = await GetStockCurrent2(strCodes)
            Lstock = Lstock.concat(res);

            //console.log("count" + Lstock.length)

            strCodes = "";
            iCount = 0;
            continue;
        }
    }

    if (strCodes != "") {//处理不足20条的情况
        var res = await GetStockCurrent2(strCodes)
        Lstock = Lstock.concat(res);

        // console.log("count" + Lstock.length)

        strCodes = "";
        iCount = 0;
    }


    return Lstock

}

function Parse(orginText: string): Stock {

    // v_sz002415="51~海康威视~002415~30.02~29.59~29.51~280959~167335~113623~30.01~730~30.00~3043~29.99~243~29.98~504~29.97~147~30.02~518~30.03~273~30.04~69~30.05~254~30.06~72~~20241127161500~0.43~1.45~30.02~29.45~30.02/280959/837838461~280959~83784~0.31~20.74~~30.02~29.45~1.93~2733.62~2771.81~3.61~32.55~26.63~0.99~3481~29.82~25.64~19.65~~~1.05~83783.8461~0.0000~0~ ~GP-A~-11.24~-3.47~3.03~17.39~11.74~35.90~24.71~-7.40~0.03~13.80~9105998839~9233198326~59.47~-13.69~9105998839~~~-12.68~0.07~~CNY~0~~30.09~-312"; 
    var mStock = new Stock();
    try {
        // console.log(orginText)
        let iStart = orginText.indexOf('"') + 1;
        let iEnd = orginText.indexOf('"', iStart);

        if (iEnd <= iStart) { //无数据
            return new Stock();
        }

        var sInput = orginText.substring(iStart, iEnd);
        var sTemp: string[] = sInput.split('~');

        if (sTemp.length < 32) {//数据不足或异常
            return new Stock();
        }

        mStock.stockname = sTemp[1];
        mStock.stockcode = ParseStockCode(orginText);
        
        mStock.CurrentPrice = sTemp[3];
        mStock.YesterdayClosingPrice = sTemp[4];
        mStock.TodayOpeningPrice = sTemp[5];
        mStock.BidBuyPrice = sTemp[9];
        mStock.BidSellPrice = sTemp[19];
        mStock.TodayMaxPrice = sTemp[33];
        mStock.TodayMinPrice = sTemp[34];
        

        mStock.TradingVolume = (parseFloat(sTemp[36])).toString();
        mStock.TradingPrice = (parseFloat(sTemp[37]) * 100).toString();
        mStock.BuyTop5 = [];
        mStock.SellTop5 = [];

        //计算buysellrate
        var iIndex = 10;
        var iBuyTotal = 0;
        var iSelltotal = 0;
        for (let index = 0; index < 5; index++) {
            mStock.BuyTop5[index] = sTemp[iIndex + 1] + "/" + sTemp[iIndex];//买入价格/买入量
            iBuyTotal += parseInt(sTemp[iIndex]);
            iIndex += 2
        }

        for (let index = 0; index < 5; index++) {
            mStock.SellTop5[index] = sTemp[iIndex + 1] + "/" + sTemp[iIndex];
            iSelltotal += parseInt(sTemp[iIndex]);
            iIndex += 2
        }

        // console.log("lala:"+iBuyTotal+"&"+iSelltotal);

        mStock.SellBuyRate = ((iBuyTotal - iSelltotal) / (iBuyTotal + iSelltotal) * 100).toFixed(2).toString() + "%";
        mStock.SearchTime = convertToDate(sTemp[30]);

        return mStock;


    } catch (error) {
        console.log(error);
    }


    return mStock;
}


const convertToDate = (input: string): Date => {
    // 验证输入是否为有效的14位字符串
    if (!/^\d{14}$/.test(input)) {
      throw new Error("输入字符串格式不正确，应为14位数字");
    }
  
    // 提取年月日时分秒
    const year = parseInt(input.slice(0, 4), 10);
    const month = parseInt(input.slice(4, 6), 10) - 1; // 月份从0开始
    const day = parseInt(input.slice(6, 8), 10);
    const hour = parseInt(input.slice(8, 10), 10);
    const minute = parseInt(input.slice(10, 12), 10);
    const second = parseInt(input.slice(12, 14), 10);
  
    // 创建并返回日期对象
    return new Date(year, month, day, hour, minute, second);
  };

function ParseStockCode(orginText: string): string {

    var ArrayInfo: string[] = orginText.split('=');
    var iStart = ArrayInfo[0].indexOf("v_");
    var sResult: string = ArrayInfo[0].substring(iStart + 2);
    return sResult.trim();
}


async function GetWebData(stockcode: string): Promise<string> {

    const charset = require('superagent-charset');
    const Throttle = require('superagent-throttle')
    let throttle = new Throttle({
        active: true,     // set false to pause queue
        rate: 5,          // how many requests can be sent every `ratePer`
        ratePer: 100,   // number of ms in which `rate` requests may be sent
        concurrent: 2     // how many requests can be sent concurrently
    })

    const superagent = charset(require('superagent'));
    const courseHtml = await superagent.get(dataurl + stockcode).charset('gbk')
        // .set('Referer', 'https://finance.sina.com.cn/')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/100.0.4896.88 Safari/537.36')
        .set('Accept-Language', 'zh-CN,zh;q=0.9,en;q=0.8')
        .set('Content-Type', ' application/javascript; charset=GB18030')
        .use(throttle.plugin())
        .buffer(true)

        ;

    var res = courseHtml.text;

    //console.log(courseHtml.charset);
    return res;

}

export class Stock {
    stockcode!: string;
    stockname!: string;

    SearchTime: Date = new Date();
    CurrentPrice!: string;
    YesterdayClosingPrice!: string;
    TodayOpeningPrice!: string;
    HighLowRate!: string;
    TodayMinPrice!: string;
    TodayMaxPrice!: string;
    HighLowPrice!: string;
    TradingVolume!: string;
    TradingPrice!: string;
    BidBuyPrice!: string;
    BidSellPrice!: string;
    BuyTop5!: string[];
    SellTop5!: string[];
    SellBuyRate!: string;

}