// hooks/useBlockPasswordManager.js
import { useEffect, useRef } from 'react';

export function useBlockPasswordManager() {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current) return;

    const elements = ref.current.querySelectorAll('input, textarea, select');
    elements.forEach(el => {
      el.setAttribute('data-1p-ignore', '');
      el.setAttribute('data-lpignore', 'true');
      el.setAttribute('data-form-type', 'other');
      el.setAttribute('autocomplete', 'off');
    });
  }, []);

  return ref;
}