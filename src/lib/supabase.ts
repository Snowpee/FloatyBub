import { createClient } from '@supabase/supabase-js'
import { indexedDBStorage } from '@/store/storage'

// Supabase 配置
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// 检查必需的环境变量
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing required Supabase environment variables. Please check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.')
}

const fetchWithApikey: typeof fetch = async (input, init) => {
  const existingHeaders = (() => {
    if (init?.headers) return init.headers
    if (typeof input === 'string' || input instanceof URL) return undefined
    return input.headers
  })()

  const headers = new Headers(existingHeaders)
  if (!headers.has('apikey')) {
    headers.set('apikey', supabaseAnonKey)
  }

  const method = (() => {
    if (init?.method) return init.method
    if (typeof input === 'string' || input instanceof URL) return 'GET'
    return input.method || 'GET'
  })().toUpperCase()

  const maxRetries = method === 'GET' || method === 'HEAD' ? 3 : 1
  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
  const jitter = () => Math.floor(Math.random() * 250)
  const isRetryableStatus = (status: number) => status === 429 || status === 502 || status === 503 || status === 504
  const isRetryableFetchError = (err: unknown) => {
    if (err instanceof DOMException) {
      // 如果是 AbortError，通常是用户取消或超时，不应重试
      return err.name !== 'AbortError'
    }
    if (err instanceof TypeError) return true
    const message = err instanceof Error ? err.message : String(err)
    const m = message.toLowerCase()
    return m.includes('failed to fetch') || m.includes('network') || m.includes('connection') || m.includes('http2') || m.includes('timeout')
  }

  // 增加默认超时时间，避免过早 AbortError
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000) // 60秒超时
  const signal = init?.signal || controller.signal

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const res = await fetch(input, { ...init, headers, signal })
      clearTimeout(timeoutId)
      
      if (attempt < maxRetries && isRetryableStatus(res.status)) {
        try {
          await res.text()
        } catch {}

        const retryAfter = res.headers.get('retry-after')
        const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : NaN
        const delay = Number.isFinite(retryAfterMs)
          ? retryAfterMs
          : Math.min(1000 * Math.pow(2, attempt - 1) + jitter(), 4000)
        await sleep(delay)
        continue
      }
      return res
    } catch (err) {
      clearTimeout(timeoutId)
      if (attempt < maxRetries && navigator.onLine && isRetryableFetchError(err)) {
        const delay = Math.min(1000 * Math.pow(2, attempt - 1) + jitter(), 4000)
        await sleep(delay)
        continue
      }
      throw err
    }
  }

  return fetch(input, { ...init, headers })
}

// 创建 Supabase 客户端
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage:
      typeof window !== 'undefined'
        ? {
            getItem: (key) => indexedDBStorage.getItem(key),
            setItem: (key, value) => indexedDBStorage.setItem(key, value),
            removeItem: (key) => indexedDBStorage.removeItem(key)
          }
        : undefined
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'X-Client-Info': 'supabase-js-web'
    },
    fetch: fetchWithApikey
  },
  // 重要：配置数据类型转换，确保 BIGINT 类型作为字符串返回
  // 这解决了 JavaScript Number 类型精度丢失的问题
  realtime: {
    // 使用默认配置，避免无效属性导致的TypeScript错误
  }
})

// 数据库类型定义
export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          user_id: string
          display_name: string | null
          avatar_url: string | null
          preferences: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          display_name?: string | null
          avatar_url?: string | null
          preferences?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          display_name?: string | null
          avatar_url?: string | null
          preferences?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      general_settings: {
        Row: {
          id: string
          user_id: string
          settings: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          settings?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          settings?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      chat_sessions: {
        Row: {
          id: string
          user_id: string
          title: string
          metadata: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title?: string
          metadata?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          metadata?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      messages: {
        Row: {
          id: string
          session_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          reasoning_content: string | null
          metadata: Record<string, any>
          created_at: string
          message_timestamp: string
          snowflake_id: string | null
        }
        Insert: {
          id?: string
          session_id: string
          role: 'user' | 'assistant' | 'system'
          content: string
          reasoning_content?: string | null
          metadata?: Record<string, any>
          created_at?: string
          message_timestamp?: string
          snowflake_id?: string | null
        }
        Update: {
          id?: string
          session_id?: string
          role?: 'user' | 'assistant' | 'system'
          content?: string
          reasoning_content?: string | null
          metadata?: Record<string, any>
          created_at?: string
          message_timestamp?: string
          snowflake_id?: string | null
        }
      }
      llm_configs: {
        Row: {
          id: string
          user_id: string
          name: string
          provider: string
          model: string
          config: Record<string, any>
          is_default: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          provider: string
          model: string
          config?: Record<string, any>
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          provider?: string
          model?: string
          config?: Record<string, any>
          is_default?: boolean
          created_at?: string
          updated_at?: string
        }
      }
      ai_roles: {
        Row: {
          id: string
          user_id: string
          name: string
          prompt: string
          avatar: string | null
          settings: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          prompt: string
          avatar?: string | null
          settings?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          prompt?: string
          avatar?: string | null
          settings?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
      global_prompts: {
        Row: {
          id: string
          user_id: string
          title: string
          content: string
          category: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          title: string
          content: string
          category?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          title?: string
          content?: string
          category?: string
          created_at?: string
          updated_at?: string
        }
      }
      voice_settings: {
        Row: {
          id: string
          user_id: string
          provider: string
          model: string
          config: Record<string, any>
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          provider?: string
          model?: string
          config?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          provider?: string
          model?: string
          config?: Record<string, any>
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}

// 类型化的 Supabase 客户端
export type SupabaseClient = typeof supabase
export type Tables<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Row']
export type Inserts<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Insert']
export type Updates<T extends keyof Database['public']['Tables']> = Database['public']['Tables'][T]['Update']
