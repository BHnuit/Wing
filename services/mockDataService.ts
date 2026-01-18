
import { DailySession, RawFragment, WingEntry, SessionStatus, FragmentType, AppSettings, Language } from '../types';
import { getLocalDateString } from '../utils/date';
import { getWelcomeEntry } from './welcomeEntry';

const STORAGE_KEYS = {
  SESSIONS: 'wing_sessions',
  ENTRIES: 'wing_entries',
  SETTINGS: 'wing_settings'
};

/** 是否已执行过「空数据时注入欢迎日记」的标记；仅首次为空时注入，用户删除后不再补回 */
const WING_INITIALIZED_KEY = 'wing_initialized';

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
  modelLanguage: 'same',
  keepEditHistory: false,
  realtimeWebdavSync: false,
  backupApiKeys: true
};

export const MockDataService = {
  getSettings: (): AppSettings => {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    const parsed = data ? JSON.parse(data) : {};
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
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(updated));
    window.dispatchEvent(new Event('wing_settings_updated'));
  },

  getSessions: (): DailySession[] => {
    const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    return data ? JSON.parse(data) : [];
  },

  getCurrentSession: (): DailySession => {
    const sessions = MockDataService.getSessions();
    const today = getLocalDateString();
    let session = sessions.find(s => s.date === today);
    
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

  saveSession: (session: DailySession) => {
    const sessions = MockDataService.getSessions();
    const index = sessions.findIndex(s => s.id === session.id);
    if (index > -1) {
      sessions[index] = session;
    } else {
      sessions.push(session);
    }
    localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
  },

  addFragment: (sessionId: string, content: string, type: FragmentType = FragmentType.TEXT, imageData?: string) => {
    const sessions = MockDataService.getSessions();
    const session = sessions.find(s => s.id === sessionId);
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
    const session = sessions.find(s => s.id === sessionId);
    if (!session) return null;
    const frag = session.fragments.find(f => f.id === fragmentId);
    if (!frag) return null;
    frag.content = content;
    frag.editedAt = Date.now();
    MockDataService.saveSession(session);
    return frag;
  },

  saveEntry: (entry: WingEntry) => {
    const entries = MockDataService.getEntries();
    entries.push(entry);
    localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
    window.dispatchEvent(new Event('wing_data_updated'));
  },

  /**
   * 当本地日记为空且从未初始化时，注入欢迎日记（介绍与教程），并标记已初始化。
   * 用户删除欢迎日记后不再自动补回。
   */
  _ensureWelcomeEntryIfNeeded: (): void => {
    if (localStorage.getItem(WING_INITIALIZED_KEY) === '1') return;
    const raw = localStorage.getItem(STORAGE_KEYS.ENTRIES);
    const arr: WingEntry[] = raw ? JSON.parse(raw) : [];
    if (arr.length > 0) {
      localStorage.setItem(WING_INITIALIZED_KEY, '1');
      return;
    }
    const lang = MockDataService.getSettings().language;
    const welcome = getWelcomeEntry(lang);
    localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify([welcome]));
    localStorage.setItem(WING_INITIALIZED_KEY, '1');
    window.dispatchEvent(new Event('wing_data_updated'));
  },

  getEntries: (): WingEntry[] => {
    MockDataService._ensureWelcomeEntryIfNeeded();
    const data = localStorage.getItem(STORAGE_KEYS.ENTRIES);
    return data ? JSON.parse(data) : [];
  },

  getEntryById: (id: string): WingEntry | undefined => {
    return MockDataService.getEntries().find(e => e.id === id);
  },

  /**
   * 按日期 (YYYY-MM-DD) 获取当日会话
   * @param date 日期字符串
   * @returns 当日会话，不存在则 undefined
   */
  getSessionByDate: (date: string): DailySession | undefined => {
    return MockDataService.getSessions().find(s => s.date === date);
  },

  /**
   * 按日期获取会话，不存在则创建并保存（用于在选定日期新增记录时）
   * @param date YYYY-MM-DD
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
   * @param id 日记 id
   * @param updates 要更新的字段
   */
  updateEntry: (id: string, updates: Partial<WingEntry>) => {
    const entries = MockDataService.getEntries();
    const index = entries.findIndex(e => e.id === id);
    if (index === -1) return;
    const next = { ...entries[index], ...updates, id: entries[index].id };
    entries[index] = next;
    localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
    window.dispatchEvent(new Event('wing_data_updated'));
  },

  /**
   * 删除日记，并清理引用该日记的 session.finalEntryId
   * @param id 日记 id
   */
  deleteEntry: (id: string) => {
    const entries = MockDataService.getEntries().filter(e => e.id !== id);
    localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));

    const sessions = MockDataService.getSessions();
    let changed = false;
    sessions.forEach(s => {
      if (s.finalEntryId === id) {
        s.finalEntryId = undefined;
        changed = true;
      }
    });
    if (changed) {
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    }

    window.dispatchEvent(new Event('wing_data_updated'));
  },

  /**
   * 清除本地数据并刷新页面；同时清空云端备份设置（WebDAV）、各供应商 API Key，重置「已初始化」标记，使下次加载时重新注入欢迎日记。
   */
  clearData: () => {
    MockDataService.updateSettings({
      apiKey: '',
      apiKeys: {},
      webdavUrl: '',
      webdavUser: '',
      webdavPass: ''
    });
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.ENTRIES);
    localStorage.removeItem(WING_INITIALIZED_KEY);
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
   * 仅在这些日期间切换，空白日期不包含；若「今天」暂无记录也会加入，以便可切回今日新增。
   * @returns 按 YYYY-MM-DD 升序排列的日期数组
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

  /** 当天碎片中文本总字数（羽毛数） */
  getTodayFeatherCount: (): number => {
    const today = getLocalDateString();
    const s = MockDataService.getSessionByDate(today);
    if (!s || !s.fragments) return 0;
    return s.fragments.reduce((n, f) => n + (f.content?.length || 0), 0);
  },

  /** 当天发送消息数（挥动翅膀次数） */
  getTodayMessageCount: (): number => {
    const today = getLocalDateString();
    const s = MockDataService.getSessionByDate(today);
    return s?.fragments?.length ?? 0;
  },

  /** 全部碎片的文本总字数（羽毛总数） */
  getTotalFeatherCount: (): number => {
    return MockDataService.getSessions().reduce(
      (n, s) => n + (s.fragments || []).reduce((m, f) => m + (f.content?.length || 0), 0),
      0
    );
  }
};
