"""Stock code utilities for AKShare integration"""
from db_config import get_connection, query

def strip_prefix(code: str) -> str:
    """Remove sh/sz prefix: 'sh600519' -> '600519', 'sz000001' -> '000001'"""
    if code.startswith('sh') or code.startswith('sz'):
        return code[2:]
    return code

def add_prefix(code: str) -> str:
    """Add sh/sz prefix based on code pattern:
    - 6开头 = sh (沪指/科创板)
    - 0/3开头 = sz (深指/创业板)
    """
    if code.startswith('6'):
        return f'sh{code}'
    elif code.startswith('0') or code.startswith('3'):
        return f'sz{code}'
    else:
        # Unknown pattern, return as-is
        return code

def get_stock_list(conn=None):
    """Get all stocks from t_StockNameList"""
    should_close = False
    if conn is None:
        try:
            conn = get_connection()
            should_close = True
        except Exception:
            # Fallback when DB is not configured in the environment
            return []
    
    try:
        cursor = conn.cursor(as_dict=True)
        cursor.execute("SELECT StockCode, StockName FROM t_StockNameList")
        stocks = cursor.fetchall()
        cursor.close()
        return stocks
    finally:
        if should_close:
            try:
                conn.close()
            except Exception:
                pass

def filter_active_stocks(stocks: list) -> list:
    """Filter out delisted stocks (name contains '退')"""
    return [s for s in stocks if '退' not in s.get('StockName', '')]

def is_delisted(stock_name: str) -> bool:
    """Check if stock is delisted"""
    return '退' in stock_name
