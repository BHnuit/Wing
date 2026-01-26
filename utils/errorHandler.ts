/**
 * 统一错误处理工具
 * 提供统一的错误分类、格式化、日志记录和用户友好的错误消息
 */

/**
 * 错误类型枚举
 */
export enum ErrorType {
  /** 网络错误：连接失败、超时等 */
  NETWORK = 'NETWORK',
  /** API 错误：AI 服务调用失败 */
  API = 'API',
  /** 存储错误：IndexedDB、localStorage 等存储操作失败 */
  STORAGE = 'STORAGE',
  /** 解析错误：JSON 解析、数据格式错误等 */
  PARSE = 'PARSE',
  /** 权限错误：用户拒绝授权等 */
  PERMISSION = 'PERMISSION',
  /** 验证错误：输入验证失败 */
  VALIDATION = 'VALIDATION',
  /** 未知错误 */
  UNKNOWN = 'UNKNOWN'
}

/**
 * 错误严重程度
 */
export enum ErrorSeverity {
  /** 低：不影响核心功能 */
  LOW = 'LOW',
  /** 中：影响部分功能 */
  MEDIUM = 'MEDIUM',
  /** 高：影响核心功能 */
  HIGH = 'HIGH',
  /** 严重：应用无法使用 */
  CRITICAL = 'CRITICAL'
}

/**
 * 统一错误接口
 */
export interface WingError {
  /** 错误类型 */
  type: ErrorType;
  /** 错误严重程度 */
  severity: ErrorSeverity;
  /** 错误消息（用户友好） */
  message: string;
  /** 原始错误对象 */
  originalError?: unknown;
  /** 错误代码（如 API 错误码） */
  code?: string;
  /** HTTP 状态码（如 API 错误） */
  statusCode?: number;
  /** 错误详情（开发调试用） */
  details?: string;
  /** 时间戳 */
  timestamp: number;
  /** 错误上下文信息 */
  context?: Record<string, unknown>;
}

/**
 * 创建统一错误对象
 * @param type 错误类型
 * @param message 错误消息
 * @param options 可选配置
 * @returns WingError 对象
 */
export function createError(
  type: ErrorType,
  message: string,
  options?: {
    severity?: ErrorSeverity;
    originalError?: unknown;
    code?: string;
    statusCode?: number;
    details?: string;
    context?: Record<string, unknown>;
  }
): WingError {
  // 根据错误类型自动推断严重程度
  const severity = options?.severity ?? inferSeverity(type);
  
  return {
    type,
    severity,
    message,
    originalError: options?.originalError,
    code: options?.code,
    statusCode: options?.statusCode,
    details: options?.details,
    timestamp: Date.now(),
    context: options?.context
  };
}

/**
 * 根据错误类型推断严重程度
 */
function inferSeverity(type: ErrorType): ErrorSeverity {
  switch (type) {
    case ErrorType.NETWORK:
    case ErrorType.API:
      return ErrorSeverity.HIGH;
    case ErrorType.STORAGE:
      return ErrorSeverity.CRITICAL;
    case ErrorType.PERMISSION:
      return ErrorSeverity.MEDIUM;
    case ErrorType.PARSE:
    case ErrorType.VALIDATION:
      return ErrorSeverity.MEDIUM;
    default:
      return ErrorSeverity.UNKNOWN;
  }
}

/**
 * 将未知错误转换为统一错误格式
 * @param error 未知错误对象
 * @param context 错误上下文
 * @returns WingError 对象
 */
export function normalizeError(
  error: unknown,
  context?: Record<string, unknown>
): WingError {
  // 如果已经是 WingError，直接返回
  if (error && typeof error === 'object' && 'type' in error && 'message' in error) {
    return error as WingError;
  }

  // 处理 Error 对象
  if (error instanceof Error) {
    // 检查是否是网络错误
    if (error.message.includes('fetch') || error.message.includes('network') || error.message.includes('Network')) {
      return createError(
        ErrorType.NETWORK,
        '网络连接失败，请检查网络设置',
        {
          originalError: error,
          details: error.message,
          context
        }
      );
    }

    // 检查是否是存储错误
    if (error.name === 'QuotaExceededError' || error.message.includes('quota') || error.message.includes('storage')) {
      return createError(
        ErrorType.STORAGE,
        '存储空间不足，请清理数据或导出备份',
        {
          severity: ErrorSeverity.CRITICAL,
          originalError: error,
          details: error.message,
          context
        }
      );
    }

    // 检查是否是权限错误
    if (error.message.includes('permission') || error.message.includes('denied') || error.name === 'NotAllowedError') {
      return createError(
        ErrorType.PERMISSION,
        '权限被拒绝，请检查应用权限设置',
        {
          originalError: error,
          details: error.message,
          context
        }
      );
    }

    // 默认作为未知错误
    return createError(
      ErrorType.UNKNOWN,
      error.message || '发生未知错误',
      {
        originalError: error,
        details: error.stack,
        context
      }
    );
  }

  // 处理字符串错误
  if (typeof error === 'string') {
    return createError(
      ErrorType.UNKNOWN,
      error,
      {
        details: error,
        context
      }
    );
  }

  // 处理对象错误（如 API 错误响应）
  if (error && typeof error === 'object') {
    const err = error as { message?: string; code?: string; statusCode?: number; error?: { message?: string } };
    const message = 
      err.message || 
      (err.error && typeof err.error === 'object' && 'message' in err.error ? String(err.error.message) : undefined) ||
      '发生未知错误';
    
    return createError(
      ErrorType.API,
      message,
      {
        code: err.code,
        statusCode: err.statusCode,
        originalError: error,
        context
      }
    );
  }

  // 完全未知的错误
  return createError(
    ErrorType.UNKNOWN,
    '发生未知错误',
    {
      originalError: error,
      details: String(error),
      context
    }
  );
}

/**
 * 记录错误到控制台（开发环境）或日志服务（生产环境）
 * @param error WingError 对象
 */
export function logError(error: WingError): void {
  const logData = {
    type: error.type,
    severity: error.severity,
    message: error.message,
    code: error.code,
    statusCode: error.statusCode,
    timestamp: new Date(error.timestamp).toISOString(),
    context: error.context,
    details: error.details
  };

  // 根据严重程度选择日志级别
  switch (error.severity) {
    case ErrorSeverity.CRITICAL:
      console.error('[CRITICAL]', logData, error.originalError);
      // 生产环境可以发送到错误追踪服务
      // if (import.meta.env.PROD) {
      //   sendToErrorTrackingService(logData);
      // }
      break;
    case ErrorSeverity.HIGH:
      console.error('[HIGH]', logData, error.originalError);
      break;
    case ErrorSeverity.MEDIUM:
      console.warn('[MEDIUM]', logData, error.originalError);
      break;
    case ErrorSeverity.LOW:
      console.info('[LOW]', logData);
      break;
    default:
      console.log('[UNKNOWN]', logData);
  }
}

/**
 * 获取用户友好的错误消息
 * @param error WingError 对象
 * @param lang 语言（'zh' | 'en'）
 * @returns 用户友好的错误消息
 */
export function getUserFriendlyMessage(error: WingError, lang: 'zh' | 'en' = 'zh'): string {
  // 如果已有用户友好的消息，直接返回
  if (error.message && !error.message.includes('Error:') && !error.message.includes('error')) {
    return error.message;
  }

  // 根据错误类型返回本地化消息
  const messages: Record<ErrorType, { zh: string; en: string }> = {
    [ErrorType.NETWORK]: {
      zh: '网络连接失败，请检查网络设置后重试',
      en: 'Network connection failed. Please check your network settings and try again.'
    },
    [ErrorType.API]: {
      zh: 'AI 服务调用失败，请检查 API 配置',
      en: 'AI service call failed. Please check your API configuration.'
    },
    [ErrorType.STORAGE]: {
      zh: '存储操作失败，请清理数据或导出备份',
      en: 'Storage operation failed. Please clear data or export backup.'
    },
    [ErrorType.PARSE]: {
      zh: '数据解析失败，请检查数据格式',
      en: 'Data parsing failed. Please check the data format.'
    },
    [ErrorType.PERMISSION]: {
      zh: '权限被拒绝，请检查应用权限设置',
      en: 'Permission denied. Please check application permissions.'
    },
    [ErrorType.VALIDATION]: {
      zh: '输入验证失败，请检查输入内容',
      en: 'Input validation failed. Please check your input.'
    },
    [ErrorType.UNKNOWN]: {
      zh: '发生未知错误，请稍后重试',
      en: 'An unknown error occurred. Please try again later.'
    }
  };

  return messages[error.type][lang];
}

/**
 * 错误处理包装器：自动捕获、记录和转换错误
 * @param fn 异步函数
 * @param context 错误上下文
 * @returns 包装后的函数
 */
export function withErrorHandling<T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: Record<string, unknown>
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      const normalizedError = normalizeError(error, context);
      logError(normalizedError);
      throw normalizedError;
    }
  }) as T;
}

/**
 * 同步错误处理包装器
 * @param fn 同步函数
 * @param context 错误上下文
 * @returns 包装后的函数
 */
export function withSyncErrorHandling<T extends (...args: unknown[]) => unknown>(
  fn: T,
  context?: Record<string, unknown>
): T {
  return ((...args: Parameters<T>) => {
    try {
      return fn(...args);
    } catch (error) {
      const normalizedError = normalizeError(error, context);
      logError(normalizedError);
      throw normalizedError;
    }
  }) as T;
}
