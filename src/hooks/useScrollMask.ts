import { useRef, useEffect, useState, useCallback, RefObject } from 'react';
import { cn } from '@/lib/utils';

/**
 * 滚动位置类型
 */
type ScrollPosition = 'top' | 'bottom' | 'middle' | 'none';

/**
 * useScrollMask Hook 配置选项
 */
interface UseScrollMaskOptions {
  /**
   * 渐变遮罩的内边距，默认为 '1rem'
   */
  gradientPadding?: string;
  /**
   * 滚动检测的容差值（像素），默认为 1
   */
  tolerance?: number;
  /**
   * 依赖项数组，当这些值变化时重新初始化监听器
   */
  dependencies?: React.DependencyList;
}

/**
 * useScrollMask Hook 返回值
 */
interface UseScrollMaskReturn {
  /**
   * 滚动容器的 ref
   */
  scrollContainerRef: RefObject<HTMLDivElement>;
  /**
   * 动态计算的滚动遮罩 CSS 类字符串
   */
  scrollMaskClasses: string;
  /**
   * 当前滚动位置
   */
  scrollPosition: ScrollPosition;
  /**
   * 是否有滚动条
   */
  hasScrollbar: boolean;
}

/**
 * 智能滚动遮罩 Hook
 * 
 * 自动检测滚动容器的滚动位置，并返回相应的 CSS 类用于渐变遮罩效果。
 * 
 * @param options 配置选项
 * @returns 滚动容器 ref 和动态 CSS 类
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { scrollContainerRef, scrollMaskClasses } = useScrollMask({
 *     gradientPadding: '1.5rem'
 *   });
 * 
 *   return (
 *     <div 
 *       ref={scrollContainerRef}
 *       className={cn('overflow-y-auto', scrollMaskClasses)}
 *     >
 *       {/* 滚动内容 *\/}
 *     </div>
 *   );
 * }
 * ```
 */
export function useScrollMask(options: UseScrollMaskOptions = {}): UseScrollMaskReturn {
  const {
    gradientPadding = '1rem',
    tolerance = 1,
    dependencies = []
  } = options;

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasScrollbar, setHasScrollbar] = useState(false);
  const [scrollPosition, setScrollPosition] = useState<ScrollPosition>('none');

  // 检查滚动位置的函数
  const checkScrollPosition = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    const hasScroll = scrollHeight > clientHeight;
    
    setHasScrollbar(hasScroll);
    
    if (!hasScroll) {
      setScrollPosition('none');
      return;
    }

    const isAtTop = scrollTop <= tolerance;
    const isAtBottom = scrollTop >= scrollHeight - clientHeight - tolerance;

    if (isAtTop && isAtBottom) {
      // 内容刚好填满容器，没有滚动
      setScrollPosition('none');
    } else if (isAtTop) {
      setScrollPosition('top');
    } else if (isAtBottom) {
      setScrollPosition('bottom');
    } else {
      setScrollPosition('middle');
    }
  }, [tolerance]);

  // 监听滚动容器的大小变化、内容变化和滚动事件
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // 初始检测
    checkScrollPosition();

    // 滚动事件监听器
    const handleScroll = () => {
      checkScrollPosition();
    };

    // 使用 ResizeObserver 监听容器大小变化
    const resizeObserver = new ResizeObserver(() => {
      checkScrollPosition();
    });

    // 使用 MutationObserver 监听内容变化
    const mutationObserver = new MutationObserver(() => {
      checkScrollPosition();
    });

    // 添加事件监听器（使用 passive 优化性能）
    container.addEventListener('scroll', handleScroll, { passive: true });
    resizeObserver.observe(container);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });

    // 清理函数
    return () => {
      container.removeEventListener('scroll', handleScroll);
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, dependencies); // 依赖项变化时重新设置监听器

  // 计算动态 CSS 类
  const scrollMaskClasses = cn(
    scrollPosition === 'top' && `gradient-mask-b [--gradient-mask-padding:${gradientPadding}]`,
    scrollPosition === 'bottom' && `gradient-mask-t [--gradient-mask-padding:${gradientPadding}]`,
    scrollPosition === 'middle' && `gradient-mask-y [--gradient-mask-padding:${gradientPadding}]`
  );

  return {
    scrollContainerRef,
    scrollMaskClasses,
    scrollPosition,
    hasScrollbar
  };
}