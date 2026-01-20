/**
 * WebDAV服务模块
 * 支持坚果云等WebDAV服务商
 */

import { WingEntry, DailySession, AppSettings } from '../types';
import { getLocalDateString } from '../utils/date';
import { MockDataService } from './mockDataService';
import { buildBackupZip } from './dataService';

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
   * 备份所有数据到 WebDAV，ZIP 结构与本地导出一致：data.json（文本）+ images/（图片）
   */
  async backupData(entries: WingEntry[], sessions: DailySession[]): Promise<SyncStatus> {
    try {
      const blob = await buildBackupZip(entries, sessions);
      const fileName = `wing-backup-${getLocalDateString()}.zip`;
      return await this.uploadBlob(fileName, blob, 'application/zip');
    } catch (error) {
      return {
        success: false,
        message: `备份失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 列出云盘 Wing 目录下的备份文件（.zip、.json），按修改时间倒序
   * 与本地导出一致：ZIP 为 data.json + images/，.json 为旧版格式
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
   * 从云盘下载备份文件，返回 File 供 dataService.replaceData/importData 使用
   * 与本地导入一致：支持 .zip（data.json + images/）与 .json
   */
  async downloadBackupFile(fileName: string): Promise<{ success: boolean; file?: File; message: string }> {
    try {
      const url = this.getFullPath(fileName);
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Authorization': this.getAuthHeader(), ...this.getProxyHeaderIfNeeded(url) }
      });
      if (response.status === 404) return { success: false, message: '文件不存在' };
      if (response.status < 200 || response.status >= 300) {
        return { success: false, message: `下载失败: HTTP ${response.status}` };
      }
      const isZip = fileName.toLowerCase().endsWith('.zip');
      if (isZip) {
        const blob = await response.blob();
        const file = new File([blob], fileName, { type: 'application/zip' });
        return { success: true, file, message: '下载成功' };
      }
      const text = await response.text();
      const file = new File([text], fileName, { type: 'application/json' });
      return { success: true, file, message: '下载成功' };
    } catch (e) {
      return {
        success: false,
        message: `下载失败: ${e instanceof Error ? e.message : '未知错误'}`
      };
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

