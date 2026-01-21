/**
 * 统一 AI 服务：支持 Gemini、OpenAI、DeepSeek、自定义 Base URL
 * 提供 synthesizeJournal 与 testConnection
 */

import { AppSettings, AiProvider, RawFragment, WingEntry, Language, FragmentType } from '../types';
import { GeminiService, GeminiAPIError, getSystemInstructionForSynthesis, buildInsightUserContent, safeFragmentContentForPrompt } from './geminiService';

/** 统一 AI 调用错误，与 GeminiAPIError 兼容（含 code） */
export class AiAPIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'AiAPIError';
  }
}

const OPENAI_BASE = 'https://api.openai.com';
const DEEPSEEK_BASE = 'https://api.deepseek.com';

/**
 * 生产环境或显式开启时走 /api/ai 代理，避免浏览器直连 AI 供应商的 CORS 限制（Vercel/Netlify 等）。
 * 仅浏览器端使用代理：服务端（如 Vercel serverless）无 window，且 fetch('/api/ai') 相对路径在部署环境中无法解析，会报错；
 * 服务端应直接请求各 AI 供应商，无 CORS 问题。
 */
const USE_AI_PROXY =
  typeof window !== 'undefined' &&
  (import.meta.env?.PROD === true || import.meta.env?.VITE_AI_PROXY === 'true');
const AI_PROXY_URL = (String(import.meta.env?.VITE_AI_PROXY_URL || '') || '/api/ai').replace(/\/$/, '');

/**
 * 解析模型返回内容的语言：modelLanguage 为 'same' 或未设时使用页面语言
 */
export function getModelResponseLanguage(settings: AppSettings): Language {
  const m = settings.modelLanguage;
  if (m === 'zh' || m === 'en') return m;
  return settings.language || 'zh';
}

/**
 * 根据当前供应商从 apiKeys 或旧版 apiKey 解析出有效的 API Key
 */
export function getEffectiveApiKey(settings: AppSettings): string {
  const p = (settings.aiProvider || 'gemini') as AiProvider;
  return (settings.apiKeys?.[p] ?? settings.apiKey ?? '').trim();
}

/**
 * 根据供应商解析 Base URL（不含 /v1/chat/completions）
 */
function getBaseUrl(settings: AppSettings): string {
  const p = (settings.aiProvider || 'gemini') as AiProvider;
  if (p === 'openai') return OPENAI_BASE;
  if (p === 'deepseek') return DEEPSEEK_BASE;
  if (p === 'custom') {
    const u = (settings.aiBaseUrl || '').trim();
    return u.replace(/\/v1\/?$/, '').replace(/\/$/, '');
  }
  return '';
}

/**
 * 根据供应商与设置解析模型名（优先 aiModels[provider]，兼容旧 aiModel）
 */
function getModel(settings: AppSettings): string {
  const p = (settings.aiProvider || 'gemini') as AiProvider;
  const m = (settings.aiModels?.[p] ?? settings.aiModel ?? '').trim();
  if (p === 'gemini') return m || 'gemini-3-flash-preview';
  if (p === 'openai') return m || 'gpt-4o-mini';
  if (p === 'deepseek') return m || 'deepseek-chat';
  return m; // custom: 必填，由调用方校验
}

/**
 * 使用 OpenAI 兼容接口（/v1/chat/completions）合成日记
 */
async function openAICompatibleSynthesize(
  fragments: RawFragment[],
  lang: Language,
  settings: AppSettings,
  retries: number,
  previousGeneration?: string
): Promise<Partial<WingEntry>> {
  const base = getBaseUrl(settings);
  const model = getModel(settings);
  if (!model) throw new AiAPIError('请填写模型名称', 'MISSING_MODEL');

  const url = `${base}/v1/chat/completions`;
  const sys = getSystemInstructionForSynthesis(lang, {
    writingStyle: settings.writingStyle,
    writingStylePrompt: settings.writingStylePrompt
  }) +
    '\n\nOutput ONLY a valid JSON object. No markdown, no extra text. Required keys: title, mood, summary, content_markdown, todos (array of {title, priority}). priority is one of: high, medium, low.';

  const inputContext = fragments
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((f) => `[${new Date(f.timestamp).toLocaleTimeString()}] ${f.type === FragmentType.IMAGE ? '[Image]' : ''} ${safeFragmentContentForPrompt(f)}`)
    .join('\n');

  let fullInput = `这是用户今天的记录：\n\n${inputContext}`;
  if (previousGeneration?.trim()) {
    const pg = previousGeneration.length > 30000 ? previousGeneration.slice(0, 30000) + '\n\n...(正文过长已截断)' : previousGeneration;
    fullInput += `\n\n[已生成的日记正文，供重新生成时参考]\n${pg}\n\n【重新生成】content_markdown 必须为**重新撰写**的正文：请对上述原文进行重写、润色或合并当日新记录，**禁止逐字照抄原文**，输出的正文须在表述、结构或详略上与原文有可见差异。todos：从当日记录或上述正文中提取待办，若无则填 []。`;
  }

  /** 国内不少中转不支持 response_format.json_object，custom 时仅靠 system 约束 JSON */
  const isCustom = (settings.aiProvider || 'gemini') === 'custom';
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system' as const, content: sys },
      { role: 'user' as const, content: fullInput }
    ],
    max_tokens: 8192
  };
  if (!isCustom) body.response_format = { type: 'json_object' as const };

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getEffectiveApiKey(settings)}`
        },
        body: JSON.stringify(body)
      });

      const json = await res.json().catch(() => ({})) as Record<string, unknown>;
      if (!res.ok) {
        const msg = (json.msg as string) || (json.err_msg as string) || (typeof json.error === 'string' ? json.error : null)
          || (json.error && typeof (json.error as { message?: string }).message === 'string' ? (json.error as { message?: string }).message : null)
          || (json.message as string) || res.statusText || `HTTP ${res.status}`;
        throw new AiAPIError(msg, (json.error as { code?: string })?.code || 'API_ERROR', res.status);
      }

      const content = json.choices?.[0] && typeof (json.choices[0] as { message?: { content?: unknown } }).message?.content === 'string'
        ? (json.choices[0] as { message: { content: string } }).message.content
        : null;
      if (!content) {
        throw new AiAPIError('接口返回为空或格式异常', 'EMPTY_RESPONSE');
      }

      /** 兼容部分中转返回 ```json ... ``` 包裹 */
      const raw = String(content).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      let result: Record<string, unknown>;
      try {
        result = JSON.parse(raw) as Record<string, unknown>;
      } catch {
        throw new AiAPIError('接口返回不是合法 JSON', 'PARSE_ERROR');
      }

      const required = (previousGeneration?.trim() ? ['title', 'mood', 'summary', 'todos'] : ['title', 'mood', 'summary', 'content_markdown', 'todos']);
      const missing = required.filter((k) => result[k] == null);
      if (missing.length) {
        throw new AiAPIError(`返回缺少字段: ${missing.join(', ')}`, 'INVALID_RESPONSE');
      }

      const rawMd = result.content_markdown ?? result.contentMarkdown;
      let md = (rawMd != null && String(rawMd).trim() !== '') ? String(rawMd) : (previousGeneration || '');
      // 若记录中有图片但模型未输出足够 [Image]，在文末补全占位符以便日记页能显示
      const imageCount = fragments.filter((f) => f.type === FragmentType.IMAGE || f.type === 'IMAGE').length;
      const placeholders = (md.match(/\[Image\]/gi) || []).length;
      for (let i = placeholders; i < imageCount; i++) md += '\n\n[Image]\n\n';
      return {
        title: String(result.title),
        mood: String(result.mood),
        summary: String(result.summary),
        markdownContent: md,
        todos: Array.isArray(result.todos) ? result.todos as { title: string; priority: string }[] : []
      };
    } catch (e) {
      lastErr = e as Error;
      if (e instanceof AiAPIError) throw e;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }

  if (lastErr instanceof TypeError && (lastErr.message || '').includes('fetch')) {
    throw new AiAPIError('网络异常，请检查网络', 'NETWORK_ERROR');
  }
  throw new AiAPIError(lastErr?.message || '合成失败', 'UNKNOWN_ERROR');
}

/**
 * 使用 OpenAI 兼容接口流式合成日记（stream: true），逐块 yield 文本以降低 TTFB
 * 注：流式时部分实现可能不支持 response_format.json_object，仍依赖 system 约束输出 JSON
 */
async function* openAICompatibleSynthesizeStream(
  fragments: RawFragment[],
  lang: Language,
  settings: AppSettings,
  retries: number,
  previousGeneration?: string
): AsyncGenerator<string> {
  const base = getBaseUrl(settings);
  const model = getModel(settings);
  if (!model) throw new AiAPIError('请填写模型名称', 'MISSING_MODEL');

  const url = `${base}/v1/chat/completions`;
  const sys = getSystemInstructionForSynthesis(lang, {
    writingStyle: settings.writingStyle,
    writingStylePrompt: settings.writingStylePrompt
  }) +
    '\n\nOutput ONLY a valid JSON object. No markdown, no extra text. Required keys: title, mood, summary, content_markdown, todos (array of {title, priority}). priority is one of: high, medium, low.';

  const inputContext = fragments
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((f) => `[${new Date(f.timestamp).toLocaleTimeString()}] ${f.type === FragmentType.IMAGE ? '[Image]' : ''} ${safeFragmentContentForPrompt(f)}`)
    .join('\n');

  let fullInput = `这是用户今天的记录：\n\n${inputContext}`;
  if (previousGeneration?.trim()) {
    const pg = previousGeneration.length > 30000 ? previousGeneration.slice(0, 30000) + '\n\n...(正文过长已截断)' : previousGeneration;
    fullInput += `\n\n[已生成的日记正文，供重新生成时参考]\n${pg}\n\n【重新生成】content_markdown 必须为**重新撰写**的正文：请对上述原文进行重写、润色或合并当日新记录，**禁止逐字照抄原文**，输出的正文须在表述、结构或详略上与原文有可见差异。todos：从当日记录或上述正文中提取待办，若无则填 []。`;
  }

  const isCustom = (settings.aiProvider || 'gemini') === 'custom';
  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: 'system' as const, content: sys },
      { role: 'user' as const, content: fullInput }
    ],
    stream: true,
    max_tokens: 8192
  };
  if (!isCustom) body.response_format = { type: 'json_object' as const };

  let lastErr: Error | null = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${getEffectiveApiKey(settings)}`
        },
        body: JSON.stringify(body)
      });

      if (!res.ok) {
        const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
        const msg = (json.msg as string) || (json.err_msg as string) || (typeof json.error === 'string' ? json.error : null)
          || (json.error && typeof (json.error as { message?: string }).message === 'string' ? (json.error as { message?: string }).message : null)
          || (json.message as string) || res.statusText || `HTTP ${res.status}`;
        throw new AiAPIError(msg, (json.error as { code?: string })?.code || 'API_ERROR', res.status);
      }

      const reader = res.body?.getReader();
      if (!reader) throw new AiAPIError('接口未返回可读流', 'EMPTY_RESPONSE');

      const dec = new TextDecoder();
      let buf = '';
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        const blocks = buf.split('\n\n');
        buf = blocks.pop() ?? '';
        for (const block of blocks) {
          const line = block.split('\n').find((l) => l.startsWith('data: '));
          if (!line) continue;
          const d = line.slice(6).trim();
          if (d === '[DONE]') return;
          try {
            const j = JSON.parse(d) as { choices?: Array<{ delta?: { content?: string } }> };
            const c = j?.choices?.[0]?.delta?.content;
            if (typeof c === 'string') yield c;
          } catch {
            // 忽略非 JSON 或无效行
          }
        }
      }
      // 处理剩余
      if (buf) {
        const line = buf.split('\n').find((l) => l.startsWith('data: '));
        if (line) {
          const d = line.slice(6).trim();
          if (d !== '[DONE]') {
            try {
              const j = JSON.parse(d) as { choices?: Array<{ delta?: { content?: string } }> };
              const c = j?.choices?.[0]?.delta?.content;
              if (typeof c === 'string') yield c;
            } catch {
              // ignore
            }
          }
        }
      }
      return;
    } catch (e) {
      lastErr = e as Error;
      if (e instanceof AiAPIError) throw e;
      if (attempt === retries) break;
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
    }
  }
  if (lastErr instanceof TypeError && (lastErr.message || '').includes('fetch')) {
    throw new AiAPIError('网络异常，请检查网络', 'NETWORK_ERROR');
  }
  throw new AiAPIError(lastErr?.message || '流式合成失败', 'UNKNOWN_ERROR');
}

/**
 * 使用 OpenAI 兼容接口仅生成心理洞察
 */
async function openAICompatibleRegenerateInsight(
  entry: Pick<WingEntry, 'title' | 'mood' | 'summary' | 'markdownContent'>,
  lang: Language,
  settings: AppSettings
): Promise<string> {
  const base = getBaseUrl(settings);
  const model = getModel(settings);
  if (!model) throw new AiAPIError('请填写模型名称', 'MISSING_MODEL');

  const user = buildInsightUserContent(entry, lang, settings.insightPrompt);

  const res = await fetch(`${base}/v1/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getEffectiveApiKey(settings)}`
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system' as const, content: 'You output only the requested insight text. No quotes, no preamble.' },
        { role: 'user' as const, content: user }
      ],
      max_tokens: 256
    })
  });

  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const msg = (json.msg as string) || (json.err_msg as string) || (typeof json.error === 'string' ? json.error : null)
      || (json.error && typeof (json.error as { message?: string }).message === 'string' ? (json.error as { message?: string }).message : null)
      || (json.message as string) || res.statusText || `HTTP ${res.status}`;
    throw new AiAPIError(msg, (json.error as { code?: string })?.code || 'API_ERROR', res.status);
  }

  const text = (json?.choices?.[0] && (json.choices[0] as { message?: { content?: string } })?.message?.content
    ? (json.choices[0] as { message: { content: string } }).message.content
    : '').trim().replace(/^["']|["']$/g, '');
  if (!text) throw new AiAPIError('接口返回为空', 'EMPTY_RESPONSE');
  return text;
}

export const AiService = {
  /**
   * 流式合成日记（仅服务端）：逐块 yield JSON 文本，供代理做 SSE 转发以降低 TTFB
   * @param fragments 碎片
   * @param lang 语言
   * @param settings 应用设置
   * @param retries 重试次数
   * @param previousGeneration 重新生成时的已有正文
   */
  async *synthesizeJournalStream(
    fragments: RawFragment[],
    lang: Language,
    settings: AppSettings,
    retries: number = 2,
    previousGeneration?: string
  ): AsyncGenerator<string> {
    if (!getEffectiveApiKey(settings)) {
      throw new AiAPIError('请先在设置中配置 API 密钥', 'MISSING_API_KEY');
    }
    const provider = (settings.aiProvider || 'gemini') as AiProvider;

    if (provider === 'gemini') {
      try {
        yield* GeminiService.synthesizeJournalStream(
          fragments,
          lang,
          getEffectiveApiKey(settings),
          retries,
          previousGeneration,
          getModel(settings),
          settings.writingStyle,
          settings.writingStylePrompt
        );
      } catch (e) {
        if (e instanceof GeminiAPIError) throw new AiAPIError(e.message, e.code, e.statusCode);
        throw e;
      }
      return;
    }

    if (provider === 'custom') {
      const base = (settings.aiBaseUrl || '').trim();
      if (!base) throw new AiAPIError('请填写自定义 Base URL', 'MISSING_BASE_URL');
      if (!getModel(settings)) throw new AiAPIError('请填写模型名称', 'MISSING_MODEL');
    }
    yield* openAICompatibleSynthesizeStream(fragments, lang, settings, retries, previousGeneration);
  },

  /**
   * 合成日记：按设置路由到 Gemini 或 OpenAI 兼容接口
   * 走代理且 stream 为 true 时使用 SSE，以降低首次字节响应超时
   * @param fragments 碎片
   * @param lang 语言
   * @param settings 应用设置（含 aiProvider、apiKey、aiBaseUrl、aiModels）
   * @param retries 重试次数
   * @param previousGeneration 重新生成时的已有正文
   * @param opts 可选，stream: 走代理时是否请求流式（默认 true）；skipInsight: 仅代理模式下服务端跳过洞察以降低 504 超时，由客户端单独请求
   */
  async synthesizeJournal(
    fragments: RawFragment[],
    lang: Language,
    settings: AppSettings,
    retries: number = 2,
    previousGeneration?: string,
    opts?: { stream?: boolean; skipInsight?: boolean }
  ): Promise<Partial<WingEntry>> {
    if (!getEffectiveApiKey(settings)) {
      throw new AiAPIError('请先在设置中配置 API 密钥', 'MISSING_API_KEY');
    }

    const provider = (settings.aiProvider || 'gemini') as AiProvider;
    const useStream = opts?.stream !== false;

    if (USE_AI_PROXY) {
      /** 504 时对用户友好的提示（Netlify 默认 10s 超时） */
      const MSG_504_SYNTH = '请求超时 (504)：合成耗时超过服务器限制（约 10 秒）。建议：缩短当日记录、换用更快模型（如 gemini-2.0-flash），或升级 Netlify Pro 将超时延至 26 秒。可重试一次。';
      /** 代理请求体剔除 imageData，避免 base64 图片导致 payload 超限（Vercel ~4.5MB、Netlify ~6MB），合成逻辑仅用 id/content/timestamp/type/editedAt；图片由前端在生成后写入 entry.images */
      const fragmentsForProxy = fragments.map(({ imageData, ...f }) => f);
      const body = {
        action: 'synthesize',
        stream: useStream,
        provider,
        apiKey: getEffectiveApiKey(settings),
        baseUrl: provider === 'custom' ? (settings.aiBaseUrl || '').trim() : undefined,
        model: getModel(settings),
        lang,
        fragments: fragmentsForProxy,
        previousGeneration,
        writingStyle: settings.writingStyle,
        writingStylePrompt: settings.writingStylePrompt,
        insightPrompt: settings.insightPrompt
      };
      let res: Response;
      for (let attempt = 0; attempt < 2; attempt++) {
        res = await fetch(AI_PROXY_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        if (res.status !== 504 || attempt === 1) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
      const ct = (res.headers.get('Content-Type') || '').toLowerCase();
      if (useStream && ct.includes('text/event-stream')) {
        const dec = new TextDecoder();
        const reader = res.body?.getReader();
        if (!reader) {
          const j = (await res.json().catch(() => ({}))) as { error?: string; code?: string };
          const msg = res.status === 504 ? MSG_504_SYNTH : (j.error || res.statusText || `请求失败 (HTTP ${res.status})`);
          if (!res.ok) throw new AiAPIError(msg, res.status === 504 ? 'TIMEOUT' : j.code, res.status);
          return j as Partial<WingEntry>;
        }
        let buf = '';
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const blocks = buf.split('\n\n');
          buf = blocks.pop() ?? '';
          for (const block of blocks) {
            const line = block.split('\n').find((l) => l.startsWith('data: '));
            if (!line) continue;
            try {
              const j = JSON.parse(line.slice(6).trim()) as { done?: boolean; entry?: Partial<WingEntry>; error?: string; code?: string };
              if (j.done === true && j.entry) return j.entry;
              if (j.error) throw new AiAPIError(j.error, j.code, res.status);
            } catch (e) {
              if (e instanceof AiAPIError) throw e;
              // 忽略解析失败行
            }
          }
        }
        if (buf) {
          try {
            const line = buf.split('\n').find((l) => l.startsWith('data: '));
            if (line) {
              const j = JSON.parse(line.slice(6).trim()) as { done?: boolean; entry?: Partial<WingEntry>; error?: string; code?: string };
              if (j.done === true && j.entry) return j.entry;
              if (j.error) throw new AiAPIError(j.error, j.code, res.status);
            }
          } catch (e) {
            if (e instanceof AiAPIError) throw e;
          }
        }
        throw new AiAPIError('流式响应未返回完整 entry', 'EMPTY_RESPONSE');
      }

      const data = (await res.json().catch(() => ({}))) as Partial<WingEntry> & { error?: string; code?: string };
      if (!res.ok) {
        const msg = res.status === 504 ? MSG_504_SYNTH : (data.error || res.statusText || `请求失败 (HTTP ${res.status})`);
        throw new AiAPIError(msg, res.status === 504 ? 'TIMEOUT' : data.code, res.status);
      }
      let entry = data;
      // 代理端 synthesize 已用 skipInsight 仅做正文，此处单独请求洞察以规避 Netlify 10s 超时；失败则留空，用户可于详情页「仅重新生成洞察」
      if ((entry.aiInsights == null || entry.aiInsights === '') && (entry.title != null || (entry.markdownContent != null && String(entry.markdownContent).trim() !== ''))) {
        try {
          const ir = await fetch(AI_PROXY_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'regenerateInsight',
              provider,
              apiKey: getEffectiveApiKey(settings),
              baseUrl: provider === 'custom' ? (settings.aiBaseUrl || '').trim() : undefined,
              model: getModel(settings),
              lang,
              entry: { title: entry.title, mood: entry.mood, summary: entry.summary, markdownContent: entry.markdownContent },
              insightPrompt: settings.insightPrompt
            })
          });
          const idata = (await ir.json().catch(() => ({}))) as { text?: string; error?: string; code?: string };
          if (ir.ok && idata.text != null) entry = { ...entry, aiInsights: idata.text };
        } catch {
          /* 洞察请求失败则保留空，用户可于详情页「仅重新生成洞察」 */
        }
      }
      return entry;
    }

    let baseResult: Partial<WingEntry>;
    if (provider === 'gemini') {
      try {
        baseResult = await GeminiService.synthesizeJournal(
          fragments,
          lang,
          getEffectiveApiKey(settings),
          retries,
          previousGeneration,
          getModel(settings),
          settings.writingStyle,
          settings.writingStylePrompt
        );
      } catch (e) {
        if (e instanceof GeminiAPIError) {
          throw new AiAPIError(e.message, e.code, e.statusCode);
        }
        throw e;
      }
    } else {
      if (provider === 'custom') {
        const base = (settings.aiBaseUrl || '').trim();
        if (!base) throw new AiAPIError('请填写自定义 Base URL', 'MISSING_BASE_URL');
        if (!getModel(settings)) throw new AiAPIError('请填写模型名称', 'MISSING_MODEL');
      }
      baseResult = await openAICompatibleSynthesize(fragments, lang, settings, retries, previousGeneration);
    }

    // 洞察改为根据已生成的日记正文单独生成，而非根据消息记录；skipInsight 时仅返回正文，由代理端客户端单独请求洞察以规避 10s 超时
    const md = (baseResult.markdownContent != null && String(baseResult.markdownContent).trim() !== '')
      ? baseResult.markdownContent
      : (previousGeneration || '');
    if (opts?.skipInsight) return { ...baseResult, aiInsights: '', markdownContent: md };
    const partial: Pick<WingEntry, 'title' | 'mood' | 'summary' | 'markdownContent'> = {
      title: baseResult.title ?? '',
      mood: baseResult.mood ?? '',
      summary: baseResult.summary ?? '',
      markdownContent: md
    };
    const aiInsights = await AiService.regenerateInsight(partial, lang, settings);
    return { ...baseResult, aiInsights, markdownContent: md };
  },

  /**
   * 仅根据日记内容重新生成心理洞察（约 50–100 字）
   * @param entry 日记条目（使用 title、mood、summary、markdownContent）
   * @param lang 语言
   * @param settings 应用设置
   * @returns 洞察纯文本
   */
  async regenerateInsight(
    entry: Pick<WingEntry, 'title' | 'mood' | 'summary' | 'markdownContent'>,
    lang: Language,
    settings: AppSettings
  ): Promise<string> {
    if (!getEffectiveApiKey(settings)) {
      throw new AiAPIError('请先在设置中配置 API 密钥', 'MISSING_API_KEY');
    }

    const provider = (settings.aiProvider || 'gemini') as AiProvider;

    if (USE_AI_PROXY) {
      const res = await fetch(AI_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'regenerateInsight',
          provider,
          apiKey: getEffectiveApiKey(settings),
          baseUrl: provider === 'custom' ? (settings.aiBaseUrl || '').trim() : undefined,
          model: getModel(settings),
          lang,
          entry,
          insightPrompt: settings.insightPrompt
        })
      });
      const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string; code?: string };
      if (!res.ok) {
        const msg = res.status === 504 ? '请求超时 (504)，请稍后重试。' : (data.error || res.statusText || `请求失败 (HTTP ${res.status})`);
        throw new AiAPIError(msg, res.status === 504 ? 'TIMEOUT' : data.code, res.status);
      }
      return data.text ?? '';
    }

    if (provider === 'gemini') {
      try {
        return await GeminiService.regenerateInsight(
          entry,
          lang,
          getEffectiveApiKey(settings),
          getModel(settings),
          settings.insightPrompt
        );
      } catch (e) {
        if (e instanceof GeminiAPIError) {
          throw new AiAPIError(e.message, e.code, e.statusCode);
        }
        throw e;
      }
    }

    if (provider === 'custom') {
      const base = (settings.aiBaseUrl || '').trim();
      if (!base) throw new AiAPIError('请填写自定义 Base URL', 'MISSING_BASE_URL');
      if (!getModel(settings)) throw new AiAPIError('请填写模型名称', 'MISSING_MODEL');
    }

    return openAICompatibleRegenerateInsight(entry, lang, settings);
  },

  /**
   * 测试 AI 连接
   * @param settings 应用设置
   * @returns { success, message }
   */
  async testConnection(settings: AppSettings): Promise<{ success: boolean; message: string }> {
    const key = getEffectiveApiKey(settings);
    if (!key) return { success: false, message: '请先填写 API 密钥' };

    const provider = (settings.aiProvider || 'gemini') as AiProvider;

    if (USE_AI_PROXY) {
      const res = await fetch(AI_PROXY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test',
          provider,
          apiKey: key,
          baseUrl: provider === 'custom' ? (settings.aiBaseUrl || '').trim() : undefined,
          model: getModel(settings)
        })
      });
      const data = (await res.json().catch(() => ({}))) as { success?: boolean; message?: string; error?: string };
      if (!res.ok) return { success: false, message: data.error || res.statusText || `请求失败 (HTTP ${res.status})` };
      return { success: !!data.success, message: data.message ?? '' };
    }

    if (provider === 'custom') {
      const base = (settings.aiBaseUrl || '').trim();
      if (!base) return { success: false, message: '请填写自定义 Base URL' };
      if (!getModel(settings)) return { success: false, message: '请填写模型名称' };
    }

    if (provider === 'openai' || provider === 'deepseek') {
      const model = getModel(settings);
      if (!model) return { success: false, message: '请填写模型名称' };
    }

    if (provider === 'gemini') {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey: key });
        const res = await ai.models.generateContent({
          model: getModel(settings),
          contents: 'Reply with exactly: OK'
        });
        const text = (res?.text || '').trim();
        return { success: true, message: text ? '连接成功' : '连接成功（无内容）' };
      } catch (e) {
        const msg = e instanceof Error ? e.message : '连接失败';
        return { success: false, message: msg };
      }
    }

    // OpenAI / DeepSeek / Custom
    const base = getBaseUrl(settings);
    const url = `${base}/v1/chat/completions`;
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify({
          model: getModel(settings),
          messages: [{ role: 'user', content: 'Hi' }],
          max_tokens: 10
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) return { success: true, message: '连接成功' };
      const errMsg = data?.error?.message || data?.message || res.statusText || `HTTP ${res.status}`;
      return { success: false, message: errMsg };
    } catch (e) {
      const msg = e instanceof Error ? e.message : '网络异常';
      return { success: false, message: msg };
    }
  }
};
