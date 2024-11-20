import { PrismaClient, t_StockNameList, t_StockDayReport, Prisma } from '@prisma/client'
import { GetStockCurrent2, Stock, GetStockCurrent, GetSinaStockByList } from './sinaStockInterface'
import { GetStockdayRptByCondition, UpdateDayRpt, GetAllStockCode } from './dbBll'

import { parse } from 'superagent';

async function main() {

    var beginday: Date = new Date();
    beginday.setHours(8)
    beginday.setMinutes(0)
    beginday.setSeconds(0)
    beginday.setMilliseconds(0)
    var endday: Date = new Date();
    endday.setHours(8)
    endday.setMinutes(0)
    endday.setSeconds(0)
    endday.setMilliseconds(0)
    endday.setDate(endday.getDate()+1);

    
    var LstockName = await GetAllStockCode()
    if (LstockName.length == 0) {
        return;
    }

    while (endday > beginday) {
        var ReportDay = beginday;
        // ReportDay.setHours(8);
        // console.log(ReportDay.toLocaleDateString());

        let LdayReport: Array<t_StockDayReport> = [];

        for (let i = 0; i < LstockName.length; i++) {
            const element = LstockName[i];
            var dayrptTemp = await GetStockdayRptByCondition(beginday, element.StockCode, 21);

            if (dayrptTemp.length == 0 || dayrptTemp.length < 20) {
                continue;
            }
            if (dayrptTemp[0].ReportDay < beginday) {
                continue;
            }

            var mDayRpt = dayrptTemp[0];
            if (Number(mDayRpt.TradingVol) == 0) {//过滤停牌
                continue;
            }
            dayrptTemp.sort(function (a, b) {
                var keyA = a.ReportDay,
                    keyB = b.ReportDay;
                // Compare the 2 dates
                if (keyA < keyB) return -1;
                if (keyA > keyB) return 1;
                return 0;
            });
            // console.log(dayrptTemp[0].ReportDay + "|" + dayrptTemp[dayrptTemp.length - 1].ReportDay)

            var boll = await bollCalc(dayrptTemp);
            var rsi = await rsiCalc(dayrptTemp);
            var memo: string = "布林:";
            if (Number(mDayRpt.TodayClosePrice) > boll.ma) { memo += "强势区" }
            if (Number(mDayRpt.TodayClosePrice) < boll.ma) { memo += "弱势区" }
            if (Number(mDayRpt.TodayMinPrice) < boll.down) { memo += "|穿透下线" }
            if (Number(mDayRpt.TodayMaxPrice) > boll.up) { memo += "|穿透上线" }

            var bb: number = (Number(mDayRpt.TodayClosePrice) - boll.down) / (boll.up - boll.down);
            bb = bb;

            memo += "||RSI:";
            memo += rsi.analysis;
            mDayRpt.RSI7 = new Prisma.Decimal(rsi.rsi7);
            mDayRpt.RSI14 = new Prisma.Decimal(rsi.rsi14);
            mDayRpt.MA = new Prisma.Decimal(boll.ma);
            mDayRpt.bollUP = new Prisma.Decimal(boll.up);
            mDayRpt.bollDown = new Prisma.Decimal(boll.down);
            mDayRpt.Rate = new Prisma.Decimal((Number(mDayRpt.RatePrice) / Number(mDayRpt.TodayMinPrice)).toFixed(4));
            mDayRpt.BB = new Prisma.Decimal(bb.toFixed(4));
            mDayRpt.WIDTH = new Prisma.Decimal(((boll.up - boll.down) / boll.ma).toFixed(2));
            mDayRpt.Memo = memo;

            UpdateDayRpt(mDayRpt)

        }

        beginday.setDate(beginday.getDate() + 1);
    }

    console.log(new Date().toString() + "DoTech 被调用,并完成");
}

async function bollCalc(dayrpts: t_StockDayReport[]): Promise<bolldata> {
    var mBollData = new bolldata();
    var dayrptsCopy = [...dayrpts];

    if (dayrpts.length == 0) {
        return mBollData;
    }
    if (dayrpts.length > 20) {
        dayrptsCopy = dayrptsCopy.slice(dayrptsCopy.length - 20, dayrptsCopy.length);
    }

    var sumClose = dayrptsCopy.reduce((c, R) => c + Number(R.TodayClosePrice), 0)
    mBollData.ma = Number((sumClose / dayrptsCopy.length).toFixed(2));
    var staTemp: number = 0;
    for (let index = 0; index < dayrptsCopy.length; index++) {
        const element = dayrptsCopy[index];
        staTemp += Math.pow(Number(element.TodayClosePrice) - mBollData.ma, 2);
    }
    mBollData.sta = Number(Math.sqrt(staTemp / (dayrptsCopy.length - 1)).toFixed(2))
    mBollData.up = Number((mBollData.ma + mBollData.sta * 2).toFixed(2));
    mBollData.down = Number((mBollData.ma - mBollData.sta * 2).toFixed(2));

    return mBollData;

}

async function rsiCalc(dayrpts: t_StockDayReport[]): Promise<rsidata> {
    var mRsiData = new rsidata();
    mRsiData.rsi7 = -1;
    mRsiData.rsi14 = -1;
    if (dayrpts.length == 0 || dayrpts.length < 7) {
        return mRsiData;
    }
    var dayrptsCopy = [...dayrpts];

    if (dayrptsCopy.length > 15) {
        dayrptsCopy = dayrptsCopy.slice(dayrptsCopy.length - 15, dayrptsCopy.length);
    }

    var upSum = 0;
    var upSum7 = 0;
    var downSum = 0;
    var downSum7 = 0;
    var iCount7 = 0;
    for (let index = 1; index < dayrptsCopy.length; index++) {
        const element = dayrptsCopy[index];
        var iTemp = Number(element.TodayClosePrice) - Number(dayrptsCopy[index - 1].TodayClosePrice);

        if (iTemp >= 0) {
            upSum += iTemp;
        } else {
            downSum += Math.abs(iTemp);
        }

        if (index >= (dayrptsCopy.length - 7)) {
            if (Number(element.TradingVol) == 0) {//报告期内有停牌
                return mRsiData;
            }
            if (iTemp >= 0) {
                upSum7 += iTemp;
            } else {
                downSum7 += Math.abs(iTemp);
            }
            iCount7++;
        }


        if (index == (dayrptsCopy.length - 1)) {
            mRsiData.up7avg = upSum7 / 7;
            mRsiData.down7avg = downSum7 / 7;
            mRsiData.relativestrength7 = mRsiData.up7avg / mRsiData.down7avg;
            mRsiData.rsi7 = Number((100 - 100 / (mRsiData.relativestrength7 + 1)).toFixed(2));

            if (dayrptsCopy.length > 14) {
                mRsiData.up14avg = upSum / 14;
                mRsiData.down14avg = downSum / 14;
                mRsiData.relativestrength14 = mRsiData.up14avg / mRsiData.down14avg;
                mRsiData.rsi14 = Number((100 - 100 / (mRsiData.relativestrength14 + 1)).toFixed(2));
            }

        }
    }
    console.log(iCount7 + "|" + dayrptsCopy[0].ReportDay);
    //  文字结论
    if (mRsiData.rsi14 == -1) {
        return mRsiData;
    }

    if (mRsiData.rsi7 < 20) { mRsiData.analysis = "RSI7 极弱，超卖" }
    if (mRsiData.rsi7 > 20 && mRsiData.rsi7 < 50) { mRsiData.analysis = "RSI7 弱区" }
    if (mRsiData.rsi7 > 50 && mRsiData.rsi7 < 80) { mRsiData.analysis = "RSI7 强区" }
    if (mRsiData.rsi7 > 80) { mRsiData.analysis = "RSI7 极强，超买" }


    if (mRsiData.rsi7 > mRsiData.rsi14) { mRsiData.analysis += "|多头市场" }
    if (mRsiData.rsi7 < mRsiData.rsi14) { mRsiData.analysis += "|空头市场" }

    return mRsiData;


}



class bolldata {
    sta!: number;
    up!: number;
    down!: number;
    ma!: number;
}

class rsidata {
    rsi7: number = -1;
    up7avg: number = -1;
    down7avg: number = -1;
    relativestrength7: number = -1;
    rsi14: number = -1;
    up14avg: number = -1;
    down14avg: number = -1;
    relativestrength14: number = -1;
    analysis: string = "";
}


main()
    .catch((e) => {
        throw e
    })
    .finally(async () => {
    })