from db_config import get_connection

try:
    conn = get_connection()
    print("connected", conn)
    conn.close()
except Exception as e:
    print("ERR", e)
