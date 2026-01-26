/**
 * 会话状态枚举
 * @enum {string}
 */
export enum SessionStatus {
  /** 正在记录中 */
  RECORDING = 'RECORDING',
  /** 正在处理中（AI 合成中） */
  PROCESSING = 'PROCESSING',
  /** 已完成（已生成日记） */
  COMPLETED = 'COMPLETED'
}

/**
 * 碎片类型枚举
 * @enum {string}
 */
export enum FragmentType {
  /** 文本类型 */
  TEXT = 'TEXT',
  /** 图片类型 */
  IMAGE = 'IMAGE'
}

/**
 * 语言类型
 * @typedef {'zh' | 'en'} Language
 */
export type Language = 'zh' | 'en';

/**
 * AI 供应商类型
 * @typedef {'gemini' | 'openai' | 'deepseek' | 'custom'} AiProvider
 * - gemini: Google Gemini API
 * - openai: OpenAI API
 * - deepseek: DeepSeek API
 * - custom: 自定义 Base URL
 */
export type AiProvider = 'gemini' | 'openai' | 'deepseek' | 'custom';

/**
 * 文风类型
 * @typedef {'letter' | 'prose' | 'report' | 'custom'} WritingStyle
 * - letter: 书信体
 * - prose: 散文体
 * - report: 报告体
 * - custom: 自定义文风
 */
export type WritingStyle = 'letter' | 'prose' | 'report' | 'custom';

/**
 * 原始碎片记录接口
 * 表示用户输入的单个记录片段（文本或图片）
 * @interface RawFragment
 */
export interface RawFragment {
  /** 唯一标识符 */
  id: string;
  /** 文本内容（图片类型时可能为空或包含描述） */
  content: string;
  /** 图片数据（Base64 编码），仅当 type 为 IMAGE 时存在 */
  imageData?: string;
  /** 时间戳（Unix 毫秒） */
  timestamp: number;
  /** 碎片类型 */
  type: FragmentType;
  /** 编辑时间戳（Unix 毫秒），若存在则表示消息已被编辑，用于显示「已编辑 HH:mm」 */
  editedAt?: number;
}

/**
 * 待办事项接口
 * @interface WingTodo
 */
export interface WingTodo {
  /** 待办标题 */
  title: string;
  /** 优先级 */
  priority: 'high' | 'medium' | 'low';
  /** 是否已完成；未设置视为 false */
  completed?: boolean;
}

/**
 * 编辑历史单条记录
 * 保存编辑前的 title 与 markdownContent 快照，用于恢复旧版本
 * @interface EditHistoryItem
 */
export interface EditHistoryItem {
  /** 创建时间戳（Unix 毫秒） */
  createdAt: number;
  /** 编辑前的标题 */
  title: string;
  /** 编辑前的 Markdown 内容 */
  markdownContent: string;
}

/**
 * 日记条目接口
 * 表示由 AI 合成的完整日记，包含标题、摘要、正文、洞察、待办等
 * @interface WingEntry
 */
export interface WingEntry {
  /** 唯一标识符 */
  id: string;
  /** 日记标题 */
  title: string;
  /** 一句话摘要 */
  summary: string;
  /** 心情 emoji（单个 emoji 字符） */
  mood: string;
  /** Markdown 格式的日记正文 */
  markdownContent: string;
  /** AI 生成的洞察（心理学视角的深度分析与鼓励） */
  aiInsights: string;
  /** 待办事项列表 */
  todos: WingTodo[];
  /** 创建时间戳（Unix 毫秒） */
  createdAt: number;
  /** 图片映射：fragmentId -> base64 imageData */
  images?: { [key: string]: string };
  /** 最后手动编辑时间戳（Unix 毫秒），用于显示「已编辑 HH:mm」 */
  editedAt?: number;
  /** 编辑历史（仅当设置「保留编辑历史」时写入），可恢复 */
  editHistory?: EditHistoryItem[];
  /** 收拢生成完成时间戳（Unix 毫秒），用于猫头鹰消息的时间标记 */
  generatedAt?: number;
}

/**
 * 每日会话接口
 * 表示一天内的所有碎片记录和对应的日记生成状态
 * @interface DailySession
 */
export interface DailySession {
  /** 唯一标识符 */
  id: string;
  /** 日期（YYYY-MM-DD 格式） */
  date: string;
  /** 会话状态 */
  status: SessionStatus;
  /** 碎片记录列表 */
  fragments: RawFragment[];
  /** 最终生成的日记条目 ID（当 status 为 COMPLETED 时存在） */
  finalEntryId?: string;
  /** 当天每次触发收拢的时间戳数组，用于展示「HH:mm 开始收拢羽毛」；再次生成则追加 */
  gatherStartedAt?: number[];
  /** 每次收拢完成记录，用于按时间叠加展示「已生成《xx》」；再次生成覆盖同一日记时追加 */
  gatherCompletions?: { completedAt: number; entryId: string; title: string }[];
}

/**
 * 应用设置接口
 * 存储用户的所有配置选项，包括 AI 配置、界面设置、功能开关等
 * @interface AppSettings
 */
export interface AppSettings {
  /** 
   * @deprecated 使用 apiKeys 按供应商存储；仅作向后兼容
   * 旧版 API Key，新版本应使用 apiKeys
   */
  apiKey?: string;
  /** 
   * 按 AI 供应商分别存储的 API Key
   * 切换供应商时保留各自已填写的密钥，避免重复输入
   */
  apiKeys?: Partial<Record<AiProvider, string>>;
  /** AI 供应商选择 */
  aiProvider?: AiProvider;
  /** 自定义 API Base URL（仅当 aiProvider 为 custom 时使用） */
  aiBaseUrl?: string;
  /** 
   * @deprecated 使用 aiModels 按供应商存储；仅作向后兼容
   * 旧版模型名称，新版本应使用 aiModels
   */
  aiModel?: string;
  /** 
   * 按 AI 供应商分别存储的模型名称
   * 留空则使用该供应商默认模型
   */
  aiModels?: Partial<Record<AiProvider, string>>;
  /** 界面语言 */
  language: Language;
  /** 页面主题：system 跟随系统、light 亮色、dark 暗色 */
  theme?: 'system' | 'light' | 'dark';
  /** 页面字体：system 系统默认、source-han-sans 思源黑体、source-han-serif 思源宋体、xlwk 霞鹜文楷 */
  pageFont?: 'system' | 'source-han-sans' | 'source-han-serif' | 'xlwk';
  /** 全站字号：large 大、medium 中、small 小，未设置时视为 medium */
  fontSize?: 'large' | 'medium' | 'small';
  /** 模型返回内容的语言：zh / en / same（与页面一致） */
  modelLanguage?: 'zh' | 'en' | 'same';
  /** 手动编辑日记时是否写入编辑历史，以便恢复旧版本 */
  keepEditHistory?: boolean;
  /** 导出时是否备份所有设置（模型配置等密钥信息），默认开启；关闭时仅导出日记与记录 */
  backupApiKeys?: boolean;
  /** 文风：letter 书信体、prose 散文体、report 报告体、custom 自定义 */
  writingStyle?: WritingStyle;
  /** 自定义文风时的提示词，仅当 writingStyle 为 custom 时生效 */
  writingStylePrompt?: string;
  /** 猫头鹰洞察的自定义提示语，留空使用默认（心理学视角的深度分析与鼓励，约 50–100 字） */
  insightPrompt?: string;
  /** 是否启用长期记忆功能（Beta） */
  enableLongTermMemory?: boolean;
  /** 是否自动提取记忆（日记生成后自动提取） */
  memoryExtractionAuto?: boolean;
  /** 是否在生成日记时检索记忆（向AI传递记忆内容，需记忆数≥100） */
  memoryRetrievalEnabled?: boolean;
}

/**
 * 记忆类型
 * @typedef {'semantic' | 'episodic' | 'procedural'} MemoryType
 * - semantic: 语义记忆（用户画像）
 * - episodic: 情景记忆（相关回忆）
 * - procedural: 程序性记忆（交互偏好）
 */
export type MemoryType = 'semantic' | 'episodic' | 'procedural';

/**
 * 语义记忆接口
 * 存储用户的基本事实信息，如姓名、位置、喜好等
 * @interface SemanticMemory
 */
export interface SemanticMemory {
  /** 唯一标识符 */
  id: string;
  /** 记忆类型 */
  type: 'semantic';
  /** 记忆键，如 "name", "location", "favorite_music" */
  key: string;
  /** 记忆值，如 "小夏", "成都", "五月天" */
  value: string;
  /** 置信度 0-1，多次提及则提高 */
  confidence: number;
  /** 来源日记ID列表 */
  sourceEntryIds: string[];
  /** 创建时间戳（Unix 毫秒） */
  createdAt: number;
  /** 更新时间戳（Unix 毫秒） */
  updatedAt: number;
}

/**
 * 情景记忆接口
 * 记录特定时间、地点的事件和情绪
 * @interface EpisodicMemory
 */
export interface EpisodicMemory {
  /** 唯一标识符 */
  id: string;
  /** 记忆类型 */
  type: 'episodic';
  /** 事件描述，如 "生日那天，我陪你听了歌" */
  event: string;
  /** 情绪，如 "开心", "焦虑" */
  emotion?: string;
  /** 日期 YYYY-MM-DD */
  date: string;
  /** 上下文信息 */
  context?: string;
  /** 来源日记ID */
  sourceEntryId: string;
  /** 创建时间戳（Unix 毫秒） */
  createdAt: number;
}

/**
 * 程序性记忆接口
 * 学习用户的交互偏好和行为模式
 * @interface ProceduralMemory
 */
export interface ProceduralMemory {
  /** 唯一标识符 */
  id: string;
  /** 记忆类型 */
  type: 'procedural';
  /** 行为模式，如 "不喜欢被打断" */
  pattern: string;
  /** 偏好描述，如 "喜欢在夜晚倾诉" */
  preference: string;
  /** 触发条件，如 "心情不好时用'唉……'开头" */
  trigger?: string;
  /** 出现频率 */
  frequency: number;
  /** 来源日记ID列表 */
  sourceEntryIds: string[];
  /** 创建时间戳（Unix 毫秒） */
  createdAt: number;
  /** 更新时间戳（Unix 毫秒） */
  updatedAt: number;
}

/**
 * 联合记忆类型
 * 所有记忆类型的联合类型
 * @typedef {SemanticMemory | EpisodicMemory | ProceduralMemory} Memory
 */
export type Memory = SemanticMemory | EpisodicMemory | ProceduralMemory;
