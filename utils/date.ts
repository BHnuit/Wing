/**
 * 日期工具：统一使用用户本地时区的日历日 (YYYY-MM-DD)，避免 toISOString 的 UTC 导致的「今天」错位。
 */

/**
 * 获取日期在本地时区的 YYYY-MM-DD
 * @param d 可选，默认当前时刻
 */
export function getLocalDateString(d?: Date): string {
  const x = d ?? new Date();
  return x.toLocaleDateString('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' });
}
