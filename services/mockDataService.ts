/**
 * 数据服务模块（IndexedDB 存储）
 * 提供 entries、sessions、settings 的读写，底层为 IndexedDB，突破 localStorage 5–10MB 限制，容纳更多图片。
 * 保持 getEntries、saveEntry、getSessionByDate、updateFragment 等 API 不变，上层无感迁移。
 */

import { DailySession, RawFragment, WingEntry, SessionStatus, FragmentType, AppSettings } from '../types';
import { getLocalDateString } from '../utils/date';
import { IndexedDBStorage } from './indexedDBStorage';
import { getWelcomeEntry } from './welcomeEntry';

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  apiKeys: {},
  aiProvider: 'gemini',
  aiBaseUrl: '',
  aiModels: {},
  webdavUrl: '',
  webdavUser: '',
  webdavPass: '',
  language: 'zh',
  theme: 'system',
  pageFont: 'system',
  modelLanguage: 'same',
  keepEditHistory: false,
  realtimeWebdavSync: false,
  backupApiKeys: true,
  writingStyle: 'prose',
  writingStylePrompt: '',
  insightPrompt: ''
};

export const MockDataService = {
  /**
   * 初始化 IndexedDB 存储（打开 DB、迁移 localStorage、加载到内存）。必须在应用启动时 await 完成后再使用其它方法。
   */
  init: (): Promise<void> => IndexedDBStorage.init(),

  getSettings: (): AppSettings => {
    const raw = IndexedDBStorage.getSettings();
    const parsed = raw || {};
    // 迁移：旧数据仅有 apiKey 时，写入 apiKeys[当前供应商]
    if (parsed.apiKey != null && parsed.apiKey !== '' && !parsed.apiKeys) {
      const p = parsed.aiProvider || 'gemini';
      parsed.apiKeys = { [p]: parsed.apiKey };
    }
    // 迁移：旧 aiModel 写入 aiModels[当前供应商]
    if (parsed.aiModel != null && parsed.aiModel !== '') {
      const p = parsed.aiProvider || 'gemini';
      if (!parsed.aiModels) parsed.aiModels = {};
      if (parsed.aiModels[p] == null) parsed.aiModels[p] = parsed.aiModel;
    }
    return { ...DEFAULT_SETTINGS, ...parsed };
  },

  updateSettings: (settings: Partial<AppSettings>) => {
    const current = MockDataService.getSettings();
    const updated = { ...current, ...settings };
    IndexedDBStorage.putSettings(updated);
    window.dispatchEvent(new Event('wing_settings_updated'));
  },

  getSessions: (): DailySession[] => IndexedDBStorage.getSessions(),

  getCurrentSession: (): DailySession => {
    const sessions = MockDataService.getSessions();
    const today = getLocalDateString();
    let session = sessions.find((s) => s.date === today);

    if (!session) {
      session = {
        id: crypto.randomUUID(),
        date: today,
        status: SessionStatus.RECORDING,
        fragments: []
      };
      MockDataService.saveSession(session);
    }
    return session;
  },

  /**
   * 保存会话到 IndexedDB（内存 + 异步持久化）
   */
  saveSession: (session: DailySession) => {
    IndexedDBStorage.putSession(session);
  },

  addFragment: (
    sessionId: string,
    content: string,
    type: FragmentType = FragmentType.TEXT,
    imageData?: string
  ): RawFragment | null => {
    const sessions = MockDataService.getSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (session) {
      const fragment: RawFragment = {
        id: crypto.randomUUID(),
        content,
        type,
        imageData,
        timestamp: Date.now()
      };
      session.fragments.push(fragment);
      MockDataService.saveSession(session);
      return fragment;
    }
    return null;
  },

  /**
   * 更新片段内容（纠错、补充），并设置 editedAt
   * @param sessionId 会话 ID
   * @param fragmentId 片段 ID
   * @param content 新内容
   * @returns 更新后的片段，不存在则返回 null
   */
  updateFragment: (sessionId: string, fragmentId: string, content: string): RawFragment | null => {
    const sessions = MockDataService.getSessions();
    const session = sessions.find((s) => s.id === sessionId);
    if (!session) return null;
    const frag = session.fragments.find((f) => f.id === fragmentId);
    if (!frag) return null;
    frag.content = content;
    frag.editedAt = Date.now();
    MockDataService.saveSession(session);
    return frag;
  },

  /**
   * 保存日记到 IndexedDB（内存 + 异步持久化）
   */
  saveEntry: (entry: WingEntry) => {
    IndexedDBStorage.addEntry(entry);
    window.dispatchEvent(new Event('wing_data_updated'));
  },

  /**
   * 当本地日记为空且从未初始化时，注入欢迎日记（介绍与教程），并标记已初始化。
   * 用户删除欢迎日记后不再自动补回。
   */
  _ensureWelcomeEntryIfNeeded: (): void => {
    if (IndexedDBStorage.getInitialized()) return;
    if (IndexedDBStorage.getEntries().length > 0) {
      IndexedDBStorage.setInitialized(true);
      return;
    }
    const lang = MockDataService.getSettings().language;
    const welcome = getWelcomeEntry(lang);
    IndexedDBStorage.replaceEntries([welcome]).catch(() => {});
    IndexedDBStorage.setInitialized(true);
    window.dispatchEvent(new Event('wing_data_updated'));
  },

  getEntries: (): WingEntry[] => {
    MockDataService._ensureWelcomeEntryIfNeeded();
    return IndexedDBStorage.getEntries();
  },

  getEntryById: (id: string): WingEntry | undefined => MockDataService.getEntries().find((e) => e.id === id),

  /**
   * 按日期 (YYYY-MM-DD) 获取当日会话
   */
  getSessionByDate: (date: string): DailySession | undefined =>
    MockDataService.getSessions().find((s) => s.date === date),

  /**
   * 按日期获取会话，不存在则创建并保存（用于在选定日期新增记录时）
   */
  getOrCreateSessionByDate: (date: string): DailySession => {
    const existing = MockDataService.getSessionByDate(date);
    if (existing) return existing;
    const session: DailySession = {
      id: crypto.randomUUID(),
      date,
      status: SessionStatus.RECORDING,
      fragments: []
    };
    MockDataService.saveSession(session);
    return session;
  },

  /**
   * 更新已有日记（部分字段，保留 id）
   */
  updateEntry: (id: string, updates: Partial<WingEntry>) => {
    const entries = MockDataService.getEntries();
    const index = entries.findIndex((e) => e.id === id);
    if (index === -1) return;
    const next = { ...entries[index], ...updates, id: entries[index].id };
    IndexedDBStorage.updateEntryInPlace(next);
    window.dispatchEvent(new Event('wing_data_updated'));
  },

  /**
   * 删除日记，并清理引用该日记的 session.finalEntryId
   */
  deleteEntry: (id: string) => {
    IndexedDBStorage.deleteEntry(id);
    const sessions = MockDataService.getSessions();
    let changed = false;
    sessions.forEach((s) => {
      if (s.finalEntryId === id) {
        s.finalEntryId = undefined;
        changed = true;
      }
    });
    if (changed) {
      sessions.forEach((s) => IndexedDBStorage.putSession(s));
    }
    window.dispatchEvent(new Event('wing_data_updated'));
  },

  /**
   * 替换全部 entries（供 dataService 导入/替换使用）。可 await 以捕获 QuotaExceeded。
   */
  replaceEntries: (entries: WingEntry[]): Promise<void> => IndexedDBStorage.replaceEntries(entries),

  /**
   * 替换全部 sessions（供 dataService 导入/替换使用）。可 await 以捕获 QuotaExceeded。
   */
  replaceSessions: (sessions: DailySession[]): Promise<void> => IndexedDBStorage.replaceSessions(sessions),

  /**
   * 清除本地数据并刷新页面；同时清空云端备份设置（WebDAV）、各供应商 API Key，重置「已初始化」标记，使下次加载时重新注入欢迎日记。
   */
  clearData: async (): Promise<void> => {
    await IndexedDBStorage.clearAll();
    window.location.reload();
  },

  /**
   * 有记录或日记的日期集合（YYYY-MM-DD），用于日历展示
   */
  getActivityDateSet: (): Set<string> => {
    const set = new Set<string>();
    MockDataService.getSessions().forEach((s) => {
      if (s.fragments && s.fragments.length > 0) set.add(s.date);
    });
    MockDataService.getEntries().forEach((e) => {
      set.add(getLocalDateString(new Date(e.createdAt)));
    });
    return set;
  },

  /**
   * 有会话记录（至少一个 fragment）的日期列表，用于记录页日期选择器。
   */
  getDatesWithRecordsForPicker: (): string[] => {
    const set = new Set<string>();
    MockDataService.getSessions().forEach((s) => {
      if (s.fragments && s.fragments.length > 0) set.add(s.date);
    });
    const today = getLocalDateString();
    if (!set.has(today)) set.add(today);
    return Array.from(set).sort();
  },

  getTodayFeatherCount: (): number => {
    const today = getLocalDateString();
    const s = MockDataService.getSessionByDate(today);
    if (!s || !s.fragments) return 0;
    return s.fragments.reduce((n, f) => n + (f.content?.length || 0), 0);
  },

  getTodayMessageCount: (): number => {
    const today = getLocalDateString();
    const s = MockDataService.getSessionByDate(today);
    return s?.fragments?.length ?? 0;
  },

  getTotalFeatherCount: (): number =>
    MockDataService.getSessions().reduce(
      (n, s) => n + (s.fragments || []).reduce((m, f) => m + (f.content?.length || 0), 0),
      0
    )
};
