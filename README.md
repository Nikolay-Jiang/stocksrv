# stocksrv

基于 Node.js + TypeScript 的股票数据采集服务，定时从腾讯股票接口获取行情数据并写入 MSSQL 数据库。

## 功能特性

- **实时数据采集**: 交易时段内定时获取股票实时行情
- **日报生成**: 从日内分时数据汇总生成日线日报
- **技术指标计算**: 自动计算 BOLL 布林线、RSI 指标
- **结构化日志**: 使用 winston 日志系统，支持日志轮转

## 项目结构

```
stocksrv/
├── dbBll.ts              # 数据库操作层 (Prisma ORM)
├── DayLog.ts             # 日内分时数据采集
├── DayReport.ts          # 当日日报生成
├── DayReport2.ts         # 补报表功能
├── DayReportTech.ts      # 技术指标计算 (BOLL/RSI)
├── tencentStockInterface.ts  # 腾讯股票接口
├── UpdateAllCodeName.ts  # 更新股票代码列表
├── logger.ts             # winston 日志模块
├── prisma/
│   └── schema.prisma     # 数据库模型定义
├── .env                  # 环境变量配置
├── .env.example          # 环境变量模板
└── logs/                 # 日志输出目录
```

## 环境要求

- Node.js >= 16
- MSSQL 数据库

## 安装

```bash
# 克隆项目
git clone https://github.com/Nikolay-Jiang/stocksrv.git
cd stocksrv

# 安装依赖
npm install

# 配置环境变量
cp .env.example .env
# 编辑 .env 文件，填入实际的数据库连接信息

# 生成 Prisma 客户端
npx prisma generate
```

## 配置

在 `.env` 文件中配置以下环境变量：

```env
DATABASE_URL="sqlserver://host:port;initial catalog=DB;user=sa;password=password;trustServerCertificate=true;"
LOG_LEVEL=info
```

## 运行

```bash
# 日内数据采集 (交易时段内运行，建议每分钟调用)
npx ts-node DayLog.ts

# 当日日报生成 (收盘后运行)
npx ts-node DayReport.ts

# 技术指标计算
npx ts-node DayReportTech.ts

# 补报表 (指定日期范围)
npx ts-node DayReport2.ts

# 更新股票列表
npx ts-node UpdateAllCodeName.ts
```

## 数据库表

| 表名 | 用途 |
|------|------|
| t_StockNameList | 股票代码名称列表 |
| t_StockDayLog | 日内分时行情数据 |
| t_StockDayReport | 日线汇总报告 (含技术指标) |
| t_StockKLine | 多周期K线数据 (5m/15m/60m/1d/1w/1M) |
| t_TradeLog | 交易记录 |
| t_Observer | 用户观察股票 |

---

## K线数据模块 (Python)

多周期K线数据采集与存储，使用 AKShare 作为数据源，写入 `t_StockKLine` 表，供策略回测使用。

### 环境要求

- Python >= 3.8
- 依赖库见 `python/requirements.txt`

### 安装 Python 依赖

```bash
cd python
pip install -r requirements.txt
```

### 脚本说明

| 脚本 | 用途 |
|------|------|
| `historical_import.py` | 历史K线批量导入（首次使用） |
| `daily_collect.py` | 每日收盘后采集当日K线 |
| `sync_daily_kline.py` | 将日K从 t_StockDayReport 同步到 t_StockKLine |
| `aggregate_kline.py` | 从日K聚合生成周K/月K |

### 首次使用：导入历史数据

```bash
cd python

# 导入全部股票近1年的分钟K线（5m/15m/60m）
python3 historical_import.py --periods 5m,15m,60m --days 365

# 仅导入单只股票（测试用）
python3 historical_import.py --stock sh600519 --periods 5m,15m,60m --days 365

# 断点续传（跳过已有数据，从上次中断处继续）
python3 historical_import.py --periods 5m,15m,60m --days 365 --resume

# 同步日K数据（从 t_StockDayReport 复制到 t_StockKLine）
python3 sync_daily_kline.py

# 生成周K和月K（从日K聚合）
python3 aggregate_kline.py --period 1w
python3 aggregate_kline.py --period 1M
```

### 每日例行任务（收盘后运行）

```bash
cd python

# 1. 采集当日分钟K线（默认今天）
python3 daily_collect.py

# 2. 同步当日日K
python3 sync_daily_kline.py

# 3. 更新周K和月K
python3 aggregate_kline.py --period 1w
python3 aggregate_kline.py --period 1M
```

> **注意**: 非交易日（周六/周日）运行 `daily_collect.py` 会自动检测并跳过，安全退出。

### 脚本参数说明

**`historical_import.py`**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--stock` | 指定单只股票代码（如 `sh600519`） | 全部股票 |
| `--periods` | K线周期，逗号分隔 | `5m,15m,60m` |
| `--days` | 导入历史天数 | `365` |
| `--resume` | 断点续传，跳过已有数据 | 否 |

**`daily_collect.py`**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--date` | 指定采集日期（格式 `YYYY-MM-DD`） | 今天 |
| `--stock` | 指定单只股票代码 | 全部股票 |
| `--periods` | K线周期，逗号分隔 | `5m,15m,60m` |

**`sync_daily_kline.py`**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--start-date` | 同步起始日期（格式 `YYYY-MM-DD`） | 全部历史 |
| `--end-date` | 同步截止日期 | 今天 |
| `--stock` | 指定单只股票代码 | 全部股票 |

**`aggregate_kline.py`**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `--period` | 聚合周期：`1w`（周K）或 `1M`（月K） | **必填** |
| `--start-date` | 聚合起始日期 | 全部历史 |
| `--end-date` | 聚合截止日期 | 今天 |
| `--stock` | 指定单只股票代码 | 全部股票 |

### 失败日志

采集失败的股票会记录到 `python/logs/` 目录：

- `import_failed.log` — 历史导入失败记录
- `daily_failed_YYYYMMDD.log` — 每日采集失败记录

### TypeScript 查询接口

K线数据可通过 `dbBll.ts` 中的以下方法查询：

```typescript
import { GetKLineData, GetKLineDataMulti, GetLatestKLine, GetKLineDateRange } from './dbBll'

// 查询单只股票指定周期K线
const daily = await GetKLineData('sh600519', '1d', '2025-01-01', '2025-12-31')
const min5  = await GetKLineData('sh600519', '5m', '2025-06-01', '2025-06-30')

// 查询多只股票
const multi = await GetKLineDataMulti(['sh600519', 'sz000001'], '1w', '2025-01-01', '2025-12-31')

// 最新 N 根K线（倒序）
const latest = await GetLatestKLine('sh600519', '60m', 100)

// 查询数据日期范围
const range = await GetKLineDateRange('sh600519', '1d')
// 返回: { min: Date, max: Date } | null
```

**支持的周期值**（Period 字段）：

| 值 | 说明 |
|----|------|
| `5m` | 5分钟K线 |
| `15m` | 15分钟K线 |
| `60m` | 60分钟K线 |
| `1d` | 日K线 |
| `1w` | 周K线 |
| `1M` | 月K线 |

---

## 技术栈

- **运行时**: Node.js
- **语言**: TypeScript
- **ORM**: Prisma
- **数据库**: MSSQL
- **日志**: winston + winston-daily-rotate-file
- **数据源**: 腾讯股票接口

## 日志

日志文件存储在 `logs/` 目录下，按日期轮转：

- 文件名格式: `stocksrv-YYYY-MM-DD.log`
- 保留期限: 14 天
- 单文件大小限制: 50MB

## License

MIT