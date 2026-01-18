/**
 * 服务端 AI 代理：供 Vercel / Netlify 等 serverless 使用
 * 在服务端转发请求到 Gemini、OpenAI、DeepSeek、自定义等，避免浏览器 CORS 限制
 */

import { AiService } from '../services/aiService';
import type { AppSettings, AiProvider, RawFragment, Language } from '../types';

/** 构建代理用的最小 AppSettings */
function buildSettings(p: {
  provider: AiProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  language?: Language;
}): AppSettings {
  const { provider, apiKey, baseUrl, model, language } = p;
  return {
    aiProvider: provider,
    apiKeys: { [provider]: apiKey },
    apiKey,
    aiBaseUrl: baseUrl || undefined,
    aiModels: model ? { [provider]: model } : undefined,
    aiModel: model,
    language: language || 'zh',
    webdavUrl: '',
    webdavUser: '',
    webdavPass: '',
  } as AppSettings;
}

export type AiProxyAction = 'synthesize' | 'regenerateInsight' | 'test';

export interface AiProxyBody {
  action: AiProxyAction;
  provider: AiProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  lang?: Language;
  /** synthesize */
  fragments?: RawFragment[];
  previousGeneration?: string;
  /** regenerateInsight */
  entry?: { title?: string; mood?: string; summary?: string; markdownContent?: string };
}

export interface AiProxyResult {
  status: number;
  data?: unknown;
  error?: string;
  code?: string;
}

/**
 * 处理 AI 代理请求：根据 action 调用 AiService 并返回统一结构
 * @param body 前端传入的 JSON  body
 * @returns { status, data?, error?, code? }
 */
export async function handleAiRequest(body: AiProxyBody): Promise<AiProxyResult> {
  if (!body || typeof body.action !== 'string') {
    return { status: 400, error: '缺少 action 或 body 格式错误' };
  }

  const { action, provider, apiKey, baseUrl, model, lang = 'zh' } = body;
  const settings = buildSettings({ provider, apiKey, baseUrl, model, language: lang });

  try {
    switch (action) {
      case 'synthesize': {
        const { fragments, previousGeneration } = body;
        if (!Array.isArray(fragments)) {
          return { status: 400, error: 'synthesize 需要 fragments 数组' };
        }
        const ret = await AiService.synthesizeJournal(
          fragments,
          lang,
          settings,
          2,
          typeof previousGeneration === 'string' ? previousGeneration : undefined
        );
        return { status: 200, data: ret };
      }

      case 'regenerateInsight': {
        const { entry } = body;
        if (!entry || typeof entry !== 'object') {
          return { status: 400, error: 'regenerateInsight 需要 entry 对象' };
        }
        const text = await AiService.regenerateInsight(entry, lang, settings);
        return { status: 200, data: { text } };
      }

      case 'test': {
        const result = await AiService.testConnection(settings);
        return { status: 200, data: result };
      }

      default:
        return { status: 400, error: `不支持的 action: ${action}` };
    }
  } catch (e: unknown) {
    const err = e as { message?: string; code?: string; statusCode?: number };
    const msg = err?.message || 'AI 请求失败';
    const code = err?.code;
    const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
    return { status, error: msg, code };
  }
}
