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

/**
 * 格式化时间戳为易读的时间描述（如「上午 10:30」「下午 3:15」）
 * 用于在生成日记时传递给 AI，便于识别记录时的情景
 * @param timestamp 时间戳（毫秒）
 * @param lang 语言，用于选择时间格式
 * @returns 格式化的时间字符串，如「上午 10:30」或「下午 3:15」
 */
export function formatTimestampForPrompt(timestamp: number, lang: 'zh' | 'en' = 'zh'): string {
  const date = new Date(timestamp);
  if (lang === 'zh') {
    // 中文格式：上午/下午 + 时:分
    const hour = date.getHours();
    const minute = date.getMinutes();
    const period = hour < 12 ? '上午' : '下午';
    const displayHour = hour === 0 ? 12 : (hour > 12 ? hour - 12 : hour);
    const displayMinute = minute.toString().padStart(2, '0');
    return `${period} ${displayHour}:${displayMinute}`;
  } else {
    // 英文格式：AM/PM + 时:分
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}
