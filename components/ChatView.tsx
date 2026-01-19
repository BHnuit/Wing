
import React, { useState, useEffect, useRef } from 'react';
import { Send, CheckCircle2, Image as ImageIcon, Loader2, Pencil, ChevronLeft, ChevronRight, Feather } from 'lucide-react';
import { EmptyStateOwl, LoadingOwl } from './OwlAssets';
import { MockDataService } from '../services/mockDataService';
import { AiService, AiAPIError, getEffectiveApiKey, getModelResponseLanguage } from '../services/aiService';
import { triggerRealtimeSyncIfEnabled } from '../services/webdavService';
import { DailySession, RawFragment, SessionStatus, WingEntry, FragmentType } from '../types';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from '../i18n';
import { useToast } from './ErrorToast';
import { getLocalDateString } from '../utils/date';
import { convertImageToBase64 } from '../utils/imageToBase64';

/** 格式化为 HH:mm */
const formatTime = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** 校验 YYYY-MM-DD，无效则返回 todayFallback（本地日历日） */
function toValidDate(dateStr: string | null, todayFallback: string): string {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return todayFallback;
  const d = new Date(dateStr + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return todayFallback;
  return dateStr;
}

const ChatView: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [today, setToday] = useState(() => getLocalDateString());
  const viewDate = toValidDate(searchParams.get('date'), today);

  const [session, setSession] = useState<DailySession | null>(() => MockDataService.getSessionByDate(viewDate) ?? null);
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  const [input, setInput] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  /** 当前处于编辑状态的片段 id */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** 编辑中的文案（仅当 editingId 非空时有效） */
  const [editDraft, setEditDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { showToast, ToastContainer } = useToast();

  useEffect(() => {
    setSession(MockDataService.getSessionByDate(viewDate) ?? null);
  }, [viewDate]);

  /** 随系统日期更新 today：每分钟检查一次，且切回标签页时检查，跨日或重开 App 后能正确显示「今天」 */
  useEffect(() => {
    const tick = () => setToday((prev) => {
      const next = getLocalDateString();
      return next !== prev ? next : prev;
    });
    const id = setInterval(tick, 60_000);
    const onVis = () => { if (document.visibilityState === 'visible') tick(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
  }, []);

  useEffect(() => {
    const handleSettingsUpdate = () => setSettings(MockDataService.getSettings());
    window.addEventListener('wing_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('wing_settings_updated', handleSettingsUpdate);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.fragments]);

  /**
   * 处理图片选择。
   * 兼容微信等移动端：放宽 file.type 校验（当 type 为空时按扩展名放行），
   * base64 转换使用 utils/imageToBase64（FileReader 超时后降级为 Canvas）。
   */
  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // 检查文件类型：微信等环境下 file.type 可能为空，按扩展名放行
    const isImage =
      file.type.startsWith('image/') ||
      /\.(jpe?g|png|gif|webp|heic)$/i.test(file.name || '');
    if (!isImage) {
      showToast(t('invalid_image'), 'error');
      return;
    }

    // 检查文件大小（限制为5MB）
    if (file.size > 5 * 1024 * 1024) {
      showToast(t('image_too_large'), 'error');
      return;
    }

    try {
      const base64 = await convertImageToBase64(file);
      const s = session ?? MockDataService.getOrCreateSessionByDate(viewDate);
      const fragment = MockDataService.addFragment(
        s.id,
        file.name || t('image_placeholder'),
        FragmentType.IMAGE,
        base64
      );
      if (fragment) {
        setSession(MockDataService.getSessionByDate(viewDate)!);
        triggerRealtimeSyncIfEnabled(settings);
        setShowSuccess(true);
        if ('vibrate' in navigator) navigator.vibrate(50);
        setTimeout(() => setShowSuccess(false), 1500);
      }
    } catch (error) {
      console.error('Failed to process image:', error);
      const isHeic =
        /\.heic$/i.test(file.name || '') ||
        (file.type || '').toLowerCase().includes('heic');
      showToast(isHeic ? t('image_process_failed_heic') : t('image_process_failed'), 'error');
    }

    // 重置文件输入
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;
    const s = session ?? MockDataService.getOrCreateSessionByDate(viewDate);
    MockDataService.addFragment(s.id, input);
    setSession(MockDataService.getSessionByDate(viewDate)!);
    triggerRealtimeSyncIfEnabled(settings);
    setInput('');
    setShowSuccess(true);
    if ('vibrate' in navigator) navigator.vibrate(50);
    setTimeout(() => setShowSuccess(false), 1500);
  };

  /** 进入编辑：历史记录也支持编辑（含已合成当日） */
  const startEdit = (fragment: RawFragment) => {
    if (!session) return;
    setEditingId(fragment.id);
    setEditDraft(fragment.content);
  };

  /** 保存编辑 */
  const saveEdit = () => {
    if (!session || !editingId || editDraft === undefined) return;
    const frag = session.fragments.find(f => f.id === editingId);
    if (!frag) return;
    if (frag.type === FragmentType.TEXT && !editDraft.trim()) return;
    MockDataService.updateFragment(session.id, editingId, editDraft);
    setSession(MockDataService.getSessionByDate(viewDate)!);
    triggerRealtimeSyncIfEnabled(settings);
    setEditingId(null);
  };

  /** 取消编辑 */
  const cancelEdit = () => {
    setEditingId(null);
  };

  const handleSynthesize = async () => {
    if (!session || session.fragments.length === 0) {
      showToast(t('no_fragments'), 'warning');
      return;
    }

    setIsSynthesizing(true);
    try {
      if (!getEffectiveApiKey(settings)) {
        showToast(t('api_key_missing'), 'error');
        setIsSynthesizing(false);
        return;
      }

      /** 再次收拢：当日已有日记则覆盖该日记 */
      if (session.status === SessionStatus.COMPLETED && session.finalEntryId) {
        const entry = MockDataService.getEntryById(session.finalEntryId);
        if (entry) {
          const previousGeneration = entry.markdownContent;
          const synthesized = await AiService.synthesizeJournal(
            session.fragments,
            getModelResponseLanguage(settings),
            settings,
            2,
            previousGeneration
          );
          const images: { [key: string]: string } = {};
          session.fragments.forEach((f) => {
            if (f.type === FragmentType.IMAGE && f.imageData) images[f.id] = f.imageData;
          });
          const finalImages = Object.keys(images).length > 0 ? images : (session.fragments.length > 0 ? undefined : entry.images);
          const resolvedMd = (synthesized.markdownContent != null && String(synthesized.markdownContent).trim() !== '')
            ? synthesized.markdownContent
            : entry.markdownContent;
          const resolvedTodos = (synthesized.todos && synthesized.todos.length > 0) ? synthesized.todos : (entry.todos || []);

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
          triggerRealtimeSyncIfEnabled(settings);
          showToast(t('regen_success'), 'success', 2000);
          setTimeout(() => navigate(`/journal/${entry.id}`), 500);
          return;
        }
      }

      /** 首次收拢：新建日记 */
      const synthesizedData = await AiService.synthesizeJournal(session.fragments, getModelResponseLanguage(settings), settings);

      const images: { [key: string]: string } = {};
      session.fragments.forEach((f) => {
        if (f.type === FragmentType.IMAGE && f.imageData) images[f.id] = f.imageData;
      });

      const newEntry: WingEntry = {
        id: crypto.randomUUID(),
        title: synthesizedData.title || t('untitled'),
        summary: synthesizedData.summary || '',
        mood: synthesizedData.mood || '🌿',
        markdownContent: synthesizedData.markdownContent || '',
        aiInsights: synthesizedData.aiInsights || '',
        todos: synthesizedData.todos || [],
        createdAt: new Date(viewDate + 'T12:00:00').getTime(),
        images: Object.keys(images).length > 0 ? images : undefined
      };

      MockDataService.saveEntry(newEntry);
      const updatedSession = { ...session, status: SessionStatus.COMPLETED, finalEntryId: newEntry.id };
      MockDataService.saveSession(updatedSession);
      setSession(MockDataService.getSessionByDate(viewDate)!);
      triggerRealtimeSyncIfEnabled(settings);
      showToast(t('synth_success'), 'success', 2000);
      setTimeout(() => navigate(`/journal/${newEntry.id}`), 500);
    } catch (error) {
      console.error('Synthesis failed:', error);
      let errorMessage = t('synth_failed');
      if (error instanceof AiAPIError) {
        switch (error.code) {
          case 'MISSING_API_KEY': errorMessage = t('api_key_missing'); break;
          case 'NETWORK_ERROR': errorMessage = t('network_error'); break;
          case 'EMPTY_FRAGMENTS': errorMessage = t('no_fragments'); break;
          case 'PARSE_ERROR': errorMessage = t('parse_error'); break;
          default: errorMessage = error.message || t('synth_failed');
        }
      }
      showToast(errorMessage, 'error');
    } finally {
      setIsSynthesizing(false);
    }
  };

  const fragments = session?.fragments ?? [];
  const isCompleted = session?.status === SessionStatus.COMPLETED;

  /** 有记录的日期列表（含今天），用于日期选择器；仅在这些日期间切换，空白日期不显示 */
  const datesForPicker = MockDataService.getDatesWithRecordsForPicker();

  /** 当 URL 的 date 为空白日期时，重定向到最近的存在记录的日期，不展示空白日 */
  useEffect(() => {
    const list = MockDataService.getDatesWithRecordsForPicker();
    if (list.length === 0) return;
    if (list.includes(viewDate)) return;
    const beforeOrEq = list.filter((d) => d <= viewDate);
    const target = beforeOrEq.length > 0 ? beforeOrEq[beforeOrEq.length - 1] : list[0];
    setSearchParams({ date: target }, { replace: true });
  }, [viewDate, setSearchParams]);

  const idx = datesForPicker.indexOf(viewDate);
  const prevDate = idx > 0 ? datesForPicker[idx - 1] : null;
  const nextDate = idx >= 0 && idx < datesForPicker.length - 1 ? datesForPicker[idx + 1] : null;
  const canGoPrev = idx > 0;
  const canGoNext = idx >= 0 && idx < datesForPicker.length - 1;

  const dateLabel = viewDate === today
    ? t('record_date_today')
    : new Date(viewDate + 'T12:00:00').toLocaleDateString(settings.language === 'en' ? 'en-US' : 'zh-CN', { month: 'numeric', day: 'numeric', weekday: 'short' });

  return (
    <div className="flex flex-col h-full bg-twilight-bg dark:bg-nocturnal-bg">
      {/* 日期切换：亮色卡片色，暗色 nocturnal surface；日期用 accentPurple */}
      <div className="flex items-center justify-center gap-2 py-3 border-b border-twilight-divider dark:border-nocturnal-secondary/25 bg-twilight-cream dark:bg-nocturnal-surface/80">
        <button
          type="button"
          onClick={() => prevDate && setSearchParams({ date: prevDate })}
          disabled={!canGoPrev}
          className="p-2 text-twilight-duskLight hover:text-twilight-amber hover:bg-twilight-cream dark:text-nocturnal-secondary dark:hover:text-nocturnal-accent dark:hover:bg-nocturnal-surface rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-twilight-duskLight dark:disabled:hover:text-nocturnal-secondary"
          aria-label={prevDate ?? undefined}
        >
          <ChevronLeft size={20} />
        </button>
        <span className="min-w-[7rem] text-center text-sm font-medium text-twilight-warm dark:text-nocturnal-accent">
          {dateLabel}
        </span>
        <button
          type="button"
          onClick={() => nextDate && setSearchParams({ date: nextDate })}
          disabled={!canGoNext}
          className="p-2 text-twilight-duskLight hover:text-twilight-amber hover:bg-twilight-cream dark:text-nocturnal-secondary dark:hover:text-nocturnal-accent dark:hover:bg-nocturnal-surface rounded-full disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-twilight-duskLight dark:disabled:hover:text-nocturnal-secondary transition-colors"
          aria-label={nextDate ?? undefined}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto p-6 space-y-6">
        {fragments.length === 0 ? (
          <div className="h-[60vh] flex flex-col items-center justify-center text-twilight-duskLight dark:text-nocturnal-secondary space-y-4">
            <EmptyStateOwl size={100} />
            <p className="serif italic text-lg text-center px-12">
              {t('empty_chat')}
            </p>
          </div>
        ) : (
          fragments.map((fragment) => {
            const isEditing = editingId === fragment.id;
            const canEdit = !!session;
            const timeLabel = fragment.editedAt
              ? `${t('edited')} ${formatTime(fragment.editedAt)}`
              : formatTime(fragment.timestamp);

            return (
              <div key={fragment.id} className="flex flex-col items-end">
                <div className="max-w-[85%] bg-twilight-cream dark:bg-nocturnal-surface border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl rounded-tr-none shadow-sm overflow-hidden">
                  {fragment.type === FragmentType.IMAGE && fragment.imageData ? (
                    <div className="relative">
                      <img
                        src={fragment.imageData}
                        alt={fragment.content}
                        className="max-w-full h-auto object-cover"
                        style={{ maxHeight: '400px' }}
                      />
                      {isEditing ? (
                        <div className="px-4 py-2 bg-twilight-cream/30 dark:bg-nocturnal-bg/40 border-t border-twilight-divider dark:border-nocturnal-secondary/20">
                          <textarea
                            value={editDraft}
                            onChange={(e) => setEditDraft(e.target.value)}
                            placeholder={t('image_placeholder')}
                            className="w-full text-xs text-twilight-warm dark:text-nocturnal-secondary bg-transparent border-none resize-none focus:outline-none focus:ring-0 min-h-[2rem]"
                            rows={2}
                            autoFocus
                          />
                        </div>
                      ) : (
                        (fragment.content && fragment.content !== t('image_placeholder')) && (
                          <div className="px-4 py-2 bg-twilight-cream/30 dark:bg-nocturnal-bg/40 border-t border-twilight-divider dark:border-nocturnal-secondary/20">
                            <p className="text-xs text-twilight-duskLight dark:text-nocturnal-secondary">{fragment.content}</p>
                          </div>
                        )
                      )}
                    </div>
                  ) : isEditing ? (
                    <div className="px-4 py-3">
                      <textarea
                        value={editDraft}
                        onChange={(e) => setEditDraft(e.target.value)}
                        placeholder={t('mind_placeholder')}
                        className="w-full text-twilight-charcoal dark:text-nocturnal-primary leading-relaxed bg-transparent border-none resize-none focus:outline-none focus:ring-0 min-h-[4rem]"
                        rows={4}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="px-4 py-3">
                      <p className="text-twilight-charcoal dark:text-nocturnal-primary leading-relaxed">{fragment.content}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-1 mr-1">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={saveEdit}
                        disabled={fragment.type === FragmentType.TEXT && !editDraft.trim()}
                        className="text-[10px] text-twilight-amber dark:text-nocturnal-accent font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline"
                      >
                        {t('save')}
                      </button>
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="text-[10px] text-twilight-duskLight dark:text-nocturnal-secondary hover:text-twilight-amber dark:hover:text-nocturnal-accent"
                      >
                        {t('cancel')}
                      </button>
                    </>
                  ) : (
                    <>
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => startEdit(fragment)}
                          className="p-0.5 text-twilight-duskLight dark:text-nocturnal-secondary hover:text-twilight-amber dark:hover:text-nocturnal-accent rounded"
                          title={t('edit')}
                          aria-label={t('edit')}
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                      <span className="text-[10px] text-twilight-duskLight dark:text-nocturnal-secondary">{timeLabel}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={scrollRef} />
      </div>

      {fragments.length > 0 && (
        <div className="px-6 py-4 flex justify-center flex-shrink-0">
          <button 
            onClick={handleSynthesize}
            disabled={isSynthesizing}
            className="flex items-center gap-2 bg-twilight-amber dark:bg-nocturnal-accent text-white px-6 py-3 rounded-full font-medium shadow-lg hover:bg-twilight-amberMuted dark:hover:bg-nocturnal-accent/90 transition-all disabled:opacity-50"
          >
            {isSynthesizing ? (
              <LoadingOwl size={36} stroke="white" className="animate-pulse" />
            ) : (
              <Feather size={20} />
            )}
            <span>
              {isSynthesizing
                ? t('weaving')
                : isCompleted && session?.finalEntryId
                  ? t('synthesize_btn_regather')
                  : viewDate === today
                    ? t('synthesize_btn')
                    : t('synthesize_btn_that_day')}
            </span>
          </button>
        </div>
      )}

      {/* 占位：避免最后一条内容被固定消息栏遮挡 */}
      <div className="h-24 flex-shrink-0" aria-hidden="true" />

      <div className="fixed bottom-[3.75rem] left-1/2 -translate-x-1/2 w-full max-w-2xl z-40 bg-twilight-cream dark:bg-nocturnal-surface/95 backdrop-blur-xl border-t border-twilight-divider dark:border-nocturnal-secondary/25 px-6 py-4">
        <div className="flex items-end gap-3">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleImageSelect}
            accept="image/*"
            className="hidden"
          />
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="p-3 text-twilight-duskLight hover:text-twilight-amber hover:bg-twilight-cream/60 dark:text-nocturnal-secondary dark:hover:text-nocturnal-accent dark:hover:bg-nocturnal-bg/60 rounded-full transition-colors"
            title={t('add_image')}
          >
            <ImageIcon size={22} />
          </button>
          
          <div className="flex-1 relative flex items-center">
            <textarea
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t('mind_placeholder')}
              className="w-full bg-twilight-cream/60 dark:bg-nocturnal-bg/70 dark:text-nocturnal-primary rounded-[24px] px-5 py-3 pr-12 focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/40 resize-none max-h-32 border border-transparent focus:border-twilight-dusk/20 dark:focus:border-nocturnal-accent/30 placeholder:dark:text-nocturnal-secondary"
            />
            <div className={`absolute right-4 transition-all duration-300 ${showSuccess ? 'scale-110 opacity-100' : 'scale-50 opacity-0'}`}>
              <CheckCircle2 className="text-green-500" size={22} />
            </div>
          </div>

          <button 
            onClick={handleSend}
            disabled={!input.trim()}
            className="p-3 bg-twilight-amber dark:bg-nocturnal-accent text-white rounded-full hover:bg-twilight-amberMuted dark:hover:bg-nocturnal-accent/90 disabled:bg-twilight-dusk/20 disabled:dark:bg-nocturnal-secondary/30 disabled:text-twilight-duskLight disabled:dark:text-nocturnal-secondary transition-all shadow-md active:scale-95"
          >
            <Send size={20} />
          </button>
        </div>
      </div>

      {/* Toast 容器 */}
      <ToastContainer />
    </div>
  );
};

export default ChatView;
