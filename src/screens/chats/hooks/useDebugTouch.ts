import { useEffect } from 'react';

export const useDebugTouch = () => {
  const debugTouchStartRoot = (e: React.TouchEvent) => {
    const t = e.target as HTMLElement;
    const css = t ? window.getComputedStyle(t) : ({} as any);
    const touch = e.touches[0];
    console.debug('[SwipeDebug]', {
      loc: 'ChatRoot',
      phase: 'start',
      x: touch?.clientX,
      y: touch?.clientY,
      cancelable: e.nativeEvent.cancelable,
      defaultPrevented: e.defaultPrevented,
      targetTag: t?.tagName,
      targetClasses: t?.className,
      css_touchAction: css?.touchAction,
      css_userSelect: css?.userSelect,
      css_pointerEvents: css?.pointerEvents
    });
  };

  const debugTouchMoveRoot = (e: React.TouchEvent) => {
    const t = e.target as HTMLElement;
    const css = t ? window.getComputedStyle(t) : ({} as any);
    const touch = e.touches[0];
    console.debug('[SwipeDebug]', {
      loc: 'ChatRoot',
      phase: 'move',
      x: touch?.clientX,
      y: touch?.clientY,
      cancelable: e.nativeEvent.cancelable,
      defaultPrevented: e.defaultPrevented,
      targetTag: t?.tagName,
      targetClasses: t?.className,
      css_touchAction: css?.touchAction,
      css_userSelect: css?.userSelect,
      css_pointerEvents: css?.pointerEvents
    });
  };

  const debugTouchEndRoot = () => {
    console.debug('[SwipeDebug]', { loc: 'ChatRoot', phase: 'end' });
  };

  const debugTouchStartList = (e: React.TouchEvent) => {
    const t = e.target as HTMLElement;
    const css = t ? window.getComputedStyle(t) : ({} as any);
    const touch = e.touches[0];
    console.debug('[SwipeDebug]', {
      loc: 'ChatList',
      phase: 'start',
      x: touch?.clientX,
      y: touch?.clientY,
      cancelable: e.nativeEvent.cancelable,
      defaultPrevented: e.defaultPrevented,
      targetTag: t?.tagName,
      targetClasses: t?.className,
      css_touchAction: css?.touchAction,
      css_userSelect: css?.userSelect,
      css_pointerEvents: css?.pointerEvents
    });
  };

  const debugTouchMoveList = (e: React.TouchEvent) => {
    const t = e.target as HTMLElement;
    const css = t ? window.getComputedStyle(t) : ({} as any);
    const touch = e.touches[0];
    console.debug('[SwipeDebug]', {
      loc: 'ChatList',
      phase: 'move',
      x: touch?.clientX,
      y: touch?.clientY,
      cancelable: e.nativeEvent.cancelable,
      defaultPrevented: e.defaultPrevented,
      targetTag: t?.tagName,
      targetClasses: t?.className,
      css_touchAction: css?.touchAction,
      css_userSelect: css?.userSelect,
      css_pointerEvents: css?.pointerEvents
    });
  };

  const debugTouchEndList = () => {
    console.debug('[SwipeDebug]', { loc: 'ChatList', phase: 'end' });
  };

  const debugTouchStartBubble = (e: React.TouchEvent) => {
    const t = e.target as HTMLElement;
    const css = t ? window.getComputedStyle(t) : ({} as any);
    const touch = e.touches[0];
    console.debug('[SwipeDebug]', {
      loc: 'ChatBubble',
      phase: 'start',
      x: touch?.clientX,
      y: touch?.clientY,
      cancelable: e.nativeEvent.cancelable,
      defaultPrevented: e.defaultPrevented,
      targetTag: t?.tagName,
      targetClasses: t?.className,
      css_touchAction: css?.touchAction,
      css_userSelect: css?.userSelect,
      css_pointerEvents: css?.pointerEvents
    });
  };

  const debugTouchMoveBubble = (e: React.TouchEvent) => {
    const t = e.target as HTMLElement;
    const css = t ? window.getComputedStyle(t) : ({} as any);
    const touch = e.touches[0];
    console.debug('[SwipeDebug]', {
      loc: 'ChatBubble',
      phase: 'move',
      x: touch?.clientX,
      y: touch?.clientY,
      cancelable: e.nativeEvent.cancelable,
      defaultPrevented: e.defaultPrevented,
      targetTag: t?.tagName,
      targetClasses: t?.className,
      css_touchAction: css?.touchAction,
      css_userSelect: css?.userSelect,
      css_pointerEvents: css?.pointerEvents
    });
  };

  const debugTouchEndBubble = () => {
    console.debug('[SwipeDebug]', { loc: 'ChatBubble', phase: 'end' });
  };

  useEffect(() => {
    const start = (ev: TouchEvent) => {
      const t = ev.target as HTMLElement;
      const css = t ? window.getComputedStyle(t) : ({} as any);
      const touch = ev.touches[0];
      console.debug('[SwipeDebug]', {
        loc: 'Document',
        phase: 'start',
        x: touch?.clientX,
        y: touch?.clientY,
        cancelable: ev.cancelable,
        defaultPrevented: ev.defaultPrevented,
        targetTag: t?.tagName,
        targetClasses: t?.className,
        css_touchAction: css?.touchAction,
        css_userSelect: css?.userSelect,
        css_pointerEvents: css?.pointerEvents
      });
    };
    const move = (ev: TouchEvent) => {
      const t = ev.target as HTMLElement;
      const css = t ? window.getComputedStyle(t) : ({} as any);
      const touch = ev.touches[0];
      console.debug('[SwipeDebug]', {
        loc: 'Document',
        phase: 'move',
        x: touch?.clientX,
        y: touch?.clientY,
        cancelable: ev.cancelable,
        defaultPrevented: ev.defaultPrevented,
        targetTag: t?.tagName,
        targetClasses: t?.className,
        css_touchAction: css?.touchAction,
        css_userSelect: css?.userSelect,
        css_pointerEvents: css?.pointerEvents
      });
    };
    const end = () => {
      console.debug('[SwipeDebug]', { loc: 'Document', phase: 'end' });
    };
    document.addEventListener('touchstart', start, { capture: true, passive: false });
    document.addEventListener('touchmove', move, { capture: true, passive: false });
    document.addEventListener('touchend', end, { capture: true, passive: false });
    return () => {
      document.removeEventListener('touchstart', start, { capture: true } as any);
      document.removeEventListener('touchmove', move, { capture: true } as any);
      document.removeEventListener('touchend', end, { capture: true } as any);
    };
  }, []);

  return {
    debugTouchStartRoot,
    debugTouchMoveRoot,
    debugTouchEndRoot,
    debugTouchStartList,
    debugTouchMoveList,
    debugTouchEndList,
    debugTouchStartBubble,
    debugTouchMoveBubble,
    debugTouchEndBubble
  };
};
