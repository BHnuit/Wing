/**
 * IndexedDB 存储层
 * 替代 localStorage，突破 5–10MB 限制，容纳更多图片与日记内容。
 * 使用内存缓存 + 异步持久化，对外提供同步读、异步写的能力。
 */

import { DailySession, WingEntry, AppSettings, Memory } from '../types';
import { isQuotaExceededError } from '../utils/storage';

const DB_NAME = 'wing_db';
const DB_VERSION = 2; // 升级版本以添加 memories store
const STORES = { ENTRIES: 'entries', SESSIONS: 'sessions', SETTINGS: 'settings', META: 'meta', MEMORIES: 'memories' } as const;

const LS_KEYS = {
  ENTRIES: 'wing_entries',
  SESSIONS: 'wing_sessions',
  SETTINGS: 'wing_settings',
  INITIALIZED: 'wing_initialized'
} as const;

/** 内存缓存 */
let _entries: WingEntry[] = [];
let _sessions: DailySession[] = [];
let _settings: AppSettings | null = null;
let _memories: Memory[] = [];
let _initialized = false;
let _db: IDBDatabase | null = null;
let _initPromise: Promise<void> | null = null;

/**
 * 打开 IndexedDB，若不存在则创建 object stores
 */
function openDB(): Promise<IDBDatabase> {
  // 检查浏览器是否支持 IndexedDB
  if (!window.indexedDB) {
    return Promise.reject(new Error('浏览器不支持 IndexedDB，请使用现代浏览器（Chrome、Firefox、Safari、Edge）'));
  }

  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(DB_NAME, DB_VERSION);
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }

    req.onerror = () => {
      const error = req.error || new Error('IndexedDB 打开失败');
      reject(error);
    };

    req.onsuccess = () => {
      if (!req.result) {
        reject(new Error('IndexedDB 打开成功但未返回数据库实例'));
        return;
      }
      resolve(req.result);
    };

    req.onupgradeneeded = (e) => {
      try {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORES.ENTRIES)) {
          db.createObjectStore(STORES.ENTRIES, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.SESSIONS)) {
          db.createObjectStore(STORES.SESSIONS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORES.SETTINGS)) {
          db.createObjectStore(STORES.SETTINGS, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORES.META)) {
          db.createObjectStore(STORES.META, { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains(STORES.MEMORIES)) {
          const memoryStore = db.createObjectStore(STORES.MEMORIES, { keyPath: 'id' });
          memoryStore.createIndex('type', 'type', { unique: false });
          memoryStore.createIndex('date', 'date', { unique: false }); // 用于情景记忆
          memoryStore.createIndex('key', 'key', { unique: false }); // 用于语义记忆
        }
      } catch (error) {
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    };

    req.onblocked = () => {
      console.warn('IndexedDB 升级被阻塞，可能有其他标签页正在使用数据库');
      // 不 reject，等待其他标签页关闭
    };
  });
}

/**
 * 从 localStorage 迁移到 IndexedDB（仅在 IDB 无数据且 LS 有数据时执行）
 */
async function migrateFromLocalStorage(db: IDBDatabase): Promise<void> {
  const rawEntries = localStorage.getItem(LS_KEYS.ENTRIES);
  const rawSessions = localStorage.getItem(LS_KEYS.SESSIONS);
  const rawSettings = localStorage.getItem(LS_KEYS.SETTINGS);
  const rawInit = localStorage.getItem(LS_KEYS.INITIALIZED);

  /** 任意旧 key 存在则迁移，避免丢失仅含 settings 或 initialized 的状态 */
  const hasLS = rawEntries != null || rawSessions != null || rawSettings != null || rawInit != null;
  if (!hasLS) return;

  let entries: WingEntry[] = [];
  let sessions: DailySession[] = [];
  let settings: AppSettings | null = null;
  let initialized = false;

  try {
    entries = rawEntries ? JSON.parse(rawEntries) : [];
    if (!Array.isArray(entries)) entries = [];
  } catch (error) {
    console.warn('解析 localStorage entries 失败，跳过迁移:', error);
    entries = [];
  }

  try {
    sessions = rawSessions ? JSON.parse(rawSessions) : [];
    if (!Array.isArray(sessions)) sessions = [];
  } catch (error) {
    console.warn('解析 localStorage sessions 失败，跳过迁移:', error);
    sessions = [];
  }

  try {
    settings = rawSettings ? JSON.parse(rawSettings) : null;
  } catch (error) {
    console.warn('解析 localStorage settings 失败，跳过迁移:', error);
    settings = null;
  }

  initialized = rawInit === '1';

  const putAll = <T>(storeName: string, items: T[]) => {
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(storeName, 'readwrite');
      const st = tx.objectStore(storeName);
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();
      items.forEach((item) => st.put(item));
      if (items.length === 0) resolve();
    });
  };

  await putAll(STORES.ENTRIES, entries);
  await putAll(STORES.SESSIONS, sessions);
  if (settings) {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORES.SETTINGS, 'readwrite');
      tx.objectStore(STORES.SETTINGS).put({ key: 'app', value: settings });
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();
    });
  }
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORES.META, 'readwrite');
    tx.objectStore(STORES.META).put({ key: 'initialized', value: initialized ? '1' : '' });
    tx.onerror = () => reject(tx.error);
    tx.oncomplete = () => resolve();
  });

  /** 迁移成功后清空 localStorage 释放空间 */
  localStorage.removeItem(LS_KEYS.ENTRIES);
  localStorage.removeItem(LS_KEYS.SESSIONS);
  localStorage.removeItem(LS_KEYS.SETTINGS);
  localStorage.removeItem(LS_KEYS.INITIALIZED);
}

/**
 * 从 IndexedDB 加载全部数据到内存
 */
async function loadAllFromDB(db: IDBDatabase): Promise<void> {
  const getAll = <T>(storeName: string): Promise<T[]> =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result || []);
    });

  const getOne = <T>(storeName: string, key: string): Promise<T | undefined> =>
    new Promise((resolve, reject) => {
      const tx = db.transaction(storeName, 'readonly');
      const req = tx.objectStore(storeName).get(key);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });

  const [entries, sessions, settingsRow, metaRow, memories] = await Promise.all([
    getAll<WingEntry>(STORES.ENTRIES),
    getAll<DailySession>(STORES.SESSIONS),
    getOne<{ key: string; value: AppSettings }>(STORES.SETTINGS, 'app'),
    getOne<{ key: string; value: string }>(STORES.META, 'initialized'),
    getAll<Memory>(STORES.MEMORIES)
  ]);

  _entries = Array.isArray(entries) ? entries : [];
  _sessions = Array.isArray(sessions) ? sessions : [];
  _settings = settingsRow?.value ?? null;
  _memories = Array.isArray(memories) ? memories : [];
  _initialized = metaRow?.value === '1';
}

/**
 * 持久化：覆盖写入全部 entries
 */
async function persistEntriesReplace(entries: WingEntry[]): Promise<void> {
  if (!_db) return;
  return new Promise((resolve, reject) => {
    const tx = _db!.transaction(STORES.ENTRIES, 'readwrite');
    const st = tx.objectStore(STORES.ENTRIES);
    tx.onerror = () => {
      const err = tx.error;
      if (err && isQuotaExceededError(err)) {
        window.dispatchEvent(new CustomEvent('wing_storage_error', { detail: { code: 'QUOTA_EXCEEDED' } }));
      }
      reject(err);
    };
    tx.oncomplete = () => resolve();
    st.clear();
    entries.forEach((e) => st.put(e));
  });
}

/**
 * 持久化：覆盖写入全部 sessions
 */
async function persistSessionsReplace(sessions: DailySession[]): Promise<void> {
  if (!_db) return;
  return new Promise((resolve, reject) => {
    const tx = _db!.transaction(STORES.SESSIONS, 'readwrite');
    const st = tx.objectStore(STORES.SESSIONS);
    tx.onerror = () => {
      const err = tx.error;
      if (err && isQuotaExceededError(err)) {
        window.dispatchEvent(new CustomEvent('wing_storage_error', { detail: { code: 'QUOTA_EXCEEDED' } }));
      }
      reject(err);
    };
    tx.oncomplete = () => resolve();
    st.clear();
    sessions.forEach((s) => st.put(s));
  });
}

/**
 * 持久化：写入单条 entry（put 覆盖同 id）
 */
function persistEntry(entry: WingEntry): void {
  if (!_db) return;
  const tx = _db.transaction(STORES.ENTRIES, 'readwrite');
  const st = tx.objectStore(STORES.ENTRIES);
  tx.onerror = () => {
    const err = tx.error;
    if (err && isQuotaExceededError(err)) {
      window.dispatchEvent(new CustomEvent('wing_storage_error', { detail: { code: 'QUOTA_EXCEEDED' } }));
    }
  };
  st.put(entry);
}

/**
 * 持久化：删除单条 entry
 */
function persistEntryDelete(id: string): void {
  if (!_db) return;
  const tx = _db.transaction(STORES.ENTRIES, 'readwrite');
  tx.objectStore(STORES.ENTRIES).delete(id);
}

/**
 * 持久化：写入单条 session（put 覆盖同 id）
 */
function persistSession(session: DailySession): void {
  if (!_db) return;
  const tx = _db.transaction(STORES.SESSIONS, 'readwrite');
  const st = tx.objectStore(STORES.SESSIONS);
  tx.onerror = () => {
    const err = tx.error;
    if (err && isQuotaExceededError(err)) {
      window.dispatchEvent(new CustomEvent('wing_storage_error', { detail: { code: 'QUOTA_EXCEEDED' } }));
    }
  };
  st.put(session);
}

/**
 * 持久化：写入 settings
 */
function persistSettings(settings: AppSettings): void {
  if (!_db) return;
  const tx = _db.transaction(STORES.SETTINGS, 'readwrite');
  const st = tx.objectStore(STORES.SETTINGS);
  tx.onerror = () => {
    const err = tx.error;
    if (err && isQuotaExceededError(err)) {
      window.dispatchEvent(new CustomEvent('wing_storage_error', { detail: { code: 'QUOTA_EXCEEDED' } }));
    }
  };
  st.put({ key: 'app', value: settings });
}

/**
 * 持久化：写入 meta（如 initialized）
 */
function persistMeta(key: string, value: string): void {
  if (!_db) return;
  const tx = _db.transaction(STORES.META, 'readwrite');
  tx.objectStore(STORES.META).put({ key, value });
}

/**
 * 持久化：写入单条 memory（put 覆盖同 id）
 */
function persistMemory(memory: Memory): void {
  if (!_db) return;
  const tx = _db.transaction(STORES.MEMORIES, 'readwrite');
  const st = tx.objectStore(STORES.MEMORIES);
  tx.onerror = () => {
    const err = tx.error;
    if (err && isQuotaExceededError(err)) {
      window.dispatchEvent(new CustomEvent('wing_storage_error', { detail: { code: 'QUOTA_EXCEEDED' } }));
    }
  };
  st.put(memory);
}

/**
 * 持久化：删除单条 memory
 */
function persistMemoryDelete(id: string): void {
  if (!_db) return;
  const tx = _db.transaction(STORES.MEMORIES, 'readwrite');
  tx.objectStore(STORES.MEMORIES).delete(id);
}

/**
 * 持久化：覆盖写入全部 memories
 */
async function persistMemoriesReplace(memories: Memory[]): Promise<void> {
  if (!_db) return;
  return new Promise((resolve, reject) => {
    const tx = _db!.transaction(STORES.MEMORIES, 'readwrite');
    const st = tx.objectStore(STORES.MEMORIES);
    tx.onerror = () => {
      const err = tx.error;
      if (err && isQuotaExceededError(err)) {
        window.dispatchEvent(new CustomEvent('wing_storage_error', { detail: { code: 'QUOTA_EXCEEDED' } }));
      }
      reject(err);
    };
    tx.oncomplete = () => resolve();
    st.clear();
    memories.forEach((m) => st.put(m));
  });
}

/**
 * 清空所有 IndexedDB 对象库
 */
async function clearAllStores(): Promise<void> {
  if (!_db) return;
  const stores = [STORES.ENTRIES, STORES.SESSIONS, STORES.SETTINGS, STORES.META, STORES.MEMORIES];
  for (const name of stores) {
    await new Promise<void>((resolve, reject) => {
      const tx = _db!.transaction(name, 'readwrite');
      tx.objectStore(name).clear();
      tx.onerror = () => reject(tx.error);
      tx.oncomplete = () => resolve();
    });
  }
}

// ============ 对外 API ============

export const IndexedDBStorage = {
  /**
   * 初始化：打开 DB、迁移 localStorage（如需）、加载到内存。必须先调用再使用其它方法。
   */
  async init(): Promise<void> {
    if (_initPromise) return _initPromise;
    _initPromise = (async () => {
      _db = await openDB();
      const countReq = _db.transaction(STORES.ENTRIES, 'readonly').objectStore(STORES.ENTRIES).count();
      const count = await new Promise<number>((resolve, reject) => {
        countReq.onsuccess = () => resolve(countReq.result);
        countReq.onerror = () => reject(countReq.error);
      });
      if (count === 0) await migrateFromLocalStorage(_db);
      await loadAllFromDB(_db);
    })();
    return _initPromise;
  },

  getEntries(): WingEntry[] {
    return _entries;
  },

  getSessions(): DailySession[] {
    return _sessions;
  },

  getSettings(): AppSettings | null {
    return _settings;
  },

  getInitialized(): boolean {
    return _initialized;
  },

  /** 追加 entry 并持久化 */
  addEntry(entry: WingEntry): void {
    _entries.push(entry);
    persistEntry(entry);
  },

  /** 更新内存中已存在的 entry 并持久化 */
  updateEntryInPlace(entry: WingEntry): void {
    const i = _entries.findIndex((e) => e.id === entry.id);
    if (i >= 0) _entries[i] = entry;
    persistEntry(entry);
  },

  /** 从内存移除 entry 并持久化删除 */
  deleteEntry(id: string): void {
    _entries = _entries.filter((e) => e.id !== id);
    persistEntryDelete(id);
  },

  /** 替换全部 entries，并持久化（可 await 以捕获 QuotaExceeded） */
  async replaceEntries(entries: WingEntry[]): Promise<void> {
    _entries = [...entries];
    await persistEntriesReplace(_entries);
  },

  /** 追加或更新 session 并持久化 */
  putSession(session: DailySession): void {
    const i = _sessions.findIndex((s) => s.id === session.id);
    if (i >= 0) _sessions[i] = session;
    else _sessions.push(session);
    persistSession(session);
  },

  /** 替换全部 sessions 并持久化（可 await） */
  async replaceSessions(sessions: DailySession[]): Promise<void> {
    _sessions = [...sessions];
    await persistSessionsReplace(_sessions);
  },

  /** 更新 settings 并持久化 */
  putSettings(settings: AppSettings): void {
    _settings = settings;
    persistSettings(settings);
  },

  /** 设置 initialized 并持久化 */
  setInitialized(value: boolean): void {
    _initialized = value;
    persistMeta('initialized', value ? '1' : '');
  },

  getMemories(): Memory[] {
    return _memories;
  },

  /** 追加或更新 memory 并持久化 */
  putMemory(memory: Memory): void {
    const i = _memories.findIndex((m) => m.id === memory.id);
    if (i >= 0) _memories[i] = memory;
    else _memories.push(memory);
    persistMemory(memory);
  },

  /** 从内存移除 memory 并持久化删除 */
  deleteMemory(id: string): void {
    _memories = _memories.filter((m) => m.id !== id);
    persistMemoryDelete(id);
  },

  /** 替换全部 memories 并持久化（可 await） */
  async replaceMemories(memories: Memory[]): Promise<void> {
    _memories = [...memories];
    await persistMemoriesReplace(_memories);
  },

  /**
   * 清空所有数据（内存 + IndexedDB），并关闭 DB。调用后需 reload。
   */
  async clearAll(): Promise<void> {
    await clearAllStores();
    _entries = [];
    _sessions = [];
    _settings = null;
    _memories = [];
    _initialized = false;
    if (_db) {
      _db.close();
      _db = null;
    }
    _initPromise = null;
  }
};
