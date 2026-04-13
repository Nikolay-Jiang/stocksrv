import argparse
import sys
import os
import time
from datetime import datetime

from akshare_fetcher import fetch_intraday_kline
from stock_code_utils import strip_prefix, get_stock_list, filter_active_stocks
from db_config import execute_many
from logger_config import get_logger

logger = get_logger('daily_collect')

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
    parser = argparse.ArgumentParser(description='Daily batch K-line collection')
    parser.add_argument('--date', type=str, default=None,
                       help='Target date (YYYY-MM-DD, default: today)')
    parser.add_argument('--stock', type=str, help='Single stock code (e.g., sh600519)')
    parser.add_argument('--periods', type=str, default='5m,15m,60m',
                       help='Comma-separated periods (5m,15m,60m)')
    return parser.parse_args()

def is_weekday(date_str):
    dt = datetime.strptime(date_str, '%Y-%m-%d')
    return dt.weekday() < 5

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

def log_failure(stock_code, period, date_str, error):
    log_dir = os.path.join(os.path.dirname(__file__), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    
    date_compact = date_str.replace('-', '')
    log_file = os.path.join(log_dir, f'daily_failed_{date_compact}.log')
    with open(log_file, 'a', encoding='utf-8') as f:
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        f.write(f"{timestamp} | {stock_code} | {period} | {date_str} | {error}\n")

def process_stock(stock, periods, date_str):
    stock_code = stock['StockCode']
    stock_name = stock.get('StockName', '')
    bare_code = strip_prefix(stock_code)
    ak_date = date_str.replace('-', '')
    
    success_count = 0
    fail_count = 0
    
    for period in periods:
        ak_period = PERIOD_MAP.get(period)
        if not ak_period:
            logger.warning(f"Invalid period: {period}, skipping")
            continue
        
        try:
            df = fetch_intraday_kline(bare_code, ak_period, ak_date, ak_date)
            if df.empty:
                logger.warning(f"No data returned for {stock_code} {period}")
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
                logger.info(f"Imported {len(params_list)} rows for {stock_code} {period}")
                success_count += 1
            else:
                logger.warning(f"No valid rows to import for {stock_code} {period}")
                
        except Exception as e:
            logger.error(f"Failed to import {stock_code} {period}: {e}")
            log_failure(stock_code, period, date_str, str(e))
            fail_count += 1
    
    return success_count, fail_count

def main():
    start_time = time.time()
    args = parse_args()
    
    date_str = args.date if args.date else datetime.now().strftime('%Y-%m-%d')
    
    if not is_weekday(date_str):
        logger.info(f"非交易日: {date_str}")
        print(f"非交易日: {date_str}")
        return 0
    
    periods = [p.strip() for p in args.periods.split(',')]
    valid_periods = [p for p in periods if p in PERIOD_MAP]
    if not valid_periods:
        logger.error("No valid periods specified")
        return 1
    
    stocks = get_stocks_to_process(args.stock)
    if not stocks:
        logger.error("No stocks to process")
        return 1
    
    logger.info(f"Starting daily collection for {len(stocks)} stock(s), date: {date_str}, periods: {', '.join(valid_periods)}")
    
    total_success = 0
    total_failed = 0
    
    for stock in stocks:
        success, fail = process_stock(stock, valid_periods, date_str)
        total_success += success
        total_failed += fail
    
    elapsed = time.time() - start_time
    summary = f"Collection complete. Success: {total_success}, Failed: {total_failed}, Time: {elapsed:.1f}s"
    logger.info(summary)
    print(summary)
    
    return 0

if __name__ == '__main__':
    sys.exit(main())