/**
 * 设置二级：显示选项（页面显示语言、模型返回语言、页面主题）
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { MockDataService } from '../services/mockDataService';
import { useTranslation } from '../i18n';
import { Language } from '../types';

type ModelLang = 'zh' | 'en' | 'same';
type Theme = 'system' | 'light' | 'dark';
type PageFont = 'system' | 'source-han-sans' | 'source-han-serif' | 'xlwk';

const SettingsLanguageView: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);

  useEffect(() => {
    const h = () => setSettings(MockDataService.getSettings());
    window.addEventListener('wing_settings_updated', h);
    return () => window.removeEventListener('wing_settings_updated', h);
  }, []);

  const handlePageLanguage = (lang: Language) => {
    MockDataService.updateSettings({ language: lang });
    setSettings((s) => ({ ...s, language: lang }));
  };

  const handleModelLanguage = (v: ModelLang) => {
    MockDataService.updateSettings({ modelLanguage: v });
    setSettings((s) => ({ ...s, modelLanguage: v }));
  };

  const handleTheme = (v: Theme) => {
    MockDataService.updateSettings({ theme: v });
    setSettings((s) => ({ ...s, theme: v }));
  };

  const handlePageFont = (v: PageFont) => {
    MockDataService.updateSettings({ pageFont: v });
    setSettings((s) => ({ ...s, pageFont: v }));
  };

  const modelLang = (settings.modelLanguage ?? 'same') as ModelLang;
  const theme = (settings.theme ?? 'system') as Theme;
  const pageFont = (settings.pageFont ?? 'system') as PageFont;

  return (
    <div className="p-6 space-y-6">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 -ml-2 text-twilight-duskLight dark:text-nocturnal-secondary hover:bg-twilight-dusk/5 dark:hover:bg-nocturnal-surface/60 rounded-full"
          aria-label={t('settings_back')}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="serif text-2xl font-bold text-twilight-charcoal dark:text-nocturnal-primary">{t('display_options')}</h2>
      </header>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-twilight-duskLight dark:text-nocturnal-secondary mb-3">{t('theme_section')}</h3>
        <div className="flex p-1 bg-twilight-cream/60 dark:bg-nocturnal-surface/60 rounded-2xl">
          {(['system', 'light', 'dark'] as Theme[]).map((v) => (
            <button
              key={v}
              onClick={() => handleTheme(v)}
              className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${
                theme === v ? 'bg-twilight-surface dark:bg-nocturnal-surface shadow text-twilight-amber dark:text-nocturnal-accent' : 'text-twilight-duskLight dark:text-nocturnal-secondary'
              }`}
            >
              {v === 'system' && t('theme_system')}
              {v === 'light' && t('theme_light')}
              {v === 'dark' && t('theme_dark')}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-twilight-duskLight dark:text-nocturnal-secondary mb-3">{t('page_font_section')}</h3>
        <div className="flex flex-wrap gap-2 p-1">
          {(['system', 'source-han-sans', 'source-han-serif', 'xlwk'] as PageFont[]).map((v) => (
            <button
              key={v}
              onClick={() => handlePageFont(v)}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${
                pageFont === v ? 'bg-twilight-charcoal dark:bg-nocturnal-accent text-twilight-amberMuted dark:text-nocturnal-bg' : 'bg-twilight-cream/60 dark:bg-nocturnal-bg/60 text-twilight-duskLight dark:text-nocturnal-secondary hover:bg-twilight-dusk/10 dark:hover:bg-nocturnal-surface'
              }`}
            >
              {v === 'system' && t('font_system')}
              {v === 'source-han-sans' && t('font_source_han_sans')}
              {v === 'source-han-serif' && t('font_source_han_serif')}
              {v === 'xlwk' && t('font_xlwk')}
            </button>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-twilight-duskLight dark:text-nocturnal-secondary mb-3">{t('page_display_language')}</h3>
        <div className="flex p-1 bg-twilight-cream/60 dark:bg-nocturnal-surface/60 rounded-2xl">
          <button
            onClick={() => handlePageLanguage('zh')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${
              settings.language === 'zh' ? 'bg-twilight-surface dark:bg-nocturnal-surface shadow text-twilight-amber dark:text-nocturnal-accent' : 'text-twilight-duskLight dark:text-nocturnal-secondary'
            }`}
          >
            {t('lang_zh')}
          </button>
          <button
            onClick={() => handlePageLanguage('en')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium ${
              settings.language === 'en' ? 'bg-twilight-surface dark:bg-nocturnal-surface shadow text-twilight-amber dark:text-nocturnal-accent' : 'text-twilight-duskLight dark:text-nocturnal-secondary'
            }`}
          >
            {t('lang_en')}
          </button>
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-twilight-duskLight dark:text-nocturnal-secondary mb-3">{t('model_response_language')}</h3>
        <div className="flex flex-wrap gap-2 p-1">
          {(['same', 'zh', 'en'] as ModelLang[]).map((v) => (
            <button
              key={v}
              onClick={() => handleModelLanguage(v)}
              className={`px-4 py-2 rounded-xl text-sm font-medium ${
                modelLang === v ? 'bg-twilight-charcoal dark:bg-nocturnal-accent text-twilight-amberMuted dark:text-nocturnal-bg' : 'bg-twilight-cream/60 dark:bg-nocturnal-bg/60 text-twilight-duskLight dark:text-nocturnal-secondary hover:bg-twilight-dusk/10 dark:hover:bg-nocturnal-surface'
              }`}
            >
              {v === 'same' && t('model_language_same')}
              {v === 'zh' && t('lang_zh')}
              {v === 'en' && t('lang_en')}
            </button>
          ))}
        </div>
        <p className="text-[11px] text-twilight-duskLight dark:text-nocturnal-secondary mt-2">
          {modelLang === 'same' && t('model_language_hint_same')}
          {modelLang === 'zh' && t('model_language_hint_zh')}
          {modelLang === 'en' && t('model_language_hint_en')}
        </p>
      </section>
    </div>
  );
};

export default SettingsLanguageView;
