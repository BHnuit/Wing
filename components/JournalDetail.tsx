
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share, MoreHorizontal, Bell, CheckCircle } from 'lucide-react';
import { MockDataService } from '../services/mockDataService';
import { useTranslation } from '../i18n';
import { MarkdownRenderer } from './MarkdownRenderer';

const JournalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  const navigate = useNavigate();
  const entry = MockDataService.getEntryById(id || '');

  useEffect(() => {
    const handleSettingsUpdate = () => setSettings(MockDataService.getSettings());
    window.addEventListener('wing_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('wing_settings_updated', handleSettingsUpdate);
  }, []);

  if (!entry) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-slate-600 text-lg mb-4">{t('entry_not_found')}</p>
          <button
            onClick={() => navigate('/journal')}
            className="text-blue-600 hover:text-blue-700 underline"
          >
            {t('go_home')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white min-h-screen">
      <header className="sticky top-0 z-50 glass px-4 py-4 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="p-2 text-slate-500 hover:bg-slate-100 rounded-full">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-1">
          <Share size={18} className="text-slate-400 p-1 cursor-pointer" />
          <MoreHorizontal size={18} className="text-slate-400 p-1 cursor-pointer" />
        </div>
      </header>

      <div className="px-8 pt-6 pb-12 space-y-4">
        <span className="text-5xl block mb-2">{entry.mood}</span>
        <h1 className="serif text-4xl font-bold text-slate-900 leading-tight">
          {entry.title}
        </h1>
        <p className="text-slate-400 text-sm uppercase tracking-widest">
          {new Date(entry.createdAt).toLocaleDateString(settings.language === 'en' ? 'en-US' : 'zh-CN', { 
            weekday: 'long', month: 'long', day: 'numeric' 
          })}
        </p>
      </div>

      <div className="px-8 pb-12">
        <MarkdownRenderer content={entry.markdownContent} entry={entry} />
      </div>

      <div className="px-6 mb-12">
        <div className="bg-slate-900 text-white rounded-[32px] p-8 shadow-xl">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-blue-500 w-2 h-2 rounded-full animate-pulse" />
            <span className="text-xs font-bold uppercase tracking-widest text-blue-400">{t('wing_insight')}</span>
          </div>
          <p className="serif italic text-lg opacity-90 leading-relaxed">
            "{entry.aiInsights}"
          </p>
        </div>
      </div>

      {entry.todos.length > 0 && (
        <div className="px-8 pb-20">
          <div className="flex items-center justify-between mb-6">
            <h3 className="serif text-2xl font-bold text-slate-900 flex items-center gap-2">
              <Bell className="text-blue-500" size={24} />
              {t('tasks_captured')}
            </h3>
            <span className="text-xs bg-slate-100 text-slate-500 px-3 py-1 rounded-full border border-slate-200">
              {t('synced_reminders')}
            </span>
          </div>
          <div className="space-y-3">
            {entry.todos.map((todo, i) => (
              <div key={i} className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <CheckCircle className="text-slate-300" size={20} />
                <div className="flex-1">
                  <p className="font-medium text-slate-800">{todo.title}</p>
                  <span className={`text-[10px] uppercase font-bold tracking-tighter ${
                    todo.priority === 'high' ? 'text-rose-500' : 
                    todo.priority === 'medium' ? 'text-amber-500' : 'text-slate-400'
                  }`}>
                    {todo.priority} priority
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default JournalDetail;
