import React, { useEffect, useMemo, useRef, ReactNode } from 'react';
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

const BottomSheetModal: React.FC<BottomSheetModalProps> = ({
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
  const closedY = useMemo(() => (typeof window !== 'undefined' ? window.innerHeight : 800), []);
  const isDesktop = useMemo(() => (typeof window !== 'undefined' ? window.innerWidth >= 1024 : false), []);

  const [{ y, backdrop, deskY, deskOpacity }, api] = useSpring(() => ({ y: closedY, backdrop: 0, deskY: 100, deskOpacity: 0 }));

  useEffect(() => {
    if (isOpen) {
      if (isDesktop) {
        api.start({ deskY: 0, deskOpacity: 1, backdrop: 1, config: { tension: 300, friction: 25 } });
      } else {
        api.start({ y: 0, backdrop: 1, config: { tension: 300, friction: 30 } });
      }
      if (debug) console.log('[BottomSheetModal] open');
    } else {
      if (isDesktop) {
        api.start({ deskY: 100, deskOpacity: 0, backdrop: 0, config: { tension: 300, friction: 25 } });
      } else {
        api.start({ y: closedY, backdrop: 0, config: { tension: 260, friction: 30 } });
      }
      if (debug) console.log('[BottomSheetModal] close');
    }
  }, [isOpen, api, closedY, debug, isDesktop]);

  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const rubber = (v: number) => {
    const k = 0.5;
    const c = 150;
    return (v * k) / (Math.abs(v) + c) * (closedY + c);
  };

  const handleRef = useRef<HTMLDivElement | null>(null);
  useDrag(({ down, movement: [, my], velocity: [vx, vy], direction: [, dy], last, event }) => {
    if (!dragEnabled || isDesktop) return;
    const raw = my > 0 ? my : 0;
    const next = rubberband ? rubber(raw) : raw;
    if (down) {
      (event as Event).preventDefault?.();
      api.start({ y: clamp(next, 0, closedY), backdrop: clamp(1 - next / closedY, 0, 1), immediate: true });
      if (debug) console.log('[BottomSheetModal] drag', { y: next });
    } else if (last) {
      const shouldClose = next > distanceThreshold || (vy > velocityThreshold && dy > 0);
      if (shouldClose) {
        api.start({ y: closedY, backdrop: 0, config: { tension: 260, friction: 30 } });
        if (debug) console.log('[BottomSheetModal] release -> close', { y: next, vy, dy });
        setTimeout(() => {
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
    if (isDesktop) {
      api.start({ deskY: 100, deskOpacity: 0, backdrop: 0, config: { tension: 300, friction: 25 } });
    } else {
      api.start({ y: closedY, backdrop: 0, config: { tension: 260, friction: 30 } });
    }
    setTimeout(() => {
      onOpenChange?.(false);
      onClose?.();
    }, closeAnimationDuration);
  };

  const requestClose = () => {
    if (isDesktop) {
      api.start({ deskY: 100, deskOpacity: 0, backdrop: 0, config: { tension: 300, friction: 25 } });
    } else {
      api.start({ y: closedY, backdrop: 0, config: { tension: 260, friction: 30 } });
    }
    setTimeout(() => {
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
                onClick={() => { if (a.role === 'close') requestClose(); a.onClick?.(); }}
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
                onClick={() => { if (a.role === 'close') requestClose(); a.onClick?.(); }}
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
};

export default BottomSheetModal;
