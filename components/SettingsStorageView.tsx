/**
 * 设置二级：存储管理（保留编辑历史、实时同步、备份 API Key、云端备份 WebDAV、本地数据）
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Cloud, Download, Upload, Replace, RefreshCw, CheckCircle2, XCircle, Loader2, Trash2, Eye, EyeOff } from 'lucide-react';
import { MockDataService } from '../services/mockDataService';
import { createWebDAVService } from '../services/webdavService';
import { downloadData, importData, replaceData } from '../services/dataService';
import { useTranslation } from '../i18n';
import { useToast } from './ErrorToast';

const SettingsStorageView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  const [syncStatus, setSyncStatus] = useState<{ type: 'idle' | 'testing' | 'syncing' | 'success' | 'error'; message?: string }>({ type: 'idle' });
  const [showClearModal, setShowClearModal] = useState(false);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreMode, setRestoreMode] = useState<'import' | 'replace'>('import');
  const [restoreFiles, setRestoreFiles] = useState<{ name: string; lastModified: number }[]>([]);
  const [restoreSelected, setRestoreSelected] = useState('');
  const [restoreLoading, setRestoreLoading] = useState(false);
  /** 是否明文显示 WebDAV 密码，默认打码 */
  const [showWebdavPass, setShowWebdavPass] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = () => setSettings(MockDataService.getSettings());
    window.addEventListener('wing_settings_updated', h);
    return () => window.removeEventListener('wing_settings_updated', h);
  }, []);

  useEffect(() => {
    if (!settings.webdavUrl) {
      MockDataService.updateSettings({ webdavUrl: 'https://dav.jianguoyun.com/dav/' });
      setSettings((s) => ({ ...s, webdavUrl: 'https://dav.jianguoyun.com/dav/' }));
    }
  }, [settings.webdavUrl]);

  const handleKeepEditHistoryChange = (v: boolean) => {
    MockDataService.updateSettings({ keepEditHistory: v });
    setSettings((s) => ({ ...s, keepEditHistory: v }));
  };

  const handleRealtimeWebdavSyncChange = (v: boolean) => {
    MockDataService.updateSettings({ realtimeWebdavSync: v });
    setSettings((s) => ({ ...s, realtimeWebdavSync: v }));
  };

  const handleBackupApiKeysChange = (v: boolean) => {
    MockDataService.updateSettings({ backupApiKeys: v });
    setSettings((s) => ({ ...s, backupApiKeys: v }));
  };

  const handleWebDAVChange = (f: 'webdavUrl' | 'webdavUser' | 'webdavPass', value: string) => {
    if (f === 'webdavUrl' && !value) value = 'https://dav.jianguoyun.com/dav/';
    MockDataService.updateSettings({ [f]: value });
    setSettings((s) => ({ ...s, [f]: value }));
  };

  const handleTestConnection = async () => {
    setSyncStatus({ type: 'testing', message: t('webdav_test') });
    const svc = createWebDAVService(settings);
    if (!svc) {
      setSyncStatus({ type: 'error', message: '请先填写 WebDAV 配置' });
      setTimeout(() => setSyncStatus({ type: 'idle' }), 3000);
      return;
    }
    const r = await svc.testConnection();
    setSyncStatus({ type: r.success ? 'success' : 'error', message: r.message });
    setTimeout(() => setSyncStatus({ type: 'idle' }), 3000);
  };

  /** 备份到云盘：与本地导出一致，ZIP（data.json + images/）上传 */
  const handleBackup = async () => {
    setSyncStatus({ type: 'syncing', message: t('webdav_backuping') });
    const svc = createWebDAVService(settings);
    if (!svc) {
      setSyncStatus({ type: 'error', message: '请先填写 WebDAV 配置' });
      setTimeout(() => setSyncStatus({ type: 'idle' }), 3000);
      return;
    }
    const entries = MockDataService.getEntries();
    const sessions = MockDataService.getSessions();
    const r = await svc.backupData(entries, sessions);
    setSyncStatus({ type: r.success ? 'success' : 'error', message: r.success ? t('webdav_backup_success') : r.message });
    setTimeout(() => setSyncStatus({ type: 'idle' }), 3000);
  };

  /** 打开从云盘导入/替换弹窗：先拉取备份列表；mode 决定后续走 importData 或 replaceData */
  const handleRestoreOpen = async (mode: 'import' | 'replace') => {
    const svc = createWebDAVService(settings);
    if (!svc) {
      showToast('请先填写 WebDAV 配置', 'error');
      return;
    }
    setRestoreMode(mode);
    setRestoreLoading(true);
    setShowRestoreModal(true);
    setRestoreFiles([]);
    setRestoreSelected('');
    const r = await svc.listBackupFiles();
    setRestoreLoading(false);
    if (!r.success || !r.files?.length) {
      showToast(r.success ? t('webdav_no_backup') : r.message, 'error');
      setShowRestoreModal(false);
      return;
    }
    setRestoreFiles(r.files);
    setRestoreSelected(r.files[0].name);
  };

  /** 从云盘导入或替换：下载所选备份后走 importData（合并）或 replaceData（覆盖），与本地逻辑一致 */
  const handleRestoreConfirm = async () => {
    if (!restoreSelected) return;
    const confirmMsg = restoreMode === 'replace' ? t('confirm_replace') : t('webdav_import_confirm');
    if (!window.confirm(confirmMsg)) return;
    const svc = createWebDAVService(settings);
    if (!svc) {
      showToast('请先填写 WebDAV 配置', 'error');
      return;
    }
    setSyncStatus({ type: 'syncing', message: restoreMode === 'import' ? t('webdav_importing') : t('webdav_replacing') });
    setShowRestoreModal(false);
    const down = await svc.downloadBackupFile(restoreSelected);
    if (!down.success || !down.file) {
      setSyncStatus({ type: 'error', message: down.message });
      setTimeout(() => setSyncStatus({ type: 'idle' }), 3000);
      return;
    }
    const r = restoreMode === 'import' ? await importData(down.file) : await replaceData(down.file);
    setSyncStatus({ type: r.success ? 'success' : 'error', message: r.message });
    setTimeout(() => setSyncStatus({ type: 'idle' }), 3000);
    if (r.success) setTimeout(() => window.location.reload(), 1500);
  };

  const handleExport = async () => {
    try {
      await downloadData();
      showToast(t('export_success'), 'success');
    } catch (e) {
      showToast(`导出失败: ${e instanceof Error ? e.message : '未知错误'}`, 'error');
    }
  };

  const handleImport = () => {
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = await importData(file);
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) setTimeout(() => window.location.reload(), 1500);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReplace = () => {
    if (!window.confirm(t('confirm_replace'))) return;
    replaceFileInputRef.current?.click();
  };

  const handleReplaceFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = await replaceData(file);
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) setTimeout(() => window.location.reload(), 1500);
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
  };

  const toggle = (value: boolean, onChange: (v: boolean) => void, label: string, hint: string) => (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-twilight-divider dark:border-nocturnal-secondary/25 last:border-0">
      <div>
        <p className="text-sm font-medium text-twilight-charcoal dark:text-nocturnal-primary">{label}</p>
        <p className="text-[11px] text-twilight-duskLight dark:text-nocturnal-secondary mt-0.5">{hint}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`flex-shrink-0 w-12 h-7 rounded-full transition-colors ${value ? 'bg-twilight-amber dark:bg-nocturnal-accent' : 'bg-twilight-dusk/20 dark:bg-nocturnal-secondary/30'}`}
        role="switch"
        aria-checked={value}
      >
        <span className={`block w-5 h-5 mt-1 rounded-full bg-white dark:bg-nocturnal-primary shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  );

  return (
    <div className="p-6 space-y-6 pb-24">
      <header className="flex items-center gap-3">
        <button
          onClick={() => navigate('/settings')}
          className="p-2 -ml-2 text-twilight-duskLight dark:text-nocturnal-secondary hover:bg-twilight-dusk/5 dark:hover:bg-nocturnal-surface/60 rounded-full"
          aria-label={t('settings_back')}
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="serif text-2xl font-bold text-twilight-charcoal dark:text-nocturnal-primary">{t('storage')}</h2>
      </header>

      <div className="bg-twilight-cream dark:bg-nocturnal-surface rounded-3xl p-4 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm [&>div:last-child]:border-b-0">
        {toggle(!!settings.keepEditHistory, handleKeepEditHistoryChange, t('keep_edit_history'), t('keep_edit_history_hint'))}
        {toggle(!!settings.realtimeWebdavSync, handleRealtimeWebdavSyncChange, t('realtime_webdav_sync'), t('realtime_webdav_sync_hint'))}
        {toggle(settings.backupApiKeys !== false, handleBackupApiKeysChange, t('backup_api_keys'), t('backup_api_keys_hint'))}
      </div>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-twilight-duskLight dark:text-nocturnal-secondary mb-3">{t('cloud_backup')}</h3>
        <div className="bg-twilight-cream dark:bg-nocturnal-surface rounded-3xl p-6 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-twilight-warm dark:text-nocturnal-secondary">Server URL</label>
            <input
              type="text"
              value={settings.webdavUrl}
              onChange={(e) => handleWebDAVChange('webdavUrl', e.target.value)}
              placeholder={t('webdav_url_placeholder')}
              className="w-full bg-twilight-cream/50 dark:bg-nocturnal-bg/70 dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/40 placeholder:dark:text-nocturnal-secondary"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-twilight-warm dark:text-nocturnal-secondary">Username</label>
              <input
                type="text"
                value={settings.webdavUser}
                onChange={(e) => handleWebDAVChange('webdavUser', e.target.value)}
                placeholder={t('webdav_username_placeholder')}
                className="w-full bg-twilight-cream/50 dark:bg-nocturnal-bg/70 dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/40 placeholder:dark:text-nocturnal-secondary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-twilight-warm dark:text-nocturnal-secondary">Password</label>
              <div className="relative">
                <input
                  type={showWebdavPass ? 'text' : 'password'}
                  value={settings.webdavPass}
                  onChange={(e) => handleWebDAVChange('webdavPass', e.target.value)}
                  placeholder={t('webdav_password_placeholder')}
                  className="w-full bg-twilight-cream/50 dark:bg-nocturnal-bg/70 dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/40 placeholder:dark:text-nocturnal-secondary"
                />
                <button
                  type="button"
                  onClick={() => setShowWebdavPass((s) => !s)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded-lg text-twilight-duskLight dark:text-nocturnal-secondary hover:bg-twilight-dusk/10 dark:hover:bg-nocturnal-surface"
                  aria-label={showWebdavPass ? t('secret_hide') : t('secret_show')}
                >
                  {showWebdavPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
          </div>
          <p className="text-[10px] text-twilight-duskLight dark:text-nocturnal-secondary">{t('webdav_help')}</p>
          <div className="flex flex-col gap-3">
            <div className="flex gap-3">
              <button
                onClick={handleTestConnection}
                disabled={syncStatus.type === 'testing' || syncStatus.type === 'syncing'}
                className="flex-1 flex items-center justify-center gap-2 bg-twilight-cream/60 dark:bg-nocturnal-bg/60 text-twilight-charcoal dark:text-nocturnal-primary px-4 py-2 rounded-xl font-medium hover:bg-twilight-dusk/10 dark:hover:bg-nocturnal-surface disabled:opacity-50 border border-twilight-divider dark:border-nocturnal-secondary/25"
              >
                {syncStatus.type === 'testing' ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
                {t('webdav_test')}
              </button>
              <button
                onClick={handleBackup}
                disabled={syncStatus.type === 'testing' || syncStatus.type === 'syncing'}
                className="flex-1 flex items-center justify-center gap-2 bg-twilight-amber dark:bg-nocturnal-accent text-twilight-charcoal dark:text-white px-4 py-2 rounded-xl font-medium hover:bg-twilight-amberMuted dark:hover:bg-nocturnal-accent/90 disabled:opacity-50"
              >
                {syncStatus.type === 'syncing' ? <Loader2 className="animate-spin" size={16} /> : <Cloud size={16} />}
                {t('webdav_backup')}
              </button>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => handleRestoreOpen('import')}
                disabled={syncStatus.type === 'testing' || syncStatus.type === 'syncing'}
                className="flex-1 flex items-center justify-center gap-2 bg-twilight-cream/60 dark:bg-nocturnal-bg/60 text-twilight-charcoal dark:text-nocturnal-primary px-4 py-2 rounded-xl font-medium hover:bg-twilight-dusk/10 dark:hover:bg-nocturnal-surface disabled:opacity-50 border border-twilight-divider dark:border-nocturnal-secondary/25"
              >
                <Upload size={16} />
                {t('webdav_import')}
              </button>
              <button
                onClick={() => handleRestoreOpen('replace')}
                disabled={syncStatus.type === 'testing' || syncStatus.type === 'syncing'}
                className="flex-1 flex items-center justify-center gap-2 bg-twilight-cream/60 dark:bg-nocturnal-bg/60 text-twilight-charcoal dark:text-nocturnal-primary px-4 py-2 rounded-xl font-medium hover:bg-twilight-dusk/10 dark:hover:bg-nocturnal-surface disabled:opacity-50 border border-twilight-divider dark:border-nocturnal-secondary/25"
              >
                <Replace size={16} />
                {t('webdav_replace')}
              </button>
            </div>
          </div>
          {syncStatus.type !== 'idle' && (
            <div
              className={`flex items-center gap-2 px-4 py-2 rounded-xl ${
                syncStatus.type === 'success' ? 'bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300' : syncStatus.type === 'error' ? 'bg-rose-50 dark:bg-rose-900/30 text-rose-700 dark:text-rose-300' : 'bg-blue-50 dark:bg-nocturnal-surface text-blue-700 dark:text-nocturnal-primary'
              }`}
            >
              {syncStatus.type === 'success' ? <CheckCircle2 size={16} /> : syncStatus.type === 'error' ? <XCircle size={16} /> : <Loader2 className="animate-spin" size={16} />}
              <span className="text-sm">{syncStatus.message}</span>
            </div>
          )}
        </div>
      </section>

      <section>
        <h3 className="text-xs font-bold uppercase tracking-wider text-twilight-duskLight dark:text-nocturnal-secondary mb-3">{t('local_data')}</h3>
        <div className="bg-twilight-cream dark:bg-nocturnal-surface rounded-3xl p-4 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm space-y-2">
          <button
            onClick={handleExport}
            className="w-full flex items-center justify-center gap-2 bg-twilight-charcoal dark:bg-nocturnal-accent text-twilight-amberMuted dark:text-nocturnal-bg px-4 py-3 rounded-xl font-medium hover:bg-twilight-dusk dark:hover:bg-nocturnal-accent/90"
          >
            <Download size={18} />
            {t('export_data')}
          </button>
          <p className="text-[11px] text-twilight-duskLight dark:text-nocturnal-secondary -mt-1">{t('export_format_hint')}</p>
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept=".json,.zip" className="hidden" />
          <button
            onClick={handleImport}
            className="w-full flex items-center justify-center gap-2 bg-twilight-amber dark:bg-nocturnal-accent text-twilight-charcoal dark:text-white px-4 py-3 rounded-xl font-medium hover:bg-twilight-amberMuted dark:hover:bg-nocturnal-accent/90"
          >
            <Upload size={18} />
            {t('import_data')}
          </button>
          <p className="text-[11px] text-twilight-duskLight dark:text-nocturnal-secondary -mt-1">{t('import_format_hint')}</p>
          <input type="file" ref={replaceFileInputRef} onChange={handleReplaceFileSelect} accept=".json,.zip" className="hidden" />
          <button
            onClick={handleReplace}
            className="w-full flex items-center justify-center gap-2 bg-twilight-amberMuted dark:bg-nocturnal-surface text-twilight-charcoal dark:text-nocturnal-primary px-4 py-3 rounded-xl font-medium hover:bg-twilight-amber/80 dark:hover:bg-nocturnal-secondary/30 border border-transparent dark:border-nocturnal-secondary/20"
          >
            <Replace size={18} />
            {t('replace_data')}
          </button>
          <div className="pt-2 border-t border-twilight-divider dark:border-nocturnal-secondary/25">
            <button
              onClick={() => setShowClearModal(true)}
              className="w-full text-center text-twilight-charcoal dark:text-nocturnal-primary font-semibold py-2 active:opacity-50 hover:text-twilight-dusk dark:hover:text-nocturnal-accent"
            >
              {t('clear_data')}
            </button>
          </div>
        </div>
      </section>

      {showClearModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20" onClick={() => setShowClearModal(false)}>
          <div
            className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-twilight-divider dark:border-nocturnal-secondary/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-900/40 flex items-center justify-center">
                <Trash2 size={20} className="text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="serif text-xl font-semibold text-twilight-charcoal dark:text-nocturnal-primary">{t('clear_modal_title')}</h3>
            </div>
            <p className="text-twilight-warm dark:text-nocturnal-secondary text-sm mb-4">{t('clear_modal_confirm')}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={async () => {
                  setShowClearModal(false);
                  await MockDataService.clearData();
                }}
                className="w-full py-3 px-4 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-colors"
              >
                {t('clear_modal_confirm_btn')}
              </button>
              <button
                onClick={() => setShowClearModal(false)}
                className="w-full py-2 text-twilight-duskLight dark:text-nocturnal-secondary text-sm hover:text-twilight-warm dark:hover:text-nocturnal-primary"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showRestoreModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20" onClick={() => setShowRestoreModal(false)}>
          <div
            className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-twilight-divider dark:border-nocturnal-secondary/20"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="serif text-xl font-semibold text-twilight-charcoal dark:text-nocturnal-primary mb-3">{t('webdav_select_backup')}</h3>
            {restoreLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-twilight-duskLight dark:text-nocturnal-secondary">
                <Loader2 className="animate-spin" size={20} />
                <span>{t('webdav_loading_list')}</span>
              </div>
            ) : (
              <>
                <select
                  value={restoreSelected}
                  onChange={(e) => setRestoreSelected(e.target.value)}
                  className="w-full bg-twilight-cream/50 dark:bg-nocturnal-bg/70 dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-xl px-4 py-3 mb-4 focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/40"
                >
                  {restoreFiles.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name} ({new Date(f.lastModified).toLocaleString(undefined, { dateStyle: 'short', timeStyle: 'short' })})
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-twilight-duskLight dark:text-nocturnal-secondary mb-4">
                  {restoreMode === 'replace' ? t('confirm_replace') : t('webdav_import_confirm')}
                </p>
                <div className="flex flex-col gap-2">
                  <button
                    onClick={handleRestoreConfirm}
                    className="w-full py-3 px-4 bg-twilight-amber dark:bg-nocturnal-accent text-twilight-charcoal dark:text-white rounded-xl font-medium hover:bg-twilight-amberMuted dark:hover:bg-nocturnal-accent/90"
                  >
                    {restoreMode === 'replace' ? t('webdav_replace') : t('webdav_import')}
                  </button>
                  <button
                    onClick={() => setShowRestoreModal(false)}
                    className="w-full py-2 text-twilight-duskLight dark:text-nocturnal-secondary text-sm hover:text-twilight-warm dark:hover:text-nocturnal-primary"
                  >
                    {t('cancel')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <ToastContainer />
    </div>
  );
};

export default SettingsStorageView;
