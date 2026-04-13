import sys
print("py ok", sys.version)
try:
  import akshare, pymssql, pandas, tenacity, dotenv
  print("deps ok")
except Exception as e:
  print("deps fail:", type(e).__name__, e)
