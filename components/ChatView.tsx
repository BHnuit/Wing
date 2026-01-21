
import React, { useState, useEffect, useRef, useMemo, useCallback, useLayoutEffect } from 'react';
import { Send, CheckCircle2, Image as ImageIcon, Loader2, ChevronLeft, ChevronRight, Infinity } from 'lucide-react';
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
import { getRandomPromptGuides, getRandomPlaceholderQuestion } from '../utils/promptGuides';

/** 格式化为 HH:mm */
const formatTime = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

/** 5 分钟（毫秒），用于时间戳合并：同组内仅在最后一条消息下显示时间 */
const TIMESTAMP_MERGE_MS = 5 * 60 * 1000;

/**
 * 判断该条 fragment 是否应显示时间戳（5 分钟内合并：仅在每组最后一条下显示）。
 * @param next - 时间线中下一项，若无则为 undefined
 * @param currT - 当前 fragment 的时间（editedAt ?? timestamp）
 */
function shouldShowTimestamp(
  next: { type: string; t: number } | undefined,
  currT: number
): boolean {
  if (!next) return true;
  if (next.type !== 'fragment') return true;
  return (next.t - currT) > TIMESTAMP_MERGE_MS;
}

type TimelineItem = { type: string; t: number; fragment?: RawFragment };

/**
 * 获取时间戳文案：连续段内若有任一条已编辑，仅在本段最后一条下方显示「已编辑 HH:mm」（取段内最晚 editedAt）。
 * @param timeline - 统一时间线
 * @param index - 当前 fragment 下标（且应满足 shouldShowTimestamp，即本组最后一条）
 * @param t - 文案函数
 * @param formatTime - 时间格式化
 */
function getSegmentTimeLabel(
  timeline: TimelineItem[],
  index: number,
  t: (k: string) => string,
  formatTime: (ms: number) => string
): string {
  const cur = timeline[index];
  if (cur?.type !== 'fragment' || !cur.fragment) return formatTime(0);
  const frag = cur.fragment;
  const segment: RawFragment[] = [frag];
  let j = index;
  while (j > 0) {
    const prev = timeline[j - 1];
    if (prev.type !== 'fragment' || !prev.fragment) break;
    if (timeline[j].t - prev.t > TIMESTAMP_MERGE_MS) break;
    segment.unshift(prev.fragment);
    j = j - 1;
  }
  const latestEdited = segment
    .map((f) => f.editedAt)
    .filter((x): x is number => x != null);
  if (latestEdited.length > 0) {
    return `${t('edited')} ${formatTime(Math.max(...latestEdited))}`;
  }
  return formatTime(frag.editedAt ?? frag.timestamp);
}

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
  /** 底部输入框是否获得焦点：未聚焦时仅显示占位语、单行高；聚焦时 5 行高并显示添加图片与发送按钮 */
  const [inputFocused, setInputFocused] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  /** 收拢过程各环节提示语，显示在输入框区域 */
  const [synthStatus, setSynthStatus] = useState<string | null>(null);
  /** 长按发送键 2 秒后进入收拢模式，按钮显示 ♾️，再次点击触发收拢 */
  const [infinityMode, setInfinityMode] = useState(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** 长按进入 ♾️ 后的首次点击忽略，避免「松开即触发」 */
  const infinityModeJustEnteredRef = useRef(false);
  /** 鼠标/触屏连点两次进入收拢：点击次数与时间窗 */
  const clickCountRef = useRef(0);
  const lastClickTimeRef = useRef(0);
  const inputContainerRef = useRef<HTMLDivElement>(null);
  /** 当前处于编辑状态的片段 id */
  const [editingId, setEditingId] = useState<string | null>(null);
  /** 编辑中的文案（仅当 editingId 非空时有效） */
  const [editDraft, setEditDraft] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const placeholderMeasureRef = useRef<HTMLDivElement>(null);
  /** 切换日期时置为 true，避免 fragments 效果里 scrollIntoView 滚到底部 */
  const isDateSwitchRef = useRef(false);
  /** 上一 viewDate，用于区分「切换日期」与「同一天新增片段」 */
  const prevViewDateRef = useRef<string | undefined>(undefined);
  /** 折叠时占位语若超过一行，根据测量结果扩展行数（1–4） */
  const [collapsedRows, setCollapsedRows] = useState(1);
  /** 底部输入栏：向下滑动隐藏，向上或到底部时显示 */
  const [inputBarVisible, setInputBarVisible] = useState(true);
  const lastMainScrollTopRef = useRef(-1);
  const { showToast, ToastContainer } = useToast();

  /** 随 viewDate 拉取 session；切换日期时滚动到 main 顶部并标记，避免后续 fragments 效果滚到底部 */
  useEffect(() => {
    const isSwitch = prevViewDateRef.current !== undefined && prevViewDateRef.current !== viewDate;
    setSession(MockDataService.getSessionByDate(viewDate) ?? null);
    if (isSwitch) {
      isDateSwitchRef.current = true;
      (scrollRef.current?.closest('main') as HTMLElement | null)?.scrollTo({ top: 0, behavior: 'auto' });
    }
    prevViewDateRef.current = viewDate;
  }, [viewDate]);

  /** 有输入时退出收拢模式，按钮变回发送按钮 */
  useEffect(() => {
    if (input.trim()) setInfinityMode(false);
  }, [input]);

  /**
   * 点击输入框外部：始终折叠（收起高度与按钮栏，仅当 isSynthesizing 时按钮栏保留）；
   * 仅当不处于日记生成过程中时退出无限模式；生成中不退出，折叠后占位语由 placeholder 显示环节提示。
   */
  useEffect(() => {
    const handlePointerOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (target != null && inputContainerRef.current && !inputContainerRef.current.contains(target)) {
        setInputFocused(false);
        if (!isSynthesizing) setInfinityMode(false);
      }
    };
    document.addEventListener('mousedown', handlePointerOutside);
    document.addEventListener('touchstart', handlePointerOutside, { passive: true });
    return () => {
      document.removeEventListener('mousedown', handlePointerOutside);
      document.removeEventListener('touchstart', handlePointerOutside);
    };
  }, [isSynthesizing]);

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

  /** 同一天新增片段（发送、加图等）时滚到底部；切换日期引起的 fragments 变化则跳过，保持顶部 */
  useEffect(() => {
    if (isDateSwitchRef.current) {
      isDateSwitchRef.current = false;
      return;
    }
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session?.fragments]);

  /**
   * 监听整个页面的 touchmove / wheel，用 requestAnimationFrame 取「当前滚动位置」后做输入栏显隐：
   * 向下滑隐藏，向上或到顶/到底显示。优先读 main，没有则读 window/document。
   */
  const INPUT_BAR_SCROLL_THRESHOLD = 5;
  const INPUT_BAR_BOTTOM_MARGIN = 10;
  useEffect(() => {
    const run = () => {
      requestAnimationFrame(() => {
        const main = scrollRef.current?.closest('main') as HTMLElement | null;
        const useWindow = !main || main.scrollHeight <= main.clientHeight;
        const scrollTop = useWindow ? window.scrollY : main!.scrollTop;
        const scrollHeight = useWindow ? document.documentElement.scrollHeight : main!.scrollHeight;
        const clientHeight = useWindow ? window.innerHeight : main!.clientHeight;

        const last = lastMainScrollTopRef.current;
        if (last < 0) {
          lastMainScrollTopRef.current = scrollTop;
          return;
        }
        if (scrollTop <= 0) {
          setInputBarVisible(true);
          lastMainScrollTopRef.current = scrollTop;
          return;
        }
        const atBottom = scrollTop + clientHeight >= scrollHeight - INPUT_BAR_BOTTOM_MARGIN;
        if (atBottom) {
          setInputBarVisible(true);
          lastMainScrollTopRef.current = scrollTop;
          return;
        }
        const delta = scrollTop - last;
        lastMainScrollTopRef.current = scrollTop;
        if (delta > INPUT_BAR_SCROLL_THRESHOLD) setInputBarVisible(false);
        else if (delta < -INPUT_BAR_SCROLL_THRESHOLD) setInputBarVisible(true);
      });
    };
    document.addEventListener('touchmove', run, { passive: true });
    document.addEventListener('wheel', run, { passive: true });
    window.addEventListener('scroll', run, { passive: true });
    document.addEventListener('scroll', run, { passive: true, capture: true });
    return () => {
      document.removeEventListener('touchmove', run);
      document.removeEventListener('wheel', run);
      window.removeEventListener('scroll', run);
      document.removeEventListener('scroll', run, { capture: true });
    };
  }, []);

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
    /** 本次触发收拢的时间写入当日会话，再次生成会追加；不在此处触发 WebDAV，等日记全部生成并展示「已生成」后再同步 */
    const next = { ...session, gatherStartedAt: [...(session.gatherStartedAt ?? []), Date.now()] };
    MockDataService.saveSession(next);
    setSession(MockDataService.getSessionByDate(viewDate)!);
    setIsSynthesizing(true);
    const isRegather = session.status === SessionStatus.COMPLETED && !!session.finalEntryId;
    const oldEntry = isRegather ? MockDataService.getEntryById(session.finalEntryId!) : null;
    const previousGeneration = (isRegather && oldEntry?.markdownContent) ? oldEntry.markdownContent : undefined;
    const lang = getModelResponseLanguage(settings);

    try {
      setSynthStatus(isRegather ? t('synth_status_regather') : t('synth_status_start'));
      setSynthStatus(t('synth_status_preparing'));
      setSynthStatus(t('synth_status_body'));
      const { markdownContent } = await AiService.synthesizeJournalBody(session.fragments, lang, settings, 2, previousGeneration);

      setSynthStatus(t('synth_status_creating').replace('{date}', viewDate));
      const images: { [key: string]: string } = {};
      session.fragments.forEach((f) => {
        if (f.type === FragmentType.IMAGE) {
          const data = f.imageData || (isRegather ? oldEntry?.images?.[f.id] : undefined);
          if (data) images[f.id] = data;
        }
      });
      const tempTitle = t('synth_temp_title').replace('{date}', viewDate);
      const newEntry: WingEntry = {
        id: crypto.randomUUID(),
        title: tempTitle,
        summary: '',
        mood: '🌿',
        markdownContent: markdownContent || '',
        aiInsights: '',
        todos: [],
        createdAt: new Date(viewDate + 'T12:00:00').getTime(),
        generatedAt: Date.now(),
        images: Object.keys(images).length > 0 ? images : undefined
      };
      MockDataService.saveEntry(newEntry);
      const latest1 = MockDataService.getSessionByDate(viewDate)!;
      MockDataService.saveSession({ ...latest1, status: SessionStatus.COMPLETED, finalEntryId: newEntry.id });
      setSession(MockDataService.getSessionByDate(viewDate)!);

      setSynthStatus(t('synth_status_meta'));
      const meta = await AiService.synthesizeJournalMeta(markdownContent, lang, settings);
      MockDataService.updateEntry(newEntry.id, { title: meta.title, summary: meta.summary, mood: meta.mood });

      setSynthStatus(t('synth_status_insight'));
      const { aiInsights, todos } = await AiService.synthesizeInsightAndTodos(
        { title: meta.title, mood: meta.mood, summary: meta.summary, markdownContent },
        lang,
        settings
      );
      MockDataService.updateEntry(newEntry.id, { aiInsights, todos });

      setSynthStatus(t('synth_status_done'));
      const completedAt = Date.now();
      const latest2 = MockDataService.getSessionByDate(viewDate)!;
      MockDataService.saveSession({
        ...latest2,
        gatherCompletions: [...(latest2.gatherCompletions ?? []), { completedAt, entryId: newEntry.id, title: meta.title }]
      });
      setSession(MockDataService.getSessionByDate(viewDate)!);
      /** 仅在收拢完成、展示「已生成《xx》」之后触发 WebDAV 同步，避免网络拥堵 */
      triggerRealtimeSyncIfEnabled(settings);
    } catch (error) {
      console.error('Synthesis failed:', error);
      if ((error as { code?: string })?.code === 'QUOTA_EXCEEDED') {
        showToast(t('storage_quota_exceeded'), 'error');
        return;
      }
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
      setSynthStatus(null);
    }
  };

  const fragments = session?.fragments ?? [];
  const isCompleted = session?.status === SessionStatus.COMPLETED;

  /** 空白引导：L1 随机 2–3 个、L2 随机 1–2 个、L3 固定 1 个，随语言与日期稳定，点击填入输入框 */
  const promptGuides = useMemo(
    () => getRandomPromptGuides(settings.language),
    [settings.language, viewDate]
  );

  /** 当日已有记录时，输入框占位语：从 L1/L2/L3 合并池随机取 1 条，随语言与日期稳定 */
  const inputPlaceholderQuestion = useMemo(
    () => getRandomPlaceholderQuestion(settings.language),
    [settings.language, viewDate]
  );

  /** 折叠状态下当前占位语文案，用于测量是否需扩展行高 */
  const collapsedPlaceholder = inputFocused
    ? ''
    : (isSynthesizing ? (synthStatus || t('weaving')) : (fragments.length > 0 ? inputPlaceholderQuestion : t('mind_placeholder')));

  /**
   * 测量折叠时占位语行数：用隐藏 div 同宽、同字体渲染占位语，按 scrollHeight/lineHeight 计算行数并更新 collapsedRows。
   * 仅当未聚焦且有占位语时执行；行数限制在 1–4。
   */
  const runMeasure = useCallback(() => {
    if (inputFocused || !collapsedPlaceholder || !textareaRef.current || !placeholderMeasureRef.current) return;
    const ta = textareaRef.current;
    const m = placeholderMeasureRef.current;
    if (ta.offsetWidth <= 0) return;
    const cs = getComputedStyle(ta);
    m.style.width = `${ta.offsetWidth}px`;
    m.style.fontSize = cs.fontSize;
    m.style.lineHeight = cs.lineHeight;
    m.style.fontFamily = cs.fontFamily;
    m.style.boxSizing = 'border-box';
    m.textContent = collapsedPlaceholder;
    const lineHeight = parseFloat(cs.lineHeight);
    if (!lineHeight || Number.isNaN(lineHeight)) return;
    const lines = Math.ceil(m.scrollHeight / lineHeight);
    setCollapsedRows(Math.max(1, Math.min(lines, 4)));
  }, [inputFocused, collapsedPlaceholder]);

  useLayoutEffect(() => {
    runMeasure();
  }, [runMeasure]);

  /** 折叠时随输入框宽度变化重新测量占位语行数 */
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const ro = new ResizeObserver(runMeasure);
    ro.observe(ta);
    return () => ro.disconnect();
  }, [runMeasure]);

  /**
   * 收拢时间线：合并「开始收拢」与「已生成《xx》」，按时间排序；再次生成时多条叠加展示。
   * 旧数据无 gatherCompletions 时，从 finalEntryId 推导一条以保持兼容。
   */
  const gatherCompletionsForTimeline =
    session?.gatherCompletions?.length
      ? session.gatherCompletions
      : session?.finalEntryId
        ? (() => {
            const e = MockDataService.getEntryById(session.finalEntryId!);
            return e ? [{ completedAt: e.generatedAt ?? e.createdAt, entryId: e.id, title: e.title }] : [];
          })()
        : [];
  /**
   * 与用户记录、收拢提示、生成提示按时间混合排序，用于统一时间线渲染。
   * 收拢：首次为「开始收拢羽毛」，再次为「再次收拢羽毛」。
   */
  const unifiedTimeline = [
    ...fragments.map((f) => ({ t: f.editedAt ?? f.timestamp, type: 'fragment' as const, fragment: f })),
    ...(session?.gatherStartedAt ?? []).map((t, i) => ({ t, type: 'started' as const, isRegather: i > 0 })),
    ...gatherCompletionsForTimeline.map((c) => ({ t: c.completedAt, type: 'completed' as const, entryId: c.entryId, title: c.title }))
  ].sort((a, b) => a.t - b.t);

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
    <div className="flex flex-col bg-twilight-bg dark:bg-nocturnal-bg">
      {/* 日期切换：sticky 随 main 滚动时固定在顶部，便于 Tab 栏滑动隐藏时仍可切换日期 */}
      <div className="sticky top-0 z-10 flex items-center justify-center gap-2 py-2 border-b border-twilight-divider dark:border-nocturnal-secondary/25 bg-twilight-cream dark:bg-nocturnal-surface/80">
        <button
          type="button"
          onClick={() => prevDate && setSearchParams({ date: prevDate })}
          disabled={!canGoPrev}
          className="p-1.5 text-twilight-duskLight hover:text-twilight-amber hover:bg-twilight-cream dark:text-nocturnal-secondary dark:hover:text-nocturnal-accent dark:hover:bg-nocturnal-surface rounded-full transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-twilight-duskLight dark:disabled:hover:text-nocturnal-secondary"
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
          className="p-1.5 text-twilight-duskLight hover:text-twilight-amber hover:bg-twilight-cream dark:text-nocturnal-secondary dark:hover:text-nocturnal-accent dark:hover:bg-nocturnal-surface rounded-full disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-twilight-duskLight dark:disabled:hover:text-nocturnal-secondary transition-colors"
          aria-label={nextDate ?? undefined}
        >
          <ChevronRight size={20} />
        </button>
      </div>

      <div className="p-6">
        {fragments.length === 0 ? (
          <div className="min-h-[calc(100vh-12rem)] flex flex-col items-center justify-center text-twilight-duskLight dark:text-nocturnal-secondary space-y-4">
            <EmptyStateOwl size={100} />
            <div className="flex flex-wrap justify-center gap-2 max-w-md px-4">
              {promptGuides.map((q) => (
                <button
                  key={q}
                  type="button"
                  onClick={() => {
                    setInput(q);
                    setInputFocused(true);
                    textareaRef.current?.focus();
                  }}
                  className="px-3 py-1.5 text-sm text-twilight-charcoal dark:text-nocturnal-primary bg-twilight-cream/60 dark:bg-nocturnal-surface/60 border border-twilight-divider/80 dark:border-nocturnal-secondary/30 rounded-full hover:bg-twilight-amber/10 dark:hover:bg-nocturnal-accent/10 hover:border-twilight-amber/50 dark:hover:border-nocturnal-accent/40 transition-colors cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
            <p className="text-xs text-twilight-duskLight/80 dark:text-nocturnal-secondary/80">
              {t('prompt_guide_hint')}
            </p>
          </div>
        ) : (
          unifiedTimeline.map((ev, i) => {
            if (ev.type === 'fragment') {
              const fragment = ev.fragment;
              const isEditing = editingId === fragment.id;
              const canEdit = !!session;
              const currT = fragment.editedAt ?? fragment.timestamp;
              /** 5 分钟内与下一条合并，仅在本组最后一条下显示时间戳；「已编辑」亦仅在该条显示 */
              const showTs = shouldShowTimestamp(unifiedTimeline[i + 1], currT);
              /** 与上一条同为 fragment 且间隔 ≤5 分钟则视为同一连续段，缩小上边距 */
              const prev = unifiedTimeline[i - 1];
              const prevInSameSegment = i > 0 && prev?.type === 'fragment' && (ev.t - prev.t) <= TIMESTAMP_MERGE_MS;
              const mtClass = i === 0 ? '' : prevInSameSegment ? 'mt-2' : 'mt-6';
              return (
                <div key={`fragment-${fragment.id}`} className={`flex flex-col items-end ${mtClass}`}>
                  <div
                    className={`max-w-[85%] bg-twilight-cream dark:bg-nocturnal-surface border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl rounded-tr-none shadow-sm overflow-hidden ${canEdit && !isEditing ? 'cursor-pointer' : ''}`}
                    onDoubleClick={() => { if (!isEditing && canEdit) startEdit(fragment); }}
                    title={canEdit && !isEditing ? t('double_click_to_edit') : undefined}
                    aria-label={canEdit && !isEditing ? t('double_click_to_edit') : undefined}
                  >
                    {fragment.type === FragmentType.IMAGE && fragment.imageData ? (
                      <div className="relative">
                        <img
                          src={fragment.imageData}
                          alt={fragment.content}
                          className="max-w-full h-auto object-cover"
                          style={{ maxHeight: '400px' }}
                        />
                        {isEditing ? (
                          <div className="px-3 py-1.5 bg-twilight-cream/30 dark:bg-nocturnal-bg/40 border-t border-twilight-divider dark:border-nocturnal-secondary/20">
                            <textarea
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              placeholder={t('image_placeholder')}
                              className="w-full text-[0.6875rem] text-twilight-warm dark:text-nocturnal-secondary bg-transparent border-none resize-none focus:outline-none focus:ring-0 min-h-[1.75rem] leading-snug"
                              rows={2}
                              autoFocus
                            />
                          </div>
                        ) : (
                          (fragment.content && fragment.content !== t('image_placeholder')) && (
                            <div className="px-3 py-1.5 bg-twilight-cream/30 dark:bg-nocturnal-bg/40 border-t border-twilight-divider dark:border-nocturnal-secondary/20">
                              <p className="text-[0.6875rem] leading-snug text-twilight-duskLight dark:text-nocturnal-secondary">{fragment.content}</p>
                            </div>
                          )
                        )}
                      </div>
                    ) : isEditing ? (
                      <div className="px-3 py-2">
                        <textarea
                          value={editDraft}
                          onChange={(e) => setEditDraft(e.target.value)}
                          placeholder={t('mind_placeholder')}
                          className="w-full text-[0.8125rem] text-twilight-charcoal dark:text-nocturnal-primary leading-snug bg-transparent border-none resize-none focus:outline-none focus:ring-0 min-h-[3.5rem]"
                          rows={4}
                          autoFocus
                        />
                      </div>
                    ) : (
                      <div className="px-3 py-2">
                        <p className="text-[0.8125rem] text-twilight-charcoal dark:text-nocturnal-primary leading-snug">{fragment.content}</p>
                      </div>
                    )}
                  </div>
                  {(isEditing || showTs) && (
                    <div className="flex items-center gap-1.5 mt-0.5 mr-1">
                      {isEditing ? (
                        <>
                          <button
                            type="button"
                            onClick={saveEdit}
                            disabled={fragment.type === FragmentType.TEXT && !editDraft.trim()}
                            className="text-[0.625rem] text-twilight-amber dark:text-nocturnal-accent font-medium hover:underline disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:no-underline"
                          >
                            {t('save')}
                          </button>
                          <button
                            type="button"
                            onClick={cancelEdit}
                            className="text-[0.625rem] text-twilight-duskLight dark:text-nocturnal-secondary hover:text-twilight-amber dark:hover:text-nocturnal-accent"
                          >
                            {t('cancel')}
                          </button>
                        </>
                      ) : (
                        <span className="text-[0.625rem] text-twilight-duskLight dark:text-nocturnal-secondary">
                          {getSegmentTimeLabel(unifiedTimeline, i, t, formatTime)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            }
            if (ev.type === 'started') {
              return (
                <p key={`gather-started-${ev.t}-${i}`} className={`text-xs text-twilight-duskLight dark:text-nocturnal-secondary text-center py-2 ${i === 0 ? '' : 'mt-6'}`}>
                  {formatTime(ev.t)} {ev.isRegather ? t('gathering_regather') : t('gathering_started')}
                </p>
              );
            }
            const compIdx = gatherCompletionsForTimeline.findIndex((c) => c.completedAt === ev.t && c.entryId === ev.entryId);
            const isRegather = compIdx > 0;
            const msg = isRegather
              ? (viewDate === today ? t('owl_diary_regenerated_today') : t('owl_diary_regenerated_that_day'))
              : (viewDate === today ? t('owl_diary_generated_today') : t('owl_diary_generated_that_day'));
            return (
              <div key={`gather-completed-${ev.t}-${ev.entryId}`} className={`flex flex-col items-start ${i === 0 ? '' : 'mt-6'}`}>
                <div className="flex items-center gap-2 max-w-[85%]">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-twilight-cream dark:bg-nocturnal-surface border border-twilight-divider dark:border-nocturnal-secondary/25 flex items-center justify-center overflow-hidden">
                    <OwlLogo size={20} className="dark:invert" />
                  </div>
                  <div className="bg-twilight-cream dark:bg-nocturnal-surface border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-2xl rounded-tl-none px-3 py-2 shadow-sm">
                    <p className="text-[0.8125rem] leading-snug text-twilight-charcoal dark:text-nocturnal-primary">
                      {msg}
                      《<Link to={`/journal/${ev.entryId}`} className="text-twilight-amber dark:text-nocturnal-accent font-medium hover:underline">{ev.title}</Link>》
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <div className="w-8 flex-shrink-0" aria-hidden="true" />
                  <span className="text-[0.625rem] text-twilight-duskLight dark:text-nocturnal-secondary">
                    {formatTime(ev.t)}
                  </span>
                </div>
              </div>
            );
          })
        )}
        <div className="mt-6" />
      </div>

      {/* 占位：避免最后一条内容被固定消息栏遮挡；scrollRef 挂在此处使 scrollIntoView 能滚到真正底部 */}
      <div ref={scrollRef} className="h-24 flex-shrink-0" aria-hidden="true" />

      <div
        className={`fixed bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl z-40 px-4 py-3 transition-transform duration-300 ease-out ${inputBarVisible ? 'translate-y-0' : 'translate-y-full pointer-events-none'}`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleImageSelect}
          accept="image/*"
          className="hidden"
        />
        <div ref={inputContainerRef} className="w-full flex flex-col bg-white dark:bg-nocturnal-surface rounded-2xl overflow-hidden border border-twilight-divider/60 dark:border-nocturnal-secondary/25 focus-within:ring-2 focus-within:ring-twilight-amber/25 dark:focus-within:ring-nocturnal-accent/40 focus-within:ring-inset min-h-0">
          <div className="relative flex-1 flex min-h-0">
            {/* 折叠时测量占位语行数用：与 textarea 同宽、同 px/pr、同字体，用于计算 collapsedRows */}
            <div
              ref={placeholderMeasureRef}
              className="absolute -left-[9999px] top-0 invisible box-border px-4 pr-11 py-0 break-words"
              aria-hidden="true"
            />
            <textarea
              ref={textareaRef}
              rows={inputFocused ? 5 : collapsedRows}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onFocus={() => {
                /** 点击输入框时：先滚到底部再展开。仅用 scrollIntoView（直接改 main.scrollTop 在此布局下无效），scrollRef 在 h-24 上故能滚到真正底部 */
                scrollRef.current?.scrollIntoView({ block: 'end', behavior: 'auto' });
                setInputBarVisible(true);
                setInputFocused(true);
              }}
              readOnly={isSynthesizing}
              onBlur={() => {
                /** 延迟一帧判断：若焦点仍在输入容器内（如点击了发送/加图按钮），不折叠，避免无法发送或连点/长按进入收拢模式 */
                const container = inputContainerRef.current;
                requestAnimationFrame(() => {
                  const el = document.activeElement;
                  if (container && el != null && container.contains(el)) return;
                  setInputFocused(false);
                });
              }}
              /** 回车与换行仅插入换行，不自动发送；须手动点击发送键才发送。生成中：展开时占位「猫头鹰正在收拢羽毛，请稍等」；折叠时占位为原小字提示语（synthStatus/weaving） */
              placeholder={
                isSynthesizing
                  ? (inputFocused ? t('owl_gathering_please_wait') : (synthStatus || t('weaving')))
                  : (fragments.length > 0 ? inputPlaceholderQuestion : t('mind_placeholder'))
              }
              className="w-full bg-transparent border-none resize-none outline-none focus:ring-0 text-twilight-charcoal dark:text-nocturnal-primary px-4 pt-3 pb-2 pr-11 max-h-40 placeholder:text-twilight-duskLight placeholder:dark:text-nocturnal-secondary"
            />
            <div className={`absolute top-3 right-3 transition-all duration-300 ${showSuccess ? 'scale-110 opacity-100' : 'scale-50 opacity-0'}`} aria-hidden="true">
              <CheckCircle2 className="text-green-500" size={20} />
            </div>
          </div>
          {inputFocused && (
            <div className="flex justify-between items-center px-3 pb-2 pt-0">
              <button
                type="button"
                onClick={() => !isSynthesizing && fileInputRef.current?.click()}
                disabled={isSynthesizing}
                className="p-2 text-twilight-duskLight hover:text-twilight-amber hover:bg-twilight-cream/50 dark:text-nocturnal-secondary dark:hover:text-nocturnal-accent dark:hover:bg-nocturnal-bg/50 rounded-lg transition-colors disabled:opacity-50 disabled:pointer-events-none"
                title={t('add_image')}
                aria-label={t('add_image')}
              >
                <ImageIcon size={20} />
              </button>
              <div className="flex items-center gap-2 min-w-0">
                {isSynthesizing && (
                  <span className="text-[0.625rem] text-twilight-amber dark:text-nocturnal-accent truncate max-w-[12rem]">
                    {synthStatus || t('weaving')}
                  </span>
                )}
                {!isSynthesizing && !input.trim() && fragments.length > 0 && !infinityMode && (
                  <span className="text-[0.625rem] text-twilight-duskLight dark:text-nocturnal-secondary whitespace-nowrap">
                    {t('hint_longpress_switch_ai')}
                  </span>
                )}
                {!isSynthesizing && infinityMode && (
                  <span className="text-[0.625rem] text-twilight-duskLight dark:text-nocturnal-secondary whitespace-nowrap">
                    {isCompleted && session?.finalEntryId
                      ? (viewDate === today ? t('hint_click_regenerate_today') : t('hint_click_regenerate_that_day'))
                      : (viewDate === today ? t('hint_click_generate_today') : t('hint_click_generate_that_day'))}
                  </span>
                )}
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
                            /** 灰色按钮：鼠标连点两次、触屏双击均可进入收拢（触屏长按由 onPointerDown 处理） */
                            const now = Date.now();
                            if (now - lastClickTimeRef.current > 500) clickCountRef.current = 0;
                            clickCountRef.current += 1;
                            lastClickTimeRef.current = now;
                            if (clickCountRef.current >= 2) {
                              clickCountRef.current = 0;
                              setInfinityMode(true);
                            }
                          }
                }
                onPointerDown={(e) => {
                  /** 触屏长按 1 秒进入收拢；鼠标与触屏亦可连点两次（onClick 处理）。不在此处 preventDefault，避免干扰输入框聚焦与输入；折叠由 onBlur 内「焦点是否仍在容器内」判断控制 */
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
