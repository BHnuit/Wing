/**
 * 设置二级：模型配置
 * 拆分为三个卡片：AI 选项、文风选项（文风偏好、对应提示词）、洞察选项（猫头鹰洞察提示语）
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Key, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { MockDataService } from '../services/mockDataService';
import { AiService } from '../services/aiService';
import { WRITING_STYLE_PRESETS } from '../services/geminiService';
import { useTranslation } from '../i18n';
import { AiProvider, WritingStyle } from '../types';

const MODEL_PRESETS: Partial<Record<AiProvider, string[]>> = {
  gemini: ['gemini-3-pro-preview', 'gemini-3-pro-image-preview', 'gemini-2.5-flash', 'gemini-2.5-pro', 'gemini-2.5-flash-image-preview'],
  openai: ['gpt-5.1', 'gpt-5', 'gpt-5-mini', 'gpt-5-nano', 'gpt-5-pro'],
  deepseek: ['deepseek-chat', 'deepseek-reasoner']
};
const MODEL_CUSTOM = '__custom__';

const SettingsAiView: React.FC = () => {
  const navigate = useNavigate();
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  const [aiTestStatus, setAiTestStatus] = useState<{ type: 'idle' | 'testing' | 'success' | 'error'; message?: string }>({ type: 'idle' });
  const [modelSelectOther, setModelSelectOther] = useState(false);

  useEffect(() => {
    const h = () => setSettings(MockDataService.getSettings());
    window.addEventListener('wing_settings_updated', h);
    return () => window.removeEventListener('wing_settings_updated', h);
  }, []);
  useEffect(() => {
    setModelSelectOther(false);
  }, [settings.aiProvider]);

  const currentApiKey = () =>
    settings.apiKeys?.[settings.aiProvider || 'gemini'] ?? settings.apiKey ?? '';

  const currentModelValue = () => {
    const p = (settings.aiProvider || 'gemini') as AiProvider;
    return settings.aiModels?.[p] ?? settings.aiModel ?? '';
  };

  const handleApiKeyChange = (key: string) => {
    const p = (settings.aiProvider || 'gemini') as AiProvider;
    const next = { ...(settings.apiKeys || {}), [p]: key };
    MockDataService.updateSettings({ apiKeys: next });
    setSettings((s) => ({ ...s, apiKeys: next }));
  };

  const handleAiProviderChange = (p: AiProvider) => {
    MockDataService.updateSettings({ aiProvider: p });
    setSettings((s) => ({ ...s, aiProvider: p }));
  };

  const handleAiBaseUrlChange = (v: string) => {
    MockDataService.updateSettings({ aiBaseUrl: v });
    setSettings((s) => ({ ...s, aiBaseUrl: v }));
  };

  const handleAiModelChange = (v: string) => {
    const p = (settings.aiProvider || 'gemini') as AiProvider;
    const next = { ...(settings.aiModels || {}), [p]: v };
    MockDataService.updateSettings({ aiModels: next });
    setSettings((s) => ({ ...s, aiModels: next }));
  };

  const handleWritingStyleChange = (style: WritingStyle) => {
    MockDataService.updateSettings({ writingStyle: style });
    setSettings((s) => ({ ...s, writingStyle: style }));
  };

  const handleWritingStylePromptChange = (v: string) => {
    MockDataService.updateSettings({ writingStylePrompt: v });
    setSettings((s) => ({ ...s, writingStylePrompt: v }));
  };

  const handleInsightPromptChange = (v: string) => {
    MockDataService.updateSettings({ insightPrompt: v });
    setSettings((s) => ({ ...s, insightPrompt: v }));
  };

  const handleAiTestConnection = async () => {
    setAiTestStatus({ type: 'testing', message: t('ai_testing') });
    const result = await AiService.testConnection(settings);
    setAiTestStatus({ type: result.success ? 'success' : 'error', message: result.message });
    setTimeout(() => setAiTestStatus({ type: 'idle' }), 3000);
  };

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
        <h2 className="serif text-2xl font-bold text-twilight-charcoal dark:text-nocturnal-primary">{t('menu_model_config')}</h2>
      </header>

      {/* AI 选项：小标题在上方，配置在卡片内 */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-twilight-duskLight dark:text-nocturnal-secondary mb-3">{t('card_ai_options')}</h3>
        <div className="bg-twilight-cream dark:bg-nocturnal-surface rounded-3xl p-6 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-twilight-warm dark:text-nocturnal-secondary">{t('ai_provider')}</label>
          <div className="flex flex-wrap gap-2">
            {(['gemini', 'openai', 'deepseek', 'custom'] as AiProvider[]).map((p) => (
              <button
                key={p}
                onClick={() => handleAiProviderChange(p)}
                className={`px-4 py-2 rounded-xl text-sm font-medium ${
                  (settings.aiProvider || 'gemini') === p ? 'bg-twilight-charcoal dark:bg-nocturnal-accent text-twilight-amberMuted dark:text-nocturnal-bg' : 'bg-twilight-cream/60 dark:bg-nocturnal-bg/60 text-twilight-duskLight dark:text-nocturnal-secondary hover:bg-twilight-dusk/10 dark:hover:bg-nocturnal-surface'
                }`}
              >
                {p === 'gemini' && t('ai_provider_gemini')}
                {p === 'openai' && t('ai_provider_openai')}
                {p === 'deepseek' && t('ai_provider_deepseek')}
                {p === 'custom' && t('ai_provider_custom')}
              </button>
            ))}
          </div>
        </div>

        {/* API Key */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-twilight-warm dark:text-nocturnal-secondary">API Key</label>
          <div className="relative">
            <input
              type="password"
              value={currentApiKey()}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              placeholder="Paste your key here..."
              className="w-full bg-twilight-cream/50 dark:bg-nocturnal-bg/70 dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/40 pr-12 placeholder:dark:text-nocturnal-secondary"
            />
            <Key className="absolute right-4 top-1/2 -translate-y-1/2 text-twilight-duskLight dark:text-nocturnal-secondary" size={18} />
          </div>
        </div>

        {(settings.aiProvider || 'gemini') === 'custom' && (
          <div className="space-y-2">
            <label className="text-sm font-medium text-twilight-warm dark:text-nocturnal-secondary">{t('ai_base_url')}</label>
            <input
              type="url"
              value={settings.aiBaseUrl || ''}
              onChange={(e) => handleAiBaseUrlChange(e.target.value)}
              placeholder={t('ai_base_url_placeholder')}
              className="w-full bg-twilight-cream/50 dark:bg-nocturnal-bg/70 dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/40 placeholder:dark:text-nocturnal-secondary"
            />
          </div>
        )}

        {/* 模型名称 */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-twilight-warm dark:text-nocturnal-secondary">{t('ai_model')}</label>
          {(settings.aiProvider || 'gemini') === 'custom' ? (
            <input
              type="text"
              value={currentModelValue()}
              onChange={(e) => handleAiModelChange(e.target.value)}
              placeholder={t('ai_model_placeholder')}
              className="w-full bg-twilight-cream/50 dark:bg-nocturnal-bg/70 dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/40 placeholder:dark:text-nocturnal-secondary"
            />
          ) : (
            <>
              <select
                value={(() => {
                  const p = (settings.aiProvider || 'gemini') as AiProvider;
                  const val = currentModelValue();
                  const presets = MODEL_PRESETS[p];
                  if (modelSelectOther || (val && !presets?.includes(val))) return MODEL_CUSTOM;
                  return val || '';
                })()}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === MODEL_CUSTOM) {
                    setModelSelectOther(true);
                    return;
                  }
                  setModelSelectOther(false);
                  handleAiModelChange(v);
                }}
                className="w-full bg-twilight-cream/50 dark:bg-nocturnal-bg/70 dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/40 placeholder:dark:text-nocturnal-secondary"
              >
                <option value="">{t('ai_model_default')}</option>
                {(MODEL_PRESETS[(settings.aiProvider || 'gemini') as AiProvider] || []).map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
                <option value={MODEL_CUSTOM}>{t('ai_model_custom')}</option>
              </select>
              {(() => {
                const p = (settings.aiProvider || 'gemini') as AiProvider;
                const val = currentModelValue();
                const presets = MODEL_PRESETS[p];
                const isCustom = modelSelectOther || (!!val && !presets?.includes(val));
                if (!isCustom) return null;
                return (
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => handleAiModelChange(e.target.value)}
                    placeholder={t('ai_model_placeholder')}
                    className="w-full mt-2 bg-twilight-cream/50 dark:bg-nocturnal-bg/70 dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/40 placeholder:dark:text-nocturnal-secondary"
                  />
                );
              })()}
            </>
          )}
        </div>

        <p className="text-[10px] text-twilight-duskLight dark:text-nocturnal-secondary">{t('api_desc')}</p>

        <button
          onClick={handleAiTestConnection}
          disabled={aiTestStatus.type === 'testing'}
          className="w-full flex items-center justify-center gap-2 bg-twilight-cream/60 dark:bg-nocturnal-bg/60 text-twilight-charcoal dark:text-nocturnal-primary px-4 py-2.5 rounded-xl font-medium hover:bg-twilight-dusk/10 dark:hover:bg-nocturnal-surface disabled:opacity-50 border border-twilight-divider dark:border-nocturnal-secondary/25"
        >
          {aiTestStatus.type === 'testing' ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
          <span>{t('ai_test')}</span>
        </button>

        {aiTestStatus.type !== 'idle' && (
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
              aiTestStatus.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
              aiTestStatus.type === 'error' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' : 'bg-blue-50 dark:bg-nocturnal-surface text-blue-700 dark:text-nocturnal-primary'
            }`}
          >
            {aiTestStatus.type === 'success' ? <CheckCircle2 size={16} /> : aiTestStatus.type === 'error' ? <XCircle size={16} /> : <Loader2 className="animate-spin" size={16} />}
            <span className="text-sm">{aiTestStatus.message}</span>
          </div>
        )}
        </div>
      </section>

      {/* 文风选项：小标题在上方，配置在卡片内 */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-twilight-duskLight dark:text-nocturnal-secondary mb-3">{t('card_writing_options')}</h3>
        <div className="bg-twilight-cream dark:bg-nocturnal-surface rounded-3xl p-6 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-twilight-warm dark:text-nocturnal-secondary">{t('writing_style_preference')}</label>
          <div className="flex flex-wrap gap-2">
            {(['letter', 'prose', 'report', 'custom'] as WritingStyle[]).map((s) => (
              <button
                key={s}
                onClick={() => handleWritingStyleChange(s)}
                className={`px-4 py-2 rounded-xl text-sm font-medium ${
                  (settings.writingStyle || 'prose') === s ? 'bg-twilight-charcoal dark:bg-nocturnal-accent text-twilight-amberMuted dark:text-nocturnal-bg' : 'bg-twilight-cream/60 dark:bg-nocturnal-bg/60 text-twilight-duskLight dark:text-nocturnal-secondary hover:bg-twilight-dusk/10 dark:hover:bg-nocturnal-surface'
                }`}
              >
                {s === 'letter' && t('writing_style_letter')}
                {s === 'prose' && t('writing_style_prose')}
                {s === 'report' && t('writing_style_report')}
                {s === 'custom' && t('writing_style_custom')}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-twilight-warm dark:text-nocturnal-secondary">{t('writing_style_prompt_corresponding')}</label>
          <p className="text-[10px] text-twilight-duskLight dark:text-nocturnal-secondary">{t('writing_style_prompt_hint')}</p>
          <textarea
            value={(settings.writingStyle || 'prose') === 'custom'
              ? (settings.writingStylePrompt || '')
              : (WRITING_STYLE_PRESETS[(settings.writingStyle || 'prose') as Exclude<WritingStyle, 'custom'>] || '')}
            onChange={(e) => (settings.writingStyle || 'prose') === 'custom' && handleWritingStylePromptChange(e.target.value)}
            readOnly={(settings.writingStyle || 'prose') !== 'custom'}
            rows={3}
            placeholder={(settings.writingStyle || 'prose') === 'custom' ? t('writing_style_prompt_placeholder') : ''}
            className="w-full bg-twilight-cream/50 dark:bg-nocturnal-bg/70 dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/40 placeholder:dark:text-nocturnal-secondary resize-y"
          />
        </div>
        </div>
      </section>

      {/* 洞察选项：小标题在上方，配置在卡片内 */}
      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-twilight-duskLight dark:text-nocturnal-secondary mb-3">{t('card_insight_options')}</h3>
        <div className="bg-twilight-cream dark:bg-nocturnal-surface rounded-3xl p-6 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-twilight-warm dark:text-nocturnal-secondary">{t('insight_prompt_label')}</label>
            <textarea
              value={settings.insightPrompt || ''}
              onChange={(e) => handleInsightPromptChange(e.target.value)}
              rows={3}
              placeholder={t('insight_prompt_placeholder')}
              className="w-full bg-twilight-cream/50 dark:bg-nocturnal-bg/70 dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/40 placeholder:dark:text-nocturnal-secondary resize-y"
            />
          </div>
        </div>
      </section>
    </div>
  );
};

export default SettingsAiView;
