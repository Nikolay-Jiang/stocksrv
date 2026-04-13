import argparse
import sys
import os
from datetime import datetime, timedelta
import pandas as pd

from akshare_fetcher import fetch_intraday_kline
from stock_code_utils import strip_prefix, get_stock_list, filter_active_stocks
from db_config import get_connection, execute_many, query
from logger_config import get_logger

logger = get_logger('historical_import')

PERIOD_MAP = {
    '5m': '5',
    '15m': '15', 
    '60m': '60'
}

UPSERT_SQL = """
MERGE INTO t_StockKLine AS target
USING (VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)) AS source
    (StockCode, Period, TradeTime, OpenPrice, ClosePrice, HighPrice, LowPrice,
     Volume, Turnover, Amplitude, ChangeRate, ChangeAmount, TurnoverRate)
ON (target.StockCode = source.StockCode AND target.Period = source.Period AND target.TradeTime = source.TradeTime)
WHEN MATCHED THEN UPDATE SET
    target.OpenPrice = source.OpenPrice,
    target.ClosePrice = source.ClosePrice,
    target.HighPrice = source.HighPrice,
    target.LowPrice = source.LowPrice,
    target.Volume = source.Volume,
    target.Turnover = source.Turnover,
    target.Amplitude = source.Amplitude,
    target.ChangeRate = source.ChangeRate,
    target.ChangeAmount = source.ChangeAmount,
    target.TurnoverRate = source.TurnoverRate
WHEN NOT MATCHED THEN INSERT
    (StockCode, Period, TradeTime, OpenPrice, ClosePrice, HighPrice, LowPrice,
     Volume, Turnover, Amplitude, ChangeRate, ChangeAmount, TurnoverRate)
VALUES
    (source.StockCode, source.Period, source.TradeTime, source.OpenPrice, source.ClosePrice, source.HighPrice, source.LowPrice,
     source.Volume, source.Turnover, source.Amplitude, source.ChangeRate, source.ChangeAmount, source.TurnoverRate);
"""

def parse_args():
    parser = argparse.ArgumentParser(description='Import historical K-line data')
    parser.add_argument('--stock', type=str, help='Single stock code (e.g., sh600519)')
    parser.add_argument('--periods', type=str, default='5m,15m,60m', 
                       help='Comma-separated periods (5m,15m,60m)')
    parser.add_argument('--days', type=int, default=365, help='Number of days to import')
    parser.add_argument('--resume', action='store_true', help='Resume from last imported date')
    return parser.parse_args()

def get_stocks_to_process(stock_code=None):
    if stock_code:
        return [{'StockCode': stock_code, 'StockName': ''}]
    
    stocks = get_stock_list()
    if not stocks:
        logger.error("No stocks found in database")
        return []
    
    active_stocks = filter_active_stocks(stocks)
    logger.info(f"Found {len(active_stocks)} active stocks")
    return active_stocks

def get_start_date(stock_code, period, resume_flag, days):
    if not resume_flag:
        return (datetime.now() - timedelta(days=days)).strftime('%Y%m%d')
    
    try:
        conn = get_connection()
        cursor = conn.cursor(as_dict=True)
        cursor.execute(
            "SELECT MAX(TradeTime) as max_time FROM t_StockKLine WHERE StockCode = %s AND Period = %s",
            (stock_code, period)
        )
        result = cursor.fetchone()
        cursor.close()
        conn.close()
        
        if result and result['max_time']:
            max_date = result['max_time']
            start_date = max_date.strftime('%Y%m%d')
            logger.info(f"Resuming {stock_code} {period} from {start_date}")
            return start_date
    except Exception as e:
        logger.warning(f"Failed to query max date for {stock_code} {period}: {e}")
    
    return (datetime.now() - timedelta(days=days)).strftime('%Y%m%d')

def process_stock(stock, periods, days, resume):
    stock_code = stock['StockCode']
    stock_name = stock.get('StockName', '')
    bare_code = strip_prefix(stock_code)
    
    logger.info(f"Processing {stock_code} ({stock_name})")
    
    for period in periods:
        ak_period = PERIOD_MAP.get(period)
        if not ak_period:
            logger.warning(f"Invalid period: {period}, skipping")
            continue
        
        start_date = get_start_date(stock_code, period, resume, days)
        end_date = datetime.now().strftime('%Y%m%d')
        
        logger.info(f"  Period {period}: {start_date} to {end_date}")
        
        try:
            df = fetch_intraday_kline(bare_code, ak_period, start_date, end_date)
            if df.empty:
                logger.warning(f"    No data returned for {stock_code} {period}")
                continue
            
            df['StockCode'] = stock_code
            df['Period'] = period
            
            params_list = []
            for _, row in df.iterrows():
                params = (
                    row['StockCode'],
                    row['Period'],
                    row['time'],
                    row.get('open'),
                    row.get('close'),
                    row.get('high'),
                    row.get('low'),
                    row.get('volume'),
                    row.get('turnover'),
                    row.get('amplitude'),
                    row.get('change_rate'),
                    row.get('change_amount'),
                    row.get('turnover_rate')
                )
                params_list.append(params)
            
            if params_list:
                execute_many(UPSERT_SQL, params_list, batch_size=1000)
                logger.info(f"    Imported {len(params_list)} rows for {stock_code} {period}")
            else:
                logger.warning(f"    No valid rows to import for {stock_code} {period}")
                
        except Exception as e:
            logger.error(f"    Failed to import {stock_code} {period}: {e}")
            log_failure(stock_code, period, start_date, end_date, str(e))

def log_failure(stock_code, period, start_date, end_date, error):
    log_dir = os.path.join(os.path.dirname(__file__), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    log_file = os.path.join(log_dir, 'import_failed.log')
    with open(log_file, 'a', encoding='utf-8') as f:
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        f.write(f"{timestamp} | {stock_code} | {period} | {start_date}-{end_date} | {error}\n")

def main():
    args = parse_args()
    
    periods = [p.strip() for p in args.periods.split(',')]
    valid_periods = [p for p in periods if p in PERIOD_MAP]
    if not valid_periods:
        logger.error("No valid periods specified")
        return 1
    
    stocks = get_stocks_to_process(args.stock)
    if not stocks:
        logger.error("No stocks to process")
        return 1
    
    logger.info(f"Starting import for {len(stocks)} stock(s), periods: {', '.join(valid_periods)}, days: {args.days}")
    
    for stock in stocks:
        process_stock(stock, valid_periods, args.days, args.resume)
    
    logger.info("Import completed")
    return 0

if __name__ == '__main__':
    sys.exit(main())