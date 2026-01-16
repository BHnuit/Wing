
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MockDataService } from '../services/mockDataService';
import { Calendar, ChevronRight } from 'lucide-react';
import { useTranslation } from '../i18n';

const JournalView: React.FC = () => {
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  const entries = MockDataService.getEntries().sort((a, b) => b.createdAt - a.createdAt);
  const navigate = useNavigate();

  useEffect(() => {
    const handleSettingsUpdate = () => setSettings(MockDataService.getSettings());
    window.addEventListener('wing_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('wing_settings_updated', handleSettingsUpdate);
  }, []);

  return (
    <div className="p-6 space-y-6">
      <h2 className="serif text-3xl font-bold text-slate-900 mb-8">{t('library_title')}</h2>
      
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <Calendar size={48} className="opacity-20 mb-4" />
          <p className="italic text-center px-8">{t('empty_library')}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {entries.map(entry => (
            <button
              key={entry.id}
              onClick={() => navigate(`/journal/${entry.id}`)}
              className="group text-left bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:border-blue-100 transition-all flex justify-between items-center"
            >
              <div className="flex gap-4 items-start">
                <span className="text-3xl mt-1">{entry.mood}</span>
                <div className="space-y-1">
                  <h3 className="serif text-xl font-semibold text-slate-800 group-hover:text-blue-600 transition-colors">
                    {entry.title}
                  </h3>
                  <p className="text-sm text-slate-500 line-clamp-1">{entry.summary}</p>
                  <span className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">
                    {new Date(entry.createdAt).toLocaleDateString(settings.language === 'en' ? 'en-US' : 'zh-CN', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
              </div>
              <ChevronRight className="text-slate-300 group-hover:text-blue-400" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default JournalView;
