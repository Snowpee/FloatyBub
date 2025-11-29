import { useOutletContext } from 'react-router-dom';

export interface PageContext {
  className?: string;
}

export function usePageContext(): PageContext {
  try {
    const context = useOutletContext<PageContext>();
    return context || {};
  } catch {
    return {};
  }
}
