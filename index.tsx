/**
 * 应用入口：先初始化 IndexedDB 存储（含 localStorage 迁移），再渲染根组件
 */

import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { MockDataService } from './services/mockDataService';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);

/**
 * 显示错误界面
 */
const renderError = (error: Error) => {
  root.render(
    <div className="min-h-screen flex items-center justify-center bg-[#FAF9F4] dark:bg-[#1A1B26] text-[#4A3B32] dark:text-[#A9B1D6] p-6">
      <div className="max-w-md w-full text-center space-y-4">
        <h2 className="text-xl font-bold">初始化失败</h2>
        <p className="text-sm opacity-80">应用无法启动，请刷新页面重试</p>
        <details className="text-left mt-4">
          <summary className="cursor-pointer text-sm opacity-70 hover:opacity-100 mb-2">
            错误详情
          </summary>
          <div className="bg-black/10 dark:bg-white/10 rounded p-3 text-xs font-mono overflow-auto max-h-32">
            {error.message}
          </div>
        </details>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-[#4A3B32] dark:bg-[#A9B1D6] text-[#FAF9F4] dark:text-[#1A1B26] rounded hover:opacity-80 transition-opacity"
        >
          刷新页面
        </button>
      </div>
    </div>
  );
};

/** 先显示加载中，再初始化 IndexedDB（含 localStorage 迁移），最后渲染应用 */
root.render(
  <div className="min-h-screen flex items-center justify-center bg-[#FAF9F4] dark:bg-[#1A1B26] text-[#4A3B32] dark:text-[#A9B1D6]">
    <span>加载中...</span>
  </div>
);

/**
 * 初始化应用，包含错误处理和超时机制
 */
(async () => {
  try {
    // 添加超时保护（30秒）
    const initPromise = MockDataService.init();
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('初始化超时：超过30秒未完成，请刷新页面重试')), 30000);
    });

    await Promise.race([initPromise, timeoutPromise]);

    const s = MockDataService.getSettings();
    document.documentElement.dataset.fontSize = s.fontSize ?? 'medium';
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
  } catch (error) {
    console.error('应用初始化失败:', error);
    renderError(error instanceof Error ? error : new Error(String(error)));
  }
})();
