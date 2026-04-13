import os
import pymssql
from dotenv import load_dotenv

# Load .env from parent directory
load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), '..', '.env'))

def parse_connection_string():
    db_url = os.getenv('DATABASE_URL')
    if not db_url:
        raise ValueError("DATABASE_URL not found in .env")
    
    try:
        conn_part = db_url.replace('sqlserver://', '').strip().rstrip(';')
        segments = conn_part.split(';')
        
        host_port = segments[0].strip()
        if ':' in host_port:
            host, port_str = host_port.split(':', 1)
            port = int(port_str)
        else:
            host = host_port
            port = 1433
        
        kv = {}
        for seg in segments[1:]:
            seg = seg.strip()
            if '=' in seg:
                k, v = seg.split('=', 1)
                kv[k.strip().lower()] = v.strip()
        
        database = kv.get('initial catalog') or kv.get('database')
        user = kv.get('user') or kv.get('user id') or kv.get('uid')
        password = kv.get('password') or kv.get('pwd')
        
        if not database:
            raise ValueError("No database/initial catalog found in DATABASE_URL")
        if not user:
            raise ValueError("No user found in DATABASE_URL")
        if password is None:
            raise ValueError("No password found in DATABASE_URL")
        
        return {
            'server': host,
            'port': port,
            'user': user,
            'password': password,
            'database': database
        }
    except ValueError:
        raise
    except Exception as e:
        raise ValueError(f"Cannot parse DATABASE_URL: {e}")

def get_connection():
    """Get pymssql connection"""
    params = parse_connection_string()
    return pymssql.connect(**params)

def execute_many(sql, params_list, batch_size=1000):
    """Execute SQL with many parameter sets in batches"""
    conn = get_connection()
    cursor = conn.cursor()
    try:
        for i in range(0, len(params_list), batch_size):
            batch = params_list[i:i+batch_size]
            cursor.executemany(sql, batch)
            conn.commit()
    finally:
        cursor.close()
        conn.close()

def query(sql, params=None):
    """Execute query and return list of dicts"""
    conn = get_connection()
    cursor = conn.cursor(as_dict=True)
    try:
        cursor.execute(sql, params)
        return cursor.fetchall()
    finally:
        cursor.close()
        conn.close()
