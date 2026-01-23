/**
 * 长期记忆服务
 * 提供记忆提取、检索、更新等功能
 * 支持三种记忆类型：语义记忆、情景记忆、程序性记忆
 */

import { Memory, MemoryType, SemanticMemory, EpisodicMemory, ProceduralMemory, WingEntry, RawFragment, AppSettings, Language } from '../types';
import { IndexedDBStorage } from './indexedDBStorage';
import { AiService, getEffectiveApiKey, getModelResponseLanguage } from './aiService';
import { AiAPIError } from './aiService';

/**
 * 从日记中提取记忆
 * @param entry 日记条目
 * @param settings 应用设置
 * @returns 提取的记忆列表
 */
export async function extractMemoriesFromEntry(
  entry: WingEntry,
  settings: AppSettings
): Promise<Memory[]> {
  if (!getEffectiveApiKey(settings)) {
    throw new AiAPIError('请先在设置中配置 API 密钥', 'MISSING_API_KEY');
  }

  const lang = getModelResponseLanguage(settings);
  const provider = (settings.aiProvider || 'gemini') as string;

  // 构建提取记忆的 prompt
  const prompt = lang === 'zh'
    ? `请从以下日记中提取用户的长期记忆信息，输出 JSON 格式：

日记标题：${entry.title}
日记摘要：${entry.summary}
日记正文：${entry.markdownContent.substring(0, 2000)}${entry.markdownContent.length > 2000 ? '...' : ''}

请提取三类记忆：

1. **语义记忆（Semantic Memory）**：用户的基本事实信息
   - 例如：姓名、居住地、喜好（音乐、食物、活动等）、习惯（作息、工作等）
   - 格式：{"type": "semantic", "key": "记忆键（如 name, location, favorite_music）", "value": "记忆值"}

2. **情景记忆（Episodic Memory）**：特定时间、地点的事件和情绪
   - 例如："生日那天，我陪你听了歌"、"我们上周三深夜聊过失眠"
   - 格式：{"type": "episodic", "event": "事件描述", "emotion": "情绪（可选）", "date": "YYYY-MM-DD"}

3. **程序性记忆（Procedural Memory）**：用户的交互偏好和行为模式
   - 例如："不喜欢被打断"、"喜欢在夜晚倾诉"、"心情不好时用'唉……'开头"
   - 格式：{"type": "procedural", "pattern": "行为模式", "preference": "偏好描述", "trigger": "触发条件（可选）"}

输出要求：
- 只输出 JSON 数组，格式：[{...}, {...}]
- 如果日记中没有可提取的记忆，输出空数组 []
- 不要输出其他文字说明
- 语义记忆的 key 使用英文小写，如 name, location, favorite_music, sleep_habit
- 日期格式必须为 YYYY-MM-DD`
    : `Extract long-term memory information from the following journal entry, output in JSON format:

Title: ${entry.title}
Summary: ${entry.summary}
Content: ${entry.markdownContent.substring(0, 2000)}${entry.markdownContent.length > 2000 ? '...' : ''}

Extract three types of memories:

1. **Semantic Memory**: Basic factual information about the user
   - Examples: name, location, preferences (music, food, activities), habits (sleep, work)
   - Format: {"type": "semantic", "key": "memory key (e.g., name, location, favorite_music)", "value": "memory value"}

2. **Episodic Memory**: Specific events and emotions at particular times/places
   - Examples: "On your birthday, I listened to music with you", "We talked about insomnia late Wednesday night"
   - Format: {"type": "episodic", "event": "event description", "emotion": "emotion (optional)", "date": "YYYY-MM-DD"}

3. **Procedural Memory**: User interaction preferences and behavioral patterns
   - Examples: "doesn't like to be interrupted", "prefers to confide at night", "starts with 'sigh...' when feeling down"
   - Format: {"type": "procedural", "pattern": "behavior pattern", "preference": "preference description", "trigger": "trigger condition (optional)"}

Output requirements:
- Output only a JSON array, format: [{...}, {...}]
- If no memories can be extracted, output empty array []
- Do not output any other text
- Semantic memory keys should be lowercase English, e.g., name, location, favorite_music, sleep_habit
- Date format must be YYYY-MM-DD`;

  try {
    // 使用 AiService 的 testConnection 方式调用 API（简化实现）
    // 注意：这里直接调用 API，后续可以优化为通过 aiService
    const baseUrl = provider === 'custom' ? (settings.aiBaseUrl || '').trim() : undefined;
    const model = getModelForProvider(settings);
    const apiKey = getEffectiveApiKey(settings);

    if (!apiKey || !model) {
      throw new AiAPIError('请先配置 API 密钥和模型', 'MISSING_API_KEY');
    }

    // 对于 Gemini，使用 @google/genai SDK 的方式更可靠
    if (provider === 'gemini') {
      try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });
        const res = await ai.models.generateContent({
          model: model || 'gemini-2.0-flash-exp',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            maxOutputTokens: 2048
          }
        });
        const content = res.text || '';
        if (!content) return [];

        const raw = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
        let extracted: any[];
        try {
          const parsed = JSON.parse(raw);
          extracted = Array.isArray(parsed) ? parsed : (parsed.memories || parsed.data || []);
          if (!Array.isArray(extracted)) extracted = [];
        } catch {
          return [];
        }

        // 转换为 Memory 对象并保存
        const memories: Memory[] = [];
        const entryDate = new Date(entry.createdAt).toISOString().split('T')[0];

        for (const item of extracted) {
          if (item.type === 'semantic') {
            const memory: SemanticMemory = {
              id: crypto.randomUUID(),
              type: 'semantic',
              key: String(item.key || '').toLowerCase(),
              value: String(item.value || ''),
              confidence: 0.5,
              sourceEntryIds: [entry.id],
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            if (memory.key && memory.value) {
              memories.push(memory);
            }
          } else if (item.type === 'episodic') {
            const memory: EpisodicMemory = {
              id: crypto.randomUUID(),
              type: 'episodic',
              event: String(item.event || ''),
              emotion: item.emotion ? String(item.emotion) : undefined,
              date: item.date || entryDate,
              context: item.context ? String(item.context) : undefined,
              sourceEntryId: entry.id,
              createdAt: Date.now()
            };
            if (memory.event) {
              memories.push(memory);
            }
          } else if (item.type === 'procedural') {
            const memory: ProceduralMemory = {
              id: crypto.randomUUID(),
              type: 'procedural',
              pattern: String(item.pattern || ''),
              preference: String(item.preference || ''),
              trigger: item.trigger ? String(item.trigger) : undefined,
              frequency: 1,
              sourceEntryIds: [entry.id],
              createdAt: Date.now(),
              updatedAt: Date.now()
            };
            if (memory.pattern || memory.preference) {
              memories.push(memory);
            }
          }
        }

        // 保存到 IndexedDB
        for (const memory of memories) {
          IndexedDBStorage.putMemory(memory);
        }

        return memories;
      } catch (error) {
        console.error('Gemini 提取记忆失败:', error);
        throw error;
      }
    }

    const url = `${baseUrl || getBaseUrlForProvider(provider)}/v1/chat/completions`;

    const body = provider === 'gemini'
      ? {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { response_mime_type: 'application/json' }
        }
      : {
          model,
          messages: [
            { role: 'system', content: 'You are a memory extraction assistant. Output only valid JSON arrays, no markdown.' },
            { role: 'user', content: prompt }
          ],
          response_format: provider === 'custom' ? undefined : { type: 'json_object' },
          max_tokens: 2048
        };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new AiAPIError(
        errorData.error?.message || `提取记忆失败: ${res.statusText}`,
        'EXTRACTION_ERROR',
        res.status
      );
    }

    const json = await res.json();
    let content = '';
    if (provider === 'gemini') {
      content = json.candidates?.[0]?.content?.parts?.[0]?.text || '';
    } else {
      content = json.choices?.[0]?.message?.content || '';
    }

    if (!content) {
      return [];
    }

    // 解析 JSON
    const raw = content.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    let extracted: any[];
    try {
      const parsed = JSON.parse(raw);
      // 处理可能是对象的情况（某些 API 返回 {memories: [...]}）
      extracted = Array.isArray(parsed) ? parsed : (parsed.memories || parsed.data || []);
      if (!Array.isArray(extracted)) {
        extracted = [];
      }
    } catch {
      return [];
    }

    // 转换为 Memory 对象并保存
    const memories: Memory[] = [];
    const entryDate = new Date(entry.createdAt).toISOString().split('T')[0];

    for (const item of extracted) {
      if (item.type === 'semantic') {
        const memory: SemanticMemory = {
          id: crypto.randomUUID(),
          type: 'semantic',
          key: String(item.key || '').toLowerCase(),
          value: String(item.value || ''),
          confidence: 0.5,
          sourceEntryIds: [entry.id],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        if (memory.key && memory.value) {
          memories.push(memory);
        }
      } else if (item.type === 'episodic') {
        const memory: EpisodicMemory = {
          id: crypto.randomUUID(),
          type: 'episodic',
          event: String(item.event || ''),
          emotion: item.emotion ? String(item.emotion) : undefined,
          date: item.date || entryDate,
          context: item.context ? String(item.context) : undefined,
          sourceEntryId: entry.id,
          createdAt: Date.now()
        };
        if (memory.event) {
          memories.push(memory);
        }
      } else if (item.type === 'procedural') {
        const memory: ProceduralMemory = {
          id: crypto.randomUUID(),
          type: 'procedural',
          pattern: String(item.pattern || ''),
          preference: String(item.preference || ''),
          trigger: item.trigger ? String(item.trigger) : undefined,
          frequency: 1,
          sourceEntryIds: [entry.id],
          createdAt: Date.now(),
          updatedAt: Date.now()
        };
        if (memory.pattern || memory.preference) {
          memories.push(memory);
        }
      }
    }

    // 保存到 IndexedDB
    for (const memory of memories) {
      IndexedDBStorage.putMemory(memory);
    }

    return memories;
  } catch (error) {
    console.error('提取记忆失败:', error);
    throw error;
  }
}

/**
 * 检索相关记忆
 * @param fragments 当前记录片段
 * @param date 日期 YYYY-MM-DD
 * @param settings 应用设置
 * @returns 相关记忆列表
 */
export function getRelevantMemories(
  fragments: RawFragment[],
  date: string,
  settings: AppSettings
): Memory[] {
  if (!settings.enableLongTermMemory) {
    return [];
  }

  const allMemories = IndexedDBStorage.getMemories();
  const relevant: Memory[] = [];

  // 提取关键词（简单实现，后续可优化为更智能的提取）
  const keywords = extractKeywords(fragments);

  for (const memory of allMemories) {
    let score = 0;

    if (memory.type === 'semantic') {
      // 语义记忆：检查关键词是否匹配
      const mem = memory as SemanticMemory;
      if (keywords.some(kw => mem.key.includes(kw) || mem.value.includes(kw))) {
        score = mem.confidence;
      }
    } else if (memory.type === 'episodic') {
      // 情景记忆：检查日期相近或关键词匹配
      const mem = memory as EpisodicMemory;
      const daysDiff = Math.abs((new Date(date).getTime() - new Date(mem.date).getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff <= 30) {
        score = 0.7;
      }
      if (keywords.some(kw => mem.event.includes(kw))) {
        score = Math.max(score, 0.8);
      }
    } else if (memory.type === 'procedural') {
      // 程序性记忆：检查行为模式匹配
      const mem = memory as ProceduralMemory;
      if (keywords.some(kw => mem.pattern.includes(kw) || mem.preference.includes(kw))) {
        score = Math.min(mem.frequency / 10, 1);
      }
    }

    if (score > 0.3) {
      relevant.push(memory);
    }
  }

  // 按相关性排序
  return relevant.sort((a, b) => {
    const scoreA = getMemoryScore(a, keywords, date);
    const scoreB = getMemoryScore(b, keywords, date);
    return scoreB - scoreA;
  }).slice(0, 10); // 最多返回 10 条
}

/**
 * 获取记忆相关性分数
 */
function getMemoryScore(memory: Memory, keywords: string[], date: string): number {
  if (memory.type === 'semantic') {
    const mem = memory as SemanticMemory;
    return mem.confidence;
  } else if (memory.type === 'episodic') {
    const mem = memory as EpisodicMemory;
    const daysDiff = Math.abs((new Date(date).getTime() - new Date(mem.date).getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, 1 - daysDiff / 30);
  } else {
    const mem = memory as ProceduralMemory;
    return Math.min(mem.frequency / 10, 1);
  }
}

/**
 * 从片段中提取关键词（简单实现）
 */
function extractKeywords(fragments: RawFragment[]): string[] {
  const text = fragments.map(f => f.content).join(' ');
  const keywords: string[] = [];
  
  // 简单提取：常见词汇
  const commonWords = ['音乐', '电影', '工作', '学习', '朋友', '家人', '心情', '开心', '难过', '焦虑', '放松'];
  for (const word of commonWords) {
    if (text.includes(word)) {
      keywords.push(word);
    }
  }

  return keywords;
}

/**
 * 构建记忆上下文，用于注入到 AI prompt
 */
export function buildMemoryContext(memories: Memory[], lang: Language): string {
  if (memories.length === 0) {
    return '';
  }

  const semantic: SemanticMemory[] = [];
  const episodic: EpisodicMemory[] = [];
  const procedural: ProceduralMemory[] = [];

  for (const mem of memories) {
    if (mem.type === 'semantic') semantic.push(mem as SemanticMemory);
    else if (mem.type === 'episodic') episodic.push(mem as EpisodicMemory);
    else if (mem.type === 'procedural') procedural.push(mem as ProceduralMemory);
  }

  const parts: string[] = [];

  if (semantic.length > 0) {
    if (lang === 'zh') {
      parts.push('【用户画像】');
      for (const mem of semantic) {
        parts.push(`- ${mem.key}: ${mem.value}`);
      }
    } else {
      parts.push('【User Profile】');
      for (const mem of semantic) {
        parts.push(`- ${mem.key}: ${mem.value}`);
      }
    }
  }

  if (episodic.length > 0) {
    if (lang === 'zh') {
      parts.push('\n【相关回忆】');
      for (const mem of episodic.slice(0, 3)) {
        parts.push(`- ${mem.event}${mem.emotion ? ` (${mem.emotion})` : ''}`);
      }
    } else {
      parts.push('\n【Related Memories】');
      for (const mem of episodic.slice(0, 3)) {
        parts.push(`- ${mem.event}${mem.emotion ? ` (${mem.emotion})` : ''}`);
      }
    }
  }

  if (procedural.length > 0) {
    if (lang === 'zh') {
      parts.push('\n【交互偏好】');
      for (const mem of procedural.slice(0, 2)) {
        parts.push(`- ${mem.preference || mem.pattern}`);
      }
    } else {
      parts.push('\n【Interaction Preferences】');
      for (const mem of procedural.slice(0, 2)) {
        parts.push(`- ${mem.preference || mem.pattern}`);
      }
    }
  }

  return parts.join('\n') + '\n\n请结合以上信息，让日记更个性化、更有温度。';
}

/**
 * 更新记忆置信度（当相同记忆被多次提取时）
 */
export function updateMemoryConfidence(memoryId: string, increment: number = 0.1): void {
  const memories = IndexedDBStorage.getMemories();
  const memory = memories.find(m => m.id === memoryId);
  if (memory && memory.type === 'semantic') {
    const mem = memory as SemanticMemory;
    mem.confidence = Math.min(1, mem.confidence + increment);
    mem.updatedAt = Date.now();
    IndexedDBStorage.putMemory(mem);
  }
}

/**
 * 计算两个字符串的相似度（使用简单的字符重叠率）
 * @param str1 字符串1
 * @param str2 字符串2
 * @returns 相似度 0-1
 */
function calculateTextSimilarity(str1: string, str2: string): number {
  if (!str1 || !str2) return 0;
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();
  if (s1 === s2) return 1;
  
  // 计算共同字符数（简单实现）
  const chars1 = new Set(s1.split(''));
  const chars2 = new Set(s2.split(''));
  let common = 0;
  for (const char of chars1) {
    if (chars2.has(char)) common++;
  }
  const total = chars1.size + chars2.size;
  if (total === 0) return 0;
  
  // 也考虑子串匹配
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length > s2.length ? s2 : s1;
  let substringMatch = 0;
  for (let i = 0; i <= longer.length - shorter.length; i++) {
    if (longer.includes(shorter)) {
      substringMatch = shorter.length / longer.length;
      break;
    }
  }
  
  // 综合字符重叠率和子串匹配
  const charOverlap = (common * 2) / total;
  return Math.max(charOverlap, substringMatch * 0.8);
}

/**
 * 判断两个日期是否相近（相差 ≤ 30 天）
 * @param date1 日期1 (YYYY-MM-DD)
 * @param date2 日期2 (YYYY-MM-DD)
 * @returns 是否相近
 */
function areDatesClose(date1: string, date2: string): boolean {
  try {
    const d1 = new Date(date1 + 'T12:00:00');
    const d2 = new Date(date2 + 'T12:00:00');
    const diff = Math.abs(d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 30;
  } catch {
    return false;
  }
}

/**
 * 判断两个情绪是否匹配
 * @param emotion1 情绪1
 * @param emotion2 情绪2
 * @returns 是否匹配
 */
function areEmotionsMatching(emotion1?: string, emotion2?: string): boolean {
  if (!emotion1 && !emotion2) return true; // 都没有情绪，可以合并
  if (!emotion1 || !emotion2) return true; // 只有一个有情绪，可以合并（保留有情绪的）
  // 都有情绪，需要相同或相似
  return emotion1.toLowerCase().trim() === emotion2.toLowerCase().trim() ||
         calculateTextSimilarity(emotion1, emotion2) > 0.7;
}

/**
 * 合并相似记忆（去重）
 * 包括语义记忆和情景记忆
 */
export function mergeSimilarMemories(): void {
  const memories = IndexedDBStorage.getMemories();
  
  // 合并语义记忆
  const semanticMemories = memories.filter(m => m.type === 'semantic') as SemanticMemory[];
  const mergedSemantic = new Map<string, SemanticMemory>();

  for (const mem of semanticMemories) {
    const key = `${mem.type}:${mem.key}`;
    const existing = mergedSemantic.get(key);
    if (existing) {
      // 合并：提高置信度，合并来源
      existing.confidence = Math.min(1, existing.confidence + 0.1);
      existing.sourceEntryIds = [...new Set([...existing.sourceEntryIds, ...mem.sourceEntryIds])];
      existing.updatedAt = Date.now();
    } else {
      mergedSemantic.set(key, { ...mem });
    }
  }

  // 删除重复的语义记忆，保留合并后的
  for (const mem of semanticMemories) {
    const key = `${mem.type}:${mem.key}`;
    const mergedMem = mergedSemantic.get(key);
    if (mergedMem && mergedMem.id !== mem.id) {
      IndexedDBStorage.deleteMemory(mem.id);
    }
  }

  // 更新合并后的语义记忆
  for (const mem of mergedSemantic.values()) {
    IndexedDBStorage.putMemory(mem);
  }

  // 合并情景记忆
  const episodicMemories = memories.filter(m => m.type === 'episodic') as EpisodicMemory[];
  const processedIds = new Set<string>();
  const toDelete: string[] = [];

  for (let i = 0; i < episodicMemories.length; i++) {
    if (processedIds.has(episodicMemories[i].id)) continue;
    
    const mem1 = episodicMemories[i];
    const similar: EpisodicMemory[] = [mem1];
    
    // 查找相似的情景记忆
    for (let j = i + 1; j < episodicMemories.length; j++) {
      if (processedIds.has(episodicMemories[j].id)) continue;
      
      const mem2 = episodicMemories[j];
      
      // 检查是否相似：事件描述相似、日期相近、情绪匹配
      const eventSimilar = calculateTextSimilarity(mem1.event, mem2.event) >= 0.6;
      const dateClose = areDatesClose(mem1.date, mem2.date);
      const emotionMatch = areEmotionsMatching(mem1.emotion, mem2.emotion);
      
      if (eventSimilar && dateClose && emotionMatch) {
        similar.push(mem2);
        processedIds.add(mem2.id);
      }
    }
    
    // 如果有相似记忆，进行合并
    if (similar.length > 1) {
      // 选择最详细的事件描述（更长的）
      const mergedEvent = similar.reduce((prev, curr) => 
        curr.event.length > prev.event.length ? curr : prev
      ).event;
      
      // 保留较早的日期（事件发生时间）
      const mergedDate = similar.reduce((prev, curr) => 
        curr.date < prev.date ? curr : prev
      ).date;
      
      // 保留有情绪的描述，如果都有则保留更具体的
      const mergedEmotion = similar
        .filter(m => m.emotion)
        .reduce((prev, curr) => 
          !prev || (curr.emotion && curr.emotion.length > (prev.emotion?.length || 0)) ? curr : prev,
          similar[0]
        ).emotion;
      
      // 合并上下文（如果有）
      const mergedContext = similar
        .map(m => m.context)
        .filter((c): c is string => !!c)
        .join('；') || undefined;
      
      // 合并来源日记ID（虽然当前是单个，但为未来扩展保留）
      const mergedSourceEntryIds = [...new Set(similar.map(m => m.sourceEntryId))];
      
      // 创建合并后的记忆（保留第一条的ID，更新内容）
      const merged: EpisodicMemory = {
        ...mem1,
        event: mergedEvent,
        date: mergedDate,
        emotion: mergedEmotion,
        context: mergedContext,
        // 注意：EpisodicMemory 的 sourceEntryId 是单个字符串，这里我们保留第一个
        // 如果需要支持多个来源，需要修改类型定义
        sourceEntryId: mergedSourceEntryIds[0] || mem1.sourceEntryId
      };
      
      // 标记其他相似记忆为待删除
      for (let k = 1; k < similar.length; k++) {
        toDelete.push(similar[k].id);
      }
      
      // 更新合并后的记忆
      IndexedDBStorage.putMemory(merged);
      processedIds.add(mem1.id);
    } else {
      processedIds.add(mem1.id);
    }
  }

  // 删除重复的情景记忆
  for (const id of toDelete) {
    IndexedDBStorage.deleteMemory(id);
  }

  // 合并程序性记忆
  const proceduralMemories = memories.filter(m => m.type === 'procedural') as ProceduralMemory[];
  const processedProceduralIds = new Set<string>();
  const toDeleteProcedural: string[] = [];

  for (let i = 0; i < proceduralMemories.length; i++) {
    if (processedProceduralIds.has(proceduralMemories[i].id)) continue;
    
    const mem1 = proceduralMemories[i];
    const similar: ProceduralMemory[] = [mem1];
    
    // 查找相似的程序性记忆
    for (let j = i + 1; j < proceduralMemories.length; j++) {
      if (processedProceduralIds.has(proceduralMemories[j].id)) continue;
      
      const mem2 = proceduralMemories[j];
      
      // 检查 pattern 或 preference 是否相似（至少一个相似）
      const patternSimilar = mem1.pattern && mem2.pattern 
        ? calculateTextSimilarity(mem1.pattern, mem2.pattern) >= 0.6
        : false;
      const preferenceSimilar = mem1.preference && mem2.preference
        ? calculateTextSimilarity(mem1.preference, mem2.preference) >= 0.6
        : false;
      
      // 至少 pattern 或 preference 有一个相似
      const contentSimilar = patternSimilar || preferenceSimilar;
      
      // 检查 trigger 是否匹配
      let triggerMatch = true;
      if (mem1.trigger && mem2.trigger) {
        // 都有 trigger，需要相似
        triggerMatch = calculateTextSimilarity(mem1.trigger, mem2.trigger) >= 0.6;
      }
      // 如果只有一个有 trigger 或都没有，可以合并
      
      if (contentSimilar && triggerMatch) {
        similar.push(mem2);
        processedProceduralIds.add(mem2.id);
      }
    }
    
    // 如果有相似记忆，进行合并
    if (similar.length > 1) {
      // 选择更详细的 pattern（更长的，如果都存在）
      const mergedPattern = similar
        .filter(m => m.pattern)
        .reduce((prev, curr) => 
          !prev || (curr.pattern && curr.pattern.length > (prev.pattern?.length || 0)) ? curr : prev,
          similar.find(m => m.pattern) || similar[0]
        ).pattern;
      
      // 选择更详细的 preference（更长的，如果都存在）
      const mergedPreference = similar
        .filter(m => m.preference)
        .reduce((prev, curr) => 
          !prev || (curr.preference && curr.preference.length > (prev.preference?.length || 0)) ? curr : prev,
          similar.find(m => m.preference) || similar[0]
        ).preference;
      
      // 选择更具体的 trigger（更长的，如果都存在）
      const mergedTrigger = similar
        .filter(m => m.trigger)
        .reduce((prev, curr) => 
          !prev || (curr.trigger && curr.trigger.length > (prev.trigger?.length || 0)) ? curr : prev,
          similar.find(m => m.trigger) || undefined
        )?.trigger;
      
      // 累加 frequency
      const mergedFrequency = similar.reduce((sum, m) => sum + m.frequency, 0);
      
      // 合并来源日记ID
      const mergedSourceEntryIds = [...new Set(
        similar.flatMap(m => m.sourceEntryIds)
      )];
      
      // 创建合并后的记忆（保留第一条的ID，更新内容）
      const merged: ProceduralMemory = {
        ...mem1,
        pattern: mergedPattern || mem1.pattern,
        preference: mergedPreference || mem1.preference,
        trigger: mergedTrigger,
        frequency: mergedFrequency,
        sourceEntryIds: mergedSourceEntryIds,
        updatedAt: Date.now()
      };
      
      // 标记其他相似记忆为待删除
      for (let k = 1; k < similar.length; k++) {
        toDeleteProcedural.push(similar[k].id);
      }
      
      // 更新合并后的记忆
      IndexedDBStorage.putMemory(merged);
      processedProceduralIds.add(mem1.id);
    } else {
      processedProceduralIds.add(mem1.id);
    }
  }

  // 删除重复的程序性记忆
  for (const id of toDeleteProcedural) {
    IndexedDBStorage.deleteMemory(id);
  }
}

/**
 * 获取所有记忆
 */
export function getAllMemories(): Memory[] {
  return IndexedDBStorage.getMemories();
}

/**
 * 删除记忆
 */
export function deleteMemory(memoryId: string): void {
  IndexedDBStorage.deleteMemory(memoryId);
}

/**
 * 手动更新记忆
 */
export function updateMemory(memory: Memory): void {
  IndexedDBStorage.putMemory(memory);
}

/**
 * 辅助函数：获取模型名称
 */
function getModelForProvider(settings: AppSettings): string {
  const provider = (settings.aiProvider || 'gemini') as string;
  const models = settings.aiModels || {};
  const model = models[provider as keyof typeof models] || settings.aiModel || '';
  if (provider === 'gemini') return model || 'gemini-2.0-flash-exp';
  if (provider === 'openai') return model || 'gpt-4o-mini';
  if (provider === 'deepseek') return model || 'deepseek-chat';
  return model;
}

/**
 * 辅助函数：获取 Base URL
 */
function getBaseUrlForProvider(provider: string): string {
  if (provider === 'openai') return 'https://api.openai.com';
  if (provider === 'deepseek') return 'https://api.deepseek.com';
  return '';
}
