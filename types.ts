
export enum SessionStatus {
  RECORDING = 'RECORDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED'
}

export enum FragmentType {
  TEXT = 'TEXT',
  IMAGE = 'IMAGE'
}

export type Language = 'zh' | 'en';

/** AI 供应商：Gemini、OpenAI、DeepSeek、自定义 Base URL */
export type AiProvider = 'gemini' | 'openai' | 'deepseek' | 'custom';

/** 文风：书信体、散文体、报告体、自定义 */
export type WritingStyle = 'letter' | 'prose' | 'report' | 'custom';

export interface RawFragment {
  id: string;
  content: string;
  imageData?: string; // base64
  timestamp: number;
  type: FragmentType;
  /** 若存在则表示消息已被编辑，用于显示「已编辑 HH:mm」 */
  editedAt?: number;
}

export interface WingTodo {
  title: string;
  priority: 'high' | 'medium' | 'low';
}

/** 编辑历史单条：保存编辑前的 title 与 markdownContent 快照 */
export interface EditHistoryItem {
  createdAt: number;
  title: string;
  markdownContent: string;
}

export interface WingEntry {
  id: string;
  title: string;
  summary: string;
  mood: string;
  markdownContent: string;
  aiInsights: string;
  todos: WingTodo[];
  createdAt: number;
  images?: { [key: string]: string }; // 图片映射：fragmentId -> base64 imageData
  /** 最后手动编辑时间，用于显示「已编辑 HH:mm」 */
  editedAt?: number;
  /** 编辑历史（仅当设置「保留编辑历史」时写入），可恢复 */
  editHistory?: EditHistoryItem[];
  /** 收拢生成完成时间，用于猫头鹰消息的时间标记 */
  generatedAt?: number;
}

export interface DailySession {
  id: string;
  date: string; // YYYY-MM-DD
  status: SessionStatus;
  fragments: RawFragment[];
  finalEntryId?: string;
  /** 当天每次触发收拢的时间戳，用于展示「HH:mm 开始收拢羽毛」；再次生成则追加 */
  gatherStartedAt?: number[];
  /** 每次收拢完成记录，用于按时间叠加展示「已生成《xx》」；再次生成覆盖同一日记时追加 */
  gatherCompletions?: { completedAt: number; entryId: string; title: string }[];
}

export interface AppSettings {
  /** @deprecated 使用 apiKeys 按供应商存储；仅作向后兼容 */
  apiKey?: string;
  /** 按 AI 供应商分别存储的 API Key，切换供应商时保留各自已填写的密钥 */
  apiKeys?: Partial<Record<AiProvider, string>>;
  /** AI 供应商 */
  aiProvider?: AiProvider;
  /** 自定义 API Base URL（仅当 aiProvider 为 custom 时使用） */
  aiBaseUrl?: string;
  /** @deprecated 使用 aiModels 按供应商存储；仅作向后兼容 */
  aiModel?: string;
  /** 按 AI 供应商分别存储的模型名称，留空则使用该供应商默认模型 */
  aiModels?: Partial<Record<AiProvider, string>>;
  webdavUrl: string;
  webdavUser: string;
  webdavPass: string;
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
  /** 开启后，在记录、编辑等关键操作后自动同步到 WebDAV（需已配置并可连接） */
  realtimeWebdavSync?: boolean;
  /** 导出时是否备份所有设置（模型配置、云端备份等密钥信息），默认开启；关闭时仅导出日记与记录 */
  backupApiKeys?: boolean;
  /** 文风：letter 书信体、prose 散文体、report 报告体、custom 自定义 */
  writingStyle?: WritingStyle;
  /** 自定义文风时的提示词，仅当 writingStyle 为 custom 时生效 */
  writingStylePrompt?: string;
  /** 猫头鹰洞察的自定义提示语，留空使用默认（心理学视角的深度分析与鼓励，约 50–100 字） */
  insightPrompt?: string;
}
