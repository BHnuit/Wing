
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MockDataService } from '../services/mockDataService';
import { ChevronRight, Search, X } from 'lucide-react';
import { EmptyStateOwl } from './OwlAssets';
import { useTranslation } from '../i18n';
import { WingEntry, Language } from '../types';
import { getLocalDateString } from '../utils/date';
import { debounce } from '../utils/performance';

/**
 * Memoized 日记列表项组件，避免不必要的重渲染
 */
const JournalEntryItem = React.memo<{
  entry: WingEntry;
  language: Language;
  formatDate: (timestamp: number, language: string) => string;
  onNavigate: (entryId: string) => void;
}>(({ entry, language, formatDate, onNavigate }) => {
  return (
    <button
      onClick={() => onNavigate(entry.id)}
      className="group text-left bg-twilight-cream dark:bg-nocturnal-surface p-5 rounded-3xl border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm hover:shadow-md hover:border-twilight-amber/30 dark:hover:border-nocturnal-accent/40 transition-all flex justify-between items-center"
    >
      <div className="flex gap-4 items-start">
        <span className="text-3xl mt-1">{entry.mood}</span>
        <div className="space-y-1">
          <h3 className="serif text-lg font-semibold text-twilight-charcoal dark:text-nocturnal-primary group-hover:text-twilight-amber dark:group-hover:text-nocturnal-accent transition-colors">
            {entry.title}
          </h3>
          <p className="text-xs text-twilight-duskLight dark:text-nocturnal-secondary line-clamp-1">{entry.summary}</p>
          <span className="text-[10px] text-twilight-duskLight dark:text-nocturnal-secondary uppercase tracking-widest font-medium">
            {formatDate(entry.createdAt, language)}
          </span>
        </div>
      </div>
      <ChevronRight className="text-twilight-duskLight/80 dark:text-nocturnal-secondary/80 group-hover:text-twilight-amber dark:group-hover:text-nocturnal-accent" />
    </button>
  );
}, (prevProps, nextProps) => {
  // 自定义比较函数：只有当 entry.id 改变时才重新渲染
  return prevProps.entry.id === nextProps.entry.id &&
    prevProps.entry.title === nextProps.entry.title &&
    prevProps.entry.summary === nextProps.entry.summary &&
    prevProps.entry.mood === nextProps.entry.mood &&
    prevProps.entry.createdAt === nextProps.entry.createdAt &&
    prevProps.language === nextProps.language;
});

JournalEntryItem.displayName = 'JournalEntryItem';

const JournalView: React.FC = () => {
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  // 使用 useMemo 缓存排序后的 entries，避免每次渲染都重新排序
  const allEntries = useMemo(
    () => MockDataService.getEntries().sort((a, b) => b.createdAt - a.createdAt),
    []
  );
  const navigate = useNavigate();
  
  // 搜索相关状态
  const [showSearch, setShowSearch] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchDate, setSearchDate] = useState('');
  // 用于防抖的搜索关键词状态
  const [debouncedSearchKeyword, setDebouncedSearchKeyword] = useState('');
  
  // 防抖更新搜索关键词（300ms 延迟）
  const debouncedSetSearchKeyword = useRef(
    debounce((value: string) => {
      setDebouncedSearchKeyword(value);
    }, 300)
  ).current;
  
  // 当搜索关键词变化时，触发防抖更新
  useEffect(() => {
    debouncedSetSearchKeyword(searchKeyword);
  }, [searchKeyword, debouncedSetSearchKeyword]);
  
  // 使用 useMemo 实现搜索过滤逻辑（使用防抖后的关键词）
  const entries = useMemo(() => {
    if (!searchKeyword && !searchDate) {
      return allEntries;
    }
    
    return allEntries.filter(entry => {
      // 关键词搜索：匹配标题或内容（使用防抖后的关键词）
      const keywordMatch = !debouncedSearchKeyword || 
        entry.title.toLowerCase().includes(debouncedSearchKeyword.toLowerCase()) ||
        entry.markdownContent.toLowerCase().includes(debouncedSearchKeyword.toLowerCase()) ||
        entry.summary.toLowerCase().includes(debouncedSearchKeyword.toLowerCase());
      
      // 日期搜索：匹配创建日期
      const dateMatch = !searchDate || (() => {
        const entryDate = getLocalDateString(new Date(entry.createdAt));
        return entryDate === searchDate;
      })();
      
      return keywordMatch && dateMatch;
    });
  }, [allEntries, debouncedSearchKeyword, searchDate]);
  
  // 使用 useCallback 缓存日期格式化函数，避免每次渲染都创建新函数
  const formatDate = useCallback((timestamp: number, language: string) => {
    return new Date(timestamp).toLocaleDateString(
      language === 'en' ? 'en-US' : 'zh-CN',
      { month: 'long', day: 'numeric', year: 'numeric' }
    );
  }, []);

  // 使用 useCallback 缓存导航函数，避免每次渲染都创建新函数
  const handleNavigate = useCallback((entryId: string) => {
    navigate(`/journal/${entryId}`);
  }, [navigate]);
  
  // 清空搜索条件（保留搜索面板打开状态）
  const handleClearSearch = useCallback(() => {
    setSearchKeyword('');
    setSearchDate('');
  }, []);

  useEffect(() => {
    const handleSettingsUpdate = () => setSettings(MockDataService.getSettings());
    window.addEventListener('wing_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('wing_settings_updated', handleSettingsUpdate);
  }, []);

  const hasActiveSearch = debouncedSearchKeyword || searchDate;
  const searchResultsText = hasActiveSearch 
    ? t('search_results').replace('{count}', entries.length.toString())
    : '';

  return (
    <div className="p-6 space-y-6">
      {/* 标题和搜索入口 */}
      <div className="flex items-center justify-between mb-8">
        <h2 className="serif text-2xl font-bold text-twilight-charcoal dark:text-nocturnal-primary">
          {t('library_title')}
        </h2>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="p-2 text-twilight-duskLight hover:text-twilight-amber dark:text-nocturnal-secondary dark:hover:text-nocturnal-accent hover:bg-twilight-cream dark:hover:bg-nocturnal-surface rounded-full transition-colors"
          aria-label={t('search')}
        >
          <Search size={20} className={showSearch ? 'text-twilight-amber dark:text-nocturnal-accent' : ''} />
        </button>
      </div>
      
      {/* 搜索面板 */}
      {showSearch && (
        <div className="bg-twilight-cream dark:bg-nocturnal-surface p-4 rounded-2xl border border-twilight-divider dark:border-nocturnal-secondary/25 space-y-4 mb-6">
          {/* 关键词搜索 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-twilight-charcoal dark:text-nocturnal-primary">
              {t('search_keyword')}
            </label>
            <div className="relative">
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder={t('search_placeholder')}
                className="w-full px-4 py-2 pr-10 bg-white dark:bg-nocturnal-bg border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-xl text-twilight-charcoal dark:text-nocturnal-primary placeholder:text-twilight-duskLight dark:placeholder:text-nocturnal-secondary focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/30"
              />
              {searchKeyword && (
                <button
                  onClick={() => setSearchKeyword('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-twilight-duskLight hover:text-twilight-charcoal dark:text-nocturnal-secondary dark:hover:text-nocturnal-primary rounded-full transition-colors"
                  aria-label={t('search_clear')}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
          
          {/* 日期搜索 */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-twilight-charcoal dark:text-nocturnal-primary">
              {t('search_date_filter')}
            </label>
            <input
              type="date"
              value={searchDate}
              onChange={(e) => setSearchDate(e.target.value)}
              className="w-full px-4 py-2 bg-white dark:bg-nocturnal-bg border border-twilight-divider dark:border-nocturnal-secondary/25 rounded-xl text-twilight-charcoal dark:text-nocturnal-primary focus:outline-none focus:ring-2 focus:ring-twilight-amber/30 dark:focus:ring-nocturnal-accent/30"
            />
          </div>
          
          {/* 清空按钮 */}
          {hasActiveSearch && (
            <button
              onClick={handleClearSearch}
              className="w-full px-4 py-2 text-sm text-twilight-duskLight hover:text-twilight-charcoal dark:text-nocturnal-secondary dark:hover:text-nocturnal-primary hover:bg-white/50 dark:hover:bg-nocturnal-bg/50 rounded-xl transition-colors"
            >
              {t('search_clear')}
            </button>
          )}
        </div>
      )}
      
      {/* 搜索结果统计 */}
      {hasActiveSearch && (
        <div className="text-sm text-twilight-duskLight dark:text-nocturnal-secondary mb-4">
          {searchResultsText}
        </div>
      )}
      
      {/* 日记列表 */}
      {entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-twilight-duskLight dark:text-nocturnal-secondary">
          <EmptyStateOwl size={100} className="mb-4" />
          <p className="serif italic text-center px-8">
            {hasActiveSearch ? t('search_no_results') : t('empty_library')}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {entries.map(entry => (
            <JournalEntryItem
              key={entry.id}
              entry={entry}
              language={settings.language}
              formatDate={formatDate}
              onNavigate={handleNavigate}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default JournalView;
