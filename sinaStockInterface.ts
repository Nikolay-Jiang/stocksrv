import { resolveTxt } from 'dns';
import { resolve } from 'path';
import superagent, { parse } from 'superagent';
import { Prisma, prisma, PrismaClient, t_StockNameList } from '@prisma/client'

const dataurl = "http://hq.sinajs.cn/list=";
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

export async function GetSinaStockByList(lstockcode: t_StockNameList[]): Promise<Stock[]> {

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

    // var hq_str_sh600066 = "宇通客车,9.27,9.35,9.76,9.80,9.27,9.77,9.78,4567858,44306952,3100,9.77,1200,9.76,20500,9.75,1400,9.74,15300,9.73,10030,9.78,28093,9.79,156827,9.80,2800,9.81,6400,9.82,2009-01-09,15:03:32";
    var mStock = new Stock();
    try {
        // console.log(orginText)
        let iStart = orginText.indexOf('"') + 1;
        let iEnd = orginText.indexOf('"', iStart);

        if (iEnd <= iStart) { //无数据
            return new Stock();
        }

        var sInput = orginText.substring(iStart, iEnd);
        var sTemp: string[] = sInput.split(',');

        if (sTemp.length < 32) {//数据不足或异常
            return new Stock();
        }

        mStock.stockname = sTemp[0];
        mStock.stockcode = ParseStockCode(orginText);
        mStock.TodayOpeningPrice = sTemp[1];

        mStock.YesterdayClosingPrice = sTemp[2];
        mStock.CurrentPrice = sTemp[3];
        mStock.TodayMaxPrice = sTemp[4];
        mStock.TodayMinPrice = sTemp[5];
        mStock.BidBuyPrice = sTemp[6];
        mStock.BidSellPrice = sTemp[7];
        mStock.TradingVolume = (parseFloat(sTemp[8]) / 100).toString();
        mStock.TradingPrice = (parseFloat(sTemp[9]) / 100).toString();
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

        mStock.SearchTime = new Date(sTemp[30] + " " + sTemp[31]);

        return mStock;


    } catch (error) {
        console.log(error);
    }


    return mStock;
}

function ParseStockCode(orginText: string): string {

    var ArrayInfo: string[] = orginText.split('=');
    var iStart = ArrayInfo[0].indexOf("hq_str_");
    var sResult: string = ArrayInfo[0].substring(iStart + 7);
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
        .set('Referer', 'https://finance.sina.com.cn/')
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