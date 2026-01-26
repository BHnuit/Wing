/**
 * 服务端 AI 代理：供 Vercel / Netlify 等 serverless 使用
 * 在服务端转发请求到 Gemini、OpenAI、DeepSeek、自定义等，避免浏览器 CORS 限制
 */

import { AiService } from '../services/aiService';
import { parseSynthesisResult } from '../services/geminiService';
import type { AppSettings, AiProvider, RawFragment, Language, WingEntry, WritingStyle } from '../types';

/** 构建代理用的最小 AppSettings */
function buildSettings(p: {
  provider: AiProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  language?: Language;
  writingStyle?: WritingStyle;
  writingStylePrompt?: string;
  insightPrompt?: string;
}): AppSettings {
  const { provider, apiKey, baseUrl, model, language, writingStyle, writingStylePrompt, insightPrompt } = p;
  return {
    aiProvider: provider,
    apiKeys: { [provider]: apiKey },
    apiKey,
    aiBaseUrl: baseUrl || undefined,
    aiModels: model ? { [provider]: model } : undefined,
    aiModel: model,
    language: language || 'zh',
    writingStyle,
    writingStylePrompt,
    insightPrompt
  } as AppSettings;
}

export type AiProxyAction = 'synthesize' | 'synthesizeBody' | 'synthesizeMeta' | 'synthesizeInsightAndTodos' | 'regenerateInsight' | 'test';

export interface AiProxyBody {
  action: AiProxyAction;
  provider: AiProvider;
  apiKey: string;
  baseUrl?: string;
  model?: string;
  lang?: Language;
  /** synthesize：为 true 且代理支持时以 SSE 流式返回，降低 TTFB */
  stream?: boolean;
  /** synthesize、synthesizeBody */
  fragments?: RawFragment[];
  previousGeneration?: string;
  /** 文风与自定义提示词（synthesize、synthesizeBody 时生效） */
  writingStyle?: WritingStyle;
  writingStylePrompt?: string;
  /** 用户自定义提示语（synthesizeBody 时生效，用于纠正细节） */
  customPrompt?: string;
  /** synthesizeMeta */
  markdownContent?: string;
  /** synthesizeInsightAndTodos */
  entry?: { title?: string; mood?: string; summary?: string; markdownContent?: string };
  /** regenerateInsight、synthesizeInsightAndTodos */
  insightPrompt?: string;
}

export interface AiProxyResult {
  status: number;
  data?: unknown;
  error?: string;
  code?: string;
}

/** 流式合成事件：chunk | done(entry) | error */
export type SynthesizeStreamEvent =
  | { type: 'chunk'; chunk: string }
  | { type: 'done'; entry: Partial<WingEntry> }
  | { type: 'error'; error: string; code?: string };

/**
 * 流式合成：逐块 yield 文本并最终产出 entry，供 Vercel 等以 SSE 转发，降低 TTFB 超时
 * @param body 须含 action='synthesize'、fragments、lang 等
 * @yields { type: 'chunk', chunk } | { type: 'done', entry } | { type: 'error', error, code? }
 */
export async function* handleSynthesizeStream(body: AiProxyBody): AsyncGenerator<SynthesizeStreamEvent> {
  if (!body || body.action !== 'synthesize' || !Array.isArray(body.fragments)) {
    yield { type: 'error', error: 'synthesize 需要 fragments 数组', code: 'INVALID_BODY' };
    return;
  }
  const { fragments, previousGeneration, lang = 'zh', provider, apiKey, baseUrl, model, writingStyle, writingStylePrompt, insightPrompt } = body;
  const settings = buildSettings({ provider, apiKey, baseUrl, model, language: lang, writingStyle, writingStylePrompt, insightPrompt });
  let full = '';
  try {
    for await (const c of AiService.synthesizeJournalStream(
      fragments,
      lang,
      settings,
      2,
      typeof previousGeneration === 'string' ? previousGeneration : undefined
    )) {
      full += c;
      yield { type: 'chunk', chunk: c };
    }
    const baseResult = parseSynthesisResult(full, previousGeneration, fragments);
    const md = (baseResult.markdownContent != null && String(baseResult.markdownContent).trim() !== '')
      ? baseResult.markdownContent
      : (previousGeneration || '');
    const partial: Pick<WingEntry, 'title' | 'mood' | 'summary' | 'markdownContent'> = {
      title: baseResult.title ?? '',
      mood: baseResult.mood ?? '',
      summary: baseResult.summary ?? '',
      markdownContent: md
    };
    const aiInsights = await AiService.regenerateInsight(partial, lang, settings);
    const entry: Partial<WingEntry> = { ...baseResult, aiInsights, markdownContent: md };
    yield { type: 'done', entry };
  } catch (e) {
    const err = e as { message?: string; code?: string };
    yield { type: 'error', error: err?.message || '流式合成失败', code: err?.code };
  }
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

  const { action, provider, apiKey, baseUrl, model, lang = 'zh', writingStyle, writingStylePrompt, insightPrompt } = body;
  const settings = buildSettings({ provider, apiKey, baseUrl, model, language: lang, writingStyle, writingStylePrompt, insightPrompt });

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
          typeof previousGeneration === 'string' ? previousGeneration : undefined,
          { skipInsight: true }
        );
        return { status: 200, data: ret };
      }

      case 'synthesizeBody': {
        const { fragments, previousGeneration, customPrompt } = body;
        if (!Array.isArray(fragments)) {
          return { status: 400, error: 'synthesizeBody 需要 fragments 数组' };
        }
        const ret = await AiService.synthesizeJournalBody(
          fragments,
          lang,
          settings,
          2,
          typeof previousGeneration === 'string' ? previousGeneration : undefined,
          { customPrompt: typeof customPrompt === 'string' ? customPrompt : undefined }
        );
        return { status: 200, data: ret };
      }

      case 'synthesizeMeta': {
        const { markdownContent } = body;
        if (markdownContent == null || typeof markdownContent !== 'string') {
          return { status: 400, error: 'synthesizeMeta 需要 markdownContent' };
        }
        const ret = await AiService.synthesizeJournalMeta(markdownContent, lang, settings);
        return { status: 200, data: ret };
      }

      case 'synthesizeInsightAndTodos': {
        const { entry } = body;
        if (!entry || typeof entry !== 'object') {
          return { status: 400, error: 'synthesizeInsightAndTodos 需要 entry 对象' };
        }
        const ret = await AiService.synthesizeInsightAndTodos(entry, lang, settings);
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
    const err = e as { message?: string; code?: string; statusCode?: number; details?: unknown; error?: { message?: string } };
    const msg =
      (typeof err?.message === 'string' && err.message) ||
      (err?.error && typeof (err.error as { message?: string }).message === 'string' && (err.error as { message?: string }).message) ||
      (err?.details && String(err.details)) ||
      (err && typeof err === 'object' && 'toString' in err && typeof (err as { toString: () => string }).toString === 'function' ? (err as { toString: () => string }).toString() : '') ||
      'AI 请求失败';
    const code = err?.code;
    const status = typeof err?.statusCode === 'number' ? err.statusCode : 500;
    return { status, error: String(msg).slice(0, 500), code };
  }
}
