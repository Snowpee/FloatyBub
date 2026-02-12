// 知识库相关类型定义

export interface KnowledgeBase {
  id: string;
  name: string;
  description?: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  pendingUpload?: boolean;
}

export interface KnowledgeEntry {
  id: string;
  name: string;
  keywords: string[];
  explanation: string;
  knowledge_base_id: string;
  created_at: string;
  updated_at: string;
  pendingUpload?: boolean;
}

// 创建知识库的请求类型
export interface CreateKnowledgeBaseRequest {
  id?: string;
  name: string;
  description?: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateKnowledgeBaseRequest {
  name?: string;
  description?: string;
  updated_at?: string;
}

export interface CreateKnowledgeEntryRequest {
  id?: string;
  name: string;
  keywords: string[];
  explanation: string;
  knowledge_base_id: string;
  user_id?: string;
  created_at?: string;
  updated_at?: string;
}

export interface UpdateKnowledgeEntryRequest {
  name?: string;
  keywords?: string[];
  explanation?: string;
  updated_at?: string;
}

// 知识库搜索结果类型
export interface KnowledgeSearchResult {
  entry: KnowledgeEntry;
  score: number;
  matchedKeywords: string[];
}

// 知识库检索引擎接口
export interface KnowledgeSearchEngine {
  loadEntries(entries: KnowledgeEntry[]): void;
  search(userInput: string): KnowledgeSearchResult[];
}

// 角色卡知识库关联类型
export interface RoleKnowledgeAssociation {
  role_id: string;
  knowledge_base_id: string | null;
}

// 知识库统计信息
export interface KnowledgeBaseStats {
  id: string;
  name: string;
  entryCount: number;
  lastUpdated: string;
}

// 批量导入知识条目的类型
export interface ImportKnowledgeEntry {
  name: string;
  keywords: string[];
  explanation: string;
}

export interface ImportKnowledgeEntriesRequest {
  knowledge_base_id: string;
  entries: ImportKnowledgeEntry[];
}

// 知识库管理状态类型
export interface KnowledgeState {
  knowledgeBases: KnowledgeBase[];
  currentKnowledgeBase: KnowledgeBase | null;
  knowledgeEntries: KnowledgeEntry[];
  searchResults: KnowledgeSearchResult[];
  isLoading: boolean;
  error: string | null;
}

// 知识库操作动作类型
export type KnowledgeAction = 
  | { type: 'SET_KNOWLEDGE_BASES'; payload: KnowledgeBase[] }
  | { type: 'SET_CURRENT_KNOWLEDGE_BASE'; payload: KnowledgeBase | null }
  | { type: 'SET_KNOWLEDGE_ENTRIES'; payload: KnowledgeEntry[] }
  | { type: 'ADD_KNOWLEDGE_BASE'; payload: KnowledgeBase }
  | { type: 'UPDATE_KNOWLEDGE_BASE'; payload: KnowledgeBase }
  | { type: 'DELETE_KNOWLEDGE_BASE'; payload: string }
  | { type: 'ADD_KNOWLEDGE_ENTRY'; payload: KnowledgeEntry }
  | { type: 'UPDATE_KNOWLEDGE_ENTRY'; payload: KnowledgeEntry }
  | { type: 'DELETE_KNOWLEDGE_ENTRY'; payload: string }
  | { type: 'SET_SEARCH_RESULTS'; payload: KnowledgeSearchResult[] }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null };

// 知识库管理状态类型
export interface KnowledgeManagementState {
  selectedKnowledgeBaseId: string | null;
  selectedEntryId: string | null;
  isCreatingKnowledgeBase: boolean;
  isEditingKnowledgeBase: boolean;
  isCreatingEntry: boolean;
  isEditingEntry: boolean;
  isImporting: boolean;
  searchQuery: string;
  filteredEntries: KnowledgeEntry[];
}

// 知识库操作动作类型
export type KnowledgeActionType = 
  | 'create_knowledge_base'
  | 'edit_knowledge_base'
  | 'create_entry'
  | 'edit_entry'
  | 'import_entries'
  | 'cancel';