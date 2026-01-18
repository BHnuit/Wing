
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
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

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  const isDetail = location.pathname.includes('/journal/');

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

  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col bg-twilight-bg dark:bg-nocturnal-bg relative border-x border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm overflow-hidden">
      {/* Header */}
      {!isDetail && (
        <header className="sticky top-0 z-50 glass px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <OwlLogo size={26} stroke="currentColor" className="text-twilight-charcoal dark:text-nocturnal-primary" />
            <h1 className="serif text-2xl font-bold tracking-tight text-twilight-charcoal dark:text-nocturnal-primary">Wing</h1>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 pb-24 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Nav */}
      {!isDetail && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl glass border-t border-twilight-divider dark:border-nocturnal-secondary/25 px-8 py-3 flex justify-around items-center z-50">
          <NavLink 
            to="/" 
            className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-twilight-amber dark:text-nocturnal-accent' : 'text-twilight-duskLight dark:text-nocturnal-secondary'}`}
          >
            <MessageSquare size={22} />
            <span className="text-[10px] font-medium uppercase tracking-wider">{t('recording')}</span>
          </NavLink>
          <NavLink 
            to="/journal" 
            className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-twilight-amber dark:text-nocturnal-accent' : 'text-twilight-duskLight dark:text-nocturnal-secondary'}`}
          >
            <BookOpen size={22} />
            <span className="text-[10px] font-medium uppercase tracking-wider">{t('journals')}</span>
          </NavLink>
          <NavLink 
            to="/settings"
            end={false}
            className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-twilight-amber dark:text-nocturnal-accent' : 'text-twilight-duskLight dark:text-nocturnal-secondary'}`}
          >
            <SettingsIcon size={22} />
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
