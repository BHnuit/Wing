/**
 * 数据服务模块
 * 提供数据导入/导出功能
 * 导出：JSON 存文本，图片单独放在 images/ 文件夹（ZIP 打包下载）
 * 导入：支持 .json（旧版内联 base64）与 .zip（data.json + images/）
 */

import JSZip from 'jszip';
import { WingEntry, DailySession, RawFragment, AiProvider, FragmentType } from '../types';
import { getLocalDateString } from '../utils/date';
import { MockDataService } from './mockDataService';

export interface ExportData {
  entries: WingEntry[];
  sessions: DailySession[];
  version: string;
  timestamp: number;
  /** 各供应商的 API Key（仅当设置「同时备份密钥」时包含） */
  apiKeys?: Partial<Record<AiProvider, string>>;
  /** 云端备份 WebDAV 设置（仅当设置「同时备份密钥」时包含） */
  webdav?: { webdavUrl: string; webdavUser: string; webdavPass: string };
  /** 各供应商的模型名称（仅当设置「同时备份密钥」时包含） */
  aiModels?: Partial<Record<AiProvider, string>>;
  /** 自定义 Base URL（仅当设置「同时备份密钥」时包含） */
  aiBaseUrl?: string;
}

const IMAGES_FOLDER = 'images';

/**
 * 从 base64 的 data URL 解析出扩展名（.png / .jpg / .gif / .webp）
 */
function getImageExtFromDataUrl(dataUrl: string): string {
  const m = /^data:image\/(\w+);base64,/.exec(dataUrl);
  if (!m) return '.png';
  const t = (m[1] || '').toLowerCase();
  if (t === 'jpeg' || t === 'jpg') return '.jpg';
  if (t === 'png' || t === 'gif' || t === 'webp') return `.${t}`;
  return '.png';
}

/**
 * 从扩展名得到 MIME，用于把 ZIP 内图片还原为 data URL
 */
function mimeFromExt(ext: string): string {
  const e = (ext || '').toLowerCase();
  if (e === '.jpg' || e === '.jpeg') return 'image/jpeg';
  if (e === '.png') return 'image/png';
  if (e === '.gif') return 'image/gif';
  if (e === '.webp') return 'image/webp';
  return 'image/png';
}

/**
 * 从 data URL 中取出纯 base64 部分（不含 data:image/...;base64, 前缀）
 */
function getBase64FromDataUrl(dataUrl: string): string {
  const i = dataUrl.indexOf(',');
  return i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
}

/**
 * 导出所有数据为 JSON 字符串（含内联 base64，供 WebDAV 等旧式备份使用）
 * 若开启「同时备份密钥」则包含 apiKeys 与 webdav 设置
 */
export const exportData = (): string => {
  const entries = MockDataService.getEntries();
  const sessions = MockDataService.getSessions();
  const settings = MockDataService.getSettings();

  const out: ExportData = {
    entries,
    sessions,
    version: '1.0.0',
    timestamp: Date.now()
  };

  if (settings.backupApiKeys !== false) {
    out.apiKeys = settings.apiKeys || {};
    out.webdav = {
      webdavUrl: settings.webdavUrl || '',
      webdavUser: settings.webdavUser || '',
      webdavPass: settings.webdavPass || ''
    };
    out.aiModels = settings.aiModels || {};
    out.aiBaseUrl = settings.aiBaseUrl ?? '';
  }

  return JSON.stringify(out, null, 2);
};

/**
 * 构建与本地导出一致的备份 ZIP（data.json 文本 + images/ 图片），供下载或云端同步使用
 * - data.json：entries 用 imageRefs（路径），sessions 的 fragments 用 imageRef（路径），无 base64
 * - images/：entry_{entryId}_{fragmentId}.{ext}、frag_{sessionId}_{fragmentId}.{ext}
 * @param entries 日记条目
 * @param sessions 日会话
 * @returns ZIP 的 Blob
 */
export async function buildBackupZip(entries: WingEntry[], sessions: DailySession[]): Promise<Blob> {
  const settings = MockDataService.getSettings();
  const zip = new JSZip();

  /** 供 data.json 使用的结构：无 base64，只有图片路径引用 */
  type EntryForJson = Omit<WingEntry, 'images'> & { imageRefs?: Record<string, string> };
  type FragmentForJson = Omit<RawFragment, 'imageData'> & { imageRef?: string };

  const entriesForJson: EntryForJson[] = [];
  for (const e of entries) {
    const { images, ...rest } = e;
    const imageRefs: Record<string, string> | undefined = images && Object.keys(images).length > 0
      ? {} : undefined;
    if (imageRefs && images) {
      for (const [fid, dataUrl] of Object.entries(images)) {
        const ext = getImageExtFromDataUrl(dataUrl);
        const path = `${IMAGES_FOLDER}/entry_${e.id}_${fid}${ext}`;
        imageRefs[fid] = path;
        zip.file(path, getBase64FromDataUrl(dataUrl), { base64: true });
      }
    }
    entriesForJson.push({ ...rest, imageRefs });
  }

  const sessionsForJson: (Omit<DailySession, 'fragments'> & { fragments: FragmentForJson[] })[] = [];
  for (const s of sessions) {
    const fragments: FragmentForJson[] = (s.fragments || []).map((f) => {
      const { imageData, ...rest } = f;
      if (f.type === FragmentType.IMAGE && imageData) {
        const ext = getImageExtFromDataUrl(imageData);
        const path = `${IMAGES_FOLDER}/frag_${s.id}_${f.id}${ext}`;
        zip.file(path, getBase64FromDataUrl(imageData), { base64: true });
        return { ...rest, imageRef: path };
      }
      return { ...rest };
    });
    sessionsForJson.push({ ...s, fragments });
  }

  const dataJson: Record<string, unknown> = {
    entries: entriesForJson,
    sessions: sessionsForJson,
    version: '1.0.0',
    timestamp: Date.now()
  };
  if (settings.backupApiKeys !== false) {
    dataJson.apiKeys = settings.apiKeys || {};
    dataJson.webdav = {
      webdavUrl: settings.webdavUrl || '',
      webdavUser: settings.webdavUser || '',
      webdavPass: settings.webdavPass || ''
    };
    dataJson.aiModels = settings.aiModels || {};
    dataJson.aiBaseUrl = settings.aiBaseUrl ?? '';
  }

  zip.file('data.json', JSON.stringify(dataJson, null, 2));
  return zip.generateAsync({ type: 'blob' });
}

/**
 * 导出数据并下载为 ZIP：data.json 仅存文本，图片放入 images/ 文件夹
 * 与 buildBackupZip 结构一致，供本地下载使用
 */
export const downloadData = async (): Promise<void> => {
  const entries = MockDataService.getEntries();
  const sessions = MockDataService.getSessions();
  const blob = await buildBackupZip(entries, sessions);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wing-backup-${getLocalDateString()}.zip`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 从 ZIP 内的 data.json + images/ 解析出完整的 entries 与 sessions（含 base64 图片）
 */
async function resolveDataFromZip(zip: JSZip): Promise<{ data: ExportData | null; message: string }> {
  const dataFile = zip.file('data.json');
  if (!dataFile) {
    return { data: null, message: 'ZIP 中缺少 data.json' };
  }
  const text = await dataFile.async('string');
  const parsed = JSON.parse(text) as {
    entries?: unknown[];
    sessions?: unknown[];
    apiKeys?: Partial<Record<AiProvider, string>>;
    webdav?: { webdavUrl: string; webdavUser: string; webdavPass: string };
    aiModels?: Partial<Record<AiProvider, string>>;
    aiBaseUrl?: string;
  };
  if (!parsed.entries || !Array.isArray(parsed.entries) || !parsed.sessions || !Array.isArray(parsed.sessions)) {
    return { data: null, message: '无效的数据格式' };
  }

  /** 从路径取扩展名，如 "images/xx.png" -> ".png" */
  const extOf = (p: string) => {
    const i = p.lastIndexOf('.');
    return i >= 0 ? p.slice(i) : '.png';
  };

  const entries: WingEntry[] = [];
  for (const e of parsed.entries as (WingEntry & { imageRefs?: Record<string, string> })[]) {
    const { imageRefs, images: _im, ...rest } = e;
    const images: Record<string, string> = {};
    if (imageRefs && typeof imageRefs === 'object') {
      for (const [fid, path] of Object.entries(imageRefs)) {
        const f = zip.file(path);
        if (f) {
          const b64 = await f.async('base64');
          const mime = mimeFromExt(extOf(path));
          images[fid] = `data:${mime};base64,${b64}`;
        }
      }
    }
    entries.push({ ...rest, images: Object.keys(images).length > 0 ? images : undefined } as WingEntry);
  }

  const sessions: DailySession[] = [];
  for (const s of parsed.sessions as (DailySession & { fragments?: (RawFragment & { imageRef?: string })[] })[]) {
    const fragments: RawFragment[] = [];
    for (const f of s.fragments || []) {
      const { imageRef, imageData: _id, ...rest } = f;
      let imageData: string | undefined;
      if (imageRef && typeof imageRef === 'string') {
        const zf = zip.file(imageRef);
        if (zf) {
          const b64 = await zf.async('base64');
          imageData = `data:${mimeFromExt(extOf(imageRef))};base64,${b64}`;
        }
      }
      fragments.push({ ...rest, imageData } as RawFragment);
    }
    sessions.push({ ...s, fragments });
  }

  const data: ExportData = {
    entries,
    sessions,
    version: (parsed as { version?: string }).version || '1.0.0',
    timestamp: (parsed as { timestamp?: number }).timestamp || Date.now(),
    apiKeys: parsed.apiKeys,
    webdav: parsed.webdav,
    aiModels: parsed.aiModels,
    aiBaseUrl: parsed.aiBaseUrl
  };
  return { data, message: '' };
}

/**
 * 导入数据：支持 .json（旧版，base64 内联）与 .zip（data.json + images/ 文件夹）
 * 合并到现有数据，不覆盖已有条目/会话
 */
export const importData = (file: File): Promise<{ success: boolean; message: string }> => {
  const isZip = file.name.toLowerCase().endsWith('.zip');

  if (isZip) {
    return (async () => {
      try {
        const zip = await JSZip.loadAsync(file);
        const { data, message } = await resolveDataFromZip(zip);
        if (!data) {
          return { success: false, message: message || '无效的备份 ZIP' };
        }
        return applyImportMerge(data);
      } catch (e) {
        return { success: false, message: `导入失败: ${e instanceof Error ? e.message : '未知错误'}` };
      }
    })();
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data: ExportData = JSON.parse(content);
        if (!data.entries || !data.sessions) {
          resolve({ success: false, message: '无效的数据格式' });
          return;
        }
        resolve(applyImportMerge(data));
      } catch (error) {
        resolve({ success: false, message: `导入失败: ${error instanceof Error ? error.message : '未知错误'}` });
      }
    };
    reader.onerror = () => resolve({ success: false, message: '文件读取失败' });
    reader.readAsText(file);
  });
};

/**
 * 合并导入的数据到现有数据（entries / sessions 按 id 去重，只加新的）
 */
function applyImportMerge(data: ExportData): { success: boolean; message: string } {
  const existingEntries = MockDataService.getEntries();
  const existingSessions = MockDataService.getSessions();
  const entryMap = new Map(existingEntries.map((e) => [e.id, e]));
  data.entries.forEach((entry) => {
    if (!entryMap.has(entry.id)) entryMap.set(entry.id, entry);
  });
  const sessionMap = new Map(existingSessions.map((s) => [s.id, s]));
  data.sessions.forEach((session) => {
    if (!sessionMap.has(session.id)) sessionMap.set(session.id, session);
  });
  localStorage.setItem('wing_entries', JSON.stringify(Array.from(entryMap.values())));
  localStorage.setItem('wing_sessions', JSON.stringify(Array.from(sessionMap.values())));

  const cur = MockDataService.getSettings();
  if (data.apiKeys != null && typeof data.apiKeys === 'object') {
    MockDataService.updateSettings({ apiKeys: { ...(cur.apiKeys || {}), ...data.apiKeys } });
  }
  if (data.webdav != null && typeof data.webdav === 'object') {
    MockDataService.updateSettings({
      webdavUrl: data.webdav.webdavUrl !== undefined ? data.webdav.webdavUrl : cur.webdavUrl,
      webdavUser: data.webdav.webdavUser !== undefined ? data.webdav.webdavUser : cur.webdavUser,
      webdavPass: data.webdav.webdavPass !== undefined ? data.webdav.webdavPass : cur.webdavPass
    });
  }
  if (data.aiModels != null && typeof data.aiModels === 'object') {
    MockDataService.updateSettings({ aiModels: { ...(cur.aiModels || {}), ...data.aiModels } });
  }
  if (data.aiBaseUrl !== undefined) {
    MockDataService.updateSettings({ aiBaseUrl: data.aiBaseUrl ?? '' });
  }
  window.dispatchEvent(new Event('wing_data_updated'));
  return { success: true, message: `成功导入 ${data.entries.length} 条日记和 ${data.sessions.length} 个会话` };
}

/**
 * 完全替换数据：支持 .json 与 .zip（危险操作）
 */
export const replaceData = (file: File): Promise<{ success: boolean; message: string }> => {
  const isZip = file.name.toLowerCase().endsWith('.zip');

  if (isZip) {
    return (async () => {
      try {
        const zip = await JSZip.loadAsync(file);
        const { data, message } = await resolveDataFromZip(zip);
        if (!data) {
          return { success: false, message: message || '无效的备份 ZIP' };
        }
        return applyReplace(data);
      } catch (e) {
        return { success: false, message: `替换失败: ${e instanceof Error ? e.message : '未知错误'}` };
      }
    })();
  }

  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data: ExportData = JSON.parse(content);
        if (!data.entries || !data.sessions) {
          resolve({ success: false, message: '无效的数据格式' });
          return;
        }
        resolve(applyReplace(data));
      } catch (error) {
        resolve({ success: false, message: `替换失败: ${error instanceof Error ? error.message : '未知错误'}` });
      }
    };
    reader.onerror = () => resolve({ success: false, message: '文件读取失败' });
    reader.readAsText(file);
  });
}

/**
 * 用导入的数据完全替换本地 entries 与 sessions
 */
function applyReplace(data: ExportData): { success: boolean; message: string } {
  localStorage.setItem('wing_entries', JSON.stringify(data.entries));
  localStorage.setItem('wing_sessions', JSON.stringify(data.sessions));
  if (data.apiKeys != null && typeof data.apiKeys === 'object') {
    MockDataService.updateSettings({ apiKeys: data.apiKeys });
  }
  if (data.webdav != null && typeof data.webdav === 'object') {
    MockDataService.updateSettings({
      webdavUrl: data.webdav.webdavUrl ?? '',
      webdavUser: data.webdav.webdavUser ?? '',
      webdavPass: data.webdav.webdavPass ?? ''
    });
  }
  if (data.aiModels != null && typeof data.aiModels === 'object') {
    MockDataService.updateSettings({ aiModels: data.aiModels });
  }
  if (data.aiBaseUrl !== undefined) {
    MockDataService.updateSettings({ aiBaseUrl: data.aiBaseUrl ?? '' });
  }
  window.dispatchEvent(new Event('wing_data_updated'));
  return { success: true, message: `成功替换数据: ${data.entries.length} 条日记和 ${data.sessions.length} 个会话` };
}

/**
 * 获取数据统计信息
 */
export const getDataStats = () => {
  const entries = MockDataService.getEntries();
  const sessions = MockDataService.getSessions();
  
  return {
    entriesCount: entries.length,
    sessionsCount: sessions.length,
    totalSize: new Blob([JSON.stringify({ entries, sessions })], { type: 'application/json' }).size
  };
};

