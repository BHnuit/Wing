
import { GoogleGenAI, Type } from "@google/genai";
import { RawFragment, WingEntry, WingTodo, Language } from "../types";

const getSystemInstruction = (lang: Language) => `Role: 你是 Wing App 的智能内核，一位敏锐的传记作家和心理咨询师。

Task: 接收用户一天内的碎片化记录，将其重组为结构化数据。
Language: Output MUST be in ${lang === 'zh' ? 'Simplified Chinese' : 'English'}.

Output Requirement: 
1. 必须只输出纯 JSON 字符串，不要包含 Markdown 标记。
2. JSON 格式必须符合定义的 Schema。
3. 文笔需流畅、内省。如果原文包含图片，请在适当位置保留 [Image] 标记。
4. 心理学视角的深度分析与鼓励（约 50-100 字）。`;

const WING_SCHEMA = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "简短优美的标题" },
    mood: { type: Type.STRING, description: "代表今日心情的Emoji" },
    summary: { type: Type.STRING, description: "一句话概括今日" },
    content_markdown: { type: Type.STRING, description: "使用 Markdown 撰写的第一人称日记正文" },
    insights: { type: Type.STRING, description: "心理学分析与鼓励" },
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
  required: ["title", "mood", "summary", "content_markdown", "insights", "todos"]
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

export const GeminiService = {
  /**
   * 合成日记
   * @param fragments 碎片化记录
   * @param lang 语言
   * @param retries 重试次数
   * @returns 合成的日记数据
   * @throws GeminiAPIError
   */
  async synthesizeJournal(
    fragments: RawFragment[], 
    lang: Language = 'zh',
    retries: number = 2
  ): Promise<Partial<WingEntry>> {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new GeminiAPIError('API Key is missing. Please configure it in settings.', 'MISSING_API_KEY');
    }

    if (fragments.length === 0) {
      throw new GeminiAPIError('No fragments to synthesize.', 'EMPTY_FRAGMENTS');
    }

    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const ai = new GoogleGenAI({ apiKey });
        
        const inputContext = fragments
          .sort((a, b) => a.timestamp - b.timestamp)
          .map(f => `[${new Date(f.timestamp).toLocaleTimeString()}] ${f.type === 'IMAGE' ? '[Image]' : ''} ${f.content}`)
          .join('\n');

        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: `这是用户今天的记录：\n\n${inputContext}`,
          config: {
            systemInstruction: getSystemInstruction(lang),
            responseMimeType: "application/json",
            responseSchema: WING_SCHEMA
          }
        });

        if (!response.text) {
          throw new GeminiAPIError('Empty response from API', 'EMPTY_RESPONSE');
        }

        let result;
        try {
          result = JSON.parse(response.text);
        } catch (parseError) {
          throw new GeminiAPIError(
            'Failed to parse API response. The response may not be valid JSON.',
            'PARSE_ERROR'
          );
        }

        // 验证必需字段
        const requiredFields = ['title', 'mood', 'summary', 'content_markdown', 'insights', 'todos'];
        const missingFields = requiredFields.filter(field => !result[field]);
        
        if (missingFields.length > 0) {
          throw new GeminiAPIError(
            `Missing required fields in response: ${missingFields.join(', ')}`,
            'INVALID_RESPONSE'
          );
        }
        
        return {
          title: result.title,
          mood: result.mood,
          summary: result.summary,
          markdownContent: result.content_markdown,
          aiInsights: result.insights,
          todos: result.todos
        };
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
  }
};
