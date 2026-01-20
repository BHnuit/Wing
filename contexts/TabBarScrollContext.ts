import React from 'react';

/**
 * 用于子组件（如 ChatView）向 Layout 上报滚动位置，
 * 以实现移动端底部 Tab 栏滑动自动隐藏/显示。
 */
export const TabBarScrollContext = React.createContext<{
  reportScroll: (scrollTop: number) => void;
} | null>(null);
