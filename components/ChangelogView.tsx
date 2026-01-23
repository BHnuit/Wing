/**
 * 更新日志页面：展示 CHANGELOG.md 内容，使用与日记详情页相同的样式
 */

import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, ChevronUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * 将 Markdown 内容按 h2 标题分组
 */
function parseChangelog(content: string): Array<{ title: string; content: string }> {
  const sections: Array<{ title: string; content: string }> = [];
  const lines = content.split('\n');
  let currentTitle = '';
  let currentContent: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 检测 h2 标题（## 开头）
    if (line.startsWith('## ')) {
      // 保存上一个部分
      if (currentTitle) {
        sections.push({
          title: currentTitle,
          content: currentContent.join('\n')
        });
      }
      // 开始新部分
      currentTitle = line.substring(3).trim();
      currentContent = [];
    } else {
      currentContent.push(line);
    }
  }

  // 保存最后一个部分
  if (currentTitle) {
    sections.push({
      title: currentTitle,
      content: currentContent.join('\n')
    });
  }

  return sections;
}

const ChangelogView: React.FC = () => {
  const navigate = useNavigate();
  const [changelogContent, setChangelogContent] = useState<string>('');
  const [expandedSections, setExpandedSections] = useState<Set<number>>(new Set([0])); // 默认展开第一个版本

  /**
   * 加载 CHANGELOG.md 内容
   */
  useEffect(() => {
    fetch('/CHANGELOG.md')
      .then((res) => res.text())
      .then((text) => setChangelogContent(text))
      .catch((err) => {
        console.error('Failed to load changelog:', err);
        setChangelogContent('# 更新日志\n\n无法加载更新日志。');
      });
  }, []);

  /**
   * 解析更新日志内容，按版本分组
   */
  const sections = useMemo(() => {
    if (!changelogContent) return [];
    // 移除主标题（# 更新日志）
    const contentWithoutTitle = changelogContent.replace(/^#\s+更新日志\s*\n\n?/, '');
    return parseChangelog(contentWithoutTitle);
  }, [changelogContent]);

  /**
   * 当内容加载完成后，确保只展开第一个版本（最新版本）
   */
  useEffect(() => {
    if (sections.length > 0) {
      setExpandedSections(new Set([0]));
    }
  }, [sections.length]);

  /**
   * 切换版本的展开/折叠状态
   */
  const toggleSection = (index: number) => {
    setExpandedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  /**
   * 双击 header 时滚动到顶部
   */
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="bg-twilight-bg dark:bg-nocturnal-bg min-h-screen">
      <header 
        className="fixed top-0 left-0 w-full z-50 glass px-4 py-3 flex items-center justify-between h-[4.125rem] relative cursor-pointer select-none border-b border-twilight-divider dark:border-nocturnal-secondary/25" 
        style={{ position: 'fixed', top: 0, left: 0, right: 0, width: '100%' }}
        onDoubleClick={scrollToTop}
        title="双击回到顶部"
      >
        <button 
          onClick={() => navigate(-1)} 
          className="p-2 text-twilight-duskLight dark:text-nocturnal-secondary hover:text-twilight-amber dark:hover:text-nocturnal-accent hover:bg-twilight-cream dark:hover:bg-nocturnal-surface/60 rounded-full transition-colors flex-shrink-0 z-10"
        >
          <ArrowLeft size={20} />
        </button>
        <h2 className="serif text-lg font-bold text-twilight-charcoal dark:text-nocturnal-primary truncate absolute left-1/2 -translate-x-1/2 max-w-[60%] px-3 pointer-events-none" style={{ zIndex: 1 }}>
          更新日志
        </h2>
        <div className="flex-shrink-0 w-10" /> {/* 占位，保持标题居中 */}
      </header>

      {/* 内容区域 - 使用与日记详情页相同的样式 */}
      <div className="px-8 pt-6 pb-12" style={{ paddingTop: 'calc(1.5rem + 4.125rem)' }}>
        <h1 className="serif text-4xl font-bold text-twilight-charcoal dark:text-nocturnal-primary leading-tight mb-4">
          更新日志
        </h1>
        <p className="text-twilight-duskLight dark:text-nocturnal-accent text-sm uppercase tracking-widest mb-8">
          Wing Changelog
        </p>
      </div>

      <div className="px-8 pb-12">
        {changelogContent ? (
          <div className="prose max-w-none prose-lg overflow-hidden">
            {sections.length > 0 ? (
              <div className="space-y-4">
                {sections.map((section, index) => {
                  const isExpanded = expandedSections.has(index);
                  return (
                    <div key={index} className="border-b border-twilight-divider dark:border-nocturnal-secondary/25 pb-4 last:border-0 last:pb-0">
                      {/* 可点击的标题 */}
                      <button
                        onClick={() => toggleSection(index)}
                        className="w-full flex items-center justify-between gap-3 text-left hover:opacity-80 transition-opacity group"
                      >
                        <h2 className="serif text-lg font-bold text-twilight-charcoal dark:text-nocturnal-primary mt-6 mb-3 flex-1">
                          {section.title}
                        </h2>
                        <div className="flex-shrink-0 text-twilight-duskLight dark:text-nocturnal-secondary group-hover:text-twilight-amber dark:group-hover:text-nocturnal-accent transition-colors">
                          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                        </div>
                      </button>

                      {/* 可折叠的内容 */}
                      <div
                        className={`overflow-hidden transition-all duration-300 ease-in-out ${
                          isExpanded ? 'max-h-[10000px] opacity-100' : 'max-h-0 opacity-0'
                        }`}
                      >
                        <div className="pt-2">
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
                              ul: ({ children }) => (
                                <ul className="list-disc list-outside mb-6 space-y-2 text-sm text-twilight-warm dark:text-nocturnal-primary pl-6">
                                  {children}
                                </ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="list-decimal list-outside mb-6 space-y-2 text-sm text-twilight-warm dark:text-nocturnal-primary pl-6">
                                  {children}
                                </ol>
                              ),
                              li: ({ children }) => (
                                <li className="leading-relaxed pl-2">{children}</li>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-semibold text-twilight-charcoal dark:text-nocturnal-primary">
                                  {children}
                                </strong>
                              ),
                              em: ({ children }) => (
                                <em className="italic text-twilight-warm dark:text-nocturnal-secondary">
                                  {children}
                                </em>
                              ),
                              hr: () => (
                                <hr className="border-twilight-divider dark:border-nocturnal-secondary/30 my-8" />
                              ),
                              code: ({ inline, children }) => {
                                // 更新日志中的代码块统一使用行内代码样式，不使用代码块样式
                                return (
                                  <code className="bg-twilight-cream/80 dark:bg-nocturnal-surface/80 px-2 py-1 rounded text-sm font-mono text-twilight-charcoal dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25">
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
                            }}
                          >
                            {section.content}
                          </ReactMarkdown>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
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
                  ul: ({ children }) => (
                    <ul className="list-disc list-outside mb-6 space-y-2 text-sm text-twilight-warm dark:text-nocturnal-primary pl-6">
                      {children}
                    </ul>
                  ),
                  ol: ({ children }) => (
                    <ol className="list-decimal list-outside mb-6 space-y-2 text-sm text-twilight-warm dark:text-nocturnal-primary pl-6">
                      {children}
                    </ol>
                  ),
                  li: ({ children }) => (
                    <li className="leading-relaxed pl-2">{children}</li>
                  ),
                  strong: ({ children }) => (
                    <strong className="font-semibold text-twilight-charcoal dark:text-nocturnal-primary">
                      {children}
                    </strong>
                  ),
                  em: ({ children }) => (
                    <em className="italic text-twilight-warm dark:text-nocturnal-secondary">
                      {children}
                    </em>
                  ),
                  hr: () => (
                    <hr className="border-twilight-divider dark:border-nocturnal-secondary/30 my-8" />
                  ),
                  code: ({ inline, children }) => {
                    return (
                      <code className="bg-twilight-cream/80 dark:bg-nocturnal-surface/80 px-2 py-1 rounded text-sm font-mono text-twilight-charcoal dark:text-nocturnal-primary border border-twilight-divider dark:border-nocturnal-secondary/25">
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
                }}
              >
                {changelogContent}
              </ReactMarkdown>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center py-8">
            <p className="text-twilight-duskLight dark:text-nocturnal-secondary">加载中...</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChangelogView;
