
import React, { useState, useEffect, useRef } from 'react';
import { Database, Shield, Cloud, Key, Languages, Globe, Upload, Download, RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { MockDataService } from '../services/mockDataService';
import { createWebDAVService } from '../services/webdavService';
import { downloadData, importData, replaceData } from '../services/dataService';
import { useTranslation } from '../i18n';
import { Language } from '../types';
import { useToast } from './ErrorToast';

const SettingsView: React.FC = () => {
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  const [syncStatus, setSyncStatus] = useState<{ type: 'idle' | 'testing' | 'syncing' | 'success' | 'error'; message?: string }>({ type: 'idle' });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const { showToast, ToastContainer } = useToast();

  const handleLanguageChange = (lang: Language) => {
    MockDataService.updateSettings({ language: lang });
    setSettings({ ...settings, language: lang });
  };

  const handleApiKeyChange = (key: string) => {
    MockDataService.updateSettings({ apiKey: key });
    setSettings({ ...settings, apiKey: key });
  };

  const handleWebDAVChange = (field: 'webdavUrl' | 'webdavUser' | 'webdavPass', value: string) => {
    // 如果URL为空，使用坚果云默认URL
    if (field === 'webdavUrl' && !value) {
      value = 'https://dav.jianguoyun.com/dav/';
    }
    MockDataService.updateSettings({ [field]: value });
    setSettings({ ...settings, [field]: value });
  };

  // 初始化时设置默认WebDAV URL（如果为空）
  useEffect(() => {
    if (!settings.webdavUrl) {
      const defaultUrl = 'https://dav.jianguoyun.com/dav/';
      MockDataService.updateSettings({ webdavUrl: defaultUrl });
      setSettings(prev => ({ ...prev, webdavUrl: defaultUrl }));
    }
  }, [settings.webdavUrl]);

  /**
   * 测试WebDAV连接
   */
  const handleTestConnection = async () => {
    setSyncStatus({ type: 'testing', message: t('webdav_test') });
    
    const service = createWebDAVService(settings);
    if (!service) {
      setSyncStatus({ type: 'error', message: '请先填写WebDAV配置' });
      return;
    }

    const result = await service.testConnection();
    setSyncStatus({
      type: result.success ? 'success' : 'error',
      message: result.message
    });

    setTimeout(() => {
      setSyncStatus({ type: 'idle' });
    }, 3000);
  };

  /**
   * 同步数据到WebDAV
   */
  const handleSync = async () => {
    setSyncStatus({ type: 'syncing', message: t('webdav_syncing') });
    
    const service = createWebDAVService(settings);
    if (!service) {
      setSyncStatus({ type: 'error', message: '请先填写WebDAV配置' });
      return;
    }

    const entries = MockDataService.getEntries();
    const sessions = MockDataService.getSessions();
    
    const result = await service.backupData(entries, sessions);
    setSyncStatus({
      type: result.success ? 'success' : 'error',
      message: result.message
    });

    setTimeout(() => {
      setSyncStatus({ type: 'idle' });
    }, 3000);
  };

  /**
   * 导出数据
   */
  const handleExport = () => {
    try {
      downloadData();
      showToast(t('export_success'), 'success');
    } catch (error) {
      showToast(`导出失败: ${error instanceof Error ? error.message : '未知错误'}`, 'error');
    }
  };

  /**
   * 导入数据（合并）
   */
  const handleImport = async () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const result = await importData(file);
    showToast(result.message, result.success ? 'success' : 'error');
    
    if (result.success) {
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  /**
   * 替换数据（完全替换）
   */
  const handleReplace = () => {
    if (!window.confirm(t('confirm_replace'))) return;
    replaceFileInputRef.current?.click();
  };

  const handleReplaceFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const result = await replaceData(file);
    showToast(result.message, result.success ? 'success' : 'error');
    
    if (result.success) {
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    }

    if (replaceFileInputRef.current) {
      replaceFileInputRef.current.value = '';
    }
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
              value={settings.webdavUrl}
              onChange={(e) => handleWebDAVChange('webdavUrl', e.target.value)}
              placeholder={t('webdav_url_placeholder')}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 ml-1">Username</label>
              <input 
                type="text" 
                value={settings.webdavUser}
                onChange={(e) => handleWebDAVChange('webdavUser', e.target.value)}
                placeholder={t('webdav_username_placeholder')}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-600 ml-1">Password</label>
              <input 
                type="password" 
                value={settings.webdavPass}
                onChange={(e) => handleWebDAVChange('webdavPass', e.target.value)}
                placeholder={t('webdav_password_placeholder')}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>
          <p className="text-[10px] text-slate-400 px-1">
            {t('webdav_help')}
          </p>
          
          {/* 连接测试和同步按钮 */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={handleTestConnection}
              disabled={syncStatus.type === 'testing' || syncStatus.type === 'syncing'}
              className="flex-1 flex items-center justify-center gap-2 bg-slate-100 text-slate-700 px-4 py-2 rounded-xl font-medium hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              {syncStatus.type === 'testing' ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <RefreshCw size={16} />
              )}
              <span>{t('webdav_test')}</span>
            </button>
            <button
              onClick={handleSync}
              disabled={syncStatus.type === 'testing' || syncStatus.type === 'syncing'}
              className="flex-1 flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-2 rounded-xl font-medium hover:bg-blue-600 transition-colors disabled:opacity-50"
            >
              {syncStatus.type === 'syncing' ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <Cloud size={16} />
              )}
              <span>{t('webdav_sync')}</span>
            </button>
          </div>

          {/* 同步状态显示 */}
          {syncStatus.type !== 'idle' && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
              syncStatus.type === 'success' ? 'bg-green-50 text-green-700' :
              syncStatus.type === 'error' ? 'bg-rose-50 text-rose-700' :
              'bg-blue-50 text-blue-700'
            }`}>
              {syncStatus.type === 'success' ? (
                <CheckCircle2 size={16} />
              ) : syncStatus.type === 'error' ? (
                <XCircle size={16} />
              ) : (
                <Loader2 className="animate-spin" size={16} />
              )}
              <span className="text-sm">{syncStatus.message}</span>
            </div>
          )}
        </div>
      </section>

      {/* Storage Section */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 text-slate-400 mb-2">
          <Database size={18} />
          <h3 className="text-xs font-bold uppercase tracking-wider">{t('storage')}</h3>
        </div>
        <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-3">
          {/* 导出数据 */}
          <button 
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-2 bg-slate-900 text-white px-4 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors"
          >
            <Download size={18} />
            <span>{t('export_data')}</span>
          </button>

          {/* 导入数据（合并） */}
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            accept=".json"
            className="hidden"
          />
          <button 
            onClick={handleImport}
            className="w-full flex items-center justify-center gap-2 bg-blue-500 text-white px-4 py-3 rounded-xl font-medium hover:bg-blue-600 transition-colors"
          >
            <Upload size={18} />
            <span>{t('import_data')}</span>
          </button>

          {/* 替换数据（完全替换） */}
          <input
            type="file"
            ref={replaceFileInputRef}
            onChange={handleReplaceFileSelect}
            accept=".json"
            className="hidden"
          />
          <button 
            onClick={handleReplace}
            className="w-full flex items-center justify-center gap-2 bg-amber-500 text-white px-4 py-3 rounded-xl font-medium hover:bg-amber-600 transition-colors"
          >
            <Upload size={18} />
            <span>{t('replace_data')}</span>
          </button>

          {/* 清除数据 */}
          <div className="pt-2 border-t border-slate-100">
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
        </div>
      </section>

      <div className="pt-10 text-center opacity-30">
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase">Wing Version 1.0.0</p>
        <p className="text-[10px] mt-1">Inspired by the lightness of feathers.</p>
      </div>

      {/* Toast 容器 */}
      <ToastContainer />
    </div>
  );
};

export default SettingsView;
