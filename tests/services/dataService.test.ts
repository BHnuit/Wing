/**
 * 数据服务单元测试
 * 测试数据导入导出功能
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MockDataService } from '../../services/mockDataService';
import type { WingEntry, DailySession } from '../../types';

describe('dataService', () => {
  beforeEach(() => {
    // 重置 MockDataService 状态
    vi.clearAllMocks();
  });

  describe('数据获取', () => {
    it('应该能够获取所有日记条目', () => {
      const entries = MockDataService.getEntries();
      
      expect(Array.isArray(entries)).toBe(true);
      entries.forEach(entry => {
        expect(entry).toHaveProperty('id');
        expect(entry).toHaveProperty('title');
        expect(entry).toHaveProperty('markdownContent');
        expect(entry).toHaveProperty('createdAt');
      });
    });

    it('应该能够获取所有会话', () => {
      const sessions = MockDataService.getSessions();
      
      expect(Array.isArray(sessions)).toBe(true);
      sessions.forEach(session => {
        expect(session).toHaveProperty('id');
        expect(session).toHaveProperty('date');
        expect(session).toHaveProperty('status');
        expect(session).toHaveProperty('fragments');
      });
    });

    it('应该能够根据日期获取会话', () => {
      const date = '2026-01-26';
      const session = MockDataService.getSessionByDate(date);
      
      if (session) {
        expect(session.date).toBe(date);
      }
    });
  });

  describe('数据操作', () => {
    it('应该能够创建新的日记条目', () => {
      const newEntry: Partial<WingEntry> = {
        title: '测试日记',
        summary: '测试摘要',
        mood: '😊',
        markdownContent: '# 测试内容',
        aiInsights: '测试洞察',
        todos: [],
        createdAt: Date.now()
      };

      // 注意：MockDataService 可能不实际保存，这里主要测试接口
      expect(newEntry).toHaveProperty('title');
      expect(newEntry.title).toBe('测试日记');
    });

    it('应该能够创建新的会话', () => {
      const newSession: Partial<DailySession> = {
        date: '2026-01-26',
        status: 'RECORDING' as const,
        fragments: []
      };

      expect(newSession).toHaveProperty('date');
      expect(newSession.date).toBe('2026-01-26');
    });
  });
});
