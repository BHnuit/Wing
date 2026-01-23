/**
 * Markdown 渲染组件
 * 使用 react-markdown 渲染 Markdown 内容，并支持图片占位符替换
 * 支持智能图片布局：横图、竖图、超长图的自动适配
 * 支持竖图文字环绕（50%宽度，左右混排）
 * 支持点击放大查看（Lightbox）
 */

import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Maximize2, X, ChevronLeft, ChevronRight, ZoomIn } from 'lucide-react';
import { WingEntry } from '../types';
import { debounce } from '../utils/performance';

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
 * 图片布局类型
 */
type ImageLayoutType = 'landscape' | 'portrait' | 'ultra-tall';

/**
 * 检测图片布局类型
 * @param width 图片宽度
 * @param height 图片高度
 * @returns 布局类型
 */
function detectImageLayout(width: number, height: number): ImageLayoutType {
  if (width === 0 || height === 0) return 'landscape';
  const ratio = height / width;
  if (ratio > 2.5) return 'ultra-tall'; // 超长图
  if (ratio > 1) return 'portrait'; // 竖图
  return 'landscape'; // 横图
}

/**
 * 图片 Lightbox 组件
 */
interface ImageLightboxProps {
  images: string[];
  currentIndex: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

const ImageLightbox: React.FC<ImageLightboxProps> = ({ images, currentIndex, onClose, onNavigate }) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement>(null);

  const currentImage = images[currentIndex];
  const canGoPrev = currentIndex > 0;
  const canGoNext = currentIndex < images.length - 1;

  // 重置缩放和位置当切换图片时
  useEffect(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, [currentIndex]);

  // 键盘事件处理
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && canGoPrev) {
        onNavigate(currentIndex - 1);
      } else if (e.key === 'ArrowRight' && canGoNext) {
        onNavigate(currentIndex + 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, canGoPrev, canGoNext, onClose, onNavigate]);

  // 鼠标滚轮缩放
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale(prev => Math.max(0.5, Math.min(3, prev + delta)));
  };

  // 拖拽处理
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale > 1) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && scale > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // 双击重置
  const handleDoubleClick = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm flex items-center justify-center"
      onClick={onClose}
      onWheel={handleWheel}
    >
      {/* 关闭按钮 */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
        aria-label="关闭"
      >
        <X size={24} />
      </button>

      {/* 上一张按钮 */}
      {canGoPrev && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex - 1);
          }}
          className="absolute left-4 z-10 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          aria-label="上一张"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {/* 下一张按钮 */}
      {canGoNext && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onNavigate(currentIndex + 1);
          }}
          className="absolute right-4 z-10 p-3 rounded-full bg-black/50 hover:bg-black/70 text-white transition-colors"
          aria-label="下一张"
        >
          <ChevronRight size={24} />
        </button>
      )}

      {/* 图片计数 */}
      {images.length > 1 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-black/50 text-white text-sm">
          {currentIndex + 1} / {images.length}
        </div>
      )}

      {/* 图片容器 */}
      <div
        className="relative max-w-[90vw] max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          ref={imageRef}
          src={currentImage}
          alt="查看大图"
          className="max-w-full max-h-[90vh] object-contain cursor-move select-none"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
            transition: isDragging ? 'none' : 'transform 0.2s'
          }}
          onDoubleClick={handleDoubleClick}
          draggable={false}
        />
      </div>

      {/* 缩放提示 */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10 px-4 py-2 rounded-full bg-black/50 text-white text-xs">
        滚轮缩放 · 双击重置 · ESC 关闭
      </div>
    </div>
  );
};

/**
 * Markdown 渲染器组件
 * 支持标准的 Markdown 语法，并将 [Image] 占位符替换为实际图片。
 * 图片使用短占位符 __WING_IMG_N__，在 img 组件内解析为 data URL，与消息页一样直接赋给 src，避免把超长 URL 放进 Markdown 导致解析截断。
 * 支持智能图片布局和点击放大查看。
 */
export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, entry, sessionImageFragments }) => {
  // Lightbox 状态
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  
  // 存储竖图的实际渲染高度（key: imageIndex, value: height in px）
  const portraitImageHeights = useRef<Map<number, number>>(new Map());
  
  // 存储所有图片在 300px 高度限制下的实际渲染宽度（key: imageIndex, value: width in px）
  const imageWidths = useRef<Map<number, number>>(new Map());

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

  // 打开 Lightbox
  const openLightbox = (index: number) => {
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  // 关闭 Lightbox
  const closeLightbox = () => {
    setLightboxOpen(false);
  };

  // 导航到指定图片
  const navigateLightbox = (index: number) => {
    setLightboxIndex(index);
  };

  /**
   * 按句子结束标点符号分段文字
   * @param text 原始文字
   * @returns 分段后的文字数组
   */
  const splitTextBySentences = (text: string): string[] => {
    // 匹配句号、问号、感叹号、省略号等句子结束标点
    // 包括：。！？…（中文）和 .!?…（英文）
    const sentenceEndRegex = /([。！？…\.!?…]+)/g;
    const parts: string[] = [];
    let lastIndex = 0;
    let match;
    
    while ((match = sentenceEndRegex.exec(text)) !== null) {
      const endIndex = match.index + match[0].length;
      parts.push(text.substring(lastIndex, endIndex));
      lastIndex = endIndex;
    }
    
    // 添加剩余部分
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex));
    }
    
    return parts.filter(p => p.trim().length > 0);
  };

  /**
   * 智能段落组件
   * 检测前面是否有竖图，如果有且文字高度超过竖图，则分段显示
   */
  const SmartParagraph: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const paragraphRef = useRef<HTMLParagraphElement>(null);
    const [shouldSplit, setShouldSplit] = useState(false);
    const [segments, setSegments] = useState<string[]>([]);
    
    const updateSegmentation = () => {
      if (!paragraphRef.current) return;
      
      // 查找前面的竖图
      const currentElement = paragraphRef.current;
      let previousElement: Element | null = currentElement.previousElementSibling;
      
      // 向上查找竖图容器（可能跨过 clear-both div）
      let portraitContainer: HTMLElement | null = null;
      while (previousElement) {
        portraitContainer = previousElement.querySelector('[data-portrait-image-index]') as HTMLElement;
        if (portraitContainer) break;
        previousElement = previousElement.previousElementSibling;
      }
      
      let portraitHeight: number | null = null;
      
      if (portraitContainer) {
        const index = parseInt(portraitContainer.getAttribute('data-portrait-image-index') || '-1', 10);
        if (index >= 0) {
          portraitHeight = portraitImageHeights.current.get(index) || null;
          // 如果高度未测量，尝试直接从 DOM 获取
          if (!portraitHeight && portraitContainer.offsetHeight > 0) {
            portraitHeight = portraitContainer.offsetHeight;
            portraitImageHeights.current.set(index, portraitHeight);
          }
        }
      }
      
      // 如果没有竖图或竖图高度未测量，不分割
      if (!portraitHeight || portraitHeight === 0) {
        setShouldSplit(false);
        setSegments([]);
        return;
      }
      
      // 获取段落文本内容
      const textContent = currentElement.textContent || '';
      if (!textContent.trim()) {
        setShouldSplit(false);
        setSegments([]);
        return;
      }
      
      // 先测量整个段落的高度
      const paragraphHeight = currentElement.offsetHeight;
      
      // 如果段落高度不超过竖图高度，不分割
      if (paragraphHeight <= portraitHeight) {
        setShouldSplit(false);
        setSegments([]);
        return;
      }
      
      // 需要分段：按句子分割
      const sentences = splitTextBySentences(textContent);
      if (sentences.length <= 1) {
        setShouldSplit(false);
        setSegments([]);
        return;
      }
      
      // 创建临时元素来测量每段的高度
      const tempDiv = document.createElement('div');
      const computedStyle = window.getComputedStyle(currentElement);
      tempDiv.style.cssText = computedStyle.cssText;
      tempDiv.style.position = 'absolute';
      tempDiv.style.visibility = 'hidden';
      tempDiv.style.width = currentElement.offsetWidth + 'px';
      tempDiv.style.height = 'auto';
      tempDiv.className = currentElement.className;
      document.body.appendChild(tempDiv);
      
      const resultSegments: string[] = [];
      let currentSegment = '';
      
      for (const sentence of sentences) {
        const testText = currentSegment + sentence;
        tempDiv.textContent = testText;
        const testHeight = tempDiv.offsetHeight;
        
        if (testHeight <= portraitHeight!) {
          currentSegment = testText;
        } else {
          if (currentSegment) {
            resultSegments.push(currentSegment);
          }
          // 测试单个句子是否超过高度
          tempDiv.textContent = sentence;
          if (tempDiv.offsetHeight > portraitHeight!) {
            // 单个句子就超过高度，仍然添加（避免无限循环）
            resultSegments.push(sentence);
            currentSegment = '';
          } else {
            currentSegment = sentence;
          }
        }
      }
      
      if (currentSegment) {
        resultSegments.push(currentSegment);
      }
      
      document.body.removeChild(tempDiv);
      
      // 如果分段后只有一段，不分割
      if (resultSegments.length <= 1) {
        setShouldSplit(false);
        setSegments([]);
        return;
      }
      
      // 设置分段结果
      setShouldSplit(true);
      setSegments(resultSegments);
    };
    
    useEffect(() => {
      // 初始渲染后检查
      const timer = setTimeout(updateSegmentation, 100);
      
      // 监听竖图高度更新事件
      const handleHeightUpdate = () => {
        updateSegmentation();
      };
      
      window.addEventListener('portrait-image-height-updated', handleHeightUpdate);
      
      return () => {
        clearTimeout(timer);
        window.removeEventListener('portrait-image-height-updated', handleHeightUpdate);
      };
    }, [children]);
    
    // 如果需要分段，渲染为多个段落
    if (shouldSplit && segments.length > 0) {
      return (
        <>
          {segments.map((segment, index) => (
            <p
              key={index}
              className="text-twilight-warm dark:text-nocturnal-primary leading-relaxed text-base mb-6 last:mb-0"
              style={{ 
                verticalAlign: 'top', 
                marginTop: index === 0 ? 0 : undefined,
                // 第一段后，所有段落都清除浮动，从新行开始（不再环绕竖图）
                clear: index > 0 ? 'both' : 'none'
              }}
            >
              {segment}
            </p>
          ))}
        </>
      );
    }
    
    // 不需要分段，正常渲染
    return (
      <p 
        ref={paragraphRef}
        className="text-twilight-warm dark:text-nocturnal-primary leading-relaxed text-base mb-6 last:mb-0"
        style={{ verticalAlign: 'top', marginTop: 0 }}
      >
        {children}
      </p>
    );
  };

  /**
   * 智能图片组件
   * 根据图片尺寸自动选择布局方式
   */
  const SmartImage: React.FC<{ src: string; alt: string; imageIndex: number }> = ({ src, alt, imageIndex }) => {
    const [layoutType, setLayoutType] = useState<ImageLayoutType>('landscape');
    const [imageLoaded, setImageLoaded] = useState(false);
    const [floatSide, setFloatSide] = useState<'left' | 'right'>('right'); // 竖图默认右侧
    const [portraitWidthPercent, setPortraitWidthPercent] = useState<number>(50); // 竖图容器宽度百分比（桌面模式），默认50%，最大不超过50%
    const [portraitContainerWidth, setPortraitContainerWidth] = useState<number | null>(null); // 竖图容器宽度（移动模式，像素值），null 表示使用默认
    const [landscapeContainerWidth, setLandscapeContainerWidth] = useState<number | null>(null); // 横图和超长图容器宽度（像素），null 表示使用默认
    const [isMobile, setIsMobile] = useState(false); // 移动模式检测
    const imgRef = useRef<HTMLImageElement>(null);
    const portraitContainerRef = useRef<HTMLDivElement>(null);
    const landscapeContainerRef = useRef<HTMLDivElement>(null);

    // 检测移动模式（窗口宽度 < 768px），使用防抖优化性能
    useEffect(() => {
      const checkMobile = () => {
        setIsMobile(window.innerWidth < 768);
      };
      
      checkMobile();
      const debouncedCheckMobile = debounce(checkMobile, 150);
      window.addEventListener('resize', debouncedCheckMobile);
      return () => window.removeEventListener('resize', debouncedCheckMobile);
    }, []);

    // 检测图片尺寸并决定布局
    const handleImageLoad = () => {
      if (imgRef.current) {
        const { naturalWidth, naturalHeight } = imgRef.current;
        const detectedLayout = detectImageLayout(naturalWidth, naturalHeight);
        setLayoutType(detectedLayout);
        setImageLoaded(true);

        // 计算图片在 300px 高度限制下的实际宽度
        const maxHeight = 300;
        let calculatedWidth: number;
        
        if (naturalHeight <= maxHeight) {
          // 图片高度不超过限制，使用原始宽度
          calculatedWidth = naturalWidth;
        } else {
          // 图片高度超过限制，按比例计算宽度
          calculatedWidth = (naturalWidth / naturalHeight) * maxHeight;
        }
        
        // 存储图片宽度（包括竖图、横图和超长图）
        imageWidths.current.set(imageIndex, calculatedWidth);
        
        // 竖图随机选择左右（基于图片索引，保持一致性）
        if (detectedLayout === 'portrait') {
          setFloatSide(imageIndex % 2 === 0 ? 'right' : 'left');
          // 计算竖图容器宽度百分比：根据图片在300px高度限制下的实际宽度动态设置，最大不超过50%
          // 需要等待容器渲染后通过 ResizeObserver 获取父容器宽度来计算
        }
        
        // 找到所有图片中的最大宽度（包括竖图、横图和超长图）
        let maxWidth = 0;
        imageWidths.current.forEach((width) => {
          if (width > maxWidth) {
            maxWidth = width;
          }
        });
        
        // 通知 Layout 组件更新容器宽度
        window.dispatchEvent(new CustomEvent('image-width-updated', { 
          detail: { maxWidth, imageIndex } 
        }));
      }
    };

    // 打开 Lightbox
    const handleClick = () => {
      openLightbox(imageIndex);
    };

    // 根据布局类型获取容器类名
    const getContainerClassName = () => {
      const baseClasses = 'rounded-2xl overflow-hidden border border-twilight-divider dark:border-nocturnal-secondary/25 cursor-pointer group relative transition-all hover:shadow-lg hover:border-twilight-amber/50 dark:hover:border-nocturnal-accent/50';
      
      switch (layoutType) {
        case 'portrait':
          // 竖图：独立块级元素，50%宽度，上下有间距，靠一侧显示
          return `${baseClasses} my-8 w-[50%] max-w-[50%] ${floatSide === 'left' ? 'mr-auto' : 'ml-auto'}`;
        case 'ultra-tall':
          // 超长图：块级元素，动态宽度，居中显示，不参与文字环绕，上下保持段落间距
          return `${baseClasses} block my-6 mx-auto`;
        case 'landscape':
        default:
          // 横图：块级元素，动态宽度，居中显示，不参与文字环绕，上下保持段落间距
          return `${baseClasses} block my-6 mx-auto`;
      }
    };

    // 获取图片最大高度
    const getMaxHeight = () => {
      switch (layoutType) {
        case 'portrait':
          return '300px'; // 竖图限制高度300px
        case 'ultra-tall':
          return '300px';
        case 'landscape':
        default:
          return '300px';
      }
    };

    // 竖图：独立块级显示，动态宽度（根据图片在300px高度限制下的实际宽度），最大不超过50%，靠一侧，上下有间距
    // 使用 float 布局，确保文字从顶部对齐
    // 高度超过300px时限制为300px，宽度等比例缩小
    
    // 监听父容器宽度变化，动态计算竖图容器宽度
    useEffect(() => {
      if (layoutType === 'portrait' && imageLoaded && portraitContainerRef.current) {
        const container = portraitContainerRef.current;
        const calculatedWidth = imageWidths.current.get(imageIndex);
        if (!calculatedWidth) return;

        // 获取父容器（Markdown 渲染容器）的宽度
        const findParentContainer = (el: HTMLElement | null): HTMLElement | null => {
          if (!el) return null;
          // 向上查找，找到有 padding 的容器（通常是 px-8 的容器）
          let parent = el.parentElement;
          while (parent) {
            const style = window.getComputedStyle(parent);
            const paddingLeft = parseFloat(style.paddingLeft) || 0;
            const paddingRight = parseFloat(style.paddingRight) || 0;
            if (paddingLeft > 0 || paddingRight > 0) {
              return parent;
            }
            parent = parent.parentElement;
          }
          return null;
        };

        const parentContainer = findParentContainer(container);
        if (!parentContainer) return;

        const updateWidth = () => {
          const parentWidth = parentContainer.clientWidth;
          if (parentWidth > 0) {
            if (isMobile) {
              // 移动模式：容器宽度 = 图片在300px高度限制下的实际宽度，但不超过父容器宽度
              const containerWidth = Math.min(calculatedWidth, parentWidth);
              setPortraitContainerWidth(containerWidth);
            } else {
              // 桌面模式：计算百分比，最大不超过50%
              const percent = Math.min((calculatedWidth / parentWidth) * 100, 50);
              setPortraitWidthPercent(percent);
            }
          }
        };

        // 初始计算
        updateWidth();

        // 使用 ResizeObserver 监听父容器宽度变化
        const resizeObserver = new ResizeObserver(() => {
          updateWidth();
        });
        resizeObserver.observe(parentContainer);

        // 测量并存储竖图的实际渲染高度（仅在桌面模式）
        if (!isMobile) {
          setTimeout(() => {
            const height = container.offsetHeight;
            portraitImageHeights.current.set(imageIndex, height);
            // 触发重新渲染以更新文字分段
            window.dispatchEvent(new CustomEvent('portrait-image-height-updated', { detail: { imageIndex, height } }));
          }, 100);
        }

        return () => {
          resizeObserver.disconnect();
        };
      }
    }, [layoutType, imageLoaded, imageIndex, isMobile]);

    // 监听父容器宽度变化，动态计算横图和超长图容器宽度（桌面和移动模式都适用）
    useEffect(() => {
      if ((layoutType === 'landscape' || layoutType === 'ultra-tall') && imageLoaded && landscapeContainerRef.current) {
        const container = landscapeContainerRef.current;
        const calculatedWidth = imageWidths.current.get(imageIndex);
        if (!calculatedWidth) return;

        // 获取父容器（Markdown 渲染容器）的宽度
        const findParentContainer = (el: HTMLElement | null): HTMLElement | null => {
          if (!el) return null;
          // 向上查找，找到有 padding 的容器（通常是 px-8 的容器）
          let parent = el.parentElement;
          while (parent) {
            const style = window.getComputedStyle(parent);
            const paddingLeft = parseFloat(style.paddingLeft) || 0;
            const paddingRight = parseFloat(style.paddingRight) || 0;
            if (paddingLeft > 0 || paddingRight > 0) {
              return parent;
            }
            parent = parent.parentElement;
          }
          return null;
        };

        const parentContainer = findParentContainer(container);
        if (!parentContainer) return;

        const updateWidth = () => {
          const parentWidth = parentContainer.clientWidth;
          if (parentWidth > 0) {
            // 容器宽度 = 图片在300px高度限制下的实际宽度，但不超过父容器宽度
            const containerWidth = Math.min(calculatedWidth, parentWidth);
            setLandscapeContainerWidth(containerWidth);
          }
        };

        // 初始计算
        updateWidth();

        // 使用 ResizeObserver 监听父容器宽度变化
        const resizeObserver = new ResizeObserver(() => {
          updateWidth();
        });
        resizeObserver.observe(parentContainer);

        return () => {
          resizeObserver.disconnect();
        };
      }
    }, [layoutType, imageLoaded, imageIndex, isMobile]);
    
    if (layoutType === 'portrait') {
      // 移动模式下：动态宽度，居中显示，不使用 float，不与文字环绕
      if (isMobile) {
        return (
          <div
            ref={portraitContainerRef}
            className="my-6 mx-auto rounded-2xl overflow-hidden border border-twilight-divider dark:border-nocturnal-secondary/25 cursor-pointer group relative transition-all hover:shadow-lg hover:border-twilight-amber/50 dark:hover:border-nocturnal-accent/50"
            onClick={handleClick}
            style={portraitContainerWidth !== null ? {
              width: `${portraitContainerWidth}px`,
              maxWidth: '100%'
            } : undefined}
            data-portrait-image-index={imageIndex}
          >
            <img
              ref={imgRef}
              src={src}
              alt={alt || 'Journal image'}
              className="w-full h-auto object-contain transition-transform group-hover:scale-[1.02]"
              style={{
                display: imageLoaded ? 'block' : 'none',
                maxHeight: '300px'
              }}
              onLoad={handleImageLoad}
              loading="lazy"
            />
            {/* 加载占位符 */}
            {!imageLoaded && (
              <div className="w-full h-64 bg-twilight-cream/50 dark:bg-nocturnal-surface/50 flex items-center justify-center">
                <div className="text-twilight-duskLight dark:text-nocturnal-secondary text-sm">加载中...</div>
              </div>
            )}
            {/* 点击查看提示 */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="bg-black/60 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                <ZoomIn size={16} />
                <span>点击查看大图</span>
              </div>
            </div>
          </div>
        );
      }
      
      // 桌面模式：使用 float 布局，与文字环绕
      return (
        <>
          {/* 清除前面的浮动，确保图片前的段落正常显示 */}
          <div className="clear-both" />
          <div
            ref={portraitContainerRef}
            className={`my-8 ${floatSide === 'left' ? 'float-left' : 'float-right'} ${floatSide === 'left' ? 'mr-8' : 'ml-8'} mb-8 rounded-2xl overflow-hidden border border-twilight-divider dark:border-nocturnal-secondary/25 cursor-pointer group relative transition-all hover:shadow-lg hover:border-twilight-amber/50 dark:hover:border-nocturnal-accent/50`}
            onClick={handleClick}
            style={{ 
              verticalAlign: 'top',
              width: `${portraitWidthPercent}%`,
              maxWidth: '50%'
            }}
            data-portrait-image-index={imageIndex}
          >
            <img
              ref={imgRef}
              src={src}
              alt={alt || 'Journal image'}
              className="w-full h-auto object-contain transition-transform group-hover:scale-[1.02]"
              style={{
                display: imageLoaded ? 'block' : 'none',
                maxHeight: '300px'
              }}
              onLoad={handleImageLoad}
              loading="lazy"
            />
            {/* 加载占位符 */}
            {!imageLoaded && (
              <div className="w-full h-64 bg-twilight-cream/50 dark:bg-nocturnal-surface/50 flex items-center justify-center">
                <div className="text-twilight-duskLight dark:text-nocturnal-secondary text-sm">加载中...</div>
              </div>
            )}
            {/* 点击查看提示 */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
              <div className="bg-black/60 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
                <ZoomIn size={16} />
                <span>点击查看大图</span>
              </div>
            </div>
          </div>
        </>
      );
    }

    // 横图和超长图使用原有布局：块级元素，不参与文字环绕，上下保持段落间距
    return (
      <>
        {/* 清除前面的浮动，确保图片前的段落正常显示 */}
        <div className="clear-both" />
        <div
          ref={landscapeContainerRef}
          className={getContainerClassName()}
          onClick={handleClick}
          style={landscapeContainerWidth !== null ? {
            width: `${landscapeContainerWidth}px`,
            maxWidth: '100%'
          } : undefined}
        >
        <img
          ref={imgRef}
          src={src}
          alt={alt || 'Journal image'}
          className="w-full h-auto object-contain transition-transform group-hover:scale-[1.02]"
          style={{
            maxHeight: getMaxHeight(),
            display: imageLoaded ? 'block' : 'none'
          }}
          onLoad={handleImageLoad}
          loading="lazy"
        />
        {/* 加载占位符 */}
        {!imageLoaded && (
          <div className="w-full h-64 bg-twilight-cream/50 dark:bg-nocturnal-surface/50 flex items-center justify-center">
            <div className="text-twilight-duskLight dark:text-nocturnal-secondary text-sm">加载中...</div>
          </div>
        )}
        {/* 点击查看提示 */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
          <div className="bg-black/60 text-white px-4 py-2 rounded-lg flex items-center gap-2 text-sm">
            <ZoomIn size={16} />
            <span>点击查看大图</span>
          </div>
        </div>
      </div>
      </>
    );
  };

  return (
    <>
      <div className="prose max-w-none prose-lg overflow-hidden">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            p: ({ children }) => {
              // 检查段落是否只包含图片（竖图会使用 float，需要特殊处理）
              const childrenArray = React.Children.toArray(children);
              const isImageOnly = childrenArray.length === 1 && 
                typeof childrenArray[0] === 'object' && 
                childrenArray[0] !== null &&
                'type' in childrenArray[0] &&
                (childrenArray[0] as any).type === 'img';
              
              // 如果段落只包含图片，不添加额外的样式
              if (isImageOnly) {
                return (
                  <p 
                    className="text-twilight-warm dark:text-nocturnal-primary leading-relaxed text-base mb-6 last:mb-0"
                    style={{ verticalAlign: 'top', marginTop: 0 }}
                  >
                    {children}
                  </p>
                );
              }
              
              // 文字段落使用智能分段组件
              return <SmartParagraph>{children}</SmartParagraph>;
            },
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
              const isPlaceholder = /^__WING_IMG_(\d+)__$/.test(String(src || ''));
              if (!isPlaceholder) {
                // 非占位符图片，使用默认处理
                return (
                  <div className="my-6 rounded-2xl overflow-hidden border border-twilight-divider dark:border-nocturnal-secondary/25">
                    <img
                      src={src}
                      alt={alt || 'Journal image'}
                      className="w-full h-auto object-contain"
                      style={{ maxHeight: '500px' }}
                      loading="lazy"
                    />
                  </div>
                );
              }

              // 解析占位符获取图片索引
              const match = String(src).match(/^__WING_IMG_(\d+)__$/);
              const imageIndex = match ? parseInt(match[1], 10) : -1;
              const finalSrc = resolveImgSrc(src);

              if (imageIndex >= 0 && imageIndex < imageArray.length) {
                return <SmartImage src={finalSrc} alt={alt || 'Journal image'} imageIndex={imageIndex} />;
              }

              return null;
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

      {/* Lightbox */}
      {lightboxOpen && imageArray.length > 0 && (
        <ImageLightbox
          images={imageArray}
          currentIndex={lightboxIndex}
          onClose={closeLightbox}
          onNavigate={navigateLightbox}
        />
      )}
    </>
  );
};

export default MarkdownRenderer;

