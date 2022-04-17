import { Prisma, PrismaClient, t_StockNameList } from '@prisma/client'
import { GetStockCurrent2, Stock, GetStockCurrent } from './sinaStockInterface'
const prisma = new PrismaClient();
// export const testStr='lalalal'

export function GetTradeList(): any {
    var res = prisma.t_TradeLog.findMany({ select: { KeyID: true } })
    // var res ='tesinfo'
    return res;
}

//#region 
export async function AddStockDayLog(Lstock: Stock[]) {

    let dTemp = new Date("2022-4-15 9:36:00")
    console.log("开始写入..."+dTemp.toString())

    for (let index = 0; index < Lstock.length; index++) {

        const element = Lstock[index];
        if (element.stockname.indexOf("退")>=0) {//过滤已退市
            continue;
        }

        element.SearchTime.setHours(element.SearchTime.getHours()+8);//修正只存UTC 问题

        if (element.SearchTime.getHours() < dTemp.getHours()) {//判断停牌情况，9点会被记录一次，后续跳过
            continue;
        }

        try {
            let daylog = await prisma.t_StockDayLog.create({//写入数据
                data: {
                    StockCode: element.stockcode,
                    SearchTime: element.SearchTime,
                    CurrentPrice: element.CurrentPrice,
                    YesterdayClosingPrice: element.YesterdayClosingPrice,
                    TodayOpeningPrice: element.TodayOpeningPrice,
                    TodayMinPrice: element.TodayMinPrice,
                    TodayMaxPrice: element.TodayMaxPrice,
                    TradingVolume: element.TradingVolume,
                    TradingPrice: element.TradingPrice,
                    BidBuyPrice: element.BidBuyPrice,
                    BidSellPrice: element.BidSellPrice,
                    SellBuyRate: element.SellBuyRate,
                },
            })
        } catch (error) {
            console.log("error:"+Lstock[index].stockcode+error)
        }
        
    }
}


//#endregion

//#region StockNameList
export function GetStockNameList(): any {
    return prisma.t_StockNameList.findMany()
}

export function GetStockNameByCode(sCode: string): any {

    return prisma.t_StockNameList.findUnique({ where: { StockCode: sCode } })

}

export function GetAllStockCode(): any {
    var res = prisma.t_StockNameList.findMany({ select: { StockCode: true } })
    return res;
}

//更新所有板块 股票名称
export async function UpdateAllCodeName() {
    var iBegin = 600000;
    var iEnd = 604000;
    UpdateCodeName(iBegin, iEnd, "sh");//沪指

    //更新沪创业
    iBegin = 688001;
    iEnd = 688999;
    UpdateCodeName(iBegin, iEnd, "sh");//沪科创板

    //更新深创业
    iBegin = 300001;
    iEnd = 301000;
    UpdateCodeName(iBegin, iEnd, "sz");//沪创业板

    //更新深
    iBegin = 1;
    iEnd = 3000;
    UpdateCodeName(iBegin, iEnd, "sz0");//深指
}


//scodeType= sz0
async function UpdateCodeName(iBegin: number, iEnd: number, sCodeType: string) {

    for (let i = iBegin; i < iEnd; i++) {
        let sCode: string = sCodeType == "sz0" ? GetSZCode(i) : sCodeType + i.toString();

        var mStock = await GetStockCurrent(sCode);


        if (mStock != null && mStock.stockcode != undefined) {
            var mStockCurrent = await GetStockNameByCode(sCode);
            // mStockCurrent
            if (mStockCurrent == null) {
                console.log("addNew:" + sCode + "|" + mStock.stockname);
                const post = await prisma.t_StockNameList.create({
                    data: {
                        StockCode: sCode,
                        StockName: mStock.stockname,
                        LastUpdate: mStock.SearchTime
                    },
                })
            }
            else {
                if (mStockCurrent.StockName != mStock.stockname) {
                    console.log("update!" + sCode + "|" + mStock.stockname)

                    const post = await prisma.t_StockNameList.update({
                        where: { StockCode: sCode },
                        data: {
                            StockName: mStock.stockname,
                            LastUpdate: mStock.SearchTime
                        },
                    })
                }
            }
        }
    }
}

function GetSZCode(i: number): string {
    let sCode = i.toString();
    while (sCode.length < 6) {
        sCode = "0" + sCode;
    }
    return "sz" + sCode;
}



//#endregion
