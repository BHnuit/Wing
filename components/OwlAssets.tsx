/**
 * 猫头鹰意象资源组件
 * 提供：Logo、空状态插画、加载态插画、羽毛线条元素，统一黄昏配色与简约线条风格
 */

import React from 'react';
import { Feather } from 'lucide-react';

/** 亮色主题色：道林纸米白、深咖啡主文字、蜂蜜金强调、浅卡其分割；用于 stroke/fill，配合 className 可覆盖 */
const TWILIGHT = {
  amber: '#D9A54C',
  amberMuted: '#B07D48',
  dusk: '#4A3B32',
  duskLight: '#8C7B70',
  warmGray: '#4A3B32',
  cream: '#F2EFE5',
  charcoal: '#4A3B32',
  /** 主文字深咖啡，logo 等 */
  logo: '#4A3B32',
} as const;

/**
 * 应用 Logo：使用 public/OwlLogo.svg（用户提供的猫头鹰图形）
 * 用于 header、设置页脚、合成按钮等。深色模式下自动反色；深色背景可传 invert。
 */
export const OwlLogo: React.FC<{
  className?: string;
  size?: number;
  /** @deprecated 使用图片后无效，保留仅为兼容 */
  stroke?: string;
  /** 为 true 时始终反色，用于深色背景（如合成按钮） */
  invert?: boolean;
}> = ({ className = '', size = 24, invert }) => {
  const h = Math.round(size * (1024 / 896));
  return (
    <img
      src="/OwlLogo.svg"
      alt=""
      role="presentation"
      width={size}
      height={h}
      className={`block ${invert ? 'invert' : 'dark:invert'} ${className}`.trim()}
      aria-hidden
    />
  );
};

/** 单根羽毛：极简线条，用于装饰、列表项、分割 */
export const FeatherLine: React.FC<{
  className?: string;
  size?: number;
  stroke?: string;
  /** 朝左 false，朝右 true */
  flip?: boolean;
}> = ({ className = '', size = 24, stroke, flip }) => {
  const s = stroke ?? TWILIGHT.duskLight;
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={s}
      strokeWidth="1"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={flip ? { transform: 'scaleX(-1)' } : undefined}
      aria-hidden
    >
      <path d="M12 2 L4 12 Q12 10 20 12 L12 2" />
      <path d="M8 8 L16 8" />
    </svg>
  );
};

/**
 * 空状态插画：与收拢按钮同款的 lucide Feather 图标（尺寸 20），温和、留白
 * 用于：ChatView 无片段、JournalView 无日记
 */
export const EmptyStateOwl: React.FC<{
  className?: string;
  size?: number;
}> = ({ className = '' }) => {
  return (
    <div className={`flex flex-col items-center justify-center ${className}`} aria-hidden>
      <Feather size={20} className="opacity-40" style={{ color: TWILIGHT.duskLight }} aria-hidden />
    </div>
  );
};

/**
 * 加载态插画：与收拢按钮同款的 lucide Feather 图标（尺寸 20）+ 脉动，表示「在编织/整理」
 * 用于：合成中、拉取中、测试连接中
 */
export const LoadingOwl: React.FC<{
  className?: string;
  size?: number;
  /** 线条颜色，默认 TWILIGHT.amber；金色按钮上可传 'white' */
  stroke?: string;
}> = ({ className = '', stroke }) => {
  return (
    <div className={`inline-flex flex-col items-center justify-center animate-pulse ${className}`} aria-hidden>
      <Feather size={20} style={{ color: stroke ?? TWILIGHT.amber }} aria-hidden />
    </div>
  );
};

/**
 * 小号猫头鹰图标：用于「猫头鹰洞察」区、分享卡等
 * 与 OwlLogo 风格一致，可填色
 */
export const OwlInsightIcon: React.FC<{
  className?: string;
  size?: number;
}> = ({ className = '', size = 24 }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="8" cy="11" r="2.5" />
      <circle cx="16" cy="11" r="2.5" />
      <path d="M12 14.5 L10 18 L14 18 Z" />
      <path d="M5 9 L3 6" />
      <path d="M19 9 L21 6" />
      <path d="M6 17 Q12 20 18 17" />
    </svg>
  );
};

export default OwlLogo;
