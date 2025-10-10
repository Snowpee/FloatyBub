import React, { useState, useEffect, useRef, useCallback, useMemo, RefObject } from 'react';
import { useResizeObserver } from '../hooks/useResizeObserver';

interface VirtualScrollItem {
  id: string;
  [key: string]: any;
}

interface VirtualScrollContainerProps<T extends VirtualScrollItem> {
  items: T[];
  itemHeight: number;
  renderItem: (item: T, index: number, isVisible: boolean) => React.ReactNode;
  overscan?: number; // 预渲染的额外项目数量
  className?: string;
  onScroll?: (scrollTop: number) => void;
  scrollMaskRef?: RefObject<HTMLDivElement>; // 用于滚动遮罩的 ref
}

interface VirtualScrollHandle {
  scrollToItem: (index: number, align?: 'start' | 'center' | 'end') => void;
  getItemScrollPosition: (index: number) => number;
  scrollTop: number;
  scrollElement: HTMLDivElement | null;
}

const VirtualScrollContainer = React.forwardRef<VirtualScrollHandle, VirtualScrollContainerProps<VirtualScrollItem>>(function VirtualScrollContainer<T extends VirtualScrollItem>({
  items,
  itemHeight,
  renderItem,
  overscan = 5,
  className = '',
  onScroll,
  scrollMaskRef
}: VirtualScrollContainerProps<T>, ref) {
  const [scrollTop, setScrollTop] = useState(0);
  const scrollElementRef = useRef<HTMLDivElement>(null);
  
  // 使用 useResizeObserver 监听容器高度变化
  const [containerRef, containerDimensions] = useResizeObserver<HTMLDivElement>({ debounceMs: 100 });
  const containerHeight = containerDimensions?.height || 400; // 默认高度
  const prevContainerHeightRef = useRef(containerHeight);
  
  // 监听容器高度变化，重新计算滚动位置
  useEffect(() => {
    if (prevContainerHeightRef.current !== containerHeight) {
      // 容器高度变化时，保持当前滚动位置的相对比例
      if (scrollElementRef.current && prevContainerHeightRef.current > 0) {
        const scrollRatio = scrollTop / (items.length * itemHeight - prevContainerHeightRef.current);
        const newMaxScroll = items.length * itemHeight - containerHeight;
        const newScrollTop = Math.max(0, Math.min(scrollRatio * newMaxScroll, newMaxScroll));
        
        if (newScrollTop !== scrollTop) {
          scrollElementRef.current.scrollTop = newScrollTop;
          setScrollTop(newScrollTop);
        }
      }
      prevContainerHeightRef.current = containerHeight;
    }
  }, [containerHeight, scrollTop, items.length, itemHeight]);
  
  // 计算可见区域的项目索引范围
  const visibleRange = useMemo(() => {
    const visibleItemCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(startIndex + visibleItemCount, items.length - 1);
    
    // 添加overscan以提供更平滑的滚动体验
    const overscanStart = Math.max(0, startIndex - overscan);
    const overscanEnd = Math.min(items.length - 1, endIndex + overscan);
    
    return {
      start: overscanStart,
      end: overscanEnd,
      visibleStart: startIndex,
      visibleEnd: endIndex
    };
  }, [scrollTop, itemHeight, containerHeight, items.length, overscan]);
  
  // 计算虚拟滚动的总高度
  const totalHeight = items.length * itemHeight;
  
  // 计算当前可见项目
  const visibleItems = useMemo(() => {
    return items.slice(visibleRange.start, visibleRange.end + 1).map((item, index) => ({
      item,
      index: visibleRange.start + index,
      isVisible: (visibleRange.start + index) >= visibleRange.visibleStart && 
                 (visibleRange.start + index) <= visibleRange.visibleEnd
    }));
  }, [items, visibleRange]);
  
  // 处理滚动事件
  const handleScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    const newScrollTop = e.currentTarget.scrollTop;
    setScrollTop(newScrollTop);
    onScroll?.(newScrollTop);
  }, [onScroll]);
  
  // 滚动到指定项目
  const scrollToItem = useCallback((index: number, align: 'start' | 'center' | 'end' = 'start') => {
    if (!scrollElementRef.current) return;
    
    let targetScrollTop: number;
    
    switch (align) {
      case 'center':
        targetScrollTop = index * itemHeight - (containerHeight - itemHeight) / 2;
        break;
      case 'end':
        targetScrollTop = index * itemHeight - containerHeight + itemHeight;
        break;
      default: // 'start'
        targetScrollTop = index * itemHeight;
    }
    
    // 确保滚动位置在有效范围内
    targetScrollTop = Math.max(0, Math.min(targetScrollTop, totalHeight - containerHeight));
    
    scrollElementRef.current.scrollTop = targetScrollTop;
    setScrollTop(targetScrollTop);
  }, [itemHeight, containerHeight, totalHeight]);
  
  // 获取项目在视口中的位置
  const getItemScrollPosition = useCallback((index: number) => {
    return index * itemHeight;
  }, [itemHeight]);
  
  // 暴露滚动方法给父组件
  React.useImperativeHandle(ref, () => ({
    scrollToItem,
    getItemScrollPosition,
    scrollTop,
    scrollElement: scrollElementRef.current
  }), [scrollToItem, getItemScrollPosition, scrollTop]);
  
  // 合并 refs
  const setRefs = useCallback((node: HTMLDivElement | null) => {
    scrollElementRef.current = node;
    containerRef.current = node;
    // 如果传入了 scrollMaskRef，也将其指向滚动容器
    if (scrollMaskRef) {
      (scrollMaskRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
    }
  }, [containerRef, scrollMaskRef]);
  
  return (
    <div
      ref={setRefs}
      className={`virtual-scroll-container overflow-y-auto ${className}`}
      onScroll={handleScroll}
    >
      {/* 虚拟滚动容器 */}
      <div
        className="virtual-scroll-content relative p-4"
        // style={{ height: totalHeight }}
      >
        {/* 可见项目容器 */}
        <div
          className="virtual-scroll-items"
          style={{
            transform: `translateY(${visibleRange.start * itemHeight}px)`,
            position: 'relative'
          }}
        >
          {visibleItems.map(({ item, index, isVisible }) => (
            <div
              key={item.id}
              className="virtual-scroll-item"
              style={{
                height: itemHeight
              }}
              data-index={index}
              data-visible={isVisible}
            >
              {renderItem(item, index, isVisible)}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

export default VirtualScrollContainer;
export type { VirtualScrollItem, VirtualScrollContainerProps, VirtualScrollHandle };