// 知识库状态管理

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { KnowledgeService } from '@/services/knowledgeService';
import type {
  KnowledgeBase,
  KnowledgeEntry,
  CreateKnowledgeBaseRequest,
  UpdateKnowledgeBaseRequest,
  CreateKnowledgeEntryRequest,
  UpdateKnowledgeEntryRequest,
  KnowledgeBaseStats,
  ImportKnowledgeEntriesRequest,
  ImportKnowledgeEntry,
  KnowledgeManagementState,
  KnowledgeActionType
} from '../types/knowledge';

interface KnowledgeStore {
  // 状态
  knowledgeBases: KnowledgeBase[];
  currentKnowledgeBase: KnowledgeBase | null;
  knowledgeEntries: KnowledgeEntry[];
  entriesKnowledgeBaseId: string | null;
  knowledgeBaseStats: KnowledgeBaseStats[];
  loading: boolean;
  error: string | null;
  managementState: KnowledgeManagementState;

  // 知识库操作
  loadKnowledgeBases: () => Promise<void>;
  loadKnowledgeBaseStats: () => Promise<void>;
  createKnowledgeBase: (request: CreateKnowledgeBaseRequest) => Promise<KnowledgeBase>;
  updateKnowledgeBase: (id: string, request: UpdateKnowledgeBaseRequest) => Promise<KnowledgeBase>;
  deleteKnowledgeBase: (id: string) => Promise<void>;
  setCurrentKnowledgeBase: (knowledgeBase: KnowledgeBase | null) => void;

  // 知识条目操作
  loadKnowledgeEntries: (knowledgeBaseId: string) => Promise<void>;
  createKnowledgeEntry: (request: CreateKnowledgeEntryRequest) => Promise<KnowledgeEntry>;
  updateKnowledgeEntry: (id: string, request: UpdateKnowledgeEntryRequest) => Promise<KnowledgeEntry>;
  deleteKnowledgeEntry: (id: string) => Promise<void>;
  importKnowledgeEntries: (request: ImportKnowledgeEntriesRequest) => Promise<KnowledgeEntry[]>;
  bulkImportKnowledgeEntries: (knowledgeBaseId: string, entries: ImportKnowledgeEntry[]) => Promise<{ success: number; failed: number }>;
  searchKnowledgeEntries: (knowledgeBaseId: string, keywords: string[]) => Promise<KnowledgeEntry[]>;

  // 角色卡知识库关联
  setRoleKnowledgeBase: (roleId: string, knowledgeBaseId: string | null) => Promise<void>;
  getRoleKnowledgeBase: (roleId: string) => Promise<KnowledgeBase | null>;
  getKnowledgeBaseStats: (knowledgeBaseId: string) => Promise<any>;

  // 管理状态操作
  setManagementState: (state: Partial<KnowledgeManagementState>) => void;
  performAction: (action: KnowledgeActionType, payload?: any) => Promise<void>;

  // 工具方法
  clearError: () => void;
  reset: () => void;
}

const initialManagementState: KnowledgeManagementState = {
  selectedKnowledgeBaseId: null,
  selectedEntryId: null,
  isCreatingKnowledgeBase: false,
  isEditingKnowledgeBase: false,
  isCreatingEntry: false,
  isEditingEntry: false,
  isImporting: false,
  searchQuery: '',
  filteredEntries: []
};

export const useKnowledgeStore = create<KnowledgeStore>()(devtools(
  (set, get) => ({
    // 初始状态
    knowledgeBases: [],
    currentKnowledgeBase: null,
    knowledgeEntries: [],
    entriesKnowledgeBaseId: null,
    knowledgeBaseStats: [],
    loading: false,
    error: null,
    managementState: initialManagementState,

    // 知识库操作
    loadKnowledgeBases: async () => {
      const { knowledgeBases } = get();
      const hasLocal = knowledgeBases.length > 0;
      if (!hasLocal) {
        set({ loading: true, error: null });
      } else {
        set({ error: null });
      }
      try {
        const knowledgeBases = await KnowledgeService.getKnowledgeBases();
        set({ knowledgeBases, loading: false });
      } catch (error) {
        const message = (error as Error).message;
        const { knowledgeBases: existing } = get();
        if (existing.length > 0) {
          set({ error: message, loading: false });
        } else {
          set({ error: message, loading: false });
        }
      }
    },

    loadKnowledgeBaseStats: async () => {
      set({ loading: true, error: null });
      try {
        const knowledgeBaseStats = await KnowledgeService.getKnowledgeBaseStats();
        set({ knowledgeBaseStats, loading: false });
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
      }
    },

    createKnowledgeBase: async (request: CreateKnowledgeBaseRequest) => {
      set({ loading: true, error: null });
      try {
        const newKnowledgeBase = await KnowledgeService.createKnowledgeBase(request);
        const { knowledgeBases } = get();
        set({ 
          knowledgeBases: [newKnowledgeBase, ...knowledgeBases],
          loading: false 
        });
        return newKnowledgeBase;
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
        throw error;
      }
    },

    updateKnowledgeBase: async (id: string, request: UpdateKnowledgeBaseRequest) => {
      set({ loading: true, error: null });
      try {
        const updatedKnowledgeBase = await KnowledgeService.updateKnowledgeBase(id, request);
        const { knowledgeBases, currentKnowledgeBase } = get();
        const updatedKnowledgeBases = knowledgeBases.map(kb => 
          kb.id === id ? updatedKnowledgeBase : kb
        );
        set({ 
          knowledgeBases: updatedKnowledgeBases,
          currentKnowledgeBase: currentKnowledgeBase?.id === id ? updatedKnowledgeBase : currentKnowledgeBase,
          loading: false 
        });
        return updatedKnowledgeBase;
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
        throw error;
      }
    },

    deleteKnowledgeBase: async (id: string) => {
      set({ loading: true, error: null });
      try {
        await KnowledgeService.deleteKnowledgeBase(id);
        const { knowledgeBases, currentKnowledgeBase } = get();
        const filteredKnowledgeBases = knowledgeBases.filter(kb => kb.id !== id);
        set({ 
          knowledgeBases: filteredKnowledgeBases,
          currentKnowledgeBase: currentKnowledgeBase?.id === id ? null : currentKnowledgeBase,
          knowledgeEntries: currentKnowledgeBase?.id === id ? [] : get().knowledgeEntries,
          entriesKnowledgeBaseId: currentKnowledgeBase?.id === id ? null : get().entriesKnowledgeBaseId,
          loading: false 
        });
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
        throw error;
      }
    },

    setCurrentKnowledgeBase: (knowledgeBase: KnowledgeBase | null) => {
      set({ currentKnowledgeBase: knowledgeBase });
    },

    // 知识条目操作
    loadKnowledgeEntries: async (knowledgeBaseId: string) => {
      const { knowledgeEntries, entriesKnowledgeBaseId } = get();
      const hasLocalForSameBase = entriesKnowledgeBaseId === knowledgeBaseId && knowledgeEntries.length > 0;
      if (!hasLocalForSameBase) {
        set({ loading: true, error: null });
      } else {
        set({ error: null });
      }
      try {
        const knowledgeEntries = await KnowledgeService.getKnowledgeEntries(knowledgeBaseId);
        set({ knowledgeEntries, entriesKnowledgeBaseId: knowledgeBaseId, loading: false });
      } catch (error) {
        const message = (error as Error).message;
        const { knowledgeEntries: existing, entriesKnowledgeBaseId: existingBaseId } = get();
        if (existingBaseId === knowledgeBaseId && existing.length > 0) {
          set({ error: message, loading: false });
        } else {
          set({ error: message, loading: false, knowledgeEntries: [], entriesKnowledgeBaseId: knowledgeBaseId });
        }
      }
    },

    createKnowledgeEntry: async (request: CreateKnowledgeEntryRequest) => {
      set({ loading: true, error: null });
      try {
        const newEntry = await KnowledgeService.createKnowledgeEntry(request);
        const { knowledgeEntries } = get();
        set({ 
          knowledgeEntries: [newEntry, ...knowledgeEntries],
          loading: false 
        });
        return newEntry;
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
        throw error;
      }
    },

    updateKnowledgeEntry: async (id: string, request: UpdateKnowledgeEntryRequest) => {
      set({ loading: true, error: null });
      try {
        const updatedEntry = await KnowledgeService.updateKnowledgeEntry(id, request);
        const { knowledgeEntries } = get();
        const updatedEntries = knowledgeEntries.map(entry => 
          entry.id === id ? updatedEntry : entry
        );
        set({ 
          knowledgeEntries: updatedEntries,
          loading: false 
        });
        return updatedEntry;
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
        throw error;
      }
    },

    deleteKnowledgeEntry: async (id: string) => {
      set({ loading: true, error: null });
      try {
        await KnowledgeService.deleteKnowledgeEntry(id);
        const { knowledgeEntries } = get();
        const filteredEntries = knowledgeEntries.filter(entry => entry.id !== id);
        set({ 
          knowledgeEntries: filteredEntries,
          loading: false 
        });
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
        throw error;
      }
    },

    importKnowledgeEntries: async (request: ImportKnowledgeEntriesRequest) => {
      set({ loading: true, error: null });
      try {
        const importedEntries = await KnowledgeService.importKnowledgeEntries(request);
        const { knowledgeEntries } = get();
        set({ 
          knowledgeEntries: [...importedEntries, ...knowledgeEntries],
          loading: false 
        });
        return importedEntries;
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
        throw error;
      }
    },

    bulkImportKnowledgeEntries: async (knowledgeBaseId: string, entries: ImportKnowledgeEntry[]) => {
      set({ loading: true, error: null });
      try {
        let successCount = 0;
        let failedCount = 0;
        const importedEntries: KnowledgeEntry[] = [];

        for (const entry of entries) {
          try {
            const createRequest: CreateKnowledgeEntryRequest = {
              ...entry,
              knowledge_base_id: knowledgeBaseId
            };
            const newEntry = await KnowledgeService.createKnowledgeEntry(createRequest);
            importedEntries.push(newEntry);
            successCount++;
          } catch (error) {
            failedCount++;
            console.error('Failed to import entry:', entry.name, error);
          }
        }

        // 更新本地状态
        const { knowledgeEntries } = get();
        set({ 
          knowledgeEntries: [...importedEntries, ...knowledgeEntries],
          loading: false 
        });

        return { success: successCount, failed: failedCount };
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
        throw error;
      }
    },

    searchKnowledgeEntries: async (knowledgeBaseId: string, keywords: string[]) => {
      try {
        const results = await KnowledgeService.searchKnowledgeEntries(knowledgeBaseId, keywords);
        return results;
      } catch (error) {
        set({ error: (error as Error).message });
        return [];
      }
    },

    // 角色卡知识库关联
    setRoleKnowledgeBase: async (roleId: string, knowledgeBaseId: string | null) => {
      set({ loading: true, error: null });
      try {
        await KnowledgeService.setRoleKnowledgeBase(roleId, knowledgeBaseId);
        set({ loading: false });
      } catch (error) {
        set({ error: (error as Error).message, loading: false });
        throw error;
      }
    },

    getRoleKnowledgeBase: async (roleId: string) => {
      try {
        const knowledgeBase = await KnowledgeService.getRoleKnowledgeBase(roleId);
        return knowledgeBase;
      } catch (error) {
        set({ error: (error as Error).message });
        return null;
      }
    },

    getKnowledgeBaseStats: async (knowledgeBaseId: string) => {
      try {
        const entries = await KnowledgeService.getKnowledgeEntries(knowledgeBaseId);
        return {
          entryCount: entries.length,
          lastUpdated: entries.length > 0 ? entries[0].updated_at : null
        };
      } catch (error) {
        console.error('获取知识库统计信息失败:', error);
        return {
          entryCount: 0,
          lastUpdated: null
        };
      }
    },

    // 管理状态操作
    setManagementState: (state: Partial<KnowledgeManagementState>) => {
      const { managementState } = get();
      set({ managementState: { ...managementState, ...state } });
    },

    performAction: async (action: KnowledgeActionType, payload?: any) => {
      const { setManagementState } = get();
      
      switch (action) {
        case 'create_knowledge_base':
          setManagementState({ isCreatingKnowledgeBase: true });
          break;
        case 'edit_knowledge_base':
          setManagementState({ isEditingKnowledgeBase: true, selectedKnowledgeBaseId: payload?.id });
          break;
        case 'create_entry':
          setManagementState({ isCreatingEntry: true });
          break;
        case 'edit_entry':
          setManagementState({ isEditingEntry: true, selectedEntryId: payload?.id });
          break;
        case 'import_entries':
          setManagementState({ isImporting: true });
          break;
        case 'cancel':
          setManagementState({
            isCreatingKnowledgeBase: false,
            isEditingKnowledgeBase: false,
            isCreatingEntry: false,
            isEditingEntry: false,
            isImporting: false,
            selectedKnowledgeBaseId: null,
            selectedEntryId: null
          });
          break;
      }
    },

    // 工具方法
    clearError: () => set({ error: null }),

    reset: () => set({
      knowledgeBases: [],
      currentKnowledgeBase: null,
      knowledgeEntries: [],
      entriesKnowledgeBaseId: null,
      knowledgeBaseStats: [],
      loading: false,
      error: null,
      managementState: initialManagementState
    })
  }),
  {
    name: 'knowledge-store'
  }
));
