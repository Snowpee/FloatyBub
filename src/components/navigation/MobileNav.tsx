import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { animated as springAnimated, useSpring } from '@react-spring/web';
import { useDrag } from '@use-gesture/react';
import { isCapacitorIOS } from '../../lib/utils';

const navLog = (...args: any[]) => {
  try { console.log('[MobileNav]', ...args); } catch {}
};

interface PageConfig {
  id: string;
  component: React.ComponentType<any>;
  props?: Record<string, any>;
}

interface NavContextType {
  stack: PageConfig[];
  push: (component: React.ComponentType<any>, props?: Record<string, any>) => void;
  pop: () => void;
  popToRoot: () => void;
  canGoBack: () => boolean;
  replace: (component: React.ComponentType<any>, props?: Record<string, any>) => void;
}

const NavContext = createContext<NavContextType | null>(null);
const NavAnimContext = createContext<{ popWithAnimation: () => void; pushWithAnimation: (component: React.ComponentType<any>, props?: Record<string, any>) => void; isAnimating: boolean; isDragging?: boolean; canNavigate?: () => boolean } | null>(null);

export const useNav = () => {
  const context = useContext(NavContext);
  if (!context) throw new Error('useNav must be used within NavProvider');
  return context;
};

interface NavProviderProps {
  root: React.ComponentType<any>;
  rootProps?: Record<string, any>;
  children?: React.ReactNode;
}

export const NavProvider: React.FC<NavProviderProps> = ({ root, rootProps = {}, children }) => {
  const [stack, setStack] = useState<PageConfig[]>([
    { id: '0', component: root, props: rootProps }
  ]);
  const idCounter = useRef(1);

  const push = (component: React.ComponentType<any>, props = {}) => {
    const newPage: PageConfig = { id: String(idCounter.current++), component, props };
    navLog('push request', { newId: newPage.id, prevLen: stack.length });
    setStack(prev => [...prev, newPage]);
  };

  const pop = () => {
    navLog('pop request', { prevLen: stack.length });
    if (stack.length > 1) setStack(prev => prev.slice(0, -1));
  };

  const popToRoot = () => {
    navLog('popToRoot request', { prevLen: stack.length });
    setStack(prev => [prev[0]]);
  };

  const canGoBack = () => stack.length > 1;

  const replace = (component: React.ComponentType<any>, props = {}) => {
    const newPage: PageConfig = { id: String(idCounter.current++), component, props };
    navLog('replace request', { newId: newPage.id, prevLen: stack.length });
    setStack(prev => [...prev.slice(0, -1), newPage]);
  };

  return (
    <NavContext.Provider value={{ stack, push, pop, popToRoot, canGoBack, replace }}>
      {children}
    </NavContext.Provider>
  );
};

interface NavContainerProps {
  animated?: boolean;
  swipeGesture?: boolean;
  iosSwipeStartMargin?: number;
}

export const NavContainer: React.FC<NavContainerProps> = ({ animated = true, swipeGesture = false, iosSwipeStartMargin = 30 }) => {
  const { stack, pop, push, canGoBack } = useNav();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [xDebug, setXDebug] = useState(0);
  const [{ x }, api] = useSpring(() => ({
    x: 0,
    onChange: ({ value }: any) => {
      setXDebug(value.x);
    }
  }), []);
  const [mode, setMode] = useState<'idle' | 'push' | 'pop'>('idle');
  const [tempForeground, setTempForeground] = useState<PageConfig | null>(null);
  const [tempBackground, setTempBackground] = useState<PageConfig | null>(null);
  const isAnimatingRef = useRef(false);
  const safetyTimerRef = useRef<number | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [fallbackX, setFallbackX] = useState(0);
  const finalizedRef = useRef(false);
  const leavingIdRef = useRef<string | null>(null);
  const previousHiddenIdRef = useRef<string | null>(null);
  const POP_DURATION_MS = 250;
  const [isDragging, setIsDragging] = useState(false);
  const isDraggingRef = useRef(false);
  const dragMaxXRef = useRef(0);
  const dragStartedOnButtonRef = useRef(false);
  const finalizeTimerRef = useRef<number | null>(null);
  const [suppressLeaving, setSuppressLeaving] = useState(false);
  const MAX_SHIFT_PERCENT = 15;
  const PUSH_BG_OPACITY_TO = 0.6;
  const POP_BG_OPACITY_FROM = 0.6;
  enum PageState { ENTERING = 'ENTERING', ACTIVE = 'ACTIVE', GESTURE_DRAGGING = 'GESTURE_DRAGGING', GESTURE_CANCELING = 'GESTURE_CANCELING', EXITING = 'EXITING', DESTROYED = 'DESTROYED' };
  const foregroundStateRef = useRef<PageState>(PageState.ACTIVE);
  const backgroundStateRef = useRef<PageState>(PageState.ACTIVE);
  const opRef = useRef<'idle' | 'push' | 'pop'>('idle');
  const clearTemp = () => {
    setTempForeground(null);
    setTempBackground(null);
    setUseFallback(false);
    setFallbackX(0);
  };
  const canNavigate = (): boolean => {
    return !(isAnimatingRef.current || isDragging);
  };
  const getClientX = (e: any): number => {
    if (!e) return 0;
    if (e.touches && e.touches[0]) return e.touches[0].clientX;
    if (e.changedTouches && e.changedTouches[0]) return e.changedTouches[0].clientX;
    if (typeof e.clientX === 'number') return e.clientX;
    return 0;
  };

  const currentPage = stack[stack.length - 1];
  const previousPage = stack.length > 1 ? stack[stack.length - 2] : null;

  const startSafetyTimer = () => {
    if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
    navLog('startSafetyTimer');
    safetyTimerRef.current = window.setTimeout(() => {
      if (isAnimatingRef.current && !finalizedRef.current && !isDraggingRef.current) {
        navLog('safetyTimer firing finalize');
        finalize();
      }
    }, 800);
  };

  useEffect(() => {
    return () => {
      if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
      if (finalizeTimerRef.current) { clearTimeout(finalizeTimerRef.current); finalizeTimerRef.current = null; }
    };
  }, []);

  const finalize = () => {
    if (finalizedRef.current) {
      navLog('finalize skipped (already finalized)');
      return;
    }
    finalizedRef.current = true;
    navLog('finalize enter', { mode, opRef: opRef.current, leavingId: leavingIdRef.current, stackTop: stack[stack.length - 1]?.id, suppressLeaving, useFallback });
    if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
    if (finalizeTimerRef.current) { clearTimeout(finalizeTimerRef.current); finalizeTimerRef.current = null; }
    previousHiddenIdRef.current = null;
    navLog('finalize setting suppressLeaving=true');
    setSuppressLeaving(true);
    api.stop();
    if (opRef.current === 'pop') {
      navLog('finalize executing pop', { stackBefore: stack.length });
      pop();
    } else if (opRef.current === 'push' && tempForeground) {
      const c = tempForeground.component; const p = tempForeground.props || {};
      navLog('finalize executing push');
      push(c, p);
    }
    requestAnimationFrame(() => {
      navLog('finalize raf cleanup', { mode, opRef: opRef.current });
      setMode('idle');
      api.stop();
      api.set({ x: 0 });
      setTempForeground(null);
      setTempBackground(null);
      clearTemp();
      isAnimatingRef.current = false;
      dragStartedOnButtonRef.current = false;
      setIsDragging(false);
      setSuppressLeaving(false);
      leavingIdRef.current = null;
      previousHiddenIdRef.current = null;
      opRef.current = 'idle';
    });
  };

  const bind = useDrag(({ down, movement: [mx], velocity: [vx], last, active, event }) => {
    if (!swipeGesture) return;
    if (!canGoBack()) return;
    const target = event.target as HTMLElement;
    event.preventDefault();
    const startX = getClientX(event);
    if (down && isCapacitorIOS() && iosSwipeStartMargin > 0 && startX > iosSwipeStartMargin) return;
    const raw = mx > 0 ? mx : 0;
    const width = containerRef.current?.offsetWidth || (typeof window !== 'undefined' ? window.innerWidth : 1000);
    const clampVal = Math.min(raw, width * 0.9);
    if (down) {
      if (raw <= 0 && mode !== 'pop') return;
      // 仅在拖拽开始时决定是否忽略（起始点是按钮则整次拖拽忽略）
      if (!isDragging) {
        dragStartedOnButtonRef.current = !!(target && (target.tagName === 'BUTTON' || target.closest('button')));
        navLog('drag start', { startX, targetTag: target?.tagName, onButton: dragStartedOnButtonRef.current });
        if (dragStartedOnButtonRef.current) return;
      }
      if (!isDragging && raw > 0) setIsDragging(true);
      if (raw > 0) isDraggingRef.current = true;
      foregroundStateRef.current = PageState.GESTURE_DRAGGING;
      if (mode !== 'pop') {
        setTempForeground(currentPage || null);
        setTempBackground(previousPage || null);
        setMode('pop');
        opRef.current = 'pop';
        leavingIdRef.current = currentPage?.id || null;
        isAnimatingRef.current = true;
        finalizedRef.current = false;
        setUseFallback(true);
        setFallbackX(0);
        dragMaxXRef.current = 0;
        navLog('pop gesture init', { currentPage: currentPage?.id, previousPage: previousPage?.id });
        
      }
      if (raw > 0) {
        setFallbackX(clampVal);
        navLog('drag move', { clampVal });
        if (clampVal > dragMaxXRef.current) dragMaxXRef.current = clampVal;
      }
    } else {
      // 非拖拽释放事件（如点击）不应影响程序化返回动画
      if (!isDraggingRef.current) { navLog('drag end ignored (no active drag)'); return; }
      // 释放时仍需处理，即使指针位于按钮区域
      if (dragStartedOnButtonRef.current) {
        // 整次拖拽起始于按钮，直接取消并复位
        foregroundStateRef.current = PageState.GESTURE_CANCELING;
        navLog('drag cancel due to button start');
        setMode('idle');
        opRef.current = 'idle';
        setTempForeground(null);
        setTempBackground(null);
        api.stop();
        api.set({ x: 0 });
        setUseFallback(false);
        setFallbackX(0);
        isAnimatingRef.current = false;
        dragMaxXRef.current = 0;
        dragStartedOnButtonRef.current = false;
        setIsDragging(false);
        foregroundStateRef.current = PageState.ACTIVE;
        return;
      }
      if (isDragging) setIsDragging(false);
      isDraggingRef.current = false;
      const shouldClose = dragMaxXRef.current > 120 || vx > 0.35;
      navLog('drag end', { dragMaxX: dragMaxXRef.current, vx, shouldClose });
      if (shouldClose) {
        foregroundStateRef.current = PageState.EXITING;
        requestAnimationFrame(() => { setFallbackX(width); });
        if (finalizeTimerRef.current) { clearTimeout(finalizeTimerRef.current); finalizeTimerRef.current = null; }
        finalizeTimerRef.current = window.setTimeout(() => { if (!finalizedRef.current) finalize(); }, POP_DURATION_MS + 20);
        navLog('schedule finalize after pop gesture', { delay: POP_DURATION_MS + 20 });
        startSafetyTimer();
      } else {
        foregroundStateRef.current = PageState.GESTURE_CANCELING;
        requestAnimationFrame(() => { setFallbackX(0); });
        window.setTimeout(() => {
          navLog('gesture cancel complete');
          setMode('idle');
          opRef.current = 'idle';
          setTempForeground(null);
          setTempBackground(null);
          api.stop();
          api.set({ x: 0 });
          setUseFallback(false);
          setFallbackX(0);
          isAnimatingRef.current = false;
          foregroundStateRef.current = PageState.ACTIVE;
        }, POP_DURATION_MS + 20);
      }
      dragMaxXRef.current = 0;
      dragStartedOnButtonRef.current = false;
    }
  }, { axis: 'x', filterTaps: true, eventOptions: { passive: false } });

  const CurrentComponent = ((): React.ComponentType<any> | null => {
    if (mode === 'push' && tempForeground?.component) return tempForeground.component;
    if (mode === 'pop' && tempForeground?.component) return tempForeground.component;
    if (currentPage?.component) return currentPage.component;
    return null;
  })();
  const isIdleHiddenPrev = mode === 'idle' && previousHiddenIdRef.current && previousPage?.id === previousHiddenIdRef.current;
  const BackgroundComponent = ((): React.ComponentType<any> | null => {
    if (mode !== 'idle' && tempBackground?.component) return tempBackground.component;
    if (isIdleHiddenPrev && previousPage?.component) return previousPage.component;
    return null;
  })();
  const foregroundProps = ((): Record<string, any> => {
    if (mode === 'push' && tempForeground?.props) return tempForeground.props as Record<string, any>;
    if (mode === 'pop' && tempForeground?.props) return tempForeground.props as Record<string, any>;
    return (currentPage?.props || {}) as Record<string, any>;
  })();
  const backgroundProps = ((): Record<string, any> => {
    if (mode !== 'idle' && tempBackground?.props) return tempBackground.props as Record<string, any>;
    if (isIdleHiddenPrev && previousPage?.props) return previousPage.props as Record<string, any>;
    return {};
  })();

  const getBackgroundStyle = () => {
    if (mode === 'pop') {
      const w = containerRef.current?.offsetWidth || (typeof window !== 'undefined' ? window.innerWidth || 1 : 1000);
      if (useFallback) {
        const p = Math.min(1, Math.max(0, fallbackX / w));
        const shift = -MAX_SHIFT_PERCENT * (1 - p);
        const op = POP_BG_OPACITY_FROM + (1 - POP_BG_OPACITY_FROM) * p;
        return {
          transform: `translateX(${shift}%)`,
          opacity: op,
          transition: isDragging ? 'none' : `transform ${POP_DURATION_MS}ms ease-out, opacity ${POP_DURATION_MS}ms ease-out`,
          willChange: 'transform, opacity'
        } as any;
      }
      return {
        transform: x.to((v) => {
          const p = Math.min(1, Math.max(0, v / w));
          const shift = -MAX_SHIFT_PERCENT * (1 - p);
          return `translateX(${shift}%)`;
        }),
        opacity: x.to((v) => {
          const p = Math.min(1, Math.max(0, v / w));
          return POP_BG_OPACITY_FROM + (1 - POP_BG_OPACITY_FROM) * p;
        }),
        willChange: 'transform, opacity'
      } as any;
    }
    if (mode === 'push') {
      const w = containerRef.current?.offsetWidth || (typeof window !== 'undefined' ? window.innerWidth || 1 : 1000);
      return {
        transform: x.to((v) => {
          const p = 1 - Math.min(1, Math.max(0, v / w)); // 0->1 as new page enters
          const shift = -MAX_SHIFT_PERCENT * p;
          return `translateX(${shift}%)`;
        }),
        opacity: x.to((v) => {
          const p = 1 - Math.min(1, Math.max(0, v / w));
          return 1 - p * (1 - PUSH_BG_OPACITY_TO);
        }),
        willChange: 'transform, opacity'
      } as any;
    }
    return { transform: 'translateX(0%)', opacity: 1 } as any;
  };

  const getForegroundStyle = () => {
    return { transform: x.to((v) => `translateX(${v}px)`), boxShadow: x.to((v) => v > 0 ? '-4px 0 48px rgba(0,0,0,0.15)' : 'none'), willChange: 'transform', zIndex: 10 } as any;
  };

  const pushWithAnimation = (component: React.ComponentType<any>, props: Record<string, any> = {}) => {
    if (!animated) { push(component, props || {}); return; }
    if (!canNavigate()) return;
    finalizedRef.current = false;
    const prevId = currentPage?.id || null;
    const newPage: PageConfig = { id: 'temp_push', component, props };
    setTempForeground(newPage);
    setTempBackground(currentPage || null);
    setMode('push');
    opRef.current = 'push';
    isAnimatingRef.current = true;
    foregroundStateRef.current = PageState.ENTERING;
    backgroundStateRef.current = PageState.ACTIVE;
    navLog('pushWithAnimation', { prevId, tempId: newPage.id });
    api.stop();
    startSafetyTimer();
    const width = typeof window !== 'undefined' ? window.innerWidth : 1000;
    api.set({ x: width });
    api.start({ x: 0, config: { tension: 300, friction: 30 }, onRest: () => {
      if (!finalizedRef.current) {
        navLog('pushWithAnimation onRest finalize');
        finalizedRef.current = true;
        if (safetyTimerRef.current) { clearTimeout(safetyTimerRef.current); safetyTimerRef.current = null; }
        push(component, props || {});
        previousHiddenIdRef.current = prevId;
        setMode('idle');
        setTempForeground(null);
        setTempBackground(null);
        api.stop();
        api.set({ x: 0 });
        isAnimatingRef.current = false;
        foregroundStateRef.current = PageState.ACTIVE;
      }
    } });
  };

  const popWithAnimation = () => {
    if (!animated) { if (canGoBack()) pop(); return; }
    if (!canGoBack()) return;
    if (!canNavigate()) return;
    finalizedRef.current = false;
    leavingIdRef.current = currentPage?.id || null;
    navLog('popWithAnimation', { leavingId: leavingIdRef.current, previousId: previousPage?.id });
    previousHiddenIdRef.current = null;
    setTempForeground(currentPage || null);
    setTempBackground(previousPage || null);
    setMode('pop');
    opRef.current = 'pop';
    isAnimatingRef.current = true;
    foregroundStateRef.current = PageState.EXITING;
    backgroundStateRef.current = PageState.ACTIVE;
    api.stop();
    startSafetyTimer();
    const width = (containerRef.current?.offsetWidth || (typeof window !== 'undefined' ? window.innerWidth : 1000));
    setUseFallback(true);
    setFallbackX(0);
    requestAnimationFrame(() => { setFallbackX(width); });
    if (finalizeTimerRef.current) { clearTimeout(finalizeTimerRef.current); finalizeTimerRef.current = null; }
    navLog('popWithAnimation will finalize via onTransitionEnd');
    return;
  };

  return (
    <NavAnimContext.Provider value={{ popWithAnimation, pushWithAnimation, isAnimating: mode !== 'idle', isDragging, canNavigate }}>
      <div className="relative w-full h-full overflow-hidden bg-base-100" ref={containerRef}>
        {/* {mode === 'pop' && (
          <div className="absolute top-2 left-2 z-50 text-xs bg-black/60 text-white px-2 py-1 rounded pointer-events-none">
            <span>mode: {mode}</span>
            <span className="ml-2">x: {Math.round(useFallback ? fallbackX : xDebug)}</span>
          </div>
        )} */}
        {BackgroundComponent && (
          <springAnimated.div
            className="absolute inset-0 bg-base-100"
            style={isIdleHiddenPrev ? { display: 'none' } : getBackgroundStyle()}
            aria-hidden={isIdleHiddenPrev ? true : undefined}
            key={`bg`}
          >
            {React.createElement(BackgroundComponent, backgroundProps)}
          </springAnimated.div>
        )}
        {stack.slice(0, Math.max(0, stack.length - 2)).map((pg) => (
          <div
            className="absolute inset-0 bg-base-100"
            style={{ display: 'none' }}
            key={`bg-hidden-${pg.id}`}
          >
            {React.createElement(pg.component, (pg.props || {}))}
          </div>
        ))}
        {CurrentComponent && !(opRef.current === 'pop' && (suppressLeaving || finalizedRef.current)) && (
        <springAnimated.div
          className="absolute inset-0 bg-base-100"
          style={{
            ...(useFallback
              ? {
                  transform: `translateX(${fallbackX}px)`,
                  transition: isDragging ? 'none' : `transform ${POP_DURATION_MS}ms ease-out`,
                  willChange: 'transform',
                  boxShadow: (() => {
                    const w = containerRef.current?.offsetWidth || (typeof window !== 'undefined' ? window.innerWidth : 1000)
                    const p = Math.min(1, Math.max(0, fallbackX / w))
                    if (opRef.current === 'pop' && isAnimatingRef.current) return '-4px 0 6rem rgba(0,0,0,0.1)'
                    if (isDragging) {
                      const alpha = 0.08 + 0.22 * p // 越往右拖动，透明度越高
                      return p > 0 ? `-4px 0 6rem rgba(0,0,0,${alpha})` : 'none'
                    }
                    return 'none'
                  })(),
                  userSelect: isDragging ? 'none' : 'auto'
                }
              : getForegroundStyle()),
            touchAction: isDragging ? 'none' : 'pan-y',
            pointerEvents: mode !== 'idle' && !isDragging ? 'none' : 'auto'
          }}
          key={mode === 'idle' ? `fg-${currentPage?.id || 'root'}` : `fg`}
          onTransitionEnd={() => {
            if (
              !isDragging &&
              mode === 'pop' &&
              useFallback &&
              !finalizedRef.current &&
              foregroundStateRef.current === PageState.EXITING
            ) {
              navLog('onTransitionEnd calling finalize', { mode, useFallback, opRef: opRef.current });
              finalize();
            }
            navLog('onTransitionEnd event', { mode, isDragging, useFallback, finalized: finalizedRef.current, state: foregroundStateRef.current, opRef: opRef.current });
          }}
          {...bind()}
        >
          {React.createElement(CurrentComponent, foregroundProps)}
        </springAnimated.div>
        )}
      </div>
    </NavAnimContext.Provider>
  );
};

interface NavLinkProps {
  component: React.ComponentType<any>;
  props?: Record<string, any>;
  children: React.ReactNode;
  className?: string;
  replace?: boolean;
}

export const NavLink: React.FC<NavLinkProps> = ({ component, props = {}, children, className = '', replace = false }) => {
  const nav = useNav();
  const anim = useContext(NavAnimContext);
  const handleClick = () => {
    navLog('NavLink click', { replace });
    if (replace) nav.replace(component, props);
    else if (anim) anim.pushWithAnimation(component, props);
    else nav.push(component, props);
  };
  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
};

interface BackButtonProps {
  children?: React.ReactNode;
  className?: string;
}

export const BackButton: React.FC<BackButtonProps> = ({ children = '返回', className = 'btn btn-ghost btn-sm' }) => {
  const nav = useNav();
  const anim = useContext(NavAnimContext);
  const lastClickRef = useRef(0);
  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const now = Date.now();
    if (now - lastClickRef.current < 200) return;
    lastClickRef.current = now;
    navLog('BackButton click', { diff: now - lastClickRef.current });
    if (anim) {
      const canNav = !anim.canNavigate || anim.canNavigate();
      navLog('BackButton canNavigate', { canNav });
      if (canNav) { navLog('BackButton using animated pop'); anim.popWithAnimation(); } else { navLog('BackButton using immediate pop'); nav.pop(); }
    } else {
      navLog('BackButton using basic pop');
      nav.pop();
    }
  };
  return (
    <button 
      onClick={handleClick} 
      className={className}
      style={{ touchAction: 'manipulation' }}
      onMouseDown={(e) => { e.stopPropagation(); }}
      onTouchStart={(e) => { e.stopPropagation(); }}
    >
      {children}
    </button>
  );
};

export default {
  NavProvider,
  NavContainer,
  NavLink,
  BackButton,
  useNav
};
