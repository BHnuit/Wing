import { GoogleGenAI, Type } from "@google/genai";
import { RawFragment, WingEntry, WingTodo, Language, WritingStyle } from "../types";
import { formatTimestampForPrompt } from "../utils/date";

/** 获取系统提示词（供 Gemini 与 OpenAI 兼容接口共用） */
export const getSystemInstruction = (lang: Language) => `Role: 你是 Wing App 的智能内核，一位敏锐的传记作家和心理咨询师。

Task: 接收用户一天内的碎片化记录，将其重组为结构化数据。
Language: Output MUST be in ${lang === 'zh' ? 'Simplified Chinese' : 'English'}.

Output Requirement: 
1. 必须只输出纯 JSON 字符串，不要包含 Markdown 标记。
2. JSON 格式必须符合定义的 Schema。
3. 文笔需流畅、内省。如果原文包含图片，请在适当位置保留 [Image] 标记。
4. 心理学视角的深度分析与鼓励（约 50-100 字）。`;

/** 预设文风对应的提示词（仅文风段落，供合成系统提示与设置页展示） */
export const WRITING_STYLE_PRESETS: Record<Exclude<WritingStyle, 'custom'>, string> = {
  letter: '日记正文采用书信体文风：如同写给某人或未来的自己的信，可使用第二人称「你」或称呼语，语气亲切、私密，可有开头的称呼与结尾的落款感。',
  prose: '日记正文采用散文体文风：行文自由、富有节奏感，可夹叙夹议，注重意境与情绪的自然流动，语言优美、留白适中。',
  report: '日记正文采用报告体文风：条理清晰、层次分明，可适当使用小标题或分点，客观记述与简要点评结合，简洁克制。'
};

/**
 * 根据文风与自定义内容获取文风相关的提示词段落
 * @param writingStyle 文风
 * @param customPrompt 自定义文风时的用户输入，仅当 writingStyle 为 custom 时使用
 * @returns 可追加到系统提示的文风段落，若无则返回空字符串
 */
export function getWritingStylePrompt(writingStyle: WritingStyle | undefined, customPrompt?: string): string {
  if (!writingStyle || writingStyle === 'custom') {
    const t = (customPrompt || '').trim();
    return t ? `\n\nWriting style (user-defined): ${t}` : '';
  }
  const p = WRITING_STYLE_PRESETS[writingStyle];
  return p ? `\n\n${p}` : '';
}

/** 合成日记用：不包含「洞察」要求，洞察将另根据生成的日记正文单独生成 */
export const getSystemInstructionForSynthesis = (
  lang: Language,
  opts?: { writingStyle?: WritingStyle; writingStylePrompt?: string }
) => {
  const timeNote = lang === 'zh' 
    ? '每条记录前的时间戳（如「上午 10:30」「下午 3:15」）表示用户记录时的具体时间，请结合时间信息理解记录的情景与情绪变化，在撰写日记时自然地体现时间脉络。'
    : 'The timestamp before each record (e.g., "10:30 AM", "3:15 PM") indicates the specific time when the user made the record. Please use this time information to understand the context and emotional changes, and naturally reflect the timeline in the diary.';
  
  const base = `Role: 你是 Wing App 的智能内核，一位敏锐的传记作家。

Task: 接收用户一天内的碎片化记录，将其重组为结构化数据。
Language: Output MUST be in ${lang === 'zh' ? 'Simplified Chinese' : 'English'}.

Output Requirement: 
1. 必须只输出纯 JSON 字符串，不要包含 Markdown 标记。
2. JSON 格式必须符合定义的 Schema。
3. 文笔需流畅、内省。如果原文包含图片，须在 content_markdown 中保留 [Image] 标记，数量与输入一致。
4. mood 必须为单个 emoji，**仅根据日记与记录内容**选取，禁止输出文字（如 happy、晴朗、calm）。
5. ${timeNote}`;
  const style = getWritingStylePrompt(opts?.writingStyle, opts?.writingStylePrompt);
  return base + style;
};

/** 合成日记用 Schema：不含 insights，洞察将根据生成的日记正文单独生成 */
const WING_SYNTHESIS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "简短优美的标题" },
    mood: { type: Type.STRING, description: "代表今日心情的单个 emoji，仅根据日记与记录内容选取，禁止输出文字，只能输出一个 emoji" },
    summary: { type: Type.STRING, description: "一句话概括今日" },
    content_markdown: { type: Type.STRING, description: "使用 Markdown 撰写的第一人称日记正文；若输入中有 [Image]，须在正文对应位置保留 [Image]，数量与输入一致" },
    todos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          priority: { type: Type.STRING, enum: ["high", "medium", "low"] }
        },
        required: ["title", "priority"]
      }
    }
  },
  required: ["title", "mood", "summary", "content_markdown", "todos"]
};

/** 仅生成日记正文的 Schema，用于三步合成第一步以降低单次请求超时 */
const BODY_ONLY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    content_markdown: { type: Type.STRING, description: "使用 Markdown 撰写的第一人称日记正文；若输入中有 [Image]，须在正文对应位置保留 [Image]，数量与输入一致" }
  },
  required: ["content_markdown"]
};

/** 仅生成正文用的系统提示：只要求 content_markdown */
export const getSystemInstructionForBodyOnly = (
  lang: Language,
  opts?: { writingStyle?: WritingStyle; writingStylePrompt?: string }
) => {
  const timeNote = lang === 'zh' 
    ? '每条记录前的时间戳（如「上午 10:30」「下午 3:15」）表示用户记录时的具体时间，请结合时间信息理解记录的情景与情绪变化，在撰写日记时自然地体现时间脉络。'
    : 'The timestamp before each record (e.g., "10:30 AM", "3:15 PM") indicates the specific time when the user made the record. Please use this time information to understand the context and emotional changes, and naturally reflect the timeline in the diary.';
  
  const base = `Role: 你是 Wing App 的智能内核，一位敏锐的传记作家。

Task: 根据用户一天内的碎片化记录，**仅**撰写第一人称日记正文（Markdown）。不输出标题、心情、概括、待办等，只输出 JSON 中的 content_markdown 字段。
Language: Output MUST be in ${lang === 'zh' ? 'Simplified Chinese' : 'English'}。

Output Requirement:
1. 必须只输出纯 JSON，形如 {"content_markdown":"..."}，不要包含 Markdown 代码块。
2. 文笔需流畅、内省。若输入中有 [Image]，须在正文对应位置保留 [Image]，数量与输入一致。
3. ${timeNote}`;
  const style = getWritingStylePrompt(opts?.writingStyle, opts?.writingStylePrompt);
  return base + style;
};

/** 根据正文生成标题、概括、心情的 Schema */
const META_ONLY_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "简短优美的标题" },
    mood: { type: Type.STRING, description: "代表心情的单个 emoji，仅根据正文选取，禁止输出文字" },
    summary: { type: Type.STRING, description: "一句话概括" }
  },
  required: ["title", "mood", "summary"]
};

/** 根据日记生成洞察与待办的 Schema */
const INSIGHT_TODOS_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    insights: { type: Type.STRING, description: "心理学视角的深度分析与鼓励，约 50–100 字" },
    todos: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          priority: { type: Type.STRING, enum: ["high", "medium", "low"] }
        },
        required: ["title", "priority"]
      }
    }
  },
  required: ["insights", "todos"]
};

/**
 * Gemini API 错误类型
 */
export class GeminiAPIError extends Error {
  constructor(
    message: string,
    public code?: string,
    public statusCode?: number
  ) {
    super(message);
    this.name = 'GeminiAPIError';
  }
}

/**
 * 构建供 API 使用的 fragment 文本：IMAGE 仅占位不带 content，避免 filename 等无关内容；
 * 若 content 为 data URL 或超长（>2000）则用 [已省略]，防止 base64 或异常长文本导致请求超限或失败。
 * @param f 碎片
 * @returns 安全的内容片段，供拼入 inputContext
 */
export function safeFragmentContentForPrompt(f: RawFragment): string {
  const isImage = f.type === 'IMAGE' || (f as { type?: string }).type === 'IMAGE';
  if (isImage) return '';
  const c = String(f.content ?? '');
  if (c.startsWith('data:') || c.length > 2000) return '[已省略]';
  return c;
}

export const GeminiService = {
  /**
   * 合成日记
   * @param fragments 碎片化记录
   * @param lang 语言
   * @param apiKey API密钥（从设置中获取）
   * @param retries 重试次数
   * @param previousGeneration 可选，已生成的日记正文（重新生成时并入上下文）
   * @returns 合成的日记数据
   * @throws GeminiAPIError
   */
  async synthesizeJournal(
    fragments: RawFragment[], 
    lang: Language = 'zh',
    apiKey?: string,
    retries: number = 2,
    previousGeneration?: string,
    /** 模型名称，留空使用默认 gemini-3-flash-preview */
    model?: string,
    /** 文风及自定义提示词，用于系统提示 */
    writingStyle?: WritingStyle,
    writingStylePrompt?: string
  ): Promise<Partial<WingEntry>> {
    // 优先使用传入的 apiKey，否则尝试从环境变量读取（用于开发环境）
    const key = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new GeminiAPIError('API Key is missing. Please configure it in settings.', 'MISSING_API_KEY');
    }

    if (fragments.length === 0 && !previousGeneration?.trim()) {
      throw new GeminiAPIError('No fragments to synthesize.', 'EMPTY_FRAGMENTS');
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        
        const inputContext = fragments
          .sort((a, b) => a.timestamp - b.timestamp)
          .map(f => `[${formatTimestampForPrompt(f.timestamp, lang)}] ${f.type === 'IMAGE' ? '[Image]' : ''} ${safeFragmentContentForPrompt(f)}`)
          .join('\n');

        let fullInput = `这是用户今天的记录：\n\n${inputContext}`;
        if (previousGeneration?.trim()) {
          const pg = previousGeneration.length > 30000 ? previousGeneration.slice(0, 30000) + '\n\n...(正文过长已截断)' : previousGeneration;
          fullInput += `\n\n[已生成的日记正文，供重新生成时参考]\n${pg}\n\n【重新生成】content_markdown 必须为**重新撰写**的正文：请对上述原文进行重写、润色或合并当日新记录，**禁止逐字照抄原文**，输出的正文须在表述、结构或详略上与原文有可见差异。todos：从当日记录或上述正文中提取待办，若无则填 []。`;
        }

        const response = await ai.models.generateContent({
          model: model || 'gemini-3-flash-preview',
          contents: fullInput,
          config: {
            systemInstruction: getSystemInstructionForSynthesis(lang, { writingStyle, writingStylePrompt }),
            responseMimeType: "application/json",
            responseSchema: WING_SYNTHESIS_SCHEMA,
            /** 限制输出长度以降低长文生成导致的 504 超时（如 Netlify 10s） */
            maxOutputTokens: 8192
          }
        });

        if (!response.text) {
          throw new GeminiAPIError('Empty response from API', 'EMPTY_RESPONSE');
        }

        let result = parseSynthesisResult(response.text, previousGeneration, fragments);
        return result;
      } catch (error) {
        lastError = error as Error;

        // 如果是最后一次尝试，抛出错误
        if (attempt === retries) {
          break;
        }

        // 等待后重试（指数退避）
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }

    // 处理不同类型的错误
    if (lastError instanceof GeminiAPIError) {
      throw lastError;
    }

    // 网络错误
    if (lastError instanceof TypeError && lastError.message.includes('fetch')) {
      throw new GeminiAPIError(
        'Network error. Please check your internet connection.',
        'NETWORK_ERROR'
      );
    }

    // 其他错误
    throw new GeminiAPIError(
      lastError?.message || 'Unknown error occurred during synthesis',
      'UNKNOWN_ERROR'
    );
  },

  /**
   * 流式合成日记：逐块返回 JSON 文本，用于代理层尽早发送首字节以降低 TTFB 超时
   * @param fragments 碎片化记录
   * @param lang 语言
   * @param apiKey API 密钥
   * @param retries 重试次数
   * @param previousGeneration 已生成的日记正文（重新生成时）
   * @param model 模型名
   * @yields 原始 JSON 文本块
   */
  async *synthesizeJournalStream(
    fragments: RawFragment[],
    lang: Language = 'zh',
    apiKey?: string,
    retries: number = 2,
    previousGeneration?: string,
    model?: string,
    writingStyle?: WritingStyle,
    writingStylePrompt?: string
  ): AsyncGenerator<string> {
    const key = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new GeminiAPIError('API Key is missing. Please configure it in settings.', 'MISSING_API_KEY');
    }

    if (fragments.length === 0 && !previousGeneration?.trim()) {
      throw new GeminiAPIError('No fragments to synthesize.', 'EMPTY_FRAGMENTS');
    }

    const inputContext = fragments
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(f => `[${formatTimestampForPrompt(f.timestamp, lang)}] ${f.type === 'IMAGE' ? '[Image]' : ''} ${safeFragmentContentForPrompt(f)}`)
      .join('\n');

    let fullInput = `这是用户今天的记录：\n\n${inputContext}`;
    if (previousGeneration?.trim()) {
      const pg = previousGeneration.length > 30000 ? previousGeneration.slice(0, 30000) + '\n\n...(正文过长已截断)' : previousGeneration;
      fullInput += `\n\n[已生成的日记正文，供重新生成时参考]\n${pg}\n\n【重新生成】content_markdown 必须为**重新撰写**的正文：请对上述原文进行重写、润色或合并当日新记录，**禁止逐字照抄原文**，输出的正文须在表述、结构或详略上与原文有可见差异。todos：从当日记录或上述正文中提取待办，若无则填 []。`;
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const stream = await ai.models.generateContentStream({
          model: model || 'gemini-3-flash-preview',
          contents: fullInput,
          config: {
            systemInstruction: getSystemInstructionForSynthesis(lang, { writingStyle, writingStylePrompt }),
            responseMimeType: "application/json",
            responseSchema: WING_SYNTHESIS_SCHEMA,
            /** 限制输出长度以降低 504 超时概率 */
            maxOutputTokens: 8192
          }
        });

        for await (const chunk of stream) {
          const t = chunk?.text;
          if (t && typeof t === 'string') yield t;
        }
        return;
      } catch (error) {
        lastError = error as Error;
        if (attempt === retries) break;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }

    if (lastError instanceof GeminiAPIError) throw lastError;
    if (lastError instanceof TypeError && (lastError.message || '').includes('fetch')) {
      throw new GeminiAPIError('Network error. Please check your internet connection.', 'NETWORK_ERROR');
    }
    throw new GeminiAPIError(lastError?.message || 'Stream synthesis failed', 'UNKNOWN_ERROR');
  },

  /**
   * 仅生成日记正文（三步合成第一步），可流式；用于降低单次请求超时
   * @param fragments 碎片
   * @param lang 语言
   * @param apiKey API 密钥
   * @param retries 重试次数
   * @param previousGeneration 再次收拢时的已有正文
   * @param model 模型名
   * @param writingStyle 文风
   * @param writingStylePrompt 自定义文风
   * @returns { markdownContent }
   */
  async synthesizeJournalBody(
    fragments: RawFragment[],
    lang: Language = 'zh',
    apiKey?: string,
    retries: number = 2,
    previousGeneration?: string,
    model?: string,
    writingStyle?: WritingStyle,
    writingStylePrompt?: string,
    customPrompt?: string
  ): Promise<{ markdownContent: string }> {
    const key = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!key) throw new GeminiAPIError('API Key is missing. Please configure it in settings.', 'MISSING_API_KEY');
    if (fragments.length === 0 && !previousGeneration?.trim()) throw new GeminiAPIError('No fragments to synthesize.', 'EMPTY_FRAGMENTS');

    const inputContext = fragments
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(f => `[${formatTimestampForPrompt(f.timestamp, lang)}] ${f.type === 'IMAGE' ? '[Image]' : ''} ${safeFragmentContentForPrompt(f)}`)
      .join('\n');
    let fullInput = `这是用户今天的记录：\n\n${inputContext}`;
    if (previousGeneration?.trim()) {
      const pg = previousGeneration.length > 30000 ? previousGeneration.slice(0, 30000) + '\n\n...(正文过长已截断)' : previousGeneration;
      fullInput += `\n\n[已生成的日记正文，供重新生成时参考]\n${pg}\n\n【重新生成】content_markdown 必须为**重新撰写**的正文，禁止逐字照抄。`;
    }
    if (customPrompt?.trim()) {
      fullInput += `\n\n【用户自定义要求】\n${customPrompt.trim()}`;
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const res = await ai.models.generateContent({
          model: model || 'gemini-3-flash-preview',
          contents: fullInput,
          config: {
            systemInstruction: getSystemInstructionForBodyOnly(lang, { writingStyle, writingStylePrompt }),
            responseMimeType: 'application/json',
            responseSchema: BODY_ONLY_SCHEMA,
            maxOutputTokens: 8192
          }
        });
        if (!res.text) throw new GeminiAPIError('Empty response from API', 'EMPTY_RESPONSE');
        return parseBodyOnlyResult(res.text, fragments);
      } catch (e) {
        lastError = e as Error;
        if (e instanceof GeminiAPIError) throw e;
        if (attempt === retries) break;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
    if (lastError instanceof GeminiAPIError) throw lastError;
    if (lastError instanceof TypeError && (lastError.message || '').includes('fetch')) throw new GeminiAPIError('Network error. Please check your internet connection.', 'NETWORK_ERROR');
    throw new GeminiAPIError(lastError?.message || 'Body synthesis failed', 'UNKNOWN_ERROR');
  },

  /**
   * 流式仅生成日记正文（三步合成第一步），逐块 yield JSON 文本
   */
  async *synthesizeJournalBodyStream(
    fragments: RawFragment[],
    lang: Language = 'zh',
    apiKey?: string,
    retries: number = 2,
    previousGeneration?: string,
    model?: string,
    writingStyle?: WritingStyle,
    writingStylePrompt?: string
  ): AsyncGenerator<string> {
    const key = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!key) throw new GeminiAPIError('API Key is missing. Please configure it in settings.', 'MISSING_API_KEY');
    if (fragments.length === 0 && !previousGeneration?.trim()) throw new GeminiAPIError('No fragments to synthesize.', 'EMPTY_FRAGMENTS');

    const inputContext = fragments
      .sort((a, b) => a.timestamp - b.timestamp)
      .map(f => `[${formatTimestampForPrompt(f.timestamp, lang)}] ${f.type === 'IMAGE' ? '[Image]' : ''} ${safeFragmentContentForPrompt(f)}`)
      .join('\n');
    let fullInput = `这是用户今天的记录：\n\n${inputContext}`;
    if (previousGeneration?.trim()) {
      const pg = previousGeneration.length > 30000 ? previousGeneration.slice(0, 30000) + '\n\n...(正文过长已截断)' : previousGeneration;
      fullInput += `\n\n[已生成的日记正文，供重新生成时参考]\n${pg}\n\n【重新生成】content_markdown 必须为**重新撰写**的正文，禁止逐字照抄。`;
    }

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const stream = await ai.models.generateContentStream({
          model: model || 'gemini-3-flash-preview',
          contents: fullInput,
          config: {
            systemInstruction: getSystemInstructionForBodyOnly(lang, { writingStyle, writingStylePrompt }),
            responseMimeType: 'application/json',
            responseSchema: BODY_ONLY_SCHEMA,
            maxOutputTokens: 8192
          }
        });
        for await (const chunk of stream) {
          const t = chunk?.text;
          if (t && typeof t === 'string') yield t;
        }
        return;
      } catch (e) {
        lastError = e as Error;
        if (e instanceof GeminiAPIError) throw e;
        if (attempt === retries) break;
        await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
    if (lastError instanceof GeminiAPIError) throw lastError;
    if (lastError instanceof TypeError && (lastError.message || '').includes('fetch')) throw new GeminiAPIError('Network error. Please check your internet connection.', 'NETWORK_ERROR');
    throw new GeminiAPIError(lastError?.message || 'Body stream failed', 'UNKNOWN_ERROR');
  },

  /**
   * 根据日记正文生成标题、概括、心情（三步合成第二步）
   */
  async synthesizeJournalMeta(
    markdownContent: string,
    lang: Language = 'zh',
    apiKey?: string,
    model?: string
  ): Promise<{ title: string; summary: string; mood: string }> {
    const key = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!key) throw new GeminiAPIError('API Key is missing. Please configure it in settings.', 'MISSING_API_KEY');

    const md = (markdownContent || '').trim() || '（无）';
    const mdSafe = md.length > 6000 ? md.slice(0, 6000) + '\n\n...(过长已截断)' : md;
    const user = `根据以下日记正文，输出 JSON：title（简短优美标题）、mood（单个 emoji，仅根据正文选取）、summary（一句话概括）。语言：${lang === 'zh' ? '简体中文' : 'English'}。\n\n正文：\n${mdSafe}`;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const res = await ai.models.generateContent({
          model: model || 'gemini-3-flash-preview',
          contents: user,
          config: { responseMimeType: 'application/json', responseSchema: META_ONLY_SCHEMA, maxOutputTokens: 512 }
        });
        if (!res.text) throw new GeminiAPIError('Empty response', 'EMPTY_RESPONSE');
        const raw = String(res.text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const obj = JSON.parse(raw) as Record<string, unknown>;
        const title = obj.title != null ? String(obj.title) : '';
        const summary = obj.summary != null ? String(obj.summary) : '';
        const mood = obj.mood != null ? String(obj.mood) : '🌿';
        return { title, summary, mood };
      } catch (e) {
        lastError = e as Error;
        if (e instanceof GeminiAPIError) throw e;
        if (attempt < 2) await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
    if (lastError instanceof GeminiAPIError) throw lastError;
    throw new GeminiAPIError(lastError?.message || 'Meta synthesis failed', 'UNKNOWN_ERROR');
  },

  /**
   * 根据日记生成洞察与待办（三步合成第三步）
   * @param entry 含 title、mood、summary、markdownContent
   * @returns { aiInsights, todos }
   */
  async regenerateInsightAndTodos(
    entry: Pick<WingEntry, 'title' | 'mood' | 'summary' | 'markdownContent'>,
    lang: Language = 'zh',
    apiKey?: string,
    model?: string,
    insightPrompt?: string
  ): Promise<{ aiInsights: string; todos: WingTodo[] }> {
    const key = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!key) throw new GeminiAPIError('API Key is missing. Please configure it in settings.', 'MISSING_API_KEY');

    const instruction = (insightPrompt && insightPrompt.trim())
      ? insightPrompt.trim()
      : `根据以下日记，输出 JSON：insights（心理学视角的深度分析与鼓励，约 50–100 字）、todos（从正文或概括中提取的待办数组，每项 { title, priority: high|medium|low }，若无则 []）。语言：${lang === 'zh' ? '简体中文' : 'English'}。`;
    const md = (entry.markdownContent || '').trim() || '（无）';
    const mdSafe = md.length > 4000 ? md.slice(0, 4000) + '\n...(过长已截断)' : md;
    const user = `${instruction}\n\n标题：${entry.title || '（无）'}\n心情：${entry.mood || '（无）'}\n概括：${entry.summary || '（无）'}\n正文：\n${mdSafe}`;

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const res = await ai.models.generateContent({
          model: model || 'gemini-3-flash-preview',
          contents: user,
          config: { responseMimeType: 'application/json', responseSchema: INSIGHT_TODOS_SCHEMA, maxOutputTokens: 1024 }
        });
        if (!res.text) throw new GeminiAPIError('Empty response', 'EMPTY_RESPONSE');
        const raw = String(res.text).trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        const obj = JSON.parse(raw) as Record<string, unknown>;
        const aiInsights = (obj.insights != null ? String(obj.insights) : '').trim();
        const rawTodos = Array.isArray(obj.todos) ? obj.todos : [];
        const todos = rawTodos.map((t: unknown) => {
          const o = (t && typeof t === 'object' && t !== null) ? t as Record<string, unknown> : {};
          return { title: String(o.title ?? ''), priority: String(o.priority ?? 'medium') as 'high' | 'medium' | 'low' };
        }).filter((x) => x.title.trim());
        return { aiInsights, todos };
      } catch (e) {
        lastError = e as Error;
        if (e instanceof GeminiAPIError) throw e;
        if (attempt < 2) await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
      }
    }
    if (lastError instanceof GeminiAPIError) throw lastError;
    throw new GeminiAPIError(lastError?.message || 'Insight and todos failed', 'UNKNOWN_ERROR');
  },

  /**
   * 仅根据日记内容重新生成心理洞察（约 50–100 字）
   * @param entry 日记条目（使用 title、mood、summary、markdownContent）
   * @param lang 语言
   * @param apiKey API 密钥
   * @param model 模型名，留空用默认
   * @param insightPrompt 自定义洞察提示语，留空用默认
   * @returns 洞察纯文本
   * @throws GeminiAPIError
   */
  async regenerateInsight(
    entry: Pick<WingEntry, 'title' | 'mood' | 'summary' | 'markdownContent'>,
    lang: Language = 'zh',
    apiKey?: string,
    model?: string,
    insightPrompt?: string
  ): Promise<string> {
    const key = apiKey || process.env.API_KEY || process.env.GEMINI_API_KEY;
    if (!key) {
      throw new GeminiAPIError('API Key is missing. Please configure it in settings.', 'MISSING_API_KEY');
    }

    const content = buildInsightUserContent(entry, lang, insightPrompt);

    let lastError: Error | null = null;
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const ai = new GoogleGenAI({ apiKey: key });
        const res = await ai.models.generateContent({
          model: model || 'gemini-3-flash-preview',
          contents: content
        });
        const text = (res?.text || '').trim().replace(/^["']|["']$/g, '');
        if (text) return text;
        throw new GeminiAPIError('Empty response from API', 'EMPTY_RESPONSE');
      } catch (e) {
        lastError = e as Error;
        if (e instanceof GeminiAPIError) throw e;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000));
        }
      }
    }
    if (lastError instanceof GeminiAPIError) throw lastError;
    if (lastError instanceof TypeError && (lastError.message || '').includes('fetch')) {
      throw new GeminiAPIError('Network error. Please check your internet connection.', 'NETWORK_ERROR');
    }
    throw new GeminiAPIError(lastError?.message || 'Insight generation failed', 'UNKNOWN_ERROR');
  }
};

/** 猫头鹰洞察的默认指令（未设置自定义时使用） */
const DEFAULT_INSIGHT_INSTRUCTION = (lang: Language) =>
  `根据以下日记，仅输出一段心理学视角的深度分析与鼓励（约 50–100 字），使用${lang === 'zh' ? '简体中文' : 'English'}。不要加引号、标题或前后缀，只输出正文。`;

/**
 * 构建洞察生成所用的用户消息：指令 + 日记结构化内容
 * @param entry 日记条目
 * @param lang 语言
 * @param insightPrompt 自定义提示语，留空则用默认
 * @returns 完整的 user 消息文本
 */
export function buildInsightUserContent(
  entry: Pick<WingEntry, 'title' | 'mood' | 'summary' | 'markdownContent'>,
  lang: Language,
  insightPrompt?: string
): string {
  const instruction = (insightPrompt && insightPrompt.trim())
    ? insightPrompt.trim()
    : DEFAULT_INSIGHT_INSTRUCTION(lang);
  const md = entry.markdownContent || '（无）';
  const mdSafe = md.length > 6000 ? md.slice(0, 6000) + '\n\n...(正文过长已截断)' : md;
  return `${instruction}

标题：${entry.title || '（无）'}
心情：${entry.mood || '（无）'}
概括：${entry.summary || '（无）'}
正文：\n${mdSafe}`;
}

/** 解析仅正文的 JSON 并做 [Image] 占位补全；供 synthesizeJournalBody 与流式解析共用 */
export function parseBodyOnlyResult(rawText: string, fragments: RawFragment[]): { markdownContent: string } {
  const raw = String(rawText || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new GeminiAPIError('Failed to parse API response. The response may not be valid JSON.', 'PARSE_ERROR');
  }
  const rawMd = result.content_markdown ?? result.contentMarkdown;
  let md = (rawMd != null && String(rawMd).trim() !== '') ? String(rawMd) : '';
  const imageCount = fragments.filter((f) => (f as { type?: string }).type === 'IMAGE').length;
  const placeholders = (md.match(/\[Image\]/gi) || []).length;
  for (let i = placeholders; i < imageCount; i++) md += '\n\n[Image]\n\n';
  return { markdownContent: md };
}

/** 解析合成结果 JSON 并做 [Image] 占位补全，返回 WingEntry 部分字段；供 geminiService 与 aiHandler 流式解析共用 */
export function parseSynthesisResult(
  rawText: string,
  previousGeneration: string | undefined,
  fragments: RawFragment[]
): Partial<WingEntry> {
  /** 兼容国内中转等返回 ```json ... ``` 包裹 */
  const raw = String(rawText || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  let result: Record<string, unknown>;
  try {
    result = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    throw new GeminiAPIError(
      'Failed to parse API response. The response may not be valid JSON.',
      'PARSE_ERROR'
    );
  }
  const requiredFields = (previousGeneration?.trim() ? ['title', 'mood', 'summary', 'todos'] : ['title', 'mood', 'summary', 'content_markdown', 'todos']) as string[];
  const missingFields = requiredFields.filter(field => !result[field]);
  if (missingFields.length > 0) {
    throw new GeminiAPIError(
      `Missing required fields in response: ${missingFields.join(', ')}`,
      'INVALID_RESPONSE'
    );
  }
  let rawMd = result.content_markdown ?? result.contentMarkdown;
  let md = (rawMd != null && String(rawMd).trim() !== '') ? String(rawMd) : (previousGeneration ?? '');
  const imageCount = fragments.filter((f) => (f as { type?: string }).type === 'IMAGE').length;
  const placeholders = (md.match(/\[Image\]/gi) || []).length;
  for (let i = placeholders; i < imageCount; i++) md += '\n\n[Image]\n\n';
  return {
    title: result.title,
    mood: result.mood,
    summary: result.summary,
    markdownContent: md,
    todos: result.todos
  };
}
