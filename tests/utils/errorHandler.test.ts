/**
 * 错误处理工具单元测试
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createError,
  normalizeError,
  ErrorType,
  ErrorSeverity,
  getUserFriendlyMessage,
  withErrorHandling,
  withSyncErrorHandling,
  logError
} from '../../utils/errorHandler';

describe('errorHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createError', () => {
    it('应该创建基本错误对象', () => {
      const error = createError(ErrorType.NETWORK, '网络错误');
      
      expect(error.type).toBe(ErrorType.NETWORK);
      expect(error.message).toBe('网络错误');
      expect(error.severity).toBe(ErrorSeverity.HIGH);
      expect(error.timestamp).toBeTypeOf('number');
    });

    it('应该接受自定义严重程度', () => {
      const error = createError(ErrorType.VALIDATION, '验证失败', {
        severity: ErrorSeverity.LOW
      });
      
      expect(error.severity).toBe(ErrorSeverity.LOW);
    });

    it('应该保存原始错误和上下文', () => {
      const originalError = new Error('原始错误');
      const context = { userId: '123', action: 'test' };
      
      const error = createError(ErrorType.API, 'API 错误', {
        originalError,
        context,
        code: 'API_ERROR',
        statusCode: 500
      });
      
      expect(error.originalError).toBe(originalError);
      expect(error.context).toEqual(context);
      expect(error.code).toBe('API_ERROR');
      expect(error.statusCode).toBe(500);
    });
  });

  describe('normalizeError', () => {
    it('应该处理 Error 对象', () => {
      const error = new Error('测试错误');
      const normalized = normalizeError(error);
      
      expect(normalized.type).toBe(ErrorType.UNKNOWN);
      expect(normalized.message).toBe('测试错误');
      expect(normalized.originalError).toBe(error);
    });

    it('应该识别网络错误', () => {
      const error = new Error('fetch failed');
      const normalized = normalizeError(error);
      
      expect(normalized.type).toBe(ErrorType.NETWORK);
      expect(normalized.message).toContain('网络连接失败');
    });

    it('应该识别存储错误', () => {
      const error = new Error('QuotaExceededError');
      error.name = 'QuotaExceededError';
      const normalized = normalizeError(error);
      
      expect(normalized.type).toBe(ErrorType.STORAGE);
      expect(normalized.severity).toBe(ErrorSeverity.CRITICAL);
    });

    it('应该处理字符串错误', () => {
      const normalized = normalizeError('字符串错误');
      
      expect(normalized.type).toBe(ErrorType.UNKNOWN);
      expect(normalized.message).toBe('字符串错误');
    });

    it('应该处理对象错误（API 响应）', () => {
      const apiError = {
        message: 'API 错误',
        code: 'INVALID_KEY',
        statusCode: 401
      };
      const normalized = normalizeError(apiError);
      
      expect(normalized.type).toBe(ErrorType.API);
      expect(normalized.message).toBe('API 错误');
      expect(normalized.code).toBe('INVALID_KEY');
      expect(normalized.statusCode).toBe(401);
    });

    it('应该保留 WingError 对象', () => {
      const wingError = createError(ErrorType.VALIDATION, '验证失败');
      const normalized = normalizeError(wingError);
      
      expect(normalized).toBe(wingError);
    });
  });

  describe('getUserFriendlyMessage', () => {
    it('应该返回中文错误消息', () => {
      // 创建一个没有自定义消息的错误，应该使用默认消息
      const error = createError(ErrorType.NETWORK, '');
      const message = getUserFriendlyMessage(error, 'zh');
      
      expect(message).toContain('网络连接失败');
    });

    it('应该返回英文错误消息', () => {
      // 创建一个没有自定义消息的错误，应该使用默认消息
      const error = createError(ErrorType.API, '');
      const message = getUserFriendlyMessage(error, 'en');
      
      expect(message).toContain('AI service call failed');
    });

    it('应该优先使用错误对象中的消息', () => {
      const error = createError(ErrorType.NETWORK, '自定义友好消息');
      const message = getUserFriendlyMessage(error, 'zh');
      
      expect(message).toBe('自定义友好消息');
    });
  });

  describe('withErrorHandling', () => {
    it('应该成功执行异步函数', async () => {
      const fn = vi.fn().mockResolvedValue('success');
      const wrapped = withErrorHandling(fn);
      
      const result = await wrapped('arg1', 'arg2');
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledWith('arg1', 'arg2');
    });

    it('应该捕获并转换错误', async () => {
      const fn = vi.fn().mockRejectedValue(new Error('测试错误'));
      const wrapped = withErrorHandling(fn, { context: 'test' });
      
      await expect(wrapped()).rejects.toMatchObject({
        type: ErrorType.UNKNOWN,
        message: '测试错误'
      });
    });
  });

  describe('withSyncErrorHandling', () => {
    it('应该成功执行同步函数', () => {
      const fn = vi.fn().mockReturnValue('success');
      const wrapped = withSyncErrorHandling(fn);
      
      const result = wrapped('arg1');
      
      expect(result).toBe('success');
      expect(fn).toHaveBeenCalledWith('arg1');
    });

    it('应该捕获并转换同步错误', () => {
      const fn = vi.fn().mockImplementation(() => {
        throw new Error('同步错误');
      });
      const wrapped = withSyncErrorHandling(fn);
      
      expect(() => wrapped()).toThrow();
    });
  });

  describe('logError', () => {
    it('应该根据严重程度记录错误', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      const error = createError(ErrorType.CRITICAL, '严重错误', {
        severity: ErrorSeverity.CRITICAL
      });
      logError(error);
      
      expect(consoleSpy).toHaveBeenCalled();
      
      consoleSpy.mockRestore();
    });
  });
});
