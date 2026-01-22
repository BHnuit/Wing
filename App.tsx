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

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  const isDetail = location.pathname.includes('/journal/');

  /** 在应用初始化时检测是否是页面刷新，如果是刷新则清空访问标记 */
  useEffect(() => {
    // 检测页面加载类型
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming | undefined;
    const loadType = navigation?.type;
    
    // 刷新页面或首次加载时清空标记
    if (loadType === 'reload' || loadType === 'navigate') {
      sessionStorage.removeItem('wing_visited_other_page');
    }
  }, []);

  /** 双击 header 时，将 main 滚动区域快速滚回顶部 */
  const scrollMainToTop = useCallback(() => {
    mainRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
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
      {/* Header：fixed 保证任意滚动容器下都固定在视口顶部；左侧 Logo+标题，右侧 Tab 图标 */}
      {!isDetail && (
        <header
          className="fixed top-0 left-1/2 -translate-x-1/2 w-full max-w-2xl z-50 glass px-6 py-4 flex items-center justify-between cursor-pointer select-none border-b border-twilight-divider dark:border-nocturnal-secondary/25"
          onDoubleClick={scrollMainToTop}
          title="双击回到顶部"
        >
          <div className="flex items-center gap-2">
            <OwlLogo size={26} stroke="currentColor" className="text-twilight-charcoal dark:text-nocturnal-primary" />
            <span className="serif text-2xl font-bold tracking-tight text-twilight-charcoal dark:text-nocturnal-primary">Wing</span>
          </div>
          <nav className="flex items-center gap-1.5" aria-label="Main">
            <NavLink
              to="/"
              className={({ isActive }) => `p-1.5 rounded-lg transition-colors ${isActive ? 'text-twilight-amber dark:text-nocturnal-accent' : 'text-twilight-duskLight dark:text-nocturnal-secondary hover:text-twilight-amber dark:hover:text-nocturnal-accent'}`}
              title={t('recording')}
            >
              <MessageSquare size={20} />
            </NavLink>
            <NavLink
              to="/journal"
              onClick={() => {
                // 记录用户点击过日记页
                sessionStorage.setItem('wing_visited_other_page', 'true');
              }}
              className={({ isActive }) => `p-1.5 rounded-lg transition-colors ${isActive ? 'text-twilight-amber dark:text-nocturnal-accent' : 'text-twilight-duskLight dark:text-nocturnal-secondary hover:text-twilight-amber dark:hover:text-nocturnal-accent'}`}
              title={t('journals')}
            >
              <BookOpen size={20} />
            </NavLink>
            <NavLink
              to="/settings"
              end={false}
              onClick={() => {
                // 记录用户点击过设置页
                sessionStorage.setItem('wing_visited_other_page', 'true');
              }}
              className={({ isActive }) => `p-1.5 rounded-lg transition-colors ${isActive ? 'text-twilight-amber dark:text-nocturnal-accent' : 'text-twilight-duskLight dark:text-nocturnal-secondary hover:text-twilight-amber dark:hover:text-nocturnal-accent'}`}
              title={t('settings')}
            >
              <SettingsIcon size={20} />
            </NavLink>
          </nav>
        </header>
      )}

      <main ref={mainRef} className={`flex-1 overflow-y-auto ${!isDetail ? 'pt-[4.125rem]' : ''}`}>
        {children}
      </main>
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
