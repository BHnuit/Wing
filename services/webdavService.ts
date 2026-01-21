/**
 * WebDAV服务模块
 * 支持坚果云等WebDAV服务商
 */

import { WingEntry, DailySession, AppSettings } from '../types';
import { getLocalDateString } from '../utils/date';
import { MockDataService } from './mockDataService';
import { buildBackupZip, buildBackupZipOrSplit, BACKUP_MAX_SPLIT_PARTS } from './dataService';

// 坚果云默认配置
const JIANGUOYUN_DEFAULT_URL = 'https://dav.jianguoyun.com/dav/';

export interface WebDAVConfig {
  url: string;
  username: string;
  password: string;
}

export interface SyncStatus {
  success: boolean;
  message: string;
  timestamp?: number;
  /** 方案3 兜底：上传不可行时改为保存到本地，由调用方触发下载并提示用户手动上传云盘 */
  fallbackDownload?: Blob;
}

/**
 * WebDAV服务类
 */
export class WebDAVService {
  private config: WebDAVConfig;

  constructor(config: WebDAVConfig) {
    this.config = config;
  }

  /**
   * 测试WebDAV连接
   */
  async testConnection(): Promise<SyncStatus> {
    try {
      // 先尝试创建目录（如果不存在）
      const dirUrl = this.getFullPath('');
      try {
        await fetch(dirUrl, {
          method: 'MKCOL',
          headers: { 'Authorization': this.getAuthHeader(), ...this.getProxyHeaderIfNeeded(dirUrl) }
        });
      } catch (e) {
        // 目录可能已存在，忽略错误
      }

      const testUrl = this.getFullPath('test-connection.txt');
      const testContent = `Wing Connection Test - ${new Date().toISOString()}`;
      const putResponse = await fetch(testUrl, {
        method: 'PUT',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'text/plain; charset=utf-8',
          ...this.getProxyHeaderIfNeeded(testUrl)
        },
        body: testContent
      });

      if (putResponse.status === 401 || putResponse.status === 403) {
        return {
          success: false,
          message: '认证失败，请检查用户名和密码'
        };
      }

      if (putResponse.status >= 200 && putResponse.status < 300) {
        // 删除测试文件
        try {
          await fetch(testUrl, {
            method: 'DELETE',
            headers: { 'Authorization': this.getAuthHeader(), ...this.getProxyHeaderIfNeeded(testUrl) }
          });
        } catch (e) {
          // 忽略删除错误
        }

        return {
          success: true,
          message: '连接成功',
          timestamp: Date.now()
        };
      }

      return {
        success: false,
        message: `连接失败: HTTP ${putResponse.status}`
      };
    } catch (error) {
      // 检查是否是CORS错误
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          success: false,
          message: 'CORS错误：WebDAV服务器可能不允许跨域访问。请检查服务器配置或使用代理。'
        };
      }
      
      return {
        success: false,
        message: `连接错误: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 上传文件到WebDAV
   */
  async uploadFile(fileName: string, content: string): Promise<SyncStatus> {
    try {
      // 确保目录存在
      const dirUrl = this.getFullPath('');
      try {
        await fetch(dirUrl, {
          method: 'MKCOL',
          headers: { 'Authorization': this.getAuthHeader(), ...this.getProxyHeaderIfNeeded(dirUrl) }
        });
      } catch (e) {
        // 目录可能已存在，忽略错误
      }

      const url = this.getFullPath(fileName);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json; charset=utf-8',
          ...this.getProxyHeaderIfNeeded(url)
        },
        body: content
      });

      if (response.status >= 200 && response.status < 300) {
        return {
          success: true,
          message: '上传成功',
          timestamp: Date.now()
        };
      }

      if (response.status === 401 || response.status === 403) {
        return {
          success: false,
          message: '认证失败，请检查用户名和密码'
        };
      }

      return {
        success: false,
        message: `上传失败: HTTP ${response.status}`
      };
    } catch (error) {
      // 检查是否是CORS错误
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return {
          success: false,
          message: 'CORS错误：WebDAV服务器可能不允许跨域访问。请检查服务器配置或使用代理。'
        };
      }
      
      return {
        success: false,
        message: `上传错误: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 上传二进制文件到 WebDAV（如 ZIP）
   * @param fileName 远程文件名
   * @param blob 文件内容
   * @param mimeType 如 'application/zip'，默认 application/zip
   */
  async uploadBlob(fileName: string, blob: Blob, mimeType: string = 'application/zip'): Promise<SyncStatus> {
    try {
      const dirUrl = this.getFullPath('');
      try {
        await fetch(dirUrl, {
          method: 'MKCOL',
          headers: { 'Authorization': this.getAuthHeader(), ...this.getProxyHeaderIfNeeded(dirUrl) }
        });
      } catch (e) {
        // 目录可能已存在，忽略
      }

      const url = this.getFullPath(fileName);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': mimeType,
          ...this.getProxyHeaderIfNeeded(url)
        },
        body: blob
      });

      if (response.status >= 200 && response.status < 300) {
        return { success: true, message: '上传成功', timestamp: Date.now() };
      }
      if (response.status === 401 || response.status === 403) {
        return { success: false, message: '认证失败，请检查用户名和密码' };
      }
      if (response.status === 413) {
        return { success: false, message: '上传失败：备份文件过大（Netlify 限制约 6MB）。请删除部分日记或图片后重试。' };
      }
      if (response.status === 500) {
        return { success: false, message: '上传失败：HTTP 500。可能是备份包较大、云盘服务异常或网络问题，请删减数据后重试或稍后再试。' };
      }
      return { success: false, message: `上传失败: HTTP ${response.status}` };
    } catch (error) {
      if (error instanceof TypeError && error.message.includes('fetch')) {
        return { success: false, message: 'CORS错误：WebDAV服务器可能不允许跨域访问。请检查服务器配置或使用代理。' };
      }
      return { success: false, message: `上传错误: ${error instanceof Error ? error.message : '未知错误'}` };
    }
  }

  /**
   * 从WebDAV下载文件
   */
  async downloadFile(fileName: string): Promise<{ success: boolean; content?: string; message: string }> {
    try {
      const url = this.getFullPath(fileName);
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': this.getAuthHeader(), ...this.getProxyHeaderIfNeeded(url) }
      });

      if (response.status === 404) {
        return {
          success: false,
          message: '文件不存在'
        };
      }

      if (response.status >= 200 && response.status < 300) {
        const content = await response.text();
        return {
          success: true,
          content,
          message: '下载成功'
        };
      }

      return {
        success: false,
        message: `下载失败: HTTP ${response.status}`
      };
    } catch (error) {
      return {
        success: false,
        message: `下载错误: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 确保远端路径对应的目录存在（MKCOL），若已存在则忽略错误
   * @param relativePath 相对于 Wing/ 的路径，如 ''（Wing 根）、'2025-01-15'（日期文件夹）
   */
  private async ensureDir(relativePath: string): Promise<void> {
    const path = this.getFullPath(relativePath);
    try {
      await fetch(path, {
        method: 'MKCOL',
        headers: { Authorization: this.getAuthHeader(), ...this.getProxyHeaderIfNeeded(path) }
      });
    } catch {
      /* 目录可能已存在 */
    }
  }

  /**
   * 备份所有数据到 WebDAV，按日期建文件夹：Wing/YYYY-MM-DD/ 内存放单 ZIP 或 data.json + images_*.zip。
   * 分卷数超过上限或上传失败时走方案3 兜底：返回 fallbackDownload，由调用方触发下载并提示用户手动上传云盘。
   * @param onProgress 进度回调，用于按步骤更新 UI 文案：key 为 i18n 键，extra 可选 { current, total } 如上传分卷时
   */
  async backupData(
    entries: WingEntry[],
    sessions: DailySession[],
    onProgress?: (key: string, extra?: { current?: number; total?: number }) => void
  ): Promise<SyncStatus> {
    try {
      onProgress?.('webdav_backup_preparing');
      const dateFolder = getLocalDateString();
      await this.ensureDir('');
      await this.ensureDir(dateFolder);

      const prepared = await buildBackupZipOrSplit(entries, sessions);
      const prefix = `${dateFolder}/`;

      if (prepared.mode === 'single') {
        onProgress?.('webdav_backup_uploading_single');
        const fileName = `${prefix}wing-backup-${dateFolder}.zip`;
        return await this.uploadBlob(fileName, prepared.blob, 'application/zip');
      }

      if (prepared.imageZipBlobs.length > BACKUP_MAX_SPLIT_PARTS) {
        onProgress?.('webdav_backup_preparing');
        const fullBlob = await buildBackupZip(entries, sessions);
        return {
          success: false,
          message: '备份分卷过多，已改为保存到本地，请手动上传到云盘。',
          fallbackDownload: fullBlob
        };
      }

      onProgress?.('webdav_backup_uploading_json');
      const ru = await this.uploadFile(`${prefix}${prepared.baseName}.json`, prepared.dataJson);
      if (!ru.success) {
        onProgress?.('webdav_backup_preparing');
        const fullBlob = await buildBackupZip(entries, sessions);
        return { success: false, message: ru.message, fallbackDownload: fullBlob };
      }
      const total = prepared.imageZipBlobs.length;
      for (let i = 0; i < total; i++) {
        onProgress?.('webdav_backup_uploading_images', { current: i + 1, total });
        const r = await this.uploadBlob(`${prefix}${prepared.baseName}_images_${i + 1}.zip`, prepared.imageZipBlobs[i], 'application/zip');
        if (!r.success) {
          onProgress?.('webdav_backup_preparing');
          const fullBlob = await buildBackupZip(entries, sessions);
          return { success: false, message: r.message, fallbackDownload: fullBlob };
        }
      }
      return { success: true, message: '备份成功', timestamp: Date.now() };
    } catch (error) {
      try {
        onProgress?.('webdav_backup_preparing');
        const fullBlob = await buildBackupZip(entries, sessions);
        return {
          success: false,
          message: `备份失败: ${error instanceof Error ? error.message : '未知错误'}`,
          fallbackDownload: fullBlob
        };
      } catch {
        return {
          success: false,
          message: `备份失败: ${error instanceof Error ? error.message : '未知错误'}`
        };
      }
    }
  }

  /**
   * 将某日期文件夹内的文件列表分组为「单文件备份」与「分卷备份」，并为每条记录附加 folder 供下载使用
   */
  static groupBackupSets(
    files: { name: string; lastModified: number }[],
    folder: string
  ): {
    single: { folder: string; name: string; lastModified: number }[];
    split: { folder: string; jsonName: string; imageNames: string[]; lastModified: number }[];
  } {
    const single = files.filter((f) => /^wing-backup-\d{4}-\d{2}-\d{2}\.zip$/.test(f.name));
    const jsonFiles = files.filter((f) => /^wing-backup-(\d{4}-\d{2}-\d{2})\.json$/.test(f.name));
    const split: { folder: string; jsonName: string; imageNames: string[]; lastModified: number }[] = [];
    for (const j of jsonFiles) {
      const date = j.name.replace(/^wing-backup-(\d{4}-\d{2}-\d{2})\.json$/, '$1');
      const imageFiles = files
        .filter((f) => new RegExp(`^wing-backup-${date.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}_images_\\d+\\.zip$`).test(f.name))
        .sort((a, b) => {
          const na = parseInt(a.name.match(/_images_(\d+)/)?.[1] ?? '0', 10);
          const nb = parseInt(b.name.match(/_images_(\d+)/)?.[1] ?? '0', 10);
          return na - nb;
        });
      split.push({
        folder,
        jsonName: j.name,
        imageNames: imageFiles.map((x) => x.name),
        lastModified: imageFiles.length ? Math.max(j.lastModified, ...imageFiles.map((x) => x.lastModified)) : j.lastModified
      });
    }
    return {
      single: single.map((f) => ({ folder, name: f.name, lastModified: f.lastModified })),
      split
    };
  }

  /**
   * 下载一个备份集合：单文件返回 File；分卷返回 jsonContent + imageZipBlobs。路径为 folder/name。
   */
  async downloadBackupSet(
    set:
      | { type: 'single'; folder: string; name: string }
      | { type: 'split'; folder: string; jsonName: string; imageNames: string[] }
  ): Promise<
    | { type: 'single'; file: File }
    | { type: 'split'; jsonContent: string; imageZipBlobs: Blob[] }
    | { success: false; message: string }
  > {
    if (set.type === 'single') {
      const r = await this.downloadBackupFile(`${set.folder}/${set.name}`);
      if (!r.success || !r.file) return { success: false, message: r.message };
      return { type: 'single', file: r.file };
    }
    const rj = await this.downloadBackupFile(`${set.folder}/${set.jsonName}`);
    if (!rj.success || !rj.file) return { success: false, message: rj.message };
    const jsonContent = await rj.file.text();
    const imageZipBlobs: Blob[] = [];
    for (const n of set.imageNames) {
      const ri = await this.downloadBackupFile(`${set.folder}/${n}`);
      if (!ri.success || !ri.file) return { success: false, message: ri.message };
      imageZipBlobs.push(ri.file);
    }
    return { type: 'split', jsonContent, imageZipBlobs };
  }

  /**
   * 列出 Wing 下按日期命名的备份文件夹（YYYY-MM-DD），按名称倒序
   */
  async listBackupFolders(): Promise<{ success: boolean; folders?: { name: string; lastModified?: number }[]; message: string }> {
    try {
      const dirUrl = this.getFullPath('');
      const propfindXml = `<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><getlastmodified/><resourcetype/></prop></propfind>`;
      const res = await fetch(dirUrl, {
        method: 'PROPFIND',
        headers: {
          Authorization: this.getAuthHeader(),
          Depth: '1',
          'Content-Type': 'application/xml; charset=utf-8',
          ...this.getProxyHeaderIfNeeded(dirUrl)
        },
        body: propfindXml
      });
      if (res.status === 401 || res.status === 403) return { success: false, message: '认证失败，请检查用户名和密码' };
      if (res.status === 404) return { success: true, folders: [], message: '' };
      if (res.status !== 207 && (res.status < 200 || res.status >= 300)) return { success: false, message: `列表失败: HTTP ${res.status}` };
      const text = await res.text();
      const folders: { name: string; lastModified?: number }[] = [];
      const blockRe = /<[a-z]:?response[^>]*>([\s\S]*?)<\/[a-z]:?response>/gi;
      const hrefRe = /<[a-z]:?href>([^<]*)<\/[a-z]:?href>/i;
      const modRe = /<[a-z]:?getlastmodified>([^<]*)<\/[a-z]:?getlastmodified>/i;
      const collRe = /<[a-z]:?collection\s*\/>/i;
      let m: RegExpExecArray | null;
      while ((m = blockRe.exec(text)) !== null) {
        const block = m[1];
        if (!collRe.test(block)) continue;
        const hrefM = hrefRe.exec(block);
        const modM = modRe.exec(block);
        if (!hrefM) continue;
        const href = decodeURIComponent(hrefM[1].replace(/^\s+|\s+$/g, ''));
        const segments = href.replace(/\/$/, '').split('/').filter(Boolean);
        const name = segments[segments.length - 1] || '';
        if (!/^\d{4}-\d{2}-\d{2}$/.test(name)) continue;
        const lastModified = modM ? (Date.parse(modM[1].trim()) || undefined) : undefined;
        folders.push({ name, lastModified });
      }
      folders.sort((a, b) => (b.name > a.name ? 1 : -1));
      return { success: true, folders, message: '' };
    } catch (e) {
      return { success: false, message: `列表失败: ${e instanceof Error ? e.message : '未知错误'}` };
    }
  }

  /**
   * 列出某日期文件夹 Wing/YYYY-MM-DD/ 下的备份文件（.zip、.json），按修改时间倒序
   */
  async listBackupFilesInFolder(folder: string): Promise<{ success: boolean; files?: { name: string; lastModified: number }[]; message: string }> {
    try {
      const dirUrl = this.getFullPath(folder);
      const propfindXml = `<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><getlastmodified/><resourcetype/></prop></propfind>`;
      const res = await fetch(dirUrl, {
        method: 'PROPFIND',
        headers: {
          Authorization: this.getAuthHeader(),
          Depth: '1',
          'Content-Type': 'application/xml; charset=utf-8',
          ...this.getProxyHeaderIfNeeded(dirUrl)
        },
        body: propfindXml
      });
      if (res.status === 401 || res.status === 403) return { success: false, message: '认证失败，请检查用户名和密码' };
      if (res.status === 404) return { success: true, files: [], message: '' };
      if (res.status !== 207 && (res.status < 200 || res.status >= 300)) return { success: false, message: `列表失败: HTTP ${res.status}` };
      const text = await res.text();
      const files: { name: string; lastModified: number }[] = [];
      const blockRe = /<[a-z]:?response[^>]*>([\s\S]*?)<\/[a-z]:?response>/gi;
      const hrefRe = /<[a-z]:?href>([^<]*)<\/[a-z]:?href>/i;
      const modRe = /<[a-z]:?getlastmodified>([^<]*)<\/[a-z]:?getlastmodified>/i;
      const collRe = /<[a-z]:?collection\s*\/>/i;
      let m: RegExpExecArray | null;
      while ((m = blockRe.exec(text)) !== null) {
        const block = m[1];
        if (collRe.test(block)) continue;
        const hrefM = hrefRe.exec(block);
        const modM = modRe.exec(block);
        if (!hrefM) continue;
        const href = decodeURIComponent(hrefM[1].replace(/^\s+|\s+$/g, ''));
        const segments = href.split('/').filter(Boolean);
        const name = segments[segments.length - 1] || '';
        if (!name.toLowerCase().endsWith('.zip') && !name.toLowerCase().endsWith('.json')) continue;
        const lastModified = modM ? (Date.parse(modM[1].trim()) || 0) : 0;
        files.push({ name, lastModified });
      }
      files.sort((a, b) => b.lastModified - a.lastModified);
      return { success: true, files, message: '' };
    } catch (e) {
      return { success: false, message: `列表失败: ${e instanceof Error ? e.message : '未知错误'}` };
    }
  }

  /**
   * 列出云盘 Wing 目录下的备份文件（.zip、.json），按修改时间倒序
   * @deprecated 推荐使用 listBackupFolders + listBackupFilesInFolder 按日期文件夹选择
   */
  async listBackupFiles(): Promise<{ success: boolean; files?: { name: string; lastModified: number }[]; message: string }> {
    try {
      const dirUrl = this.getFullPath('');
      const propfindXml = `<?xml version="1.0" encoding="utf-8"?><propfind xmlns="DAV:"><prop><getlastmodified/><resourcetype/></prop></propfind>`;
      const res = await fetch(dirUrl, {
        method: 'PROPFIND',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Depth': '1',
          'Content-Type': 'application/xml; charset=utf-8',
          ...this.getProxyHeaderIfNeeded(dirUrl)
        },
        body: propfindXml
      });
      if (res.status === 401 || res.status === 403) {
        return { success: false, message: '认证失败，请检查用户名和密码' };
      }
      if (res.status === 404) {
        return { success: true, files: [], message: '' };
      }
      if (res.status !== 207 && (res.status < 200 || res.status >= 300)) {
        return { success: false, message: `列表失败: HTTP ${res.status}` };
      }
      const text = await res.text();
      const files: { name: string; lastModified: number }[] = [];
      const blockRe = /<[a-z]:?response[^>]*>([\s\S]*?)<\/[a-z]:?response>/gi;
      const hrefRe = /<[a-z]:?href>([^<]*)<\/[a-z]:?href>/i;
      const modRe = /<[a-z]:?getlastmodified>([^<]*)<\/[a-z]:?getlastmodified>/i;
      const collRe = /<[a-z]:?collection\s*\/>/i;
      let m: RegExpExecArray | null;
      while ((m = blockRe.exec(text)) !== null) {
        const block = m[1];
        const hrefM = hrefRe.exec(block);
        const modM = modRe.exec(block);
        if (collRe.test(block)) continue;
        if (!hrefM) continue;
        const href = decodeURIComponent(hrefM[1].replace(/^\s+|\s+$/g, ''));
        const segments = href.split('/').filter(Boolean);
        const name = segments[segments.length - 1] || '';
        if (!name) continue;
        if (!name.toLowerCase().endsWith('.zip') && !name.toLowerCase().endsWith('.json')) continue;
        const lastModified = modM ? (Date.parse(modM[1].trim()) || 0) : 0;
        files.push({ name, lastModified });
      }
      files.sort((a, b) => b.lastModified - a.lastModified);
      return { success: true, files, message: '' };
    } catch (e) {
      return {
        success: false,
        message: `列表失败: ${e instanceof Error ? e.message : '未知错误'}`
      };
    }
  }

  /**
   * 从云盘下载备份文件，返回 File。fileName 可带子路径如 2025-01-15/wing-backup-2025-01-15.zip
   */
  async downloadBackupFile(fileName: string): Promise<{ success: boolean; file?: File; message: string }> {
    try {
      const url = this.getFullPath(fileName);
      const response = await fetch(url, {
        method: 'GET',
        headers: { Authorization: this.getAuthHeader(), ...this.getProxyHeaderIfNeeded(url) }
      });
      if (response.status === 404) return { success: false, message: '文件不存在' };
      if (response.status < 200 || response.status >= 300) return { success: false, message: `下载失败: HTTP ${response.status}` };
      const baseName = fileName.includes('/') ? (fileName.split('/').pop() || fileName) : fileName;
      const isZip = baseName.toLowerCase().endsWith('.zip');
      if (isZip) {
        const blob = await response.blob();
        return { success: true, file: new File([blob], baseName, { type: 'application/zip' }), message: '下载成功' };
      }
      const text = await response.text();
      return { success: true, file: new File([text], baseName, { type: 'application/json' }), message: '下载成功' };
    } catch (e) {
      return { success: false, message: `下载失败: ${e instanceof Error ? e.message : '未知错误'}` };
    }
  }

  /**
   * 获取完整的文件路径
   * 开发环境：坚果云走 Vite /api/webdav 代理；生产环境：走 Netlify /api/webdav 代理，避免 CORS
   */
  private getFullPath(fileName: string): string {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    /** 目录列表用 Wing 而非 Wing/，避免 Netlify /api/webdav/* 对尾部斜杠的匹配问题；WebDAV 对 PROPFIND 二者皆可 */
    const path = fileName === '' ? 'Wing' : `Wing/${fileName}`;

    if (isDev && this.config.url.includes('jianguoyun.com')) {
      return `/api/webdav/${path}`;
    }
    if (!isDev) {
      return `/api/webdav/${path}`;
    }
    const baseUrl = this.config.url.endsWith('/') ? this.config.url : `${this.config.url}/`;
    return `${baseUrl}Wing/${fileName}`;
  }

  /** 规范化 WebDAV 根 URL（供代理请求头 X-WebDAV-Base-URL 使用） */
  private getBaseUrl(): string {
    const u = this.config.url;
    return u.endsWith('/') ? u : u + '/';
  }

  /**
   * 当请求走 /api/webdav 代理时，附加 X-WebDAV-Base-URL 以便服务端转发
   */
  private getProxyHeaderIfNeeded(url: string): Record<string, string> {
    return url.startsWith('/api/webdav') ? { 'X-WebDAV-Base-URL': this.getBaseUrl() } : {};
  }

  /**
   * 获取Basic认证头
   */
  private getAuthHeader(): string {
    const credentials = `${this.config.username}:${this.config.password}`;
    return `Basic ${btoa(credentials)}`;
  }
}

/**
 * 创建WebDAV服务实例
 */
export const createWebDAVService = (settings: AppSettings): WebDAVService | null => {
  if (!settings.webdavUrl || !settings.webdavUser || !settings.webdavPass) {
    return null;
  }

  return new WebDAVService({
    url: settings.webdavUrl,
    username: settings.webdavUser,
    password: settings.webdavPass
  });
};

/**
 * 若已开启「自动备份到云盘」且 WebDAV 已配置，则在后台执行一次备份；供记录、编辑等关键操作后调用
 * @param settings 应用设置
 */
export async function triggerRealtimeSyncIfEnabled(settings: AppSettings): Promise<void> {
  if (settings.realtimeWebdavSync !== true) return;
  const svc = createWebDAVService(settings);
  if (!svc) return;
  try {
    const entries = MockDataService.getEntries();
    const sessions = MockDataService.getSessions();
    await svc.backupData(entries, sessions);
  } catch (e) {
    console.warn('Realtime WebDAV backup failed:', e);
  }
}

