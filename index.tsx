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

/** 先显示加载中，再初始化 IndexedDB（含 localStorage 迁移），最后渲染应用 */
root.render(
  <div className="min-h-screen flex items-center justify-center bg-[#FAF9F4] dark:bg-[#1A1B26] text-[#4A3B32] dark:text-[#A9B1D6]">
    <span>加载中...</span>
  </div>
);
(async () => {
  await MockDataService.init();
  const s = MockDataService.getSettings();
  document.documentElement.dataset.fontSize = s.fontSize ?? 'medium';
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
})();
