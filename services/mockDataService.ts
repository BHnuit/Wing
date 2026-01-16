
import { DailySession, RawFragment, WingEntry, SessionStatus, FragmentType, AppSettings, Language } from '../types';

const STORAGE_KEYS = {
  SESSIONS: 'wing_sessions',
  ENTRIES: 'wing_entries',
  SETTINGS: 'wing_settings'
};

const DEFAULT_SETTINGS: AppSettings = {
  apiKey: '',
  webdavUrl: '',
  webdavUser: '',
  webdavPass: '',
  language: 'zh'
};

export const MockDataService = {
  getSettings: (): AppSettings => {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    return data ? { ...DEFAULT_SETTINGS, ...JSON.parse(data) } : DEFAULT_SETTINGS;
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
    const today = new Date().toISOString().split('T')[0];
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

  saveEntry: (entry: WingEntry) => {
    const entries = MockDataService.getEntries();
    entries.push(entry);
    localStorage.setItem(STORAGE_KEYS.ENTRIES, JSON.stringify(entries));
  },

  getEntries: (): WingEntry[] => {
    const data = localStorage.getItem(STORAGE_KEYS.ENTRIES);
    return data ? JSON.parse(data) : [];
  },

  getEntryById: (id: string): WingEntry | undefined => {
    return MockDataService.getEntries().find(e => e.id === id);
  },

  clearData: () => {
    localStorage.removeItem(STORAGE_KEYS.SESSIONS);
    localStorage.removeItem(STORAGE_KEYS.ENTRIES);
    window.location.reload();
  }
};
