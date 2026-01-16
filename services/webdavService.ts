/**
 * WebDAV服务模块
 * 支持坚果云等WebDAV服务商
 */

import { WingEntry, DailySession, AppSettings } from '../types';

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
          headers: {
            'Authorization': this.getAuthHeader()
          }
        });
      } catch (e) {
        // 目录可能已存在，忽略错误
      }

      // 测试上传一个小文件
      const testUrl = this.getFullPath('test-connection.txt');
      const testContent = `Wing Connection Test - ${new Date().toISOString()}`;
      
      const putResponse = await fetch(testUrl, {
        method: 'PUT',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'text/plain; charset=utf-8'
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
            headers: {
              'Authorization': this.getAuthHeader()
            }
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
          headers: {
            'Authorization': this.getAuthHeader()
          }
        });
      } catch (e) {
        // 目录可能已存在，忽略错误
      }

      const url = this.getFullPath(fileName);
      const response = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': this.getAuthHeader(),
          'Content-Type': 'application/json; charset=utf-8'
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
   * 从WebDAV下载文件
   */
  async downloadFile(fileName: string): Promise<{ success: boolean; content?: string; message: string }> {
    try {
      const url = this.getFullPath(fileName);
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': this.getAuthHeader()
        }
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
   * 备份所有数据到WebDAV
   */
  async backupData(entries: WingEntry[], sessions: DailySession[]): Promise<SyncStatus> {
    try {
      const backupData = {
        entries,
        sessions,
        version: '1.0.0',
        timestamp: Date.now()
      };

      const content = JSON.stringify(backupData, null, 2);
      const fileName = `wing-backup-${new Date().toISOString().split('T')[0]}.json`;

      return await this.uploadFile(fileName, content);
    } catch (error) {
      return {
        success: false,
        message: `备份失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 从WebDAV恢复数据
   */
  async restoreData(fileName?: string): Promise<{ success: boolean; data?: any; message: string }> {
    try {
      // 如果没有指定文件名，尝试下载最新的备份
      if (!fileName) {
        // 这里简化处理，实际应该列出文件并选择最新的
        fileName = `wing-backup-${new Date().toISOString().split('T')[0]}.json`;
      }

      const result = await this.downloadFile(fileName);
      
      if (!result.success || !result.content) {
        return {
          success: false,
          message: result.message
        };
      }

      const data = JSON.parse(result.content);
      return {
        success: true,
        data,
        message: '恢复成功'
      };
    } catch (error) {
      return {
        success: false,
        message: `恢复失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }

  /**
   * 获取完整的文件路径
   * 在开发环境中使用 Vite 代理，生产环境直接访问
   */
  private getFullPath(fileName: string): string {
    // 检查是否是开发环境（通过检查是否在 localhost 或使用代理）
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    // 如果是坚果云且是开发环境，使用代理
    if (isDev && this.config.url.includes('jianguoyun.com')) {
      const path = `Wing/${fileName}`;
      return `/api/webdav/${path}`;
    }
    
    // 生产环境或其他 WebDAV 服务器，直接访问
    const baseUrl = this.config.url.endsWith('/') 
      ? this.config.url 
      : `${this.config.url}/`;
    return `${baseUrl}Wing/${fileName}`;
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

