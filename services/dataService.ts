/**
 * 数据服务模块
 * 提供数据导入/导出功能
 */

import { WingEntry, DailySession } from '../types';
import { MockDataService } from './mockDataService';

export interface ExportData {
  entries: WingEntry[];
  sessions: DailySession[];
  version: string;
  timestamp: number;
}

/**
 * 导出所有数据为JSON
 */
export const exportData = (): string => {
  const entries = MockDataService.getEntries();
  const sessions = MockDataService.getSessions();
  
  const exportData: ExportData = {
    entries,
    sessions,
    version: '1.0.0',
    timestamp: Date.now()
  };

  return JSON.stringify(exportData, null, 2);
};

/**
 * 导出数据并下载为文件
 */
export const downloadData = (): void => {
  const data = exportData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `wing-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * 导入数据
 */
export const importData = (file: File): Promise<{ success: boolean; message: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data: ExportData = JSON.parse(content);

        // 验证数据格式
        if (!data.entries || !data.sessions) {
          resolve({
            success: false,
            message: '无效的数据格式'
          });
          return;
        }

        // 合并数据（保留现有数据，只添加新的）
        const existingEntries = MockDataService.getEntries();
        const existingSessions = MockDataService.getSessions();

        // 合并entries（避免重复）
        const entryMap = new Map(existingEntries.map(e => [e.id, e]));
        data.entries.forEach(entry => {
          if (!entryMap.has(entry.id)) {
            entryMap.set(entry.id, entry);
          }
        });
        localStorage.setItem('wing_entries', JSON.stringify(Array.from(entryMap.values())));

        // 合并sessions（避免重复）
        const sessionMap = new Map(existingSessions.map(s => [s.id, s]));
        data.sessions.forEach(session => {
          if (!sessionMap.has(session.id)) {
            sessionMap.set(session.id, session);
          }
        });
        localStorage.setItem('wing_sessions', JSON.stringify(Array.from(sessionMap.values())));

        // 触发更新事件
        window.dispatchEvent(new Event('wing_data_updated'));

        resolve({
          success: true,
          message: `成功导入 ${data.entries.length} 条日记和 ${data.sessions.length} 个会话`
        });
      } catch (error) {
        resolve({
          success: false,
          message: `导入失败: ${error instanceof Error ? error.message : '未知错误'}`
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        message: '文件读取失败'
      });
    };

    reader.readAsText(file);
  });
};

/**
 * 完全替换数据（危险操作）
 */
export const replaceData = (file: File): Promise<{ success: boolean; message: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data: ExportData = JSON.parse(content);

        // 验证数据格式
        if (!data.entries || !data.sessions) {
          resolve({
            success: false,
            message: '无效的数据格式'
          });
          return;
        }

        // 完全替换数据
        localStorage.setItem('wing_entries', JSON.stringify(data.entries));
        localStorage.setItem('wing_sessions', JSON.stringify(data.sessions));

        // 触发更新事件
        window.dispatchEvent(new Event('wing_data_updated'));

        resolve({
          success: true,
          message: `成功替换数据: ${data.entries.length} 条日记和 ${data.sessions.length} 个会话`
        });
      } catch (error) {
        resolve({
          success: false,
          message: `替换失败: ${error instanceof Error ? error.message : '未知错误'}`
        });
      }
    };

    reader.onerror = () => {
      resolve({
        success: false,
        message: '文件读取失败'
      });
    };

    reader.readAsText(file);
  });
};

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

