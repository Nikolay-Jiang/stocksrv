import argparse
from datetime import datetime
from db_config import query, get_connection
from logger_config import get_logger

logger = get_logger('sync_daily_kline')

def parse_args():
    parser = argparse.ArgumentParser(description='Sync daily K-line data from t_StockDayReport to t_StockKLine')
    parser.add_argument('--start-date', type=str, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='End date (YYYY-MM-DD)')
    parser.add_argument('--stock', type=str, help='Stock code to sync')
    return parser.parse_args()

def fetch_source_data(start_date=None, end_date=None, stock_code=None):
    sql = "SELECT StockCode, ReportDay, TodayOpenPrice, TodayClosePrice, TodayMaxPrice, TodayMinPrice, TradingVol, TradingPrice, Rate, RatePrice FROM t_StockDayReport WHERE 1=1"
    params = []
    
    if start_date:
        sql += " AND ReportDay >= %s"
        params.append(start_date)
    if end_date:
        sql += " AND ReportDay <= %s"
        params.append(end_date)
    if stock_code:
        sql += " AND StockCode = %s"
        params.append(stock_code)
    
    sql += " ORDER BY ReportDay, StockCode"
    
    return query(sql, params if params else None)

def prepare_kline_data(rows):
    data = []
    for row in rows:
        data.append((
            row['StockCode'],
            '1d',
            row['ReportDay'],
            row['TodayOpenPrice'],
            row['TodayClosePrice'],
            row['TodayMaxPrice'],
            row['TodayMinPrice'],
            row['TradingVol'],
            row['TradingPrice'],
            None,
            row['Rate'],
            row['RatePrice'],
            None
        ))
    return data

def upsert_kline_batch(batch):
    conn = get_connection()
    cursor = conn.cursor()
    try:
        update_sql = """
        UPDATE t_StockKLine
        SET OpenPrice = %s, ClosePrice = %s, HighPrice = %s, LowPrice = %s,
            Volume = %s, Turnover = %s, Amplitude = %s, ChangeRate = %s,
            ChangeAmount = %s, TurnoverRate = %s
        WHERE StockCode = %s AND Period = %s AND TradeTime = %s
        """
        
        insert_sql = """
        INSERT INTO t_StockKLine
        (StockCode, Period, TradeTime, OpenPrice, ClosePrice, HighPrice, LowPrice,
         Volume, Turnover, Amplitude, ChangeRate, ChangeAmount, TurnoverRate)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        
        for params in batch:
            stock_code, period, trade_time, open_price, close_price, high_price, low_price, volume, turnover, amplitude, change_rate, change_amount, turnover_rate = params
            
            cursor.execute(update_sql, (open_price, close_price, high_price, low_price, volume, turnover, amplitude, change_rate, change_amount, turnover_rate, stock_code, period, trade_time))
            
            if cursor.rowcount == 0:
                cursor.execute(insert_sql, params)
        
        conn.commit()
    finally:
        cursor.close()
        conn.close()

def main():
    args = parse_args()
    
    logger.info(f"Starting sync: start_date={args.start_date}, end_date={args.end_date}, stock={args.stock}")
    
    rows = fetch_source_data(args.start_date, args.end_date, args.stock)
    total = len(rows)
    logger.info(f"Fetched {total} rows from t_StockDayReport")
    
    if total == 0:
        logger.info("No data to sync")
        return
    
    kline_data = prepare_kline_data(rows)
    
    batch_size = 1000
    synced = 0
    for i in range(0, len(kline_data), batch_size):
        batch = kline_data[i:i+batch_size]
        upsert_kline_batch(batch)
        synced += len(batch)
        logger.info(f"Synced {synced}/{total} rows")
    
    logger.info(f"Completed: {total} rows synced to t_StockKLine")

if __name__ == '__main__':
    main()