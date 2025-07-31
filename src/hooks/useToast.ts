import React, { useState, useCallback } from 'react';

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title?: string;
  message: string;
  duration?: number;
  position?: 'top-start' | 'top-center' | 'top-end' | 'middle-start' | 'middle-center' | 'middle-end' | 'bottom-start' | 'bottom-center' | 'bottom-end';
}

interface ToastState {
  toasts: ToastMessage[];
}

let toastState: ToastState = {
  toasts: []
};

let listeners: Array<(state: ToastState) => void> = [];

const notify = (callback: (state: ToastState) => ToastState) => {
  console.log('🔔 [useToast] notify 被调用，当前监听器数量:', listeners.length);
  toastState = callback(toastState);
  console.log('🔔 [useToast] 状态更新后，通知所有监听器');
  listeners.forEach((listener, index) => {
    console.log(`🔔 [useToast] 通知监听器 ${index}`);
    listener(toastState);
  });
};

const generateId = () => Math.random().toString(36).substr(2, 9);

const addToast = (toast: Omit<ToastMessage, 'id'>) => {
  const id = generateId();
  const newToast: ToastMessage = {
    id,
    duration: 4000,
    position: 'top-end',
    ...toast
  };

  console.log('📝 [useToast] 添加新通知:', {
    id,
    type: newToast.type,
    message: newToast.message,
    duration: newToast.duration,
    position: newToast.position
  });

  notify(state => {
    const newState = {
      ...state,
      toasts: [...state.toasts, newToast]
    };
    console.log('📝 [useToast] 当前通知列表长度:', newState.toasts.length);
    console.log('📝 [useToast] 当前通知列表:', newState.toasts.map(t => ({ id: t.id, type: t.type, message: t.message })));
    return newState;
  });

  // 自动移除
  if (newToast.duration && newToast.duration > 0) {
    console.log(`⏱️ [useToast] 设置自动移除定时器: ${newToast.duration}ms`);
    setTimeout(() => {
      console.log(`⏱️ [useToast] 定时器触发，移除通知: ${id}`);
      removeToast(id);
    }, newToast.duration);
  } else {
    console.log('📌 [useToast] 持久通知，不设置自动移除');
  }

  return id;
};

const removeToast = (id: string) => {
  console.log('🗑️ [useToast] 移除通知:', id);
  const beforeLength = toastState.toasts.length;
  notify(state => {
    const newState = {
      ...state,
      toasts: state.toasts.filter(toast => toast.id !== id)
    };
    console.log(`🗑️ [useToast] 移除后通知数量: ${beforeLength} -> ${newState.toasts.length}`);
    return newState;
  });
};

const clearAllToasts = () => {
  console.log('🧹 [useToast] 清除所有通知，当前数量:', toastState.toasts.length);
  notify(state => {
    const newState = {
      ...state,
      toasts: []
    };
    console.log('🧹 [useToast] 所有通知已清除');
    return newState;
  });
};

// Toast API
export const toast = {
  success: (message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>) => 
    addToast({ type: 'success', message, ...options }),
  
  error: (message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>) => 
    addToast({ type: 'error', message, ...options }),
  
  info: (message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>) => 
    addToast({ type: 'info', message, ...options }),
  
  warning: (message: string, options?: Partial<Omit<ToastMessage, 'id' | 'type' | 'message'>>) => 
    addToast({ type: 'warning', message, ...options }),
  
  custom: (toast: Omit<ToastMessage, 'id'>) => addToast(toast),
  
  dismiss: removeToast,
  
  clear: clearAllToasts
};

// Hook for components
export const useToast = () => {
  const [state, setState] = useState<ToastState>(toastState);

  const subscribe = useCallback((listener: (state: ToastState) => void) => {
    console.log('📡 [useToast] 新组件订阅，当前监听器数量:', listeners.length);
    listeners.push(listener);
    console.log('📡 [useToast] 订阅后监听器数量:', listeners.length);
    return () => {
      console.log('📡 [useToast] 组件取消订阅');
      const beforeLength = listeners.length;
      listeners = listeners.filter(l => l !== listener);
      console.log(`📡 [useToast] 取消订阅后监听器数量: ${beforeLength} -> ${listeners.length}`);
    };
  }, []);

  React.useEffect(() => {
    console.log('🔗 [useToast] useEffect 执行，设置订阅');
    const unsubscribe = subscribe(setState);
    return unsubscribe;
  }, [subscribe]);

  console.log('🎯 [useToast] Hook 渲染，当前通知数量:', state.toasts.length);

  return {
    toasts: state.toasts,
    toast
  };
};