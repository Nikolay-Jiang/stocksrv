/**
 * 数据库时间约定
 * ------------------------------------------------------------------
 * 以下列存的是“北京墙上时间”（无时区）：
 *   t_StockDayLog.SearchTime
 *   t_StockDayReport.ReportDay
 *   t_StockKLine.TradeTime
 *   t_StockNameList.LastUpdate
 *
 * Prisma 会把 JS Date 按 UTC 序列化到 MySQL 的 DATETIME/DATE 列，
 * 因此这里统一用 Date.UTC(...) 构造“伪 UTC”时间：
 * 它的 UTC 分量 == 期望落库的墙上时间。
 *
 * t_Predict.PredictTime / t_Observer.CreateAt / t_User.CreateAt|UpdateAt
 * 是真正的 UTC，不要用这里的函数。
 */

/** 解析腾讯 14 位时间，如 20261104150530 → 伪 UTC Date */
export function parseTencentTime(input: string): Date {
  if (!/^\d{14}$/.test(input)) {
    throw new Error(`时间格式不正确，应为14位数字: ${input}`);
  }
  const year = Number(input.slice(0, 4));
  const month = Number(input.slice(4, 6)) - 1;
  const day = Number(input.slice(6, 8));
  const hour = Number(input.slice(8, 10));
  const minute = Number(input.slice(10, 12));
  const second = Number(input.slice(12, 14));
  return new Date(Date.UTC(year, month, day, hour, minute, second));
}

/** 当前北京时间（伪 UTC），依赖运行环境 TZ=Asia/Shanghai */
export function todayWallClock(): Date {
  const now = new Date();
  return new Date(
    Date.UTC(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
      now.getHours(),
      now.getMinutes(),
      now.getSeconds(),
      now.getMilliseconds()
    )
  );
}

/** 取伪 UTC 时间的日期部分（00:00:00），用于 DATE 列和按天范围 */
export function dateOnly(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

/** 伪 UTC 日期加减天数 */
export function addDays(value: Date, days: number): Date {
  const result = new Date(value.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

/** 生成无时区 SQL 字面量，便于日志排查，如 2026-11-04 15:05:30 */
export function formatWallClock(value: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    `${value.getUTCFullYear()}-${pad(value.getUTCMonth() + 1)}-${pad(value.getUTCDate())} ` +
    `${pad(value.getUTCHours())}:${pad(value.getUTCMinutes())}:${pad(value.getUTCSeconds())}`
  );
}
