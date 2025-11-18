import React, { useEffect, useMemo, useRef, ReactNode, memo, useState } from 'react';
import { animated, useSpring } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';

type HeaderAction = {
  label?: string;
  icon?: ReactNode;
  onClick?: () => void;
  className?: string;
  role?: 'close' | 'default';
};

interface BottomSheetModalProps {
  isOpen: boolean;
  onOpenChange?: (open: boolean) => void;
  onClose?: () => void;
  dismissible?: boolean;
  dragEnabled?: boolean;
  distanceThreshold?: number;
  velocityThreshold?: number;
  rubberband?: boolean;
  safeArea?: boolean;
  debug?: boolean;
  children?: React.ReactNode;
  headerTitle?: ReactNode;
  leftActions?: HeaderAction[];
  rightActions?: HeaderAction[];
  closeAnimationDuration?: number;
}

const BottomSheetModal = memo<BottomSheetModalProps>(({
  isOpen,
  onOpenChange,
  onClose,
  dismissible = true,
  dragEnabled = true,
  distanceThreshold = 120,
  velocityThreshold = 0.5,
  rubberband = true,
  safeArea = true,
  debug = false,
  children,
  headerTitle,
  leftActions,
  rightActions,
  closeAnimationDuration = 220,
}) => {
  console.log('[BottomSheetModal] ====== component render ======', {
    isOpen,
    timestamp: Date.now(),
    componentInstance: Math.random().toString(36).substr(2, 9)
  });
  // 稳定窗口尺寸值，避免严格模式下的不一致
  const [dimensions, setDimensions] = useState({
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
    width: typeof window !== 'undefined' ? window.innerWidth : 1024,
    isDesktop: typeof window !== 'undefined' ? window.innerWidth >= 1024 : false
  });
  
  useEffect(() => {
    const updateDimensions = () => {
      setDimensions({
        height: window.innerHeight,
        width: window.innerWidth,
        isDesktop: window.innerWidth >= 1024
      });
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  const closedYRef = useRef(dimensions.height);
  const isDesktop = dimensions.isDesktop;

  const currentIsOpenRef = useRef(isOpen);
  currentIsOpenRef.current = isOpen; // 保持最新值

  const [{ y, backdrop, deskY, deskOpacity }, api] = useSpring(() => {
    const initialClosedY = closedYRef.current;
    const open = currentIsOpenRef.current;
    console.log('[BottomSheetModal] useSpring recreated with:', { closedY: initialClosedY, isDesktop: dimensions.isDesktop });
    return {
      y: open && !isDesktop ? 0 : initialClosedY,
      backdrop: open ? 1 : 0,
      deskY: open && isDesktop ? 0 : 100,
      deskOpacity: open && isDesktop ? 1 : 0,
      onChange: ({ value }: any) => {
        if (debug) {
          console.log('[BottomSheetModal] spring onChange', value);
        }
        if (currentIsOpenRef.current && !isClosingRef.current) {
          const b = (value.backdrop ?? 0);
          const d = (value.deskOpacity ?? 0);
          if (b >= 0.8 || d >= 0.8) {
            hasReachedVisibleRef.current = true;
            isOpeningRef.current = false;
          }
          if (hasReachedVisibleRef.current && b === 0 && d === 0) {
            console.log('[BottomSheetModal] ⚠️ 遮罩透明度被置0但isOpen=true', value, new Error().stack);
          }
        }
      }
    };
  }, [debug, isDesktop]);

  // 跟踪组件状态和spring状态
  const previousIsOpen = useRef(false);
  const isClosingRef = useRef(false);
  const isOpeningRef = useRef(false);
  const hasReachedVisibleRef = useRef(false);

  useEffect(() => {
    console.log('[BottomSheetModal] useEffect enter', { 
      isOpen, 
      isDesktop, 
      closedY: closedYRef.current
    });
    
    isClosingRef.current = false;
    
    // 核心修复：无论什么时候，只要isOpen为true但spring状态是初始值，就立即修正
    if (isOpen) {
      const currentBackdrop = backdrop.get();
      const currentDeskOpacity = deskOpacity.get();
      const isInvisible = currentBackdrop === 0 && currentDeskOpacity === 0;
      
      console.log('[BottomSheetModal] checking visibility', { 
        currentBackdrop, 
        currentDeskOpacity, 
        isInvisible,
        wasOpen: previousIsOpen.current
      });
      
      if (isInvisible && !isOpeningRef.current) {
        console.log('[BottomSheetModal] fixing invisible state');
        if (isDesktop) {
          api.start({ 
            from: { deskY: 100, deskOpacity: 0, backdrop: 0 },
            to:   { deskY: 0,   deskOpacity: 1, backdrop: 1 },
            config: { tension: 300, friction: 25 }
          });
        } else {
          api.start({ 
            from: { y: closedYRef.current, backdrop: 0 },
            to:   { y: 0,                  backdrop: 1 },
            config: { tension: 300, friction: 30 }
          });
        }
        isOpeningRef.current = true;
      } else if (!previousIsOpen.current) {
        // 从关闭状态打开，播放动画
        console.log('[BottomSheetModal] opening with animation');
        if (isDesktop) {
          api.start({ 
            from: { deskY: 100, deskOpacity: 0, backdrop: 0 },
            to:   { deskY: 0,   deskOpacity: 1, backdrop: 1 },
            config: { tension: 300, friction: 25 } 
          });
        } else {
          api.start({ 
            from: { y: closedYRef.current, backdrop: 0 },
            to:   { y: 0,                  backdrop: 1 },
            config: { tension: 300, friction: 30 } 
          });
        }
        isOpeningRef.current = true;
      }
    } else {
      // 关闭动画
      console.log('[BottomSheetModal] closing with animation');
      isClosingRef.current = true;
      hasReachedVisibleRef.current = false;
      if (isDesktop) {
        api.start({ deskY: 100, deskOpacity: 0, backdrop: 0, config: { tension: 300, friction: 25 } });
      } else {
        api.start({ y: closedYRef.current, backdrop: 0, config: { tension: 260, friction: 30 } });
      }
      if (debug) console.log('[BottomSheetModal] close');
    }
    
    previousIsOpen.current = isOpen;
  }, [isOpen, api, debug, isDesktop]);

  useEffect(() => {
    closedYRef.current = dimensions.height;
  }, [dimensions.height]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const rubber = (v: number) => {
    const k = 0.5;
    const c = 150;
    return (v * k) / (Math.abs(v) + c) * (closedYRef.current + c);
  };

  const handleRef = useRef<HTMLDivElement | null>(null);
  useDrag(({ down, movement: [, my], velocity: [vx, vy], direction: [, dy], last, event }) => {
    console.log('[BottomSheetModal] drag event', { down, dragEnabled, isDesktop, my, last });
    if (!dragEnabled || isDesktop) {
      console.log('[BottomSheetModal] drag ignored', { dragEnabled, isDesktop });
      return;
    }
    const raw = my > 0 ? my : 0;
    const next = rubberband ? rubber(raw) : raw;
    if (down) {
      (event as Event).preventDefault?.();
      api.start({ y: clamp(next, 0, closedYRef.current), backdrop: clamp(1 - next / closedYRef.current, 0, 1), immediate: true });
      if (debug) console.log('[BottomSheetModal] drag', { y: next });
    } else if (last) {
      console.log('[HistoryModal] decision: drag release', {
        raw,
        next,
        distanceThreshold,
        velocityThreshold,
        vy,
        dy,
        dragEnabled,
        isDesktop,
        rubberband,
      });
      const shouldClose = next > distanceThreshold || (vy > velocityThreshold && dy > 0);
      if (shouldClose) {
        api.start({ y: closedYRef.current, backdrop: 0, config: { tension: 260, friction: 30 } });
        if (debug) console.log('[BottomSheetModal] release -> close', { y: next, vy, dy });
        console.log('[HistoryModal] trigger: drag-to-dismiss', {
          y: next,
          vy,
          dy,
          distanceThreshold,
          velocityThreshold,
          eventType: (event as any)?.type,
          pointerType: (event as any)?.pointerType,
        });
        console.log('[HistoryModal] closing: start animation', { reason: 'drag-to-dismiss' });
        setTimeout(() => {
          console.log('[HistoryModal] closing: callbacks invoke', { reason: 'drag-to-dismiss' });
          onOpenChange?.(false);
          onClose?.();
        }, 220);
      } else {
        api.start({ y: 0, backdrop: 1, config: { tension: 300, friction: 30 } });
        if (debug) console.log('[BottomSheetModal] release -> snap back');
      }
    }
  }, { target: handleRef, eventOptions: { passive: false } });

  const handleBackdropClick = () => {
    if (!dismissible) return;
    console.log('[HistoryModal] trigger: backdrop click', { dismissible, isDesktop });
    isClosingRef.current = true;
    if (isDesktop) {
      api.start({ deskY: 100, deskOpacity: 0, backdrop: 0, config: { tension: 300, friction: 25 } });
    } else {
      api.start({ y: closedYRef.current, backdrop: 0, config: { tension: 260, friction: 30 } });
    }
    console.log('[HistoryModal] closing: start animation', { reason: 'backdrop' });
    setTimeout(() => {
      console.log('[HistoryModal] closing: callbacks invoke', { reason: 'backdrop' });
      onOpenChange?.(false);
      onClose?.();
    }, closeAnimationDuration);
  };

  const requestClose = (reason?: string, meta?: any) => {
    if (isDesktop) {
      api.start({ deskY: 100, deskOpacity: 0, backdrop: 0, config: { tension: 300, friction: 25 } });
    } else {
      api.start({ y: closedYRef.current, backdrop: 0, config: { tension: 260, friction: 30 } });
    }
    console.log('[HistoryModal] trigger: header close', { reason: reason || 'header', meta });
    console.log('[HistoryModal] closing: start animation', { reason: reason || 'header' });
    isClosingRef.current = true;
    setTimeout(() => {
      console.log('[HistoryModal] closing: callbacks invoke', { reason: reason || 'header' });
      onOpenChange?.(false);
      onClose?.();
    }, closeAnimationDuration);
  };

  return (
    <div className="fixed inset-0 z-50 pointer-events-auto flex align-center justify-center items-center">
      <animated.div
        style={{ opacity: backdrop.to((v) => v * 0.5) }}
        className="absolute inset-0 bg-black"
        onClick={handleBackdropClick}
      />
      <animated.div
        style={
          isDesktop
            ? { transform: deskY.to((v) => `translateY(${v}px)`), opacity: deskOpacity }
            : { transform: y.to((v) => `translateY(${v}px)`) }
        }
        className={[
          'bg-base-100 shadow-xl flex flex-col',
          safeArea ? 'pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]' : '',
          'w-full h-full',
          // 桌面端
          'md:max-w-3xl md:mx-auto md:max-h-[80%] md:rounded-[var(--radius-box)]',
        ].join(' ')}
      >
        <div className="px-4 pt-3 pb-2 flex items-center justify-between" ref={handleRef}>
          <div className="flex items-center gap-2">
            {(leftActions || []).map((a, i) => (
              <button
                key={i}
                className={a.className || 'btn btn-ghost btn-sm'}
                onClick={() => { if (a.role === 'close') requestClose('header-left-action', { index: i, role: a.role }); a.onClick?.(); }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
          <div className="flex-1 text-center">
            {headerTitle ? (
              <div className="text-center text-lg font-bold text-base-content">{headerTitle}</div>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {(rightActions || []).map((a, i) => (
              <button
                key={i}
                className={a.className || 'btn btn-ghost btn-sm'}
                onClick={() => { if (a.role === 'close') requestClose('header-right-action', { index: i, role: a.role }); a.onClick?.(); }}
                onPointerDown={(e) => e.stopPropagation()}
              >
                {a.icon}
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            {children}
          </div>
        </div>
      </animated.div>
    </div>
  );
});

export default BottomSheetModal;
