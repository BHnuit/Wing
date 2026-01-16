
import React, { useState, useEffect } from 'react';
import { Database, Shield, Cloud, Key, Languages, Globe } from 'lucide-react';
import { MockDataService } from '../services/mockDataService';
import { useTranslation } from '../i18n';
import { Language } from '../types';

const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);

  const handleLanguageChange = (lang: Language) => {
    MockDataService.updateSettings({ language: lang });
    setSettings({ ...settings, language: lang });
  };

  const handleApiKeyChange = (key: string) => {
    MockDataService.updateSettings({ apiKey: key });
    setSettings({ ...settings, apiKey: key });
  };

  return (
    <div className="p-6 space-y-8">
      <h2 className="serif text-3xl font-bold text-slate-900">{t('settings')}</h2>
      
      {/* Language Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <Globe size={18} />
          <h3 className="text-xs font-bold uppercase tracking-wider">{t('language')}</h3>
        </div>
        
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <div className="flex p-1 bg-slate-100 rounded-2xl">
            <button 
              onClick={() => handleLanguageChange('zh')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                settings.language === 'zh' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'
              }`}
            >
              {t('lang_zh')}
            </button>
            <button 
              onClick={() => handleLanguageChange('en')}
              className={`flex-1 py-2 rounded-xl text-sm font-medium transition-all ${
                settings.language === 'en' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'
              }`}
            >
              {t('lang_en')}
            </button>
          </div>
        </div>
      </section>

      {/* AI Configuration Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <Shield size={18} />
          <h3 className="text-xs font-bold uppercase tracking-wider">{t('ai_config')}</h3>
        </div>
        
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 ml-1">Gemini API Key</label>
            <div className="relative">
              <input 
                type="password" 
                value={settings.apiKey} 
                onChange={(e) => handleApiKeyChange(e.target.value)}
                placeholder="Paste your key here..."
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100 pr-12"
              />
              <Key className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300" size={18} />
            </div>
            <p className="text-[10px] text-slate-400 px-1">
              {t('api_desc')}
            </p>
          </div>
        </div>
      </section>

      {/* Backup Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <Cloud size={18} />
          <h3 className="text-xs font-bold uppercase tracking-wider">{t('cloud_backup')}</h3>
        </div>
        
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-600 ml-1">Server URL</label>
            <input 
              type="text" 
              placeholder="https://dav.example.com/wing"
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 ml-1">Username</label>
              <input 
                type="text" 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 ml-1">Password</label>
              <input 
                type="password" 
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Storage Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <Database size={18} />
          <h3 className="text-xs font-bold uppercase tracking-wider">{t('storage')}</h3>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm">
          <button 
            onClick={() => {
              if (window.confirm('Are you sure you want to clear all data?')) {
                MockDataService.clearData();
              }
            }}
            className="w-full text-center text-rose-500 font-semibold py-2 active:opacity-50 transition-opacity"
          >
            {t('clear_data')}
          </button>
        </div>
      </section>

      <div className="pt-10 text-center opacity-30">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase">Wing Version 1.0.0</p>
        <p className="text-[10px] mt-1">Inspired by the lightness of feathers.</p>
      </div>
    </div>
  );
};

export default SettingsView;
