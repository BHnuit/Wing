
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

export interface RawFragment {
  id: string;
  content: string;
  imageData?: string; // base64
  timestamp: number;
  type: FragmentType;
}

export interface WingTodo {
  title: string;
  priority: 'high' | 'medium' | 'low';
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
}

export interface DailySession {
  id: string;
  date: string; // YYYY-MM-DD
  status: SessionStatus;
  fragments: RawFragment[];
  finalEntryId?: string;
}

export interface AppSettings {
  apiKey: string;
  webdavUrl: string;
  webdavUser: string;
  webdavPass: string;
  language: Language;
}
