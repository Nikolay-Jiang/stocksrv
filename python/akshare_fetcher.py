import akshare as ak
import pandas as pd
import time
from tenacity import retry, stop_after_attempt, wait_exponential
from logger_config import get_logger

logger = get_logger('akshare_fetcher')

COLUMN_MAP = {
    '时间': 'time', '日期': 'time',
    '开盘': 'open', '收盘': 'close',
    '最高': 'high', '最低': 'low',
    '成交量': 'volume', '成交额': 'turnover',
    '振幅': 'amplitude', '涨跌幅': 'change_rate',
    '涨跌额': 'change_amount', '换手率': 'turnover_rate',
    '股票代码': 'stock_code'
}

TARGET_COLUMNS = {'time', 'open', 'close', 'high', 'low', 'volume', 'turnover', 
                  'amplitude', 'change_rate', 'change_amount', 'turnover_rate', 'stock_code'}

def _apply_column_mapping(df):
    if df is None or df.empty:
        return df
    df = df.rename(columns=COLUMN_MAP)
    existing_columns = set(df.columns)
    columns_to_keep = existing_columns.intersection(TARGET_COLUMNS)
    return df[list(columns_to_keep)]

def _validate_data(df):
    if df is None or df.empty:
        return df
    initial_count = len(df)
    invalid_rows = []
    for idx, row in df.iterrows():
        if 'high' in df.columns and 'low' in df.columns:
            if row['high'] < row['low']:
                invalid_rows.append(idx)
                continue
        if 'volume' in df.columns:
            if row['volume'] < 0:
                invalid_rows.append(idx)
    if invalid_rows:
        logger.warning(f"Dropping {len(invalid_rows)} invalid rows where high < low or volume < 0")
        df = df.drop(invalid_rows)
    return df

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=30))
def fetch_intraday_kline(symbol, period, start_date, end_date, adjust='qfq'):
    logger.info(f"Fetching intraday K-line: {symbol}, period={period}, {start_date} to {end_date}")
    df = ak.stock_zh_a_hist_min_em(symbol=symbol, start_date=start_date, 
                                   end_date=end_date, period=period, adjust=adjust)
    time.sleep(1.5)
    if df is None or df.empty:
        logger.warning(f"No data returned for {symbol} period={period}")
        return pd.DataFrame()
    df = _apply_column_mapping(df)
    df = _validate_data(df)
    logger.info(f"Fetched {len(df)} rows for {symbol} period={period}")
    return df

@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=2, max=30))
def fetch_daily_kline(symbol, period, start_date, end_date, adjust='qfq'):
    logger.info(f"Fetching daily K-line: {symbol}, period={period}, {start_date} to {end_date}")
    df = ak.stock_zh_a_hist(symbol=symbol, period=period, start_date=start_date, 
                            end_date=end_date, adjust=adjust)
    time.sleep(1.5)
    if df is None or df.empty:
        logger.warning(f"No data returned for {symbol} period={period}")
        return pd.DataFrame()
    df = _apply_column_mapping(df)
    df = _validate_data(df)
    logger.info(f"Fetched {len(df)} rows for {symbol} period={period}")
    return df