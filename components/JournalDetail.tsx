import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Share, MoreHorizontal, Bell, CheckCircle, RotateCw, Loader2, Pencil, History, Copy, Clipboard, Trash2, MessageSquare, Infinity } from 'lucide-react';
import { getLocalDateString } from '../utils/date';
import html2canvas from 'html2canvas';
import { MockDataService } from '../services/mockDataService';
import { AiService, AiAPIError, getEffectiveApiKey, getModelResponseLanguage } from '../services/aiService';
import { triggerRealtimeSyncIfEnabled } from '../services/webdavService';
import { useTranslation } from '../i18n';
import { MarkdownRenderer } from './MarkdownRenderer';
import { useToast } from './ErrorToast';
import { WingEntry, FragmentType, EditHistoryItem } from '../types';

/**
 * 仅当 mood 全部由 emoji 组成时显示，否则留空。
 * 使用 Unicode 码点白名单：常见 emoji 区块 + 变异选择子(U+FE0F)、ZWJ(U+200D)。
 */
function isMoodEmoji(s: string | undefined): boolean {
  const t = (s || '').trim();
  if (!t || t.length > 12) return false; // 允许多个 emoji 或 ZWJ 组合，但不接受长文本
  for (const c of [...t]) {
    const code = c.codePointAt(0) ?? 0;
    if (code >= 0x2600 && code <= 0x26FF) continue;   // Miscellaneous Symbols
    if (code >= 0x2700 && code <= 0x27BF) continue;   // Dingbats
    if (code >= 0x1F300 && code <= 0x1F5FF) continue; // Misc Symbols and Pictographs
    if (code >= 0x1F600 && code <= 0x1F64F) continue; // Emoticons
    if (code >= 0x1F680 && code <= 0x1F6FF) continue; // Transport and Map
    if (code >= 0x1F900 && code <= 0x1F9FF) continue; // Supplemental Symbols and Pictographs
    if (code >= 0x1FA70 && code <= 0x1FAFF) continue; // Symbols and Pictographs Extended-A
    if (code >= 0x1F1E6 && code <= 0x1F1FF) continue; // Regional Indicators (flags)
    if (code === 0xFE0F || code === 0x200D) continue; // Variation Selector, ZWJ
    return false;
  }
  return true;
}

const JournalDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();
  const [entry, setEntry] = useState<WingEntry | undefined>(() => MockDataService.getEntryById(id || ''));
  const [showRegenModal, setShowRegenModal] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isRegeneratingInsight, setIsRegeneratingInsight] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editMarkdown, setEditMarkdown] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const shareCardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setEntry(MockDataService.getEntryById(id || '') ?? undefined);
  }, [id]);

  useEffect(() => {
    const handleSettingsUpdate = () => setSettings(MockDataService.getSettings());
    window.addEventListener('wing_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('wing_settings_updated', handleSettingsUpdate);
  }, []);

  /**
   * 从当日 session 取图片（与 ChatView 同源）；若 fragment 无 imageData 则用 entry.images 回退。
   * 当 session 不存在或无 IMAGE 时返回 []，由 MarkdownRenderer 使用 entry.images。
   */
  const sessionImageFragments = useMemo(() => {
    if (!entry) return [];
    const date = getLocalDateString(new Date(entry.createdAt));
    const session = MockDataService.getSessionByDate(date);
    const frags = (session?.fragments ?? [])
      .filter((f) => f.type === FragmentType.IMAGE)
      .sort((a, b) => a.timestamp - b.timestamp);
    return frags
      .map((f) => f.imageData || (entry!.images && entry.images[f.id]) || '')
      .filter((d): d is string => !!d && typeof d === 'string');
  }, [entry?.id, entry?.createdAt, entry?.images]);

  /** 进入编辑：填充 draft 并切换到编辑模式 */
  const startEdit = () => {
    if (!entry) return;
    setEditTitle(entry.title);
    setEditMarkdown(entry.markdownContent);
    setIsEditing(true);
  };

  /** 保存编辑：可选写入编辑历史，更新 entry */
  const saveEdit = () => {
    if (!entry) return;
    const keep = !!(settings.keepEditHistory ?? false);
    const updates: Partial<WingEntry> = {
      title: editTitle.trim() || entry.title,
      markdownContent: editMarkdown,
      editedAt: Date.now()
    };
    if (keep) {
      updates.editHistory = [
        ...(entry.editHistory ?? []),
        { createdAt: Date.now(), title: entry.title, markdownContent: entry.markdownContent }
      ];
    }
    MockDataService.updateEntry(entry.id, updates);
    setEntry({ ...entry, ...updates });
    triggerRealtimeSyncIfEnabled(settings);
    setIsEditing(false);
    showToast(t('edit_success'), 'success', 2000);
  };

  /** 取消编辑 */
  const cancelEdit = () => {
    setIsEditing(false);
  };

  /**
   * 恢复到历史版本：若在编辑中则只更新表单；否则写回 entry，可选将当前内容记入历史
   */
  const restoreVersion = (hist: EditHistoryItem) => {
    if (isEditing) {
      setEditTitle(hist.title);
      setEditMarkdown(hist.markdownContent);
      showToast(t('edit_success'), 'success', 1500);
      return;
    }
    if (!entry) return;
    const keep = !!(settings.keepEditHistory ?? false);
    const updates: Partial<WingEntry> = {
      title: hist.title,
      markdownContent: hist.markdownContent,
      editedAt: Date.now()
    };
    if (keep) {
      updates.editHistory = [
        ...(entry.editHistory ?? []),
        { createdAt: Date.now(), title: entry.title, markdownContent: entry.markdownContent }
      ];
    }
    MockDataService.updateEntry(entry.id, updates);
    setEntry({ ...entry, ...updates });
    triggerRealtimeSyncIfEnabled(settings);
    showToast(t('edit_success'), 'success', 2000);
    setShowHistory(false);
  };

  /**
   * 仅根据日记内容重新生成心理洞察，只更新 aiInsights
   */
  const doRegenerateInsight = async () => {
    if (!entry || !getEffectiveApiKey(settings)) {
      showToast(t('api_key_missing'), 'error');
      return;
    }
    setIsRegeneratingInsight(true);
    try {
      const insight = await AiService.regenerateInsight(entry, getModelResponseLanguage(settings), settings);
      MockDataService.updateEntry(entry.id, { aiInsights: insight });
      setEntry({ ...entry, aiInsights: insight });
      triggerRealtimeSyncIfEnabled(settings);
      showToast(t('insight_regen_success'), 'success', 2000);
    } catch (err) {
      console.error('Regenerate insight failed:', err);
      let msg = t('insight_regen_failed');
      if (err instanceof AiAPIError) {
        if (err.code === 'MISSING_API_KEY') msg = t('api_key_missing');
        else if (err.code === 'NETWORK_ERROR') msg = t('network_error');
        else msg = err.message || msg;
      }
      showToast(msg, 'error');
    } finally {
      setIsRegeneratingInsight(false);
    }
  };

  /**
   * 重新生成：合并当日所有记录（含本日记）调用 AI，按 mode 覆盖或另存为新版本
   */
  const doRegenerate = async (mode: 'overwrite' | 'newVersion') => {
    if (!entry) return;
    if (!getEffectiveApiKey(settings)) {
      showToast(t('api_key_missing'), 'error');
      return;
    }
    const date = getLocalDateString(new Date(entry.createdAt));
    const session = MockDataService.getSessionByDate(date);
    const fragments = session?.fragments ?? [];
    const previousGeneration = entry.markdownContent;

    if (fragments.length === 0 && !previousGeneration?.trim()) {
      showToast(t('no_fragments'), 'warning');
      return;
    }

    setIsRegenerating(true);
    try {
      const synthesized = await AiService.synthesizeJournal(
        fragments,
        getModelResponseLanguage(settings),
        settings,
        2,
        previousGeneration
      );

      const images: { [key: string]: string } = {};
      fragments.forEach((f) => {
        if (f.type === FragmentType.IMAGE && f.imageData) images[f.id] = f.imageData;
      });
      const finalImages = Object.keys(images).length > 0 ? images : (fragments.length > 0 ? undefined : entry.images);

      const resolvedMd = (synthesized.markdownContent != null && String(synthesized.markdownContent).trim() !== '')
        ? synthesized.markdownContent
        : entry.markdownContent;

      const resolvedTodos = (synthesized.todos && synthesized.todos.length > 0) ? synthesized.todos : (entry.todos || []);

      if (mode === 'overwrite') {
        const updates = {
          title: synthesized.title ?? entry.title,
          summary: synthesized.summary ?? entry.summary,
          mood: synthesized.mood ?? entry.mood,
          markdownContent: resolvedMd,
          aiInsights: synthesized.aiInsights ?? entry.aiInsights,
          todos: resolvedTodos,
          ...(finalImages !== undefined && { images: finalImages })
        };
        MockDataService.updateEntry(entry.id, updates);
        setEntry({ ...entry, ...updates });
        triggerRealtimeSyncIfEnabled(settings);
        showToast(t('regen_success'), 'success', 2000);
      } else {
        const newEntry: WingEntry = {
          id: crypto.randomUUID(),
          title: synthesized.title ?? t('untitled'),
          summary: synthesized.summary ?? '',
          mood: synthesized.mood ?? '🌿',
          markdownContent: resolvedMd,
          aiInsights: synthesized.aiInsights ?? '',
          todos: resolvedTodos,
          /** 与当日聊天/会话日期一致，不采用重新生成的操作时间 */
          createdAt: entry.createdAt,
          images: Object.keys(images).length > 0 ? images : entry.images
        };
        MockDataService.saveEntry(newEntry);
        if (session) {
          session.finalEntryId = newEntry.id;
          MockDataService.saveSession(session);
        }
        triggerRealtimeSyncIfEnabled(settings);
        showToast(t('regen_success'), 'success', 2000);
        navigate(`/journal/${newEntry.id}`);
      }
    } catch (err) {
      console.error('Regenerate failed:', err);
      if ((err as { code?: string })?.code === 'QUOTA_EXCEEDED') {
        showToast(t('storage_quota_exceeded'), 'error');
        return;
      }
      let msg = t('regen_failed');
      if (err instanceof AiAPIError) {
        if (err.code === 'MISSING_API_KEY') msg = t('api_key_missing');
        else if (err.code === 'NETWORK_ERROR') msg = t('network_error');
        else if (err.code === 'EMPTY_FRAGMENTS') msg = t('no_fragments');
        else msg = err.message || msg;
      }
      showToast(msg, 'error');
    } finally {
      setIsRegenerating(false);
    }
  };

  /** 复制日记为纯文本（标题、日期、正文、洞察）到剪贴板 */
  const doCopy = () => {
    if (!entry) return;
    const dateStr = new Date(entry.createdAt).toLocaleDateString(settings.language === 'en' ? 'en-US' : 'zh-CN', {
      weekday: 'long',
      month: 'long',
      day: 'numeric'
    });
    const text = `# ${entry.title}\n\n${dateStr}\n\n${entry.markdownContent}\n\n---\n${t('owl_insight')}: ${entry.aiInsights}`;
    navigator.clipboard
      .writeText(text)
      .then(() => showToast(t('copy_success'), 'success', 2000))
      .catch(() => showToast(t('copy_failed'), 'error'));
  };

  /** 根据当前日记另存为新副本：标题加「-副本」，不继承编辑历史 */
  const doCopyAsNew = () => {
    if (!entry) return;
    const newEntry: WingEntry = {
      id: crypto.randomUUID(),
      title: `${entry.title}${t('copy_title_suffix')}`,
      summary: entry.summary,
      mood: entry.mood,
      markdownContent: entry.markdownContent,
      aiInsights: entry.aiInsights,
      todos: entry.todos ? [...entry.todos] : [],
      createdAt: Date.now(),
      images: entry.images ? { ...entry.images } : undefined
    };
    try {
      MockDataService.saveEntry(newEntry);
      triggerRealtimeSyncIfEnabled(settings);
      showToast(t('copy_as_new_success'), 'success', 2000);
      navigate(`/journal/${newEntry.id}`);
    } catch (e) {
      if ((e as { code?: string })?.code === 'QUOTA_EXCEEDED') {
        showToast(t('storage_quota_exceeded'), 'error');
      } else throw e;
    }
  };

  /** 删除日记并返回列表（由删除确认弹窗触发） */
  const doDelete = () => {
    if (!entry) return;
    MockDataService.deleteEntry(entry.id);
    triggerRealtimeSyncIfEnabled(settings);
    navigate('/journal');
    showToast(t('delete_success'), 'success', 2000);
  };

  /**
   * 生成长图：将日记完整内容渲染到离屏节点，用 html2canvas 导出为 PNG 并下载
   */
  const doShare = () => {
    if (!entry) return;
    setIsSharing(true);
    setTimeout(() => {
      const el = shareCardRef.current;
      if (!el) {
        setIsSharing(false);
        showToast(t('share_failed'), 'error');
        return;
      }
      html2canvas(el, { scale: 2, backgroundColor: '#FAF9F4', logging: false })
        .then((canvas) => {
          const name = `Wing-${(entry.title || 'journal').replace(/[\\/:*?"<>|\s]/g, '-').slice(0, 40)}-${getLocalDateString(new Date(entry.createdAt))}.png`;
          const a = document.createElement('a');
          a.href = canvas.toDataURL('image/png');
          a.download = name;
          a.click();
          showToast(t('share_success'), 'success', 2000);
        })
        .catch(() => showToast(t('share_failed'), 'error'))
        .finally(() => setIsSharing(false));
    }, 600);
  };

  if (!entry) {
    return (
      <div className="min-h-screen bg-twilight-cream dark:bg-nocturnal-bg flex items-center justify-center">
        <div className="text-center">
          <p className="text-twilight-warm dark:text-nocturnal-primary text-lg mb-4">{t('entry_not_found')}</p>
          <button
            onClick={() => navigate('/journal')}
            className="text-twilight-amber dark:text-nocturnal-accent hover:text-twilight-amberMuted dark:hover:text-nocturnal-accent/80 underline"
          >
            {t('go_home')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-twilight-bg dark:bg-nocturnal-bg min-h-screen">
      <header className="sticky top-0 z-50 glass px-4 py-3 flex items-center justify-between h-[4.125rem]">
        <button onClick={() => navigate(-1)} className="p-2 text-twilight-duskLight dark:text-nocturnal-secondary hover:text-twilight-amber dark:hover:text-nocturnal-accent hover:bg-twilight-cream dark:hover:bg-nocturnal-surface/60 rounded-full transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-1">
          {isEditing && (
            <>
              <button
                onClick={saveEdit}
                className="px-3 py-1.5 text-sm font-medium text-twilight-amber dark:text-nocturnal-accent hover:bg-twilight-amber/10 dark:hover:bg-nocturnal-accent/20 rounded-full"
              >
                {t('save')}
              </button>
              <button
                onClick={cancelEdit}
                className="px-3 py-1.5 text-sm text-twilight-duskLight dark:text-nocturnal-secondary hover:text-twilight-amber dark:hover:text-nocturnal-accent hover:bg-twilight-cream dark:hover:bg-nocturnal-surface/60 rounded-full transition-colors"
              >
                {t('cancel')}
              </button>
            </>
          )}
          <button
            onClick={doShare}
            disabled={isSharing}
            className="p-2 text-twilight-duskLight dark:text-nocturnal-secondary hover:text-twilight-amber dark:hover:text-nocturnal-accent hover:bg-twilight-cream dark:hover:bg-nocturnal-surface/60 rounded-full disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-twilight-duskLight dark:disabled:hover:text-nocturnal-secondary transition-colors"
            title={t('share_image')}
            aria-label={t('share_image')}
          >
            {isSharing ? <Loader2 size={18} className="animate-spin" /> : <Share size={18} />}
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMoreMenu((v) => !v)}
              className="p-2 text-twilight-duskLight dark:text-nocturnal-secondary hover:text-twilight-amber dark:hover:text-nocturnal-accent hover:bg-twilight-cream dark:hover:bg-nocturnal-surface/60 rounded-full transition-colors"
              title={t('more_options')}
              aria-label={t('more_options')}
              aria-expanded={showMoreMenu}
              aria-haspopup="true"
            >
              <MoreHorizontal size={18} />
            </button>
            {showMoreMenu && (
              <>
                <div
                  className="fixed inset-0 z-[55]"
                  aria-hidden
                  onClick={() => setShowMoreMenu(false)}
                />
                <div
                  className="absolute right-0 top-full mt-1 z-[60] min-w-[200px] bg-twilight-cream dark:bg-nocturnal-surface rounded-xl shadow-lg border border-twilight-divider dark:border-nocturnal-secondary/25 py-1"
                  role="menu"
                >
                  <button
                    role="menuitem"
                    onClick={() => { setShowMoreMenu(false); startEdit(); }}
                    disabled={isEditing}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-twilight-charcoal dark:text-nocturnal-primary hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/60 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    <Pencil size={16} />
                    {t('edit_entry')}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setShowMoreMenu(false); setShowRegenModal(true); }}
                    disabled={isRegenerating}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-twilight-charcoal dark:text-nocturnal-primary hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/60 disabled:opacity-50 disabled:cursor-not-allowed text-left"
                  >
                    {isRegenerating ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
                    {t('regen_menu')}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setShowMoreMenu(false); doCopyAsNew(); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-twilight-charcoal dark:text-nocturnal-primary hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/60 text-left"
                  >
                    <Copy size={16} />
                    {t('copy_as_new')}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setShowMoreMenu(false); doCopy(); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-twilight-charcoal dark:text-nocturnal-primary hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/60 text-left"
                  >
                    <Clipboard size={16} />
                    {t('copy_to_clipboard')}
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => { setShowMoreMenu(false); navigate(`/?date=${getLocalDateString(new Date(entry.createdAt))}`); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-twilight-charcoal dark:text-nocturnal-primary hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/60 text-left"
                  >
                    <MessageSquare size={16} />
                    {t('view_day_records')}
                  </button>
                  <div className="border-t border-twilight-divider dark:border-nocturnal-secondary/25 my-1" />
                  <button
                    role="menuitem"
                    onClick={() => { setShowMoreMenu(false); setShowDeleteModal(true); }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 text-left"
                  >
                    <Trash2 size={16} />
                    {t('delete_entry')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      {showRegenModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20" onClick={() => setShowRegenModal(false)}>
          <div
            className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-twilight-divider dark:border-nocturnal-secondary/20"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="serif text-xl font-semibold text-twilight-charcoal dark:text-nocturnal-primary mb-2">{t('regenerate_modal_title')}</h3>
            <p className="text-twilight-warm dark:text-nocturnal-secondary text-sm mb-4">{t('regenerate_modal_desc')}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setShowRegenModal(false); doRegenerate('overwrite'); }}
                className="w-full py-3 px-4 bg-twilight-charcoal dark:bg-nocturnal-accent text-twilight-amberMuted dark:text-nocturnal-bg rounded-xl font-medium hover:bg-twilight-dusk dark:hover:bg-nocturnal-accent/90 transition-colors"
              >
                {t('regenerate_overwrite')}
              </button>
              <button
                onClick={() => { setShowRegenModal(false); doRegenerate('newVersion'); }}
                className="w-full py-3 px-4 bg-twilight-cream/80 dark:bg-nocturnal-bg/80 text-twilight-charcoal dark:text-nocturnal-primary rounded-xl font-medium hover:bg-twilight-amber/15 dark:hover:bg-nocturnal-surface transition-colors border border-twilight-divider dark:border-nocturnal-secondary/25"
              >
                {t('regenerate_new_version')}
              </button>
              <button
                onClick={() => setShowRegenModal(false)}
                className="w-full py-2 text-twilight-duskLight dark:text-nocturnal-secondary text-sm hover:text-twilight-warm dark:hover:text-nocturnal-primary"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/20" onClick={() => setShowDeleteModal(false)}>
          <div
            className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-6 max-w-sm w-full mx-4 shadow-xl border border-twilight-divider dark:border-nocturnal-secondary/20"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-900/40 flex items-center justify-center">
                <Trash2 size={20} className="text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="serif text-xl font-semibold text-twilight-charcoal dark:text-nocturnal-primary">{t('delete_modal_title')}</h3>
            </div>
            <p className="text-twilight-warm dark:text-nocturnal-secondary text-sm mb-4">{t('delete_confirm')}</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => { setShowDeleteModal(false); doDelete(); }}
                className="w-full py-3 px-4 bg-rose-600 text-white rounded-xl font-medium hover:bg-rose-700 transition-colors"
              >
                {t('delete_confirm_btn')}
              </button>
              <button
                onClick={() => setShowDeleteModal(false)}
                className="w-full py-2 text-twilight-duskLight dark:text-nocturnal-secondary text-sm hover:text-twilight-warm dark:hover:text-nocturnal-primary"
              >
                {t('cancel')}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="px-8 pt-6 pb-12 space-y-4">
        {isMoodEmoji(entry.mood) ? <span className="text-5xl block mb-2">{entry.mood}</span> : null}
        {isEditing ? (
          <input
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder={entry.title}
            className="serif w-full text-4xl font-bold text-twilight-charcoal dark:text-nocturnal-primary bg-twilight-cream/50 dark:bg-nocturnal-surface/60 border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/40"
          />
        ) : (
          <h1 className="serif text-4xl font-bold text-twilight-charcoal dark:text-nocturnal-primary leading-tight">
            {entry.title}
          </h1>
        )}
        <p className="text-twilight-duskLight dark:text-nocturnal-accent text-sm uppercase tracking-widest">
          {new Date(entry.createdAt).toLocaleDateString(settings.language === 'en' ? 'en-US' : 'zh-CN', {
            weekday: 'long',
            month: 'long',
            day: 'numeric'
          })}
          {entry.editedAt != null && (
            <span className="ml-2 text-twilight-duskLight dark:text-nocturnal-secondary normal-case tracking-normal">
              · {t('edited')} {new Date(entry.editedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </p>
      </div>

      <div className="px-8 pb-12">
        {isEditing ? (
          <textarea
            value={editMarkdown}
            onChange={(e) => setEditMarkdown(e.target.value)}
            placeholder={entry.markdownContent}
            className="w-full min-h-[320px] bg-twilight-cream/50 dark:bg-nocturnal-surface/60 border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl px-4 py-3 font-sans text-twilight-charcoal dark:text-nocturnal-primary leading-relaxed focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/40 resize-y"
            spellCheck
          />
        ) : (
          <MarkdownRenderer content={entry.markdownContent} entry={entry} sessionImageFragments={sessionImageFragments} />
        )}
      </div>

      <div className="px-8 mb-12">
        <div className="flex items-center justify-between mb-6">
          <h2 className="serif text-xl font-bold text-twilight-charcoal dark:text-nocturnal-primary flex items-center gap-2">
            <Infinity size={20} className="text-twilight-amber dark:text-nocturnal-accent flex-shrink-0" />
            {t('owl_insight')}
          </h2>
          <button
            onClick={doRegenerateInsight}
            disabled={isRegeneratingInsight}
            className="p-2 text-twilight-duskLight dark:text-nocturnal-secondary hover:text-twilight-amber dark:hover:text-nocturnal-accent rounded-full hover:bg-twilight-cream/60 dark:hover:bg-nocturnal-surface/60 transition-colors disabled:opacity-50"
            title={t('regen_insight')}
            aria-label={t('regen_insight')}
          >
            {isRegeneratingInsight ? <Loader2 size={16} className="animate-spin" /> : <RotateCw size={16} />}
          </button>
        </div>
        <div className="flex items-center gap-4 bg-twilight-cream/40 dark:bg-nocturnal-surface/50 p-4 rounded-2xl border border-twilight-divider dark:border-nocturnal-secondary/20">
          <p className="serif italic text-base text-twilight-charcoal dark:text-nocturnal-primary leading-relaxed flex-1">
            "{entry.aiInsights}"
          </p>
        </div>
      </div>

      {entry.todos.length > 0 && (
        <div className="px-8 pb-8">
          <div className="flex items-center justify-between mb-6">
<h2 className="serif text-xl font-bold text-twilight-charcoal dark:text-nocturnal-primary flex items-center gap-2">
            <Bell className="text-twilight-amber dark:text-nocturnal-accent" size={20} />
            {t('tasks_captured')}
          </h2>
            <span className="text-xs bg-twilight-cream/80 dark:bg-nocturnal-surface/80 text-twilight-duskLight dark:text-nocturnal-secondary px-3 py-1 rounded-full border border-twilight-divider dark:border-nocturnal-secondary/25">
              {t('synced_reminders')}
            </span>
          </div>
          <div className="space-y-3">
            {entry.todos.map((todo, i) => (
              <div key={i} className="flex items-center gap-4 bg-twilight-cream/40 dark:bg-nocturnal-surface/50 p-4 rounded-2xl border border-twilight-divider dark:border-nocturnal-secondary/20">
                <CheckCircle className="text-twilight-duskLight dark:text-nocturnal-secondary" size={20} />
                <div className="flex-1">
                  <p className="font-medium text-twilight-charcoal dark:text-nocturnal-primary">{todo.title}</p>
                  <span className={`text-[10px] uppercase font-bold tracking-tighter ${
                    todo.priority === 'high' ? 'text-rose-500 dark:text-rose-400' : 
                    todo.priority === 'medium' ? 'text-amber-500 dark:text-amber-400' : 'text-twilight-duskLight dark:text-nocturnal-secondary'
                  }`}>
                    {todo.priority} priority
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {(entry.editHistory?.length ?? 0) > 0 && (
        <div className="px-8 pb-20">
          <button
            onClick={() => setShowHistory((v) => !v)}
            className="flex items-center gap-2 text-twilight-duskLight dark:text-nocturnal-secondary hover:text-twilight-warm dark:hover:text-nocturnal-primary transition-colors"
          >
            <History size={18} />
            <span className="text-sm font-medium">
              {t('edit_history')} ({entry.editHistory!.length})
            </span>
          </button>
          {showHistory && (
            <div className="mt-3 space-y-2">
              {([...(entry.editHistory ?? [])].reverse()).map((hist, i) => (
                <div
                  key={hist.createdAt}
                  className="flex items-center justify-between gap-4 bg-twilight-cream/40 dark:bg-nocturnal-surface/50 p-3 rounded-xl border border-twilight-divider dark:border-nocturnal-secondary/20"
                >
                  <span className="text-xs text-twilight-duskLight dark:text-nocturnal-secondary">
                    {new Date(hist.createdAt).toLocaleDateString(settings.language === 'en' ? 'en-US' : 'zh-CN', {
                      dateStyle: 'medium'
                    })}{' '}
                    {new Date(hist.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <button
                    onClick={() => restoreVersion(hist)}
                    className="text-xs font-medium text-twilight-amber dark:text-nocturnal-accent hover:underline"
                  >
                    {t('restore_version')}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {isSharing && entry && (
        <div
          ref={shareCardRef}
          style={{ position: 'fixed', left: '-9999px', top: 0, width: 600 }}
          className="bg-twilight-bg p-8 box-border"
          aria-hidden
        >
          <div className="pb-6">
            {isMoodEmoji(entry.mood) ? <span className="text-5xl block mb-2">{entry.mood}</span> : null}
            <h1 className="serif text-4xl font-bold text-twilight-charcoal leading-tight">{entry.title}</h1>
            <p className="text-twilight-duskLight text-sm uppercase tracking-widest mt-2">
              {new Date(entry.createdAt).toLocaleDateString(settings.language === 'en' ? 'en-US' : 'zh-CN', { weekday: 'long', month: 'long', day: 'numeric' })}
              {entry.editedAt != null && (
                <span className="ml-2 normal-case tracking-normal">· {t('edited')} {new Date(entry.editedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </p>
          </div>
          <div className="pb-8">
            <MarkdownRenderer content={entry.markdownContent} entry={entry} sessionImageFragments={sessionImageFragments} />
          </div>
          <div className="mb-8">
            <h2 className="serif text-xl font-bold text-twilight-charcoal flex items-center gap-2 mb-4">
              <Infinity size={20} className="text-twilight-amber flex-shrink-0" />
              {t('owl_insight')}
            </h2>
            <div className="flex items-center gap-4 bg-twilight-cream/40 p-4 rounded-2xl border border-twilight-divider">
              <p className="serif italic text-base text-twilight-charcoal leading-relaxed flex-1">"{entry.aiInsights}"</p>
            </div>
          </div>
          {(entry.todos?.length ?? 0) > 0 && (
            <div>
              <h2 className="serif text-xl font-bold text-twilight-charcoal flex items-center gap-2 mb-4">
                <Bell className="text-twilight-amber" size={20} />
                {t('tasks_captured')}
              </h2>
              <div className="space-y-3">
                {(entry.todos ?? []).map((todo, i) => (
                  <div key={i} className="flex items-center gap-4 bg-twilight-cream/40 p-4 rounded-2xl border border-twilight-divider">
                    <CheckCircle className="text-twilight-duskLight" size={20} />
                    <div className="flex-1">
                      <p className="font-medium text-twilight-charcoal">{todo.title}</p>
                      <span className={`text-[10px] uppercase font-bold tracking-tighter ${todo.priority === 'high' ? 'text-rose-500' : todo.priority === 'medium' ? 'text-amber-500' : 'text-twilight-duskLight'}`}>
                        {todo.priority} priority
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <ToastContainer />
    </div>
  );
};

export default JournalDetail;
