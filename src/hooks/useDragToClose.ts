import { useState, useCallback } from 'react';
import { useDrag } from '@use-gesture/react';
import type { ReactDOMAttributes } from '@use-gesture/react/dist/declarations/src/types';

interface UseDragToCloseOptions {
  onClose: () => void;
  isClosing?: boolean;
  isRebounding?: boolean;
  closeThreshold?: number;
  velocityThreshold?: number;
  reboundDuration?: number;
  enableMobileOnly?: boolean;
}

interface UseDragToCloseReturn {
  dragY: number;
  isDragging: boolean;
  isChildrenDisabled: boolean;
  isRebounding: boolean;
  dragKey: number;
  bind: (...args: any[]) => ReactDOMAttributes;
  resetDragState: () => void;
}

export const useDragToClose = ({
  onClose,
  isClosing = false,
  isRebounding: externalIsRebounding = false,
  closeThreshold = 100,
  velocityThreshold = 0.5,
  reboundDuration = 300,
  enableMobileOnly = true
}: UseDragToCloseOptions): UseDragToCloseReturn => {
  const [dragY, setDragY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [isChildrenDisabled, setIsChildrenDisabled] = useState(false);
  const [isRebounding, setIsRebounding] = useState(false);
  const [dragKey, setDragKey] = useState(0);

  // 重置拖动状态的函数
  const resetDragState = useCallback(() => {
    setDragY(0);
    setIsDragging(false);
    setIsChildrenDisabled(false);
    setIsRebounding(false);
    setDragKey(prev => prev + 1); // 强制重新创建useDrag实例
  }, []);

  // 拖动手势配置
  const bind = useDrag(
    ({ down, movement: [, my], velocity: [, vy], direction: [, dy], cancel, event }) => {
      const isMobile = window.innerWidth < 768;
      
      // 只在移动端启用拖动（如果启用了enableMobileOnly）
      if (enableMobileOnly && !isMobile) {
        return;
      }
      
      // 如果正在关闭或回弹，忽略所有拖动事件
      if (isClosing || isRebounding || externalIsRebounding) {
        return;
      }
      
      // 阻止默认的触摸行为，防止浏览器滚动等干扰拖动
      if (event?.preventDefault) {
        event.preventDefault();
      }
      
      if (down) {
        // 只允许向下拖动
        const clampedY = Math.max(0, my);
        
        // 首次拖动检测
        if (!isDragging) {
          setIsDragging(true);
          // 立即禁用子元素事件响应，确保拖动能够正确进行
          setIsChildrenDisabled(true);
        }
        
        // 设置拖动距离
        setDragY(clampedY);
        
        // 拖动距离超过阈值或向下快速滑动时触发关闭
        const shouldClose = clampedY > closeThreshold || (vy > velocityThreshold && dy > 0 && clampedY > closeThreshold / 2);
        
        if (shouldClose) {
          // 立即停止拖动手势并重置状态
          cancel();
          setIsDragging(false);
          setIsChildrenDisabled(false);
          // 延迟调用onClose，确保状态重置完成
          setTimeout(() => {
            onClose();
          }, 0);
          return; // 立即返回，避免执行后续逻辑
        }
      } else {
        // 使用当前的clampedY值而不是状态中的dragY，确保数据一致性
        const currentY = Math.max(0, my || dragY);
        
        // 如果拖动距离不够，启动回弹动画
        if (currentY < closeThreshold) {
          // 设置回弹状态
          setIsRebounding(true);
          setIsDragging(false);
          
          // 使用 requestAnimationFrame 实现平滑回弹动画
          const startY = currentY; // 使用当前实际位置作为起始点
          const startTime = performance.now();
          
          const animateRebound = (currentTime: number) => {
            const elapsed = currentTime - startTime;
            const progress = Math.min(elapsed / reboundDuration, 1);
            
            // 使用缓动函数 (ease-out-cubic)
            const easeOutCubic = 1 - Math.pow(1 - progress, 3);
            const currentY = startY * (1 - easeOutCubic);
            
            setDragY(currentY);
            
            if (progress < 1) {
              requestAnimationFrame(animateRebound);
            } else {
              setDragY(0);
              setIsRebounding(false);
              setIsChildrenDisabled(false);
            }
          };
          
          requestAnimationFrame(animateRebound);
        } else {
          // 拖动距离足够，直接重置状态
          setIsDragging(false);
          setIsChildrenDisabled(false);
        }
      }
    },
    {
      axis: 'y',
      bounds: { top: 0 },
      rubberband: true,
      filterTaps: false, // 移除filterTaps，允许所有拖动操作
      threshold: [0, 5], // 设置较小的阈值，更容易触发拖动
      preventScrollOnRefresh: true, // 防止刷新时的滚动
    }
  );

  return {
    dragY,
    isDragging,
    isChildrenDisabled,
    isRebounding,
    dragKey,
    bind,
    resetDragState
  };
};