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
}

/**
 * Markdown 渲染器组件
 * 支持标准的 Markdown 语法，并将 [Image] 占位符替换为实际图片
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, entry }) => {
  // 处理图片占位符
  const processContent = (text: string): string => {
    if (!entry?.images || Object.keys(entry.images).length === 0) {
      return text;
    }

    // 将图片映射转换为数组（按fragmentId排序以保持顺序）
    const imageArray = Object.entries(entry.images)
      .sort(([idA], [idB]) => idA.localeCompare(idB))
      .map(([, imageData]) => imageData);

    let imageIndex = 0;
    let processedText = text;

    // 替换 [Image] 占位符为 Markdown 图片语法
    processedText = processedText.replace(/\[Image\]/g, () => {
      if (imageIndex < imageArray.length) {
        const imageData = imageArray[imageIndex];
        imageIndex++;
        // 使用 base64 数据 URI
        return `![Journal image](${imageData})`;
      }
      return '';
    });

    return processedText;
  };

  const processedContent = processContent(content);

  return (
    <div className="prose prose-slate max-w-none prose-lg">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 自定义段落样式
          p: ({ children }) => (
            <p className="text-slate-700 leading-relaxed text-lg mb-6 last:mb-0">
              {children}
            </p>
          ),
          // 自定义标题样式
          h1: ({ children }) => (
            <h1 className="serif text-3xl font-bold text-slate-900 mt-8 mb-4 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="serif text-2xl font-bold text-slate-900 mt-6 mb-3">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="serif text-xl font-semibold text-slate-800 mt-4 mb-2">
              {children}
            </h3>
          ),
          // 自定义列表样式
          ul: ({ children }) => (
            <ul className="list-disc list-inside mb-6 space-y-2 text-slate-700">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal list-inside mb-6 space-y-2 text-slate-700">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="leading-relaxed">{children}</li>
          ),
          // 自定义图片样式
          img: ({ src, alt }) => (
            <div className="my-6 rounded-2xl overflow-hidden">
              <img
                src={src}
                alt={alt || 'Journal image'}
                className="w-full h-auto object-cover"
                style={{ maxHeight: '500px' }}
                loading="lazy"
              />
            </div>
          ),
          // 自定义引用样式
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-blue-300 pl-4 italic text-slate-600 my-6">
              {children}
            </blockquote>
          ),
          // 自定义代码样式
          code: ({ inline, children }) => {
            if (inline) {
              return (
                <code className="bg-slate-100 px-2 py-1 rounded text-sm font-mono text-slate-800">
                  {children}
                </code>
              );
            }
            return (
              <code className="block bg-slate-900 text-slate-100 p-4 rounded-xl overflow-x-auto text-sm font-mono my-4">
                {children}
              </code>
            );
          },
          // 自定义链接样式
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-700 underline"
            >
              {children}
            </a>
          ),
          // 自定义分隔线样式
          hr: () => (
            <hr className="border-slate-200 my-8" />
          ),
          // 自定义强调样式
          strong: ({ children }) => (
            <strong className="font-semibold text-slate-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-slate-700">{children}</em>
          )
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;

