import React, { useState, useEffect, useRef, useCallback } from 'react';
import { HashRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { MessageSquare, BookOpen, Settings as SettingsIcon } from 'lucide-react';
import { OwlLogo } from './components/OwlAssets';
import ChatView from './components/ChatView';
import JournalView from './components/JournalView';
import JournalDetail from './components/JournalDetail';
import SettingsMainView from './components/SettingsMainView';
import SettingsAiView from './components/SettingsAiView';
import SettingsStorageView from './components/SettingsStorageView';
import SettingsLanguageView from './components/SettingsLanguageView';
import { ErrorBoundary } from './components/ErrorBoundary';
import { MockDataService } from './services/mockDataService';
import { useTranslation } from './i18n';

/** 根据页面字体设置返回对应的 font-family 值（正文与标题） */
function getPageFontFamily(pageFont?: string): string {
  switch (pageFont) {
    case 'source-han-sans':
      return '"Noto Sans SC", -apple-system, BlinkMacSystemFont, sans-serif';
    case 'source-han-serif':
      return '"Noto Serif SC", Georgia, serif';
    case 'xlwk':
      return '"LXGW WenKai", sans-serif';
    default:
      return 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
  }
}

/** 滚动方向判定阈值（px），避免轻微抖动导致 Tab 栏频繁显隐 */
const SCROLL_THRESHOLD = 10;
/** 移动端断点（与 Tailwind md 一致），仅在此宽度以下启用 Tab 栏滑动隐藏 */
const MOBILE_BREAKPOINT = 768;

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  const isDetail = location.pathname.includes('/journal/');

  const mainRef = useRef<HTMLElement>(null);
  const [tabBarVisible, setTabBarVisible] = useState(true);
  const lastScrollTopRef = useRef(-1);
  const isMobileRef = useRef(typeof window !== 'undefined' && window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches);

  /**
   * 根据滚动位置与方向更新底部 Tab 栏显隐（仅移动端）。
   * 向下滑动隐藏，向上滑动或接近顶部时显示。
   */
  const handleScroll = useCallback((scrollTop: number) => {
    if (!isMobileRef.current) return;
    const last = lastScrollTopRef.current;
    if (last < 0) {
      lastScrollTopRef.current = scrollTop;
      return;
    }
    if (scrollTop <= 0) {
      setTabBarVisible(true);
      lastScrollTopRef.current = scrollTop;
      return;
    }
    const delta = scrollTop - last;
    lastScrollTopRef.current = scrollTop;
    if (delta > SCROLL_THRESHOLD) setTabBarVisible(false);
    else if (delta < -SCROLL_THRESHOLD) setTabBarVisible(true);
  }, []);

  /** 路由切换时重置上次滚动位置，避免跨页面误判方向 */
  useEffect(() => {
    lastScrollTopRef.current = -1;
  }, [location.pathname]);

  /** 监听移动端断点，仅在小屏下启用 Tab 栏滑动隐藏；切回桌面时恢复显示 */
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    isMobileRef.current = mq.matches;
    const onChange = () => {
      isMobileRef.current = mq.matches;
      if (!mq.matches) setTabBarVisible(true);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const handleSettingsUpdate = () => {
      setSettings(MockDataService.getSettings());
    };
    window.addEventListener('wing_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('wing_settings_updated', handleSettingsUpdate);
  }, []);

  /** 根据 theme 设置向 html 添加/移除 dark，亮色为默认白底 */
  useEffect(() => {
    const theme = settings.theme || 'system';
    const apply = (isDark: boolean) => {
      if (isDark) document.documentElement.classList.add('dark');
      else document.documentElement.classList.remove('dark');
    };
    if (theme === 'light') {
      apply(false);
      return;
    }
    if (theme === 'dark') {
      apply(true);
      return;
    }
    const m = window.matchMedia('(prefers-color-scheme: dark)');
    apply(m.matches);
    const onChange = () => apply(m.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, [settings.theme]);

  /** 根据字号设置缩放 html 根字号，以等比影响全站 rem；大 18px、中 16px、小 14px */
  useEffect(() => {
    const v = settings.fontSize ?? 'medium';
    document.documentElement.dataset.fontSize = v;
  }, [settings.fontSize]);

  return (
    <div
      className="min-h-screen max-w-2xl mx-auto flex flex-col bg-twilight-bg dark:bg-nocturnal-bg relative border-x border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm overflow-hidden"
      data-page-font={settings.pageFont || 'system'}
      style={{ fontFamily: getPageFontFamily(settings.pageFont) }}
    >
      {/* Header */}
      {!isDetail && (
        <header className="sticky top-0 z-50 glass px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <OwlLogo size={26} stroke="currentColor" className="text-twilight-charcoal dark:text-nocturnal-primary" />
            <span className="serif text-2xl font-bold tracking-tight text-twilight-charcoal dark:text-nocturnal-primary">Wing</span>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main
        ref={mainRef}
        className="flex-1 pb-24 overflow-y-auto"
        onScroll={() => handleScroll(mainRef.current?.scrollTop ?? 0)}
      >
        {children}
      </main>

      {/* Bottom Nav：移动端滑动时向下隐藏、向上显示，带过渡动画 */}
      {!isDetail && (
        <nav className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl glass border-t border-twilight-divider dark:border-nocturnal-secondary/25 px-8 py-2 flex justify-around items-center z-50 transition-transform duration-300 ease-out ${tabBarVisible ? 'translate-y-0' : 'translate-y-full'}`}>
          <NavLink 
            to="/" 
            className={({ isActive }) => `flex flex-col items-center gap-0.5 transition-colors ${isActive ? 'text-twilight-amber dark:text-nocturnal-accent' : 'text-twilight-duskLight dark:text-nocturnal-secondary'}`}
          >
            <MessageSquare size={18} />
            <span className="text-[10px] font-medium uppercase tracking-wider">{t('recording')}</span>
          </NavLink>
          <NavLink 
            to="/journal" 
            className={({ isActive }) => `flex flex-col items-center gap-0.5 transition-colors ${isActive ? 'text-twilight-amber dark:text-nocturnal-accent' : 'text-twilight-duskLight dark:text-nocturnal-secondary'}`}
          >
            <BookOpen size={18} />
            <span className="text-[10px] font-medium uppercase tracking-wider">{t('journals')}</span>
          </NavLink>
          <NavLink 
            to="/settings"
            end={false}
            className={({ isActive }) => `flex flex-col items-center gap-0.5 transition-colors ${isActive ? 'text-twilight-amber dark:text-nocturnal-accent' : 'text-twilight-duskLight dark:text-nocturnal-secondary'}`}
          >
            <SettingsIcon size={18} />
            <span className="text-[10px] font-medium uppercase tracking-wider">{t('settings')}</span>
          </NavLink>
        </nav>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <HashRouter>
        <Layout>
          <Routes>
            <Route path="/" element={<ChatView />} />
            <Route path="/journal" element={<JournalView />} />
            <Route path="/journal/:id" element={<JournalDetail />} />
            <Route path="/settings" element={<SettingsMainView />} />
            <Route path="/settings/language" element={<SettingsLanguageView />} />
            <Route path="/settings/ai" element={<SettingsAiView />} />
            <Route path="/settings/storage" element={<SettingsStorageView />} />
          </Routes>
        </Layout>
      </HashRouter>
    </ErrorBoundary>
  );
};

export default App;
