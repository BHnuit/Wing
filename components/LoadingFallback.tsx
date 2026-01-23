/**
 * 路由懒加载时的加载占位组件
 * 用于 Suspense fallback
 */

import React from 'react';
import { LoadingOwl } from './OwlAssets';

/**
 * 路由懒加载时的加载占位组件
 */
export const LoadingFallback: React.FC = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-twilight-bg dark:bg-nocturnal-bg">
      <div className="flex flex-col items-center gap-4">
        <LoadingOwl size={24} />
        <span className="text-sm text-twilight-duskLight dark:text-nocturnal-secondary">
          加载中...
        </span>
      </div>
    </div>
  );
};

export default LoadingFallback;
