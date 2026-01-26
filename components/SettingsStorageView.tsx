/**
 * 设置二级：存储管理（保留编辑历史、备份 API Key、本地数据导入导出）
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Upload, Replace, Loader2, Trash2 } from 'lucide-react';
import { MockDataService } from '../services/mockDataService';
import { downloadData, importData, replaceData, replaceDataFromSplit, importDataFromSplit, importDataFromFolder, replaceDataFromFolder } from '../services/dataService';
import { getLocalDateString } from '../utils/date';
import { useTranslation } from '../i18n';
import { useToast } from './ErrorToast';

const SettingsStorageView: React.FC = () => {
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  const [showClearModal, setShowClearModal] = useState(false);
  /** 显示导入方式选择弹窗 */
  const [showImportModal, setShowImportModal] = useState(false);
  /** 显示替换方式选择弹窗 */
  const [showReplaceModal, setShowReplaceModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const replaceFileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const replaceFolderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const h = () => setSettings(MockDataService.getSettings());
    window.addEventListener('wing_settings_updated', h);
    return () => window.removeEventListener('wing_settings_updated', h);
  }, []);


  const handleKeepEditHistoryChange = (v: boolean) => {
    MockDataService.updateSettings({ keepEditHistory: v });
    setSettings((s) => ({ ...s, keepEditHistory: v }));
  };

  const handleBackupApiKeysChange = (v: boolean) => {
    MockDataService.updateSettings({ backupApiKeys: v });
    setSettings((s) => ({ ...s, backupApiKeys: v }));
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
    setShowImportModal(true);
  };

  const handleImportFromFile = () => {
    setShowImportModal(false);
    fileInputRef.current?.click();
  };

  const handleImportFromFolder = () => {
    setShowImportModal(false);
    folderInputRef.current?.click();
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
    setShowReplaceModal(true);
  };

  const handleReplaceFromFile = () => {
    setShowReplaceModal(false);
    if (!window.confirm(t('confirm_replace'))) return;
    replaceFileInputRef.current?.click();
  };

  const handleReplaceFromFolder = () => {
    setShowReplaceModal(false);
    if (!window.confirm(t('confirm_replace'))) return;
    replaceFolderInputRef.current?.click();
  };

  const handleReplaceFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const r = await replaceData(file);
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) setTimeout(() => window.location.reload(), 1500);
    if (replaceFileInputRef.current) replaceFileInputRef.current.value = '';
  };

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const r = await importDataFromFolder(files);
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) setTimeout(() => window.location.reload(), 1500);
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handleReplaceFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const r = await replaceDataFromFolder(files);
    showToast(r.message, r.success ? 'success' : 'error');
    if (r.success) setTimeout(() => window.location.reload(), 1500);
    if (replaceFolderInputRef.current) replaceFolderInputRef.current.value = '';
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
        {toggle(settings.backupApiKeys !== false, handleBackupApiKeysChange, t('backup_api_keys'), t('backup_api_keys_hint'))}
      </div>

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
          <input type="file" ref={folderInputRef} onChange={handleFolderSelect} webkitdirectory="" directory="" className="hidden" />
          <button
            onClick={handleImport}
            className="w-full flex items-center justify-center gap-2 bg-twilight-amber dark:bg-nocturnal-accent text-twilight-charcoal dark:text-white px-4 py-3 rounded-xl font-medium hover:bg-twilight-amberMuted dark:hover:bg-nocturnal-accent/90"
          >
            <Upload size={18} />
            {t('import_data')}
          </button>
          <p className="text-[11px] text-twilight-duskLight dark:text-nocturnal-secondary -mt-1">{t('import_format_hint')}</p>
          <input type="file" ref={replaceFileInputRef} onChange={handleReplaceFileSelect} accept=".json,.zip" className="hidden" />
          <input type="file" ref={replaceFolderInputRef} onChange={handleReplaceFolderSelect} webkitdirectory="" directory="" className="hidden" />
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

      {showImportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20" onClick={() => setShowImportModal(false)}>
          <div
            className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-twilight-divider dark:border-nocturnal-secondary/20"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="serif text-xl font-semibold text-twilight-charcoal dark:text-nocturnal-primary mb-4">{t('import_select_method')}</h3>
            <p className="text-sm text-twilight-warm dark:text-nocturnal-secondary mb-4">{t('import_select_method_hint')}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleImportFromFile}
                className="w-full flex items-center justify-center gap-2 bg-twilight-amber dark:bg-nocturnal-accent text-twilight-charcoal dark:text-white px-4 py-3 rounded-xl font-medium hover:bg-twilight-amberMuted dark:hover:bg-nocturnal-accent/90"
              >
                <Upload size={18} />
                {t('import_from_file')}
              </button>
              <button
                onClick={handleImportFromFolder}
                className="w-full flex items-center justify-center gap-2 bg-twilight-amber/80 dark:bg-nocturnal-accent/80 text-twilight-charcoal dark:text-white px-4 py-3 rounded-xl font-medium hover:bg-twilight-amberMuted dark:hover:bg-nocturnal-accent/90"
              >
                <Upload size={18} />
                {t('import_from_folder')}
              </button>
              <button
                onClick={() => setShowImportModal(false)}
                className="w-full py-2 text-twilight-duskLight dark:text-nocturnal-secondary text-sm hover:text-twilight-warm dark:hover:text-nocturnal-primary"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReplaceModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20" onClick={() => setShowReplaceModal(false)}>
          <div
            className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-twilight-divider dark:border-nocturnal-secondary/20"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="serif text-xl font-semibold text-twilight-charcoal dark:text-nocturnal-primary mb-4">{t('replace_select_method')}</h3>
            <p className="text-sm text-twilight-warm dark:text-nocturnal-secondary mb-4">{t('replace_select_method_hint')}</p>
            <div className="flex flex-col gap-3">
              <button
                onClick={handleReplaceFromFile}
                className="w-full flex items-center justify-center gap-2 bg-twilight-amberMuted dark:bg-nocturnal-surface text-twilight-charcoal dark:text-nocturnal-primary px-4 py-3 rounded-xl font-medium hover:bg-twilight-amber/80 dark:hover:bg-nocturnal-secondary/30 border border-transparent dark:border-nocturnal-secondary/20"
              >
                <Replace size={18} />
                {t('replace_from_file')}
              </button>
              <button
                onClick={handleReplaceFromFolder}
                className="w-full flex items-center justify-center gap-2 bg-twilight-amberMuted/80 dark:bg-nocturnal-surface/80 text-twilight-charcoal dark:text-nocturnal-primary px-4 py-3 rounded-xl font-medium hover:bg-twilight-amber/80 dark:hover:bg-nocturnal-secondary/30 border border-transparent dark:border-nocturnal-secondary/20"
              >
                <Replace size={18} />
                {t('replace_from_folder')}
              </button>
              <button
                onClick={() => setShowReplaceModal(false)}
                className="w-full py-2 text-twilight-duskLight dark:text-nocturnal-secondary text-sm hover:text-twilight-warm dark:hover:text-nocturnal-primary"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}


      <ToastContainer />
    </div>
  );
};

export default SettingsStorageView;
