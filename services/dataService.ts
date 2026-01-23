/**
 * 数据服务模块
 * 提供数据导入/导出功能
 * 导出：JSON 存文本，图片单独放在 images/ 文件夹（ZIP 打包下载）
 * 导入：支持 .json（旧版内联 base64）与 .zip（data.json + images/）
 */

import JSZip from 'jszip';
import { WingEntry, DailySession, RawFragment, AiProvider, FragmentType, AppSettings, Memory } from '../types';
import { getLocalDateString } from '../utils/date';
import { isQuotaExceededError } from '../utils/storage';
import { MockDataService } from './mockDataService';
import { IndexedDBStorage } from './indexedDBStorage';

/** 「备份所有设置」时导出的设置选项与开关（不含 apiKeys、webdav、aiModels、aiBaseUrl、theme、fontSize） */
export type ExportSettings = Partial<
  Pick<
    AppSettings,
    | 'aiProvider'
    | 'language'
    | 'pageFont'
    | 'modelLanguage'
    | 'keepEditHistory'
    | 'realtimeWebdavSync'
    | 'backupApiKeys'
    | 'writingStyle'
    | 'writingStylePrompt'
    | 'insightPrompt'
    | 'enableLongTermMemory'
    | 'memoryExtractionAuto'
    | 'memoryRetrievalEnabled'
  >
>;

export interface ExportData {
  entries: WingEntry[];
  sessions: DailySession[];
  version: string;
  timestamp: number;
  /** 长期记忆数据（仅当「备份所有设置」开启时包含） */
  memories?: Memory[];
  /** 各供应商的 API Key（仅当「备份所有设置」开启时包含） */
  apiKeys?: Partial<Record<AiProvider, string>>;
  /** 云端备份 WebDAV 设置（仅当「备份所有设置」开启时包含） */
  webdav?: { webdavUrl: string; webdavUser: string; webdavPass: string };
  /** 各供应商的模型名称（仅当「备份所有设置」开启时包含） */
  aiModels?: Partial<Record<AiProvider, string>>;
  /** 自定义 Base URL（仅当「备份所有设置」开启时包含） */
  aiBaseUrl?: string;
  /** 设置中的选项与开关（仅当「备份所有设置」开启时包含） */
  settings?: ExportSettings;
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
 * 从 AppSettings 提取「备份所有设置」时导出的选项与开关（不含密钥类字段）
 */
function getExportSettings(s: AppSettings): ExportSettings | undefined {
  const o: ExportSettings = {};
  if (s.aiProvider !== undefined) o.aiProvider = s.aiProvider;
  if (s.language !== undefined) o.language = s.language;
  if (s.pageFont !== undefined) o.pageFont = s.pageFont;
  if (s.modelLanguage !== undefined) o.modelLanguage = s.modelLanguage;
  if (s.keepEditHistory !== undefined) o.keepEditHistory = s.keepEditHistory;
  if (s.realtimeWebdavSync !== undefined) o.realtimeWebdavSync = s.realtimeWebdavSync;
  if (s.backupApiKeys !== undefined) o.backupApiKeys = s.backupApiKeys;
  if (s.writingStyle !== undefined) o.writingStyle = s.writingStyle;
  if (s.writingStylePrompt !== undefined) o.writingStylePrompt = s.writingStylePrompt;
  if (s.insightPrompt !== undefined) o.insightPrompt = s.insightPrompt;
  if (s.enableLongTermMemory !== undefined) o.enableLongTermMemory = s.enableLongTermMemory;
  if (s.memoryExtractionAuto !== undefined) o.memoryExtractionAuto = s.memoryExtractionAuto;
  if (s.memoryRetrievalEnabled !== undefined) o.memoryRetrievalEnabled = s.memoryRetrievalEnabled;
  return Object.keys(o).length > 0 ? o : undefined;
}

/**
 * 导出所有数据为 JSON 字符串（含内联 base64，供 WebDAV 等旧式备份使用）
 * 若「备份所有设置」开启则包含 apiKeys、webdav、aiModels、aiBaseUrl 及 settings（各选项与开关）
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
    const s = getExportSettings(settings);
    if (s) out.settings = s;
    // 导出长期记忆数据
    const memories = IndexedDBStorage.getMemories();
    if (memories.length > 0) {
      out.memories = memories;
    }
  }

  return JSON.stringify(out, null, 2);
};

/**
 * 准备备份数据：data.json 字符串与图片列表（ path + base64），供单 ZIP 或分卷构建使用
 */
function prepareBackupData(entries: WingEntry[], sessions: DailySession[]): { dataJson: string; imageList: { path: string; base64: string }[] } {
  const settings = MockDataService.getSettings();
  /** 供 data.json 使用的结构：无 base64，只有图片路径引用 */
  type EntryForJson = Omit<WingEntry, 'images'> & { imageRefs?: Record<string, string> };
  type FragmentForJson = Omit<RawFragment, 'imageData'> & { imageRef?: string };

  const imageList: { path: string; base64: string }[] = [];
  const entriesForJson: EntryForJson[] = [];
  for (const e of entries) {
    const { images, ...rest } = e;
    const imageRefs: Record<string, string> | undefined = images && Object.keys(images).length > 0 ? {} : undefined;
    if (imageRefs && images) {
      for (const [fid, dataUrl] of Object.entries(images)) {
        const ext = getImageExtFromDataUrl(dataUrl);
        const path = `${IMAGES_FOLDER}/entry_${e.id}_${fid}${ext}`;
        imageRefs[fid] = path;
        imageList.push({ path, base64: getBase64FromDataUrl(dataUrl) });
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
        imageList.push({ path, base64: getBase64FromDataUrl(imageData) });
        return { ...rest, imageRef: path };
      }
      return { ...rest };
    });
    sessionsForJson.push({ ...s, fragments });
  }

  const dataObj: Record<string, unknown> = {
    entries: entriesForJson,
    sessions: sessionsForJson,
    version: '1.0.0',
    timestamp: Date.now()
  };
  if (settings.backupApiKeys !== false) {
    dataObj.apiKeys = settings.apiKeys || {};
    dataObj.webdav = { webdavUrl: settings.webdavUrl || '', webdavUser: settings.webdavUser || '', webdavPass: settings.webdavPass || '' };
    dataObj.aiModels = settings.aiModels || {};
    dataObj.aiBaseUrl = settings.aiBaseUrl ?? '';
    const s = getExportSettings(settings);
    if (s) dataObj.settings = s;
    // 导出长期记忆数据
    const memories = IndexedDBStorage.getMemories();
    if (memories.length > 0) {
      dataObj.memories = memories;
    }
  }
  return { dataJson: JSON.stringify(dataObj, null, 2), imageList };
}

const FILE_SIZE_LIMIT = 5.5 * 1024 * 1024;
const SPLIT_CHUNK_RAW = 4.5 * 1024 * 1024; // 每卷约 4.5MB 原始，ZIP 后通常 < 6MB
const MAX_SPLIT_PARTS = 20;

/**
 * 构建与本地导出一致的备份 ZIP（data.json 文本 + images/ 图片），供下载或云端同步使用
 * 使用 DEFLATE level 9 压缩以尽量减小体积
 */
export async function buildBackupZip(entries: WingEntry[], sessions: DailySession[]): Promise<Blob> {
  const { dataJson, imageList } = prepareBackupData(entries, sessions);
  const zip = new JSZip();
  zip.file('data.json', dataJson);
  for (const { path, base64 } of imageList) {
    zip.file(path, base64, { base64: true });
  }
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
}

/**
 * 构建备份：若单 ZIP ≤ 5.5MB 返回单文件；否则返回分卷（data.json + 多个 images_*.zip）
 * 用于云盘上传，以规避 Netlify 6MB 请求体限制。
 */
export async function buildBackupZipOrSplit(
  entries: WingEntry[],
  sessions: DailySession[]
): Promise<{ mode: 'single'; blob: Blob } | { mode: 'split'; baseName: string; dataJson: string; imageZipBlobs: Blob[] }> {
  const { dataJson, imageList } = prepareBackupData(entries, sessions);
  const zip = new JSZip();
  zip.file('data.json', dataJson);
  for (const { path, base64 } of imageList) {
    zip.file(path, base64, { base64: true });
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } });
  if (blob.size <= FILE_SIZE_LIMIT) {
    return { mode: 'single', blob };
  }
  // 分卷：按原始大小把 imageList 切成多块，每块打成一个 ZIP
  const chunks: { path: string; base64: string }[][] = [];
  let acc: { path: string; base64: string }[] = [];
  let accRaw = 0;
  for (const img of imageList) {
    const raw = Math.ceil((img.base64.length * 3) / 4);
    if (accRaw + raw > SPLIT_CHUNK_RAW && acc.length > 0) {
      chunks.push(acc);
      acc = [];
      accRaw = 0;
    }
    acc.push(img);
    accRaw += raw;
  }
  if (acc.length > 0) chunks.push(acc);

  const imageZipBlobs: Blob[] = [];
  for (let i = 0; i < chunks.length; i++) {
    const z = new JSZip();
    for (const { path, base64 } of chunks[i]) {
      z.file(path, base64, { base64: true });
    }
    imageZipBlobs.push(await z.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 9 } }));
  }
  const baseName = `wing-backup-${getLocalDateString()}`;
  return { mode: 'split', baseName, dataJson, imageZipBlobs };
}

/** 分卷数上限，超过则走方案3 兜底（保存到本地） */
export const BACKUP_MAX_SPLIT_PARTS = MAX_SPLIT_PARTS;

/**
 * 导出数据并下载为 ZIP：data.json 仅存文本，图片放入 images/ 文件夹
 * 与 buildBackupZip 结构一致，供本地下载使用
 * 兼容移动浏览器（安卓浏览器等）的下载触发方式
 */
export const downloadData = async (): Promise<void> => {
  const entries = MockDataService.getEntries();
  const sessions = MockDataService.getSessions();
  const blob = await buildBackupZip(entries, sessions);
  const url = URL.createObjectURL(blob);
  const fileName = `wing-backup-${getLocalDateString()}.zip`;
  
  // 检测是否为移动设备
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
  
  return new Promise<void>((resolve, reject) => {
    try {
      // 创建下载链接
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      
      // 对于移动浏览器，设置必要的属性
      if (isMobile) {
        // 某些移动浏览器需要链接可见（即使很小）
        a.style.position = 'fixed';
        a.style.top = '-9999px';
        a.style.left = '-9999px';
        a.style.opacity = '0';
        a.style.width = '1px';
        a.style.height = '1px';
      } else {
        a.style.display = 'none';
      }
      
      document.body.appendChild(a);
      
      // 使用 requestAnimationFrame 确保 DOM 更新后再触发
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          try {
            // 创建并触发点击事件
            const clickEvent = new MouseEvent('click', {
              view: window,
              bubbles: true,
              cancelable: true,
              buttons: 1
            });
            
            // 先尝试 dispatchEvent
            a.dispatchEvent(clickEvent);
            
            // 再尝试直接调用 click（某些浏览器需要）
            if (typeof a.click === 'function') {
              a.click();
            }
          } catch (e) {
            console.warn('下载触发失败:', e);
          }
          
          // 延迟清理，确保下载已开始
          // 移动浏览器需要更长的延迟
          const cleanupDelay = isMobile ? 2000 : 500;
          setTimeout(() => {
            try {
              if (document.body.contains(a)) {
                document.body.removeChild(a);
              }
            } catch (e) {
              // 忽略清理错误
            }
            // 延迟释放 URL，给浏览器足够时间处理下载
            setTimeout(() => {
              URL.revokeObjectURL(url);
            }, 500);
            resolve();
          }, cleanupDelay);
        });
      });
      
    } catch (error) {
      URL.revokeObjectURL(url);
      reject(new Error(`无法触发下载: ${error instanceof Error ? error.message : '未知错误'}`));
    }
  });
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
    memories?: Memory[];
    apiKeys?: Partial<Record<AiProvider, string>>;
    webdav?: { webdavUrl: string; webdavUser: string; webdavPass: string };
    aiModels?: Partial<Record<AiProvider, string>>;
    aiBaseUrl?: string;
    settings?: ExportSettings;
  };
  if (!parsed.entries || !Array.isArray(parsed.entries) || !parsed.sessions || !Array.isArray(parsed.sessions)) {
    return { data: null, message: '无效的数据格式' };
  }

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
    memories: (parsed as { memories?: Memory[] }).memories,
    apiKeys: parsed.apiKeys,
    webdav: parsed.webdav,
    aiModels: parsed.aiModels,
    aiBaseUrl: parsed.aiBaseUrl,
    settings: parsed.settings
  };
  return { data, message: '' };
}

/** 从路径取扩展名，如 "images/xx.png" -> ".png" */
function extOf(p: string): string {
  const i = p.lastIndexOf('.');
  return i >= 0 ? p.slice(i) : '.png';
}

/**
 * 从分卷备份（data.json 字符串 + 多个 images 的 ZIP Blob）解析出 ExportData
 * imageMap 的 key 为 images/xxx 路径，由调用方从 imageZipBlobs 合并得到
 */
function resolveDataFromImageMap(
  parsed: {
    entries?: unknown[];
    sessions?: unknown[];
    version?: string;
    timestamp?: number;
    memories?: Memory[];
    apiKeys?: unknown;
    webdav?: unknown;
    aiModels?: unknown;
    aiBaseUrl?: unknown;
    settings?: unknown;
  },
  imageMap: Record<string, string>
): { data: ExportData | null; message: string } {
  if (!parsed.entries || !Array.isArray(parsed.entries) || !parsed.sessions || !Array.isArray(parsed.sessions)) {
    return { data: null, message: '无效的数据格式' };
  }
  const entries: WingEntry[] = [];
  for (const e of parsed.entries as (WingEntry & { imageRefs?: Record<string, string> })[]) {
    const { imageRefs, images: _im, ...rest } = e;
    const images: Record<string, string> = {};
    if (imageRefs && typeof imageRefs === 'object') {
      for (const [fid, path] of Object.entries(imageRefs)) {
        const b64 = imageMap[path];
        if (b64) {
          images[fid] = `data:${mimeFromExt(extOf(path))};base64,${b64}`;
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
        const b64 = imageMap[imageRef];
        if (b64) imageData = `data:${mimeFromExt(extOf(imageRef))};base64,${b64}`;
      }
      fragments.push({ ...rest, imageData } as RawFragment);
    }
    sessions.push({ ...s, fragments });
  }
  const data: ExportData = {
    entries,
    sessions,
    version: parsed.version || '1.0.0',
    timestamp: parsed.timestamp || Date.now(),
    memories: parsed.memories,
    apiKeys: parsed.apiKeys,
    webdav: parsed.webdav,
    aiModels: parsed.aiModels,
    aiBaseUrl: parsed.aiBaseUrl,
    settings: parsed.settings
  };
  return { data, message: '' };
}

/**
 * 从分卷备份恢复：data.json 字符串 + 多个 images 的 ZIP Blob，合并后替换/导入
 */
async function buildImageMapFromZipBlobs(imageZipBlobs: Blob[]): Promise<Record<string, string>> {
  const imageMap: Record<string, string> = {};
  for (const b of imageZipBlobs) {
    const z = await JSZip.loadAsync(b);
    for (const [path, f] of Object.entries(z.files)) {
      if (path.startsWith('images/') && !f.dir) {
        const b64 = await f.async('base64');
        imageMap[path] = b64;
      }
    }
  }
  return imageMap;
}

/**
 * 用分卷备份（data.json 字符串 + images 的 ZIP Blob 数组）完全替换本地数据
 */
export async function replaceDataFromSplit(jsonContent: string, imageZipBlobs: Blob[]): Promise<{ success: boolean; message: string }> {
  try {
    const parsed = JSON.parse(jsonContent) as Parameters<typeof resolveDataFromImageMap>[0];
    const imageMap = await buildImageMapFromZipBlobs(imageZipBlobs);
    const { data, message } = resolveDataFromImageMap(parsed, imageMap);
    if (!data) return { success: false, message: message || '无效的备份数据' };
    return applyReplace(data);
  } catch (e) {
    return { success: false, message: `替换失败: ${e instanceof Error ? e.message : '未知错误'}` };
  }
}

/**
 * 用分卷备份（data.json 字符串 + images 的 ZIP Blob 数组）合并导入到现有数据
 */
export async function importDataFromSplit(jsonContent: string, imageZipBlobs: Blob[]): Promise<{ success: boolean; message: string }> {
  try {
    const parsed = JSON.parse(jsonContent) as Parameters<typeof resolveDataFromImageMap>[0];
    const imageMap = await buildImageMapFromZipBlobs(imageZipBlobs);
    const { data, message } = resolveDataFromImageMap(parsed, imageMap);
    if (!data) return { success: false, message: message || '无效的备份数据' };
    return applyImportMerge(data);
  } catch (e) {
    return { success: false, message: `导入失败: ${e instanceof Error ? e.message : '未知错误'}` };
  }
}

/**
 * 从文件夹导入数据：支持 WebDAV 导出的文件夹格式
 * 自动检测单文件备份（wing-backup-*.zip）或分卷备份（wing-backup-*.json + wing-backup-*_images_*.zip）
 * 合并到现有数据，不覆盖已有条目/会话
 */
export const importDataFromFolder = async (files: FileList): Promise<{ success: boolean; message: string }> => {
  try {
    // 将 FileList 转换为数组
    const fileArray = Array.from(files);
    
    // 查找单文件备份
    const singleZipFile = fileArray.find(f => /^wing-backup-\d{4}-\d{2}-\d{2}\.zip$/i.test(f.name));
    if (singleZipFile) {
      return await importData(singleZipFile);
    }
    
    // 查找分卷备份：查找 JSON 文件
    const jsonFile = fileArray.find(f => /^wing-backup-\d{4}-\d{2}-\d{2}\.json$/i.test(f.name));
    if (jsonFile) {
      // 提取日期部分
      const dateMatch = jsonFile.name.match(/^wing-backup-(\d{4}-\d{2}-\d{2})\.json$/i);
      if (!dateMatch) {
        return { success: false, message: '无法识别备份文件格式' };
      }
      const dateStr = dateMatch[1];
      
      // 查找对应的图片 ZIP 文件
      const imageZipFiles = fileArray
        .filter(f => {
          const match = f.name.match(new RegExp(`^wing-backup-${dateStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_images_(\\d+)\\.zip$`, 'i'));
          return match !== null;
        })
        .sort((a, b) => {
          const aNum = parseInt(a.name.match(/_images_(\d+)/)?.[1] ?? '0', 10);
          const bNum = parseInt(b.name.match(/_images_(\d+)/)?.[1] ?? '0', 10);
          return aNum - bNum;
        });
      
      if (imageZipFiles.length === 0) {
        return { success: false, message: '未找到对应的图片备份文件' };
      }
      
      // 读取 JSON 内容
      const jsonContent = await jsonFile.text();
      
      // 将图片 ZIP 文件转换为 Blob
      const imageZipBlobs: Blob[] = imageZipFiles.map(f => f);
      
      return await importDataFromSplit(jsonContent, imageZipBlobs);
    }
    
    return { success: false, message: '文件夹中未找到有效的备份文件（需要 wing-backup-*.zip 或 wing-backup-*.json + wing-backup-*_images_*.zip）' };
  } catch (e) {
    return { success: false, message: `导入失败: ${e instanceof Error ? e.message : '未知错误'}` };
  }
};

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
        applyImportMerge(data).then(resolve).catch((err) =>
          resolve({ success: false, message: `导入失败: ${err instanceof Error ? err.message : '未知错误'}` })
        );
      } catch (error) {
        resolve({ success: false, message: `导入失败: ${error instanceof Error ? error.message : '未知错误'}` });
      }
    };
    reader.onerror = () => resolve({ success: false, message: '文件读取失败' });
    reader.readAsText(file);
  });
};

/**
 * 合并导入的数据到现有数据（entries / sessions 按 id 去重，只加新的），写入 IndexedDB
 */
async function applyImportMerge(data: ExportData): Promise<{ success: boolean; message: string }> {
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
  try {
    await MockDataService.replaceEntries(Array.from(entryMap.values()));
    await MockDataService.replaceSessions(Array.from(sessionMap.values()));
  } catch (e) {
    if (isQuotaExceededError(e)) {
      return { success: false, message: '存储空间不足，无法完成导入。请先清空部分数据或导出备份后重试。' };
    }
    throw e;
  }

  const cur = MockDataService.getSettings();
  if (data.settings != null && typeof data.settings === 'object') {
    MockDataService.updateSettings(data.settings);
  }
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
  // 导入长期记忆数据（合并模式：按 id 去重）
  if (data.memories != null && Array.isArray(data.memories) && data.memories.length > 0) {
    const existingMemories = IndexedDBStorage.getMemories();
    const memoryMap = new Map(existingMemories.map((m) => [m.id, m]));
    data.memories.forEach((memory) => {
      if (!memoryMap.has(memory.id)) {
        memoryMap.set(memory.id, memory);
      }
    });
    await IndexedDBStorage.replaceMemories(Array.from(memoryMap.values()));
  }
  window.dispatchEvent(new Event('wing_data_updated'));
  return { success: true, message: `成功导入 ${data.entries.length} 条日记和 ${data.sessions.length} 个会话` };
}

/**
 * 从文件夹替换数据：支持 WebDAV 导出的文件夹格式
 * 自动检测单文件备份（wing-backup-*.zip）或分卷备份（wing-backup-*.json + wing-backup-*_images_*.zip）
 * 完全替换现有数据（危险操作）
 */
export const replaceDataFromFolder = async (files: FileList): Promise<{ success: boolean; message: string }> => {
  try {
    // 将 FileList 转换为数组
    const fileArray = Array.from(files);
    
    // 查找单文件备份
    const singleZipFile = fileArray.find(f => /^wing-backup-\d{4}-\d{2}-\d{2}\.zip$/i.test(f.name));
    if (singleZipFile) {
      return await replaceData(singleZipFile);
    }
    
    // 查找分卷备份：查找 JSON 文件
    const jsonFile = fileArray.find(f => /^wing-backup-\d{4}-\d{2}-\d{2}\.json$/i.test(f.name));
    if (jsonFile) {
      // 提取日期部分
      const dateMatch = jsonFile.name.match(/^wing-backup-(\d{4}-\d{2}-\d{2})\.json$/i);
      if (!dateMatch) {
        return { success: false, message: '无法识别备份文件格式' };
      }
      const dateStr = dateMatch[1];
      
      // 查找对应的图片 ZIP 文件
      const imageZipFiles = fileArray
        .filter(f => {
          const match = f.name.match(new RegExp(`^wing-backup-${dateStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_images_(\\d+)\\.zip$`, 'i'));
          return match !== null;
        })
        .sort((a, b) => {
          const aNum = parseInt(a.name.match(/_images_(\d+)/)?.[1] ?? '0', 10);
          const bNum = parseInt(b.name.match(/_images_(\d+)/)?.[1] ?? '0', 10);
          return aNum - bNum;
        });
      
      if (imageZipFiles.length === 0) {
        return { success: false, message: '未找到对应的图片备份文件' };
      }
      
      // 读取 JSON 内容
      const jsonContent = await jsonFile.text();
      
      // 将图片 ZIP 文件转换为 Blob
      const imageZipBlobs: Blob[] = imageZipFiles.map(f => f);
      
      return await replaceDataFromSplit(jsonContent, imageZipBlobs);
    }
    
    return { success: false, message: '文件夹中未找到有效的备份文件（需要 wing-backup-*.zip 或 wing-backup-*.json + wing-backup-*_images_*.zip）' };
  } catch (e) {
    return { success: false, message: `替换失败: ${e instanceof Error ? e.message : '未知错误'}` };
  }
};

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
        applyReplace(data).then(resolve).catch((err) =>
          resolve({ success: false, message: `替换失败: ${err instanceof Error ? err.message : '未知错误'}` })
        );
      } catch (error) {
        resolve({ success: false, message: `替换失败: ${error instanceof Error ? error.message : '未知错误'}` });
      }
    };
    reader.onerror = () => resolve({ success: false, message: '文件读取失败' });
    reader.readAsText(file);
  });
}

/**
 * 用导入的数据完全替换本地 entries 与 sessions，写入 IndexedDB
 */
async function applyReplace(data: ExportData): Promise<{ success: boolean; message: string }> {
  try {
    await MockDataService.replaceEntries(data.entries);
    await MockDataService.replaceSessions(data.sessions);
  } catch (e) {
    if (isQuotaExceededError(e)) {
      return { success: false, message: '存储空间不足，无法完成替换。请先清空部分数据或导出备份后重试。' };
    }
    throw e;
  }
  if (data.settings != null && typeof data.settings === 'object') {
    MockDataService.updateSettings(data.settings);
  }
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
  // 替换长期记忆数据（完全替换模式）
  if (data.memories != null && Array.isArray(data.memories)) {
    await IndexedDBStorage.replaceMemories(data.memories);
  } else {
    // 如果没有记忆数据，清空现有记忆（替换模式）
    await IndexedDBStorage.replaceMemories([]);
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

