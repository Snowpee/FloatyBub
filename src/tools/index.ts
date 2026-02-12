import type { SearchConfig } from '@/store';
import { getApiBaseUrl } from '@/lib/utils';

// Tool Definitions
export const webSearchToolDefinition = {
  type: 'function',
  function: {
    name: 'web_search',
    description: 'Search the internet for up-to-date information, news, weather, stock prices, etc.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'The search query string. Optimized for search engines.'
        },
        count: {
          type: 'number',
          description: 'Number of results to return (default: 5, max: 10)',
          minimum: 1,
          maximum: 10
        }
      },
      required: ['query']
    }
  }
};

export const visitPageToolDefinition = {
  type: 'function',
  function: {
    name: 'visit_page',
    description: 'Visit a URL and extract its main content. Use this to read the full content of a search result or a specific webpage.',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: 'The URL of the webpage to visit.'
        }
      },
      required: ['url']
    }
  }
};

export const availableTools = [webSearchToolDefinition, visitPageToolDefinition];

// Tool Helpers
export function getToolsForProvider(provider: string) {
  const tools = availableTools;
  
  if (provider === 'claude') {
    return tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters
    }));
  }
  
  if (provider === 'gemini') {
    // Assuming OpenAI-compatible proxy for Gemini for now, as Chats.tsx uses default OpenAI body structure.
    // If native Gemini API support is added to Chats.tsx, this should return native function_declarations.
    return tools; 
  }

  // Default (OpenAI compatible)
  return tools;
}

// Tool Execution Logic
export async function executeWebSearch(
  query: string,
  searchConfig: SearchConfig,
  count: number = 5
): Promise<string> {
  console.log('🌐 [Tool:WebSearch] Executing search:', { query, count });

  try {
    const apiBaseUrl = getApiBaseUrl();
    const params = new URLSearchParams();
    
    // Query
    params.set('q', query);
    
    // Config parameters
    params.set('num', String(Math.min(count, searchConfig.maxResults || 10)));
    if (searchConfig.safeSearch) params.set('safe', searchConfig.safeSearch);
    if (searchConfig.language) params.set('hl', searchConfig.language);
    if (searchConfig.country) params.set('gl', searchConfig.country);
    
    // Force date return
    params.set('withDate', '1');
    
    // Custom keys if provided
    if (searchConfig.apiKey?.trim()) params.set('key', searchConfig.apiKey.trim());
    if (searchConfig.engineId?.trim()) params.set('cx', searchConfig.engineId.trim());

    const searchUrl = `${apiBaseUrl}/api/search?${params.toString()}`;
    const res = await fetch(searchUrl, {
      headers: {
        'x-api-key': import.meta.env.VITE_API_SECRET || ''
      }
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('⚠️ [Tool:WebSearch] API error:', res.status, errText);
      return `Search failed with status ${res.status}: ${errText}`;
    }

    const data = await res.json();
    const items = Array.isArray(data?.items) ? data.items : [];

    if (items.length === 0) {
      return 'No search results found.';
    }

    const formatted = items.map((it: any, idx: number) => {
      const title = (it?.title || it?.link || '').toString();
      const link = (it?.link || '').toString();
      const snippetRaw = (it?.snippet || it?.htmlSnippet || '') as string;
      const snippet = snippetRaw.replace(/\s+/g, ' ').trim();
      const dateTxt = it?.date ? (() => {
        try { return new Date(it.date).toISOString().slice(0, 10); } catch { return String(it.date).slice(0, 10); }
      })() : 'Unknown Date';
      return `[${idx + 1}] ${title}\nLink: ${link}\nDate: ${dateTxt}\nSnippet: ${snippet}`;
    }).join('\n\n');

    return formatted;

  } catch (error: any) {
    console.error('💥 [Tool:WebSearch] Exception:', error);
    return `Search execution error: ${error.message}`;
  }
}

export async function executeVisitPage(url: string): Promise<string> {
  console.log('🌐 [Tool:VisitPage] Visiting:', url);

  try {
    const apiBaseUrl = getApiBaseUrl();
    const params = new URLSearchParams();
    params.set('url', url);

    const visitUrl = `${apiBaseUrl}/api/visit-page?${params.toString()}`;
    const res = await fetch(visitUrl, {
      headers: {
        'x-api-key': import.meta.env.VITE_API_SECRET || ''
      }
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      console.warn('⚠️ [Tool:VisitPage] API error:', res.status, errText);
      return `Failed to visit page. Status: ${res.status}. Error: ${errText}`;
    }

    const data = await res.json();
    if (data.error) {
      return `Error visiting page: ${data.error} - ${data.details}`;
    }

    const content = data.content || 'No content extracted.';
    const title = data.title || 'No Title';

    return `Page Title: ${title}\nURL: ${url}\n\nContent:\n${content}`;

  } catch (error: any) {
    console.error('💥 [Tool:VisitPage] Exception:', error);
    return `Visit page execution error: ${error.message}`;
  }
}
