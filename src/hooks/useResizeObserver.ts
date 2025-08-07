import { useEffect, useRef, useState } from 'react';

interface UseResizeObserverOptions {
  /**
   * 防抖延迟时间（毫秒）
   */
  debounceMs?: number;
}

interface ResizeObserverEntry {
  contentRect: {
    width: number;
    height: number;
  };
}

/**
 * 监听元素尺寸变化的 Hook
 * @param options 配置选项
 * @returns [ref, dimensions] ref用于绑定到要监听的元素，dimensions包含当前尺寸
 */
export const useResizeObserver = <T extends HTMLElement>(
  options: UseResizeObserverOptions = {}
) => {
  const { debounceMs = 100 } = options;
  const elementRef = useRef<T>(null);
  const [dimensions, setDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    // 创建 ResizeObserver 实例
    const resizeObserver = new ResizeObserver((entries: ResizeObserverEntry[]) => {
      if (entries.length === 0) return;
      
      const entry = entries[0];
      const { width, height } = entry.contentRect;
      
      // 清除之前的防抖定时器
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      
      // 设置新的防抖定时器
      debounceTimerRef.current = setTimeout(() => {
        setDimensions({ width, height });
      }, debounceMs);
    });

    // 开始监听元素
    resizeObserver.observe(element);
    
    // 立即获取初始尺寸
    const rect = element.getBoundingClientRect();
    setDimensions({
      width: rect.width,
      height: rect.height
    });

    // 清理函数
    return () => {
      resizeObserver.disconnect();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, [debounceMs]);

  return [elementRef, dimensions] as const;
};

export default useResizeObserver;