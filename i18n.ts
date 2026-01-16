
import { Language } from './types';

export const translations = {
  zh: {
    recording: '记录',
    journals: '日记',
    settings: '设置',
    mind_placeholder: '此刻在想什么？',
    synthesize_btn: '智能编织今日',
    weaving: '正在编织...',
    empty_library: '暂无日记。开始记录，编织你的第一个故事。',
    library_title: '日记库',
    empty_chat: '"今天过得怎么样？记录下你的思绪，像羽毛一样轻盈..."',
    wing_insight: 'Wing 洞察',
    tasks_captured: '待办捕捉',
    synced_reminders: '已同步至提醒事项',
    clear_data: '清除本地数据',
    ai_config: 'AI 配置',
    cloud_backup: '云端备份 (WebDAV)',
    storage: '存储管理',
    api_desc: 'API 密钥用于将零碎的记录合成为结构化的日记。',
    language: '语言设置',
    lang_zh: '简体中文',
    lang_en: 'English',
    untitled: '无标题 Wing',
    synth_failed: '合成失败。请检查 API 配置。'
  },
  en: {
    recording: 'Recording',
    journals: 'Journals',
    settings: 'Settings',
    mind_placeholder: "What's on your mind?",
    synthesize_btn: 'Synthesize Day',
    weaving: 'Weaving...',
    empty_library: 'No entries yet. Start recording to weave your first story.',
    library_title: 'Your Library',
    empty_chat: '"How was your day? Record your thoughts like feathers falling into place..."',
    wing_insight: 'Wing Insight',
    tasks_captured: 'Tasks Captured',
    synced_reminders: 'Synced to Reminders',
    clear_data: 'Clear Local Data',
    ai_config: 'AI Configuration',
    cloud_backup: 'Cloud Backup (WebDAV)',
    storage: 'Storage',
    api_desc: 'Your API key is used for synthesizing fragments into structured journals.',
    language: 'Language',
    lang_zh: '简体中文',
    lang_en: 'English',
    untitled: 'Untitled Wing',
    synth_failed: 'Synthesis failed. Please check your API configuration.'
  }
};

export const useTranslation = (lang: Language = 'zh') => {
  return (key: keyof typeof translations['zh']) => {
    return translations[lang][key] || translations['zh'][key];
  };
};
