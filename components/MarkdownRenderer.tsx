/**
 * Markdown 渲染组件
 * 使用 react-markdown 渲染 Markdown 内容，并支持图片占位符替换
 */

import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { WingEntry } from '../types';

interface MarkdownRendererProps {
  content: string;
  entry?: WingEntry;
  /** 当日消息记录中的图片（base64/data URL），按时间排序；优先于 entry.images，与 ChatView 同源 */
  sessionImageFragments?: string[];
}

/** 占位 URL 前缀，在 img 组件内解析为真实 data URL，避免把超长 data URL 放进 Markdown 被解析器截断 */
const WING_IMG_PLACEHOLDER_PREFIX = '__WING_IMG_';

/**
 * 规范化 data URL：去空白、补全 data: 前缀；与 ChatView 使用的格式一致，只做最小处理
 */
function toCleanDataUrl(d: string): string {
  const s = (d.startsWith('data:') ? d : `data:image/png;base64,${d}`).replace(/\s/g, '');
  return s.length > 22 ? s : ''; // "data:image/png;base64," 长度为 22，无内容则视为无效
}

/**
 * Markdown 渲染器组件
 * 支持标准的 Markdown 语法，并将 [Image] 占位符替换为实际图片。
 * 图片使用短占位符 __WING_IMG_N__，在 img 组件内解析为 data URL，与消息页一样直接赋给 src，避免把超长 URL 放进 Markdown 导致解析截断。
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, entry, sessionImageFragments }) => {
  // 与 ChatView 同源：session 有图时用 session，否则用 entry.images；只做去空白和补前缀
  let raw: string[] = [];
  if (sessionImageFragments && sessionImageFragments.length > 0) {
    raw = sessionImageFragments.filter((d): d is string => !!d && typeof d === 'string');
  } else if (entry?.images && Object.keys(entry.images).length > 0) {
    raw = (Object.values(entry.images) as string[]).filter((d): d is string => !!d && typeof d === 'string');
  }
  const imageArray = raw.map(toCleanDataUrl).filter(Boolean);

  // 用短占位符替换 [Image]，不把 data URL 写进 Markdown，避免 remark/序列化截断
  const processContent = (text: string): string => {
    if (imageArray.length === 0) return text;
    let imageIndex = 0;
    let out = text.replace(/\[Image\]/gi, () => {
      if (imageIndex < imageArray.length) return `![Journal image](${WING_IMG_PLACEHOLDER_PREFIX}${imageIndex++}__)`;
      return '';
    });
    if (imageIndex < imageArray.length) {
      out += '\n\n' + imageArray.slice(imageIndex).map((_, i) => `![Journal image](${WING_IMG_PLACEHOLDER_PREFIX}${imageIndex + i}__)`).join('\n\n');
    }
    return out;
  };

  const processedContent = processContent(content);

  // 占位符解析：__WING_IMG_N__ -> imageArray[N]，与 ChatView 一样直接作为 img src，不经 Markdown URL 解析
  const resolveImgSrc = (src: string | undefined): string => {
    if (!src || typeof src !== 'string') return '';
    const m = src.match(/^__WING_IMG_(\d+)__$/);
    if (!m) return src;
    const i = parseInt(m[1], 10);
    return (imageArray[i] !== undefined ? imageArray[i] : '') as string;
  };

  return (
    <div className="prose max-w-none prose-lg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p: ({ children }) => (
            <p className="text-twilight-warm dark:text-nocturnal-primary leading-relaxed text-base mb-6 last:mb-0">
              {children}
            </p>
          ),
          h1: ({ children }) => (
            <h1 className="serif text-2xl font-bold text-twilight-charcoal dark:text-nocturnal-primary mt-8 mb-4 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="serif text-lg font-bold text-twilight-charcoal dark:text-nocturnal-primary mt-6 mb-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="serif text-base font-semibold text-twilight-charcoal dark:text-nocturnal-primary mt-4 mb-2">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="serif text-sm font-semibold text-twilight-charcoal dark:text-nocturnal-primary mt-4 mb-2">
              {children}
            </h4>
          ),
          h5: ({ children }) => (
            <h5 className="serif text-xs font-medium text-twilight-charcoal dark:text-nocturnal-primary mt-3 mb-1">
              {children}
            </h5>
          ),
          h6: ({ children }) => (
            <h6 className="serif text-[11px] font-medium text-twilight-charcoal dark:text-nocturnal-primary mt-3 mb-1">
              {children}
            </h6>
          ),
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-6 space-y-2 text-twilight-warm dark:text-nocturnal-primary">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-6 space-y-2 text-twilight-warm dark:text-nocturnal-primary">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          img: ({ src, alt }) => {
            const isPlaceholder = /^__WING_IMG_\d+__$/.test(String(src || ''));
            const finalSrc = isPlaceholder ? resolveImgSrc(src) : (src || '');
            return (
              <div className="my-6 rounded-2xl overflow-hidden border border-twilight-divider dark:border-nocturnal-secondary/25">
                <img
                  src={finalSrc}
                  alt={alt || 'Journal image'}
                  className="w-full h-auto object-cover"
                  style={{ maxHeight: '500px' }}
                  loading="lazy"
                />
              </div>
            );
          },
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-twilight-amber/50 dark:border-nocturnal-accent/50 pl-4 italic text-twilight-dusk dark:text-nocturnal-secondary my-6">
              {children}
            </blockquote>
          ),
          code: ({ inline, children }) => {
            if (inline) {
              return (
                <code className="bg-twilight-cream/80 dark:bg-nocturnal-surface/80 px-2 py-1 rounded text-sm font-mono text-twilight-charcoal dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-twilight-charcoal dark:bg-nocturnal-surface text-twilight-amberMuted dark:text-nocturnal-primary p-4 rounded-xl overflow-x-auto text-sm font-mono my-4 border border-transparent dark:border-nocturnal-secondary/20">
                {children}
              </code>
            );
          },
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-twilight-amber dark:text-nocturnal-accent hover:text-twilight-amberMuted dark:hover:text-nocturnal-accent/80 underline"
            >
              {children}
            </a>
          ),
          hr: () => (
            <hr className="border-twilight-divider dark:border-nocturnal-secondary/30 my-8" />
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-twilight-charcoal dark:text-nocturnal-primary">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-twilight-warm dark:text-nocturnal-secondary">{children}</em>
          )
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;

