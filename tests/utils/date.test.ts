/**
 * 日期工具函数单元测试
 */

import { describe, it, expect } from 'vitest';
import { getLocalDateString, formatTimestampForPrompt } from '../../utils/date';

describe('date utils', () => {
  describe('getLocalDateString', () => {
    it('应该返回 YYYY-MM-DD 格式的日期字符串', () => {
      const date = new Date('2026-01-26T10:30:00');
      const result = getLocalDateString(date);
      
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(result).toBe('2026-01-26');
    });

    it('应该使用本地时区', () => {
      const date = new Date('2026-01-26T00:00:00Z');
      const result = getLocalDateString(date);
      
      // 结果取决于本地时区，但应该是有效的日期格式
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('formatTimestampForPrompt', () => {
    it('应该格式化上午时间戳为中文', () => {
      const date = new Date('2026-01-26T10:30:00');
      const result = formatTimestampForPrompt(date, 'zh');
      
      expect(result).toContain('上午');
      expect(result).toContain('10:30');
    });

    it('应该格式化下午时间戳为中文', () => {
      const date = new Date('2026-01-26T15:15:00');
      const result = formatTimestampForPrompt(date, 'zh');
      
      expect(result).toContain('下午');
      expect(result).toContain('3:15');
    });

    it('应该格式化时间为英文', () => {
      const date = new Date('2026-01-26T14:45:00');
      const result = formatTimestampForPrompt(date, 'en');
      
      expect(result).toMatch(/\d{1,2}:\d{2}\s*(AM|PM)/i);
    });
  });
});
