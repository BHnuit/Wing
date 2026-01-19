
import React, { useState, useEffect, useRef } from 'react';
import { Send, CheckCircle2, Image as ImageIcon, Loader2, Pencil, ChevronLeft, ChevronRight, Infinity } from 'lucide-react';
import { EmptyStateOwl, LoadingOwl, OwlLogo } from './OwlAssets';
import { MockDataService } from '../services/mockDataService';
import { AiService, AiAPIError, getEffectiveApiKey, getModelResponseLanguage } from '../services/aiService';
import { triggerRealtimeSyncIfEnabled } from '../services/webdavService';
import { DailySession, RawFragment, SessionStatus, WingEntry, FragmentType } from '../types';
import { useSearchParams, Link } from 'react-router-dom';
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
  /** 底部输入框是否获得焦点：未聚焦时仅显示占位语、3 行高；聚焦时 5 行高并显示添加图片与发送按钮 */
  const [inputFocused, setInputFocused] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  /** 长按发送键 2 秒后进入收拢模式，按钮显示 ♾️，再次点击触发收拢 */
  const [infinityMode, setInfinityMode] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 长按进入 ♾️ 后的首次点击忽略，避免「松开即触发」 */
  const infinityModeJustEnteredRef = useRef(false);
  /** 记录最后一次指针类型，用于区分触屏长按与鼠标连点 */
  const lastPointerTypeRef = useRef<string>('mouse');
  /** 鼠标模式下连点三次进入收拢：点击次数与时间窗 */
  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  /** 当前处于编辑状态的片段 id */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** 编辑中的文案（仅当 editingId 非空时有效） */
  const [editDraft, setEditDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { showToast, ToastContainer } = useToast();

  useEffect(() => {
    setSession(MockDataService.getSessionByDate(viewDate) ?? null);
  }, [viewDate]);

  /** 有输入时退出收拢模式，按钮变回发送按钮 */
  useEffect(() => {
    if (input.trim()) setInfinityMode(false);
  }, [input]);

  /** 点击文本框外任意区域：退出收拢模式，按钮重新变灰；文本框高度由 onBlur 恢复 */
  useEffect(() => {
    const handlePointerOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (target != null && inputContainerRef.current && !inputContainerRef.current.contains(target)) {
        setInfinityMode(false);
      }
    };
    document.addEventListener('mousedown', handlePointerOutside);
    document.addEventListener('touchstart', handlePointerOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerOutside);
      document.removeEventListener('touchstart', handlePointerOutside);
    };
  }, []);

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
      if ((error as { code?: string })?.code === 'QUOTA_EXCEEDED') {
        showToast(t('storage_quota_exceeded'), 'error');
        return;
      }
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
    if (!getEffectiveApiKey(settings)) {
      showToast(t('api_key_missing'), 'error');
      return;
    }
    setInfinityMode(false);
    /** 本次触发收拢的时间写入当日会话，再次生成会追加 */
    const next = { ...session, gatherStartedAt: [...(session.gatherStartedAt ?? []), Date.now()] };
    MockDataService.saveSession(next);
    setSession(MockDataService.getSessionByDate(viewDate)!);
    triggerRealtimeSyncIfEnabled(settings);
    setIsSynthesizing(true);
    try {
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
            generatedAt: Date.now(),
            ...(finalImages !== undefined && { images: finalImages })
          };
          MockDataService.updateEntry(entry.id, updates);
          triggerRealtimeSyncIfEnabled(settings);
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
        generatedAt: Date.now(),
        images: Object.keys(images).length > 0 ? images : undefined
      };

      MockDataService.saveEntry(newEntry);
      const updatedSession = { ...session, status: SessionStatus.COMPLETED, finalEntryId: newEntry.id };
      MockDataService.saveSession(updatedSession);
      setSession(MockDataService.getSessionByDate(viewDate)!);
      triggerRealtimeSyncIfEnabled(settings);
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

  /** 从当日会话与日记数据推导猫头鹰生成消息，不随日期切换清空 */
  const owlGeneratedEntry =
    session?.status === SessionStatus.COMPLETED && session.finalEntryId
      ? (() => {
          const e = MockDataService.getEntryById(session.finalEntryId!);
          return e ? { id: e.id, title: e.title, generatedAt: e.generatedAt ?? e.createdAt } : null;
        })()
      : null;

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
        {(session?.gatherStartedAt ?? []).map((ts, i) => (
          <p key={`gather-${ts}-${i}`} className="text-xs text-twilight-duskLight dark:text-nocturnal-secondary text-center py-2">
            {formatTime(ts)} {t('gathering_started')}
          </p>
        ))}
        {owlGeneratedEntry && (
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2 max-w-[85%]">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-twilight-cream dark:bg-nocturnal-surface border border-twilight-divider dark:border-nocturnal-secondary/25 flex items-center justify-center overflow-hidden">
                <OwlLogo size={20} className="dark:invert" />
              </div>
              <div className="bg-twilight-cream dark:bg-nocturnal-surface border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl rounded-tl-none px-4 py-3 shadow-sm">
                <p className="text-sm text-twilight-charcoal dark:text-nocturnal-primary">
                  {viewDate === today ? t('owl_diary_generated_today') : t('owl_diary_generated_that_day')}
                  《<Link to={`/journal/${owlGeneratedEntry.id}`} className="text-twilight-amber dark:text-nocturnal-accent font-medium hover:underline">{owlGeneratedEntry.title}</Link>》
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <div className="w-8 flex-shrink-0" aria-hidden="true" />
              <span className="text-[10px] text-twilight-duskLight dark:text-nocturnal-secondary">
                {formatTime(owlGeneratedEntry.generatedAt)}
              </span>
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* 占位：避免最后一条内容被固定消息栏遮挡 */}
      <div className="h-24 flex-shrink-0" aria-hidden="true" />

      <div className="fixed bottom-[3.75rem] left-1/2 -translate-x-1/2 w-full max-w-2xl z-40 px-4 py-3">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
        />
        <div ref={inputContainerRef} className="w-full flex flex-col bg-white dark:bg-nocturnal-surface rounded-2xl overflow-hidden border border-twilight-divider/60 dark:border-nocturnal-secondary/25 focus-within:ring-2 focus-within:ring-twilight-amber/25 dark:focus-within:ring-nocturnal-accent/40 focus-within:ring-inset min-h-0">
          <div className="relative flex-1 flex min-h-0">
            <textarea
              rows={inputFocused ? 5 : 3}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={t('mind_placeholder')}
              className="w-full bg-transparent border-none resize-none outline-none focus:ring-0 text-twilight-charcoal dark:text-nocturnal-primary px-4 pt-3 pb-2 pr-11 max-h-40 placeholder:text-twilight-duskLight placeholder:dark:text-nocturnal-secondary"
            />
            <div className={`absolute top-3 right-3 transition-all duration-300 ${showSuccess ? 'scale-110 opacity-100' : 'scale-50 opacity-0'}`} aria-hidden="true">
              <CheckCircle2 className="text-green-500" size={20} />
            </div>
          </div>
          {(inputFocused || fragments.length > 0) && (
            <div className="flex justify-between items-center px-3 pb-2 pt-0">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-2 text-twilight-duskLight hover:text-twilight-amber hover:bg-twilight-cream/50 dark:text-nocturnal-secondary dark:hover:text-nocturnal-accent dark:hover:bg-nocturnal-bg/50 rounded-lg transition-colors"
                title={t('add_image')}
                aria-label={t('add_image')}
              >
                <ImageIcon size={20} />
              </button>
              <button
                type="button"
                disabled={isSynthesizing}
                onClick={
                  isSynthesizing
                    ? undefined
                    : infinityMode
                      ? () => {
                          if (infinityModeJustEnteredRef.current) {
                            infinityModeJustEnteredRef.current = false;
                            return;
                          }
                          handleSynthesize();
                        }
                      : input.trim()
                        ? handleSend
                        : () => {
                            /** 灰色按钮：仅鼠标模式下连点三次进入收拢；触屏用长按，此处不处理 */
                            if (lastPointerTypeRef.current !== 'mouse') return;
                            const now = Date.now();
                            if (now - lastClickTimeRef.current > 500) clickCountRef.current = 0;
                            clickCountRef.current += 1;
                            lastClickTimeRef.current = now;
                            if (clickCountRef.current >= 3) {
                              clickCountRef.current = 0;
                              setInfinityMode(true);
                            }
                          }
                }
                onPointerDown={(e) => {
                  lastPointerTypeRef.current = e.pointerType ?? 'mouse';
                  /** 灰色按钮时阻止焦点移开文本框，避免折叠导致无法连点（鼠标）或长按被中断（触屏） */
                  if (!input.trim() && !infinityMode && !isSynthesizing) {
                    e.preventDefault();
                  }
                  /** 仅触屏长按 1 秒进入收拢；鼠标用连点三次 */
                  if (!input.trim() && !infinityMode && !isSynthesizing && (e.pointerType === 'touch' || e.pointerType === 'pen')) {
                    longPressTimerRef.current = setTimeout(() => {
                      longPressTimerRef.current = null;
                      setInfinityMode(true);
                      infinityModeJustEnteredRef.current = true;
                    }, 1000);
                  }
                }}
                onPointerUp={() => {
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                onPointerLeave={() => {
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                onPointerCancel={() => {
                  if (longPressTimerRef.current) {
                    clearTimeout(longPressTimerRef.current);
                    longPressTimerRef.current = null;
                  }
                }}
                className={`p-2 rounded-lg transition-all active:scale-95 ${
                  isSynthesizing
                    ? 'bg-twilight-dusk/20 dark:bg-nocturnal-secondary/30 text-twilight-duskLight dark:text-nocturnal-secondary cursor-not-allowed'
                    : !input.trim() && !infinityMode
                      ? 'bg-twilight-dusk/20 dark:bg-nocturnal-secondary/30 text-twilight-duskLight dark:text-nocturnal-secondary'
                      : 'bg-twilight-amber dark:bg-nocturnal-accent text-white hover:bg-twilight-amberMuted dark:hover:bg-nocturnal-accent/90'
                }`}
              >
                {isSynthesizing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : infinityMode ? (
                  <Infinity size={18} />
                ) : (
                  <Send size={18} />
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Toast 容器 */}
      <ToastContainer />
    </div>
  );
};

export default ChatView;
