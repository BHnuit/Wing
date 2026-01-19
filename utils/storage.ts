/**
 * 检测是否为 localStorage 配额超限异常（QuotaExceededError）
 * @param e 捕获的异常
 * @returns 是否为配额超限
 */
export function isQuotaExceededError(e: unknown): boolean {
  return (
    (e instanceof DOMException && e.name === 'QuotaExceededError') ||
    (e as { code?: number })?.code === 22
  );
}
