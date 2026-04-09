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
| t_TradeLog | 交易记录 |
| t_Observer | 用户观察股票 |

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