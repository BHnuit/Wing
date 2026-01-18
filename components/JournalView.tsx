
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MockDataService } from '../services/mockDataService';
import { ChevronRight } from 'lucide-react';
import { EmptyStateOwl } from './OwlAssets';
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
      <h2 className="serif text-3xl font-bold text-twilight-charcoal dark:text-nocturnal-primary mb-8">{t('library_title')}</h2>
      
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-twilight-duskLight dark:text-nocturnal-secondary">
          <EmptyStateOwl size={100} className="mb-4" />
          <p className="serif italic text-center px-8">{t('empty_library')}</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {entries.map(entry => (
            <button
              key={entry.id}
              onClick={() => navigate(`/journal/${entry.id}`)}
              className="group text-left bg-twilight-cream dark:bg-nocturnal-surface p-5 rounded-3xl border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm hover:shadow-md hover:border-twilight-amber/30 dark:hover:border-nocturnal-accent/40 transition-all flex justify-between items-center"
            >
              <div className="flex gap-4 items-start">
                <span className="text-3xl mt-1">{entry.mood}</span>
                <div className="space-y-1">
                  <h3 className="serif text-xl font-semibold text-twilight-charcoal dark:text-nocturnal-primary group-hover:text-twilight-amber dark:group-hover:text-nocturnal-accent transition-colors">
                    {entry.title}
                  </h3>
                  <p className="text-sm text-twilight-duskLight dark:text-nocturnal-secondary line-clamp-1">{entry.summary}</p>
                  <span className="text-[10px] text-twilight-duskLight dark:text-nocturnal-secondary uppercase tracking-widest font-medium">
                    {new Date(entry.createdAt).toLocaleDateString(settings.language === 'en' ? 'en-US' : 'zh-CN', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </span>
                </div>
              </div>
              <ChevronRight className="text-twilight-duskLight/80 dark:text-nocturnal-secondary/80 group-hover:text-twilight-amber dark:group-hover:text-nocturnal-accent" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default JournalView;
