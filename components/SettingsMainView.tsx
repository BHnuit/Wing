/**
 * 设置一级页：个人信息（蓝色日历、今日挥动翅膀/收集羽毛总数）、入口菜单（模型配置、语言选项、存储管理）
 */

import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Shield, Database, Globe, ChevronRight } from 'lucide-react';
import { MockDataService } from '../services/mockDataService';
import { getLocalDateString } from '../utils/date';
import { OwlLogo } from './OwlAssets';
import { useTranslation } from '../i18n';

const CELL_SIZE = 10;
const GAP = 2;
const ROWS = 6;
const MAX_DAYS = 365;

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

const SettingsMainView: React.FC = () => {
  const [settings, setSettings] = useState(MockDataService.getSettings());
  const t = useTranslation(settings.language);
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

  const recordedDays = activitySet.size;

  return (
    <div className="p-6 space-y-6">
      <h2 className="serif text-2xl font-bold text-twilight-charcoal dark:text-nocturnal-primary">{t('settings')}</h2>

      <section className="space-y-2">
        <p className="text-sm font-medium text-twilight-warm dark:text-nocturnal-secondary">{t('stats_days_recorded')}</p>
        <div className="bg-twilight-cream dark:bg-nocturnal-surface rounded-2xl p-4 border border-twilight-divider dark:border-nocturnal-secondary/25 shadow-sm w-full">
          <div ref={calendarRef} className="w-full">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `repeat(${nCols}, ${CELL_SIZE}px)`,
                gridTemplateRows: `repeat(${ROWS}, ${CELL_SIZE}px)`,
                gap: GAP
              }}
            >
              {Array.from({ length: ROWS * nCols }, (_, i) => {
                const ymd = i < dateList.length ? dateList[i] : '';
                const active = ymd ? activitySet.has(ymd) : false;
                return (
                  <div
                    key={i}
                    className={`rounded-[1px] ${
                      ymd ? (active ? 'bg-twilight-amber dark:bg-nocturnal-accent' : 'bg-twilight-dusk/15 dark:bg-nocturnal-secondary/30') : 'bg-transparent'
                    }`}
                    title={ymd}
                  />
                );
              })}
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
        <OwlLogo size={20} />
        <p className="text-[10px] font-bold tracking-[0.2em] uppercase text-twilight-dusk dark:text-nocturnal-secondary">Wing</p>
      </div>
    </div>
  );
};

export default SettingsMainView;
