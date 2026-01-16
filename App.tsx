
import React, { useState, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Feather, MessageSquare, BookOpen, Settings as SettingsIcon } from 'lucide-react';
import ChatView from './components/ChatView';
import JournalView from './components/JournalView';
import JournalDetail from './components/JournalDetail';
import SettingsView from './components/SettingsView';
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

  return (
    <div className="min-h-screen max-w-2xl mx-auto flex flex-col bg-slate-50 relative border-x border-slate-200 shadow-sm overflow-hidden">
      {/* Header */}
      {!isDetail && (
        <header className="sticky top-0 z-50 glass px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Feather className="text-blue-500" size={24} />
            <h1 className="serif text-2xl font-bold tracking-tight">Wing</h1>
          </div>
        </header>
      )}

      {/* Main Content */}
      <main className="flex-1 pb-24 overflow-y-auto">
        {children}
      </main>

      {/* Bottom Nav */}
      {!isDetail && (
        <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-2xl glass border-t border-slate-200 px-8 py-3 flex justify-around items-center z-50">
          <NavLink 
            to="/" 
            className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
          >
            <MessageSquare size={22} />
            <span className="text-[10px] font-medium uppercase tracking-wider">{t('recording')}</span>
          </NavLink>
          <NavLink 
            to="/journal" 
            className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
          >
            <BookOpen size={22} />
            <span className="text-[10px] font-medium uppercase tracking-wider">{t('journals')}</span>
          </NavLink>
          <NavLink 
            to="/settings" 
            className={({ isActive }) => `flex flex-col items-center gap-1 transition-colors ${isActive ? 'text-blue-600' : 'text-slate-400'}`}
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
    <HashRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<ChatView />} />
          <Route path="/journal" element={<JournalView />} />
          <Route path="/journal/:id" element={<JournalDetail />} />
          <Route path="/settings" element={<SettingsView />} />
        </Routes>
      </Layout>
    </HashRouter>
  );
};

export default App;
