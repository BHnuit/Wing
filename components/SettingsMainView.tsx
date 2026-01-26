/**
 * 设置一级页：个人信息（蓝色日历、今日挥动翅膀/收集羽毛总数）、入口菜单（模型配置、语言选项、存储管理）
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Shield, Database, Globe, ChevronRight, Brain } from 'lucide-react';
import { MockDataService } from '../services/mockDataService';
import { getLocalDateString } from '../utils/date';
import { OwlLogo } from './OwlAssets';
import { useTranslation } from '../i18n';

const CELL_SIZE = 10;
const GAP = 2;
const ROWS = 6;
const MAX_DAYS = 365;

/** 应用版本号，内测阶段以 0 开头，便于在设置页底部展示 */
const APP_VERSION = '0.2.1';

/** 最近 n 天的 YYYY-MM-DD 列表（从旧到新），使用本地时区 */
function getDateList(n: number): string[] {
  const out: string[] = [];
  const end = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    out.push(getLocalDateString(d));
  }
  return out;
}

/** 从 YYYY-MM-DD 解析出年月 */
function getYearMonth(ymd: string): { year: number; month: number } {
  const [y, m] = ymd.split('-').map(Number);
  return { year: y, month: m };
}

/** 月份标签：1 月为「25年」「26年」等简短年份，其余为「X月」；英文 1 月为「25」「26」，其余为短月名 */
function formatMonthLabel(year: number, month: number, lang: string): string {
  if (month === 1) {
    const shortYear = year % 100;
    return lang.startsWith('zh') ? `${shortYear}年` : `${shortYear}`;
  }
  const months = lang.startsWith('zh')
    ? ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
    : ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return months[month] || '';
}

const SettingsMainView: React.FC = () => {
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
  const navigate = useNavigate();
  const [activitySet, setActivitySet] = useState<Set<string>>(MockDataService.getActivityDateSet());
  const [todayMessages, setTodayMessages] = useState(MockDataService.getTodayMessageCount());
  const [totalFeathers, setTotalFeathers] = useState(MockDataService.getTotalFeatherCount());
  const [containerWidth, setContainerWidth] = useState(0);
  const calendarRef = useRef<HTMLDivElement>(null);

  const colsFit = containerWidth > 0 ? Math.max(1, Math.floor((containerWidth + GAP) / (CELL_SIZE + GAP))) : 61;
  const daysToShow = Math.min(MAX_DAYS, ROWS * colsFit);
  const nCols = Math.ceil(daysToShow / ROWS);
  const dateList = getDateList(daysToShow);

  useEffect(() => {
    const el = calendarRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect?.width ?? 0;
      setContainerWidth(w);
    });
    ro.observe(el);
    setContainerWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const onUpdate = () => {
      setActivitySet(MockDataService.getActivityDateSet());
      setTodayMessages(MockDataService.getTodayMessageCount());
      setTotalFeathers(MockDataService.getTotalFeatherCount());
    };
    window.addEventListener('wing_settings_updated', onUpdate);
    window.addEventListener('wing_data_updated', onUpdate);
    return () => {
      window.removeEventListener('wing_settings_updated', onUpdate);
      window.removeEventListener('wing_data_updated', onUpdate);
    };
  }, []);

  useEffect(() => {
    const handleSettingsUpdate = () => setSettings(MockDataService.getSettings());
    window.addEventListener('wing_settings_updated', handleSettingsUpdate);
    return () => window.removeEventListener('wing_settings_updated', handleSettingsUpdate);
  }, []);

  /**
   * 处理图标点击事件：跳转到更新日志页面
   */
  const handleLogoClick = () => {
    navigate('/changelog');
  };

  const recordedDays = activitySet.size;
  const gridWidth = nCols * (CELL_SIZE + GAP) - GAP;
  const LABEL_ROW_H = 14;

  /** 每一列应显示的月份标签：按「该月第一次出现的日期」所在列算，不要求 1 号在列顶 */
  const labelForCol: Record<number, string> = {};
  for (let i = 0; i < dateList.length; i++) {
    const isNewMonth = i === 0 || dateList[i].substring(0, 7) !== dateList[i - 1].substring(0, 7);
    if (!isNewMonth) continue;
    const c = Math.floor(i / ROWS);
    const { year, month } = getYearMonth(dateList[i]);
    labelForCol[c] = formatMonthLabel(year, month, settings.language);
  }

  return (
    <div className="p-6 space-y-6">
      <h2 className="serif text-2xl font-bold text-twilight-charcoal dark:text-nocturnal-primary">{t('settings')}</h2>

      <section className="space-y-2">
        <p className="text-sm font-medium text-twilight-warm dark:text-nocturnal-secondary">{t('stats_days_recorded')}</p>
        <div className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-4 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm w-full">
          <div ref={calendarRef} className="w-full">
            <div className="overflow-x-auto w-full">
              <div style={{ minWidth: gridWidth }}>
              {/* 月份标签 + 热力图：同一 grid，第一行为月份，下 6 行为格子，竖列排布，保证标签与格子同宽同滚动 */}
              <div
                className="grid"
                style={{
                  gridTemplateColumns: `repeat(${nCols}, ${CELL_SIZE}px)`,
                  gridTemplateRows: `${LABEL_ROW_H}px repeat(${ROWS}, ${CELL_SIZE}px)`,
                  gridAutoFlow: 'column',
                  gap: GAP
                }}
              >
                {Array.from({ length: nCols * (1 + ROWS) }, (_, i) => {
                  const c = Math.floor(i / (1 + ROWS));
                  const rowInCol = i % (1 + ROWS);
                  if (rowInCol === 0) {
                    const label = labelForCol[c];
                    if (!label) return <div key={`L-${c}`} />;
                    return (
                      <div key={`L-${c}`} className="flex items-center overflow-visible" style={{ minWidth: 0 }}>
                        <span className="text-[10px] text-twilight-duskLight dark:text-nocturnal-secondary whitespace-nowrap">
                          {label}
                        </span>
                      </div>
                    );
                  }
                  const r = rowInCol - 1;
                  const idx = c * ROWS + r;
                  const ymd = idx < dateList.length ? dateList[idx] : '';
                  const active = ymd ? activitySet.has(ymd) : false;
                  return (
                    <div
                      key={`H-${c}-${r}`}
                      className={`rounded-[1px] ${
                        ymd ? (active ? 'bg-twilight-amber dark:bg-nocturnal-accent' : 'bg-twilight-dusk/15 dark:bg-nocturnal-secondary/30') : 'bg-transparent'
                      }`}
                      title={ymd}
                    />
                  );
                })}
              </div>
            </div>
            </div>
          </div>
          <p className="text-[10px] text-twilight-duskLight dark:text-nocturnal-secondary mt-2">{recordedDays} {t('stats_days_unit')}</p>
        </div>
      </section>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-4 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm">
          <p className="text-[11px] text-twilight-duskLight dark:text-nocturnal-secondary uppercase tracking-wider">{t('stats_today_wings')}</p>
          <p className="text-xl font-bold text-twilight-charcoal dark:text-nocturnal-primary mt-0.5">
            {todayMessages}
            <span className="text-xs font-normal text-twilight-duskLight dark:text-nocturnal-secondary ml-1">{t('stats_times')}</span>
          </p>
        </div>
        <div className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-4 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm">
          <p className="text-[11px] text-twilight-duskLight dark:text-nocturnal-secondary uppercase tracking-wider">{t('stats_total_feathers')}</p>
          <p className="text-xl font-bold text-twilight-charcoal dark:text-nocturnal-primary mt-0.5">
            {totalFeathers.toLocaleString()}
            <span className="text-xs font-normal text-twilight-duskLight dark:text-nocturnal-secondary ml-1">{t('stats_feathers_unit')}</span>
          </p>
        </div>
      </div>

      <section className="space-y-3 pt-2">
        <Link
          to="/settings/ai"
          className="flex items-center justify-between gap-3 bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-4 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm hover:border-twilight-amber/30 dark:hover:border-nocturnal-accent/40 hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-twilight-amber/10 dark:bg-nocturnal-accent/20">
              <Shield className="text-twilight-amber dark:text-nocturnal-accent" size={20} />
            </div>
            <div className="text-left">
              <p className="font-medium text-twilight-charcoal dark:text-nocturnal-primary">{t('menu_model_config')}</p>
              <p className="text-xs text-twilight-duskLight dark:text-nocturnal-secondary">{t('ai_config_subtitle')}</p>
            </div>
          </div>
          <ChevronRight className="text-twilight-duskLight dark:text-nocturnal-secondary" size={20} />
        </Link>
        {/* 长期记忆入口 - 仅在启用时显示 */}
        {settings.enableLongTermMemory && (
          <Link
            to="/settings/memory"
            className="flex items-center justify-between gap-3 bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-4 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm hover:border-twilight-amber/30 dark:hover:border-nocturnal-accent/40 hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-twilight-amber/10 dark:bg-nocturnal-accent/20">
                <Brain className="text-twilight-amber dark:text-nocturnal-accent" size={20} />
              </div>
              <div className="text-left">
                <p className="font-medium text-twilight-charcoal dark:text-nocturnal-primary">{t('memory_management')}</p>
                <p className="text-xs text-twilight-duskLight dark:text-nocturnal-secondary">{t('memory_management_subtitle')}</p>
              </div>
            </div>
            <ChevronRight className="text-twilight-duskLight dark:text-nocturnal-secondary" size={20} />
          </Link>
        )}
        <Link
          to="/settings/language"
          className="flex items-center justify-between gap-3 bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-4 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm hover:border-twilight-amber/30 dark:hover:border-nocturnal-accent/40 hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-twilight-amberMuted/20 dark:bg-nocturnal-accentPurple/20">
              <Globe className="text-twilight-amberMuted dark:text-nocturnal-accentPurple" size={20} />
            </div>
            <div className="text-left">
              <p className="font-medium text-twilight-charcoal dark:text-nocturnal-primary">{t('display_options')}</p>
              <p className="text-xs text-twilight-duskLight dark:text-nocturnal-secondary">{t('display_options_subtitle')}</p>
            </div>
          </div>
          <ChevronRight className="text-twilight-duskLight dark:text-nocturnal-secondary" size={20} />
        </Link>
        <Link
          to="/settings/storage"
          className="flex items-center justify-between gap-3 bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-4 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm hover:border-twilight-amber/30 dark:hover:border-nocturnal-accent/40 hover:bg-twilight-cream/50 dark:hover:bg-nocturnal-bg/40 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-twilight-dusk/10 dark:bg-nocturnal-secondary/20">
              <Database className="text-twilight-dusk dark:text-nocturnal-secondary" size={20} />
            </div>
            <div className="text-left">
              <p className="font-medium text-twilight-charcoal dark:text-nocturnal-primary">{t('storage')}</p>
              <p className="text-xs text-twilight-duskLight dark:text-nocturnal-secondary">{t('storage_subtitle')}</p>
            </div>
          </div>
          <ChevronRight className="text-twilight-duskLight dark:text-nocturnal-secondary" size={20} />
        </Link>
      </section>

      <div className="pt-8 flex flex-col items-center gap-2 opacity-40 dark:opacity-50">
        <button
          onClick={handleLogoClick}
          className="cursor-pointer hover:opacity-60 transition-opacity"
          aria-label="查看更新日志"
        >
          <OwlLogo size={20} />
        </button>
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-twilight-dusk dark:text-nocturnal-secondary">Wing</p>
        <p className="text-[9px] font-normal text-twilight-duskLight dark:text-nocturnal-secondary">v{APP_VERSION}</p>
      </div>
    </div>
  );
};

export default SettingsMainView;
