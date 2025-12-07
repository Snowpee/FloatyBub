// contexts/InputContext.jsx
import { createContext, useContext, useEffect, useRef } from 'react';

// contexts/InputContext.jsx
const InputContext = createContext(undefined);

export function InputProvider({ children }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // 自动给所有 input/textarea 添加属性
    const observer = new MutationObserver(() => {
      const elements = containerRef.current.querySelectorAll('input, textarea, select');
      elements.forEach(el => {
        if (!el.hasAttribute('data-1p-ignore')) {
          el.setAttribute('data-1p-ignore', '');
          el.setAttribute('data-lpignore', 'true');
          el.setAttribute('data-form-type', 'other');
          if (!el.hasAttribute('autocomplete')) {
            el.setAttribute('autocomplete', 'off');
          }
        }
      });
    });

    observer.observe(containerRef.current, {
      childList: true,
      subtree: true,
    });

    // 初始化时也执行一次
    const elements = containerRef.current.querySelectorAll('input, textarea, select');
    elements.forEach(el => {
      el.setAttribute('data-1p-ignore', '');
      el.setAttribute('data-lpignore', 'true');
      el.setAttribute('data-form-type', 'other');
      if (!el.hasAttribute('autocomplete')) {
        el.setAttribute('autocomplete', 'off');
      }
    });

    return () => observer.disconnect();
  }, []);

  return <div ref={containerRef}>{children}</div>;
}