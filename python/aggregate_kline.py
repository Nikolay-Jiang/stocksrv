import argparse
from datetime import datetime
import pandas as pd
from db_config import query, get_connection
from logger_config import get_logger

logger = get_logger('aggregate_kline')


def parse_args():
    parser = argparse.ArgumentParser(description='Aggregate daily K-line data into weekly or monthly K-lines')
    parser.add_argument('--period', type=str, required=True, choices=['1w', '1M'],
                        help='Target period: 1w (weekly) or 1M (monthly)')
    parser.add_argument('--start-date', type=str, help='Start date (YYYY-MM-DD)')
    parser.add_argument('--end-date', type=str, help='End date (YYYY-MM-DD)')
    parser.add_argument('--stock', type=str, help='Stock code to aggregate')
    return parser.parse_args()


def fetch_daily_kline(start_date=None, end_date=None, stock_code=None):
    """Fetch daily K-line data from t_StockKLine"""
    sql = "SELECT StockCode, TradeTime, OpenPrice, ClosePrice, HighPrice, LowPrice, Volume, Turnover FROM t_StockKLine WHERE Period = '1d'"
    params = []
    
    if start_date:
        sql += " AND TradeTime >= %s"
        params.append(start_date)
    if end_date:
        sql += " AND TradeTime <= %s"
        params.append(end_date)
    if stock_code:
        sql += " AND StockCode = %s"
        params.append(stock_code)
    
    sql += " ORDER BY StockCode, TradeTime"
    
    return query(sql, params if params else None)


def aggregate_weekly(df):
    """Aggregate daily K-line to weekly K-line using ISO week"""
    if df.empty:
        return pd.DataFrame()
    
    df = df.copy()
    df['TradeTime'] = pd.to_datetime(df['TradeTime'])
    
    iso = df['TradeTime'].dt.isocalendar()
    df['iso_year'] = iso['year']
    df['iso_week'] = iso['week']
    
    aggregated = df.groupby(['StockCode', 'iso_year', 'iso_week']).agg(
        TradeTime=('TradeTime', 'min'),
        OpenPrice=('OpenPrice', 'first'),
        ClosePrice=('ClosePrice', 'last'),
        HighPrice=('HighPrice', 'max'),
        LowPrice=('LowPrice', 'min'),
        Volume=('Volume', 'sum'),
        Turnover=('Turnover', 'sum')
    ).reset_index()
    
    aggregated = aggregated[['StockCode', 'TradeTime', 'OpenPrice', 'ClosePrice', 
                             'HighPrice', 'LowPrice', 'Volume', 'Turnover']]
    
    return aggregated


def aggregate_monthly(df):
    """Aggregate daily K-line to monthly K-line"""
    if df.empty:
        return pd.DataFrame()
    
    df = df.copy()
    df['TradeTime'] = pd.to_datetime(df['TradeTime'])
    df['year'] = df['TradeTime'].dt.year
    df['month'] = df['TradeTime'].dt.month
    
    aggregated = df.groupby(['StockCode', 'year', 'month']).agg(
        TradeTime=('TradeTime', 'min'),
        OpenPrice=('OpenPrice', 'first'),
        ClosePrice=('ClosePrice', 'last'),
        HighPrice=('HighPrice', 'max'),
        LowPrice=('LowPrice', 'min'),
        Volume=('Volume', 'sum'),
        Turnover=('Turnover', 'sum')
    ).reset_index()
    
    aggregated = aggregated[['StockCode', 'TradeTime', 'OpenPrice', 'ClosePrice',
                             'HighPrice', 'LowPrice', 'Volume', 'Turnover']]
    
    return aggregated


def prepare_upsert_data(df, period):
    """Prepare data for UPSERT"""
    data = []
    for _, row in df.iterrows():
        trade_time = row['TradeTime']
        if hasattr(trade_time, 'strftime'):
            trade_time_str = trade_time.strftime('%Y-%m-%d')
        else:
            trade_time_str = str(trade_time)[:10]
        
        data.append((
            row['StockCode'],
            period,
            trade_time_str,
            float(row['OpenPrice']) if pd.notna(row['OpenPrice']) else None,
            float(row['ClosePrice']) if pd.notna(row['ClosePrice']) else None,
            float(row['HighPrice']) if pd.notna(row['HighPrice']) else None,
            float(row['LowPrice']) if pd.notna(row['LowPrice']) else None,
            float(row['Volume']) if pd.notna(row['Volume']) else None,
            float(row['Turnover']) if pd.notna(row['Turnover']) else None,
            None,
            None,
            None,
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
            
            cursor.execute(update_sql, (open_price, close_price, high_price, low_price, 
                                         volume, turnover, amplitude, change_rate, 
                                         change_amount, turnover_rate, stock_code, period, trade_time))
            
            if cursor.rowcount == 0:
                cursor.execute(insert_sql, params)
        
        conn.commit()
    finally:
        cursor.close()
        conn.close()


def main():
    args = parse_args()
    
    logger.info(f"Starting aggregation: period={args.period}, start_date={args.start_date}, end_date={args.end_date}, stock={args.stock}")
    
    rows = fetch_daily_kline(args.start_date, args.end_date, args.stock)
    total = len(rows)
    logger.info(f"Fetched {total} daily K-line rows from t_StockKLine")
    
    if total == 0:
        logger.info("No data to aggregate")
        return
    
    df = pd.DataFrame(rows)
    
    if args.period == '1w':
        aggregated_df = aggregate_weekly(df)
        logger.info(f"Aggregated to {len(aggregated_df)} weekly K-line rows")
    else:
        aggregated_df = aggregate_monthly(df)
        logger.info(f"Aggregated to {len(aggregated_df)} monthly K-line rows")
    
    if aggregated_df.empty:
        logger.info("No aggregated data to upsert")
        return
    
    upsert_data = prepare_upsert_data(aggregated_df, args.period)
    
    batch_size = 1000
    upserted = 0
    for i in range(0, len(upsert_data), batch_size):
        batch = upsert_data[i:i+batch_size]
        upsert_kline_batch(batch)
        upserted += len(batch)
        logger.info(f"Upserted {upserted}/{len(upsert_data)} rows")
    
    logger.info(f"Completed: {len(upsert_data)} {args.period} K-line rows upserted to t_StockKLine")


if __name__ == '__main__':
    main()