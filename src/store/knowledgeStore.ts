// 知识库状态管理

import { create } from 'zustand';
import { devtools, persist, createJSONStorage } from 'zustand/middleware';
import { indexedDBStorage } from './storage';
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
} from '@/types/knowledge';

const sortKnowledgeBasesByCreatedAtDesc = (bases: KnowledgeBase[]) =>
  [...bases].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

interface KnowledgeStore {
  // 状态
  knowledgeBases: KnowledgeBase[];
  currentKnowledgeBase: KnowledgeBase | null;
  knowledgeEntries: KnowledgeEntry[];
  entriesKnowledgeBaseId: string | null;
  allKnowledgeEntries: KnowledgeEntry[]; // 新增：缓存所有知识条目
  knowledgeBaseStats: KnowledgeBaseStats[];
  loading: boolean;
  error: string | null;
  managementState: KnowledgeManagementState;

  // 知识库操作
  loadKnowledgeBases: () => Promise<void>;
  loadKnowledgeBaseStats: () => Promise<void>;
  createKnowledgeBase: (request: CreateKnowledgeBaseRequest, options?: { skipSync?: boolean }) => Promise<KnowledgeBase>;
  updateKnowledgeBase: (id: string, request: UpdateKnowledgeBaseRequest, options?: { skipSync?: boolean }) => Promise<KnowledgeBase>;
  deleteKnowledgeBase: (id: string, options?: { skipSync?: boolean }) => Promise<void>;
  setCurrentKnowledgeBase: (knowledgeBase: KnowledgeBase | null) => void;

  // 知识条目操作
  loadKnowledgeEntries: (knowledgeBaseId: string) => Promise<void>;
  createKnowledgeEntry: (request: CreateKnowledgeEntryRequest, options?: { skipSync?: boolean }) => Promise<KnowledgeEntry>;
  updateKnowledgeEntry: (id: string, request: UpdateKnowledgeEntryRequest, options?: { skipSync?: boolean }) => Promise<KnowledgeEntry>;
  deleteKnowledgeEntry: (id: string, options?: { skipSync?: boolean }) => Promise<void>;
  importKnowledgeEntries: (request: ImportKnowledgeEntriesRequest, options?: { skipSync?: boolean }) => Promise<KnowledgeEntry[]>;
  bulkImportKnowledgeEntries: (knowledgeBaseId: string, entries: ImportKnowledgeEntry[], options?: { skipSync?: boolean }) => Promise<{ success: number; failed: number }>;
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
  persist(
    (set, get) => ({
      // 初始状态
      knowledgeBases: [],
      currentKnowledgeBase: null,
      knowledgeEntries: [],
      entriesKnowledgeBaseId: null,
      allKnowledgeEntries: [],
      knowledgeBaseStats: [],
      loading: false,
      error: null,
      managementState: initialManagementState,

      // 知识库操作
      loadKnowledgeBases: async () => {
        const { knowledgeBases } = get();
        // 1. 如果本地有数据，直接视为加载完成，不显示 loading
        if (knowledgeBases.length > 0) {
          set({ loading: false, error: null });
        } else {
          // 仅在完全无数据时显示 loading
          set({ loading: true, error: null });
        }
        
        try {
          // 2. 异步从 Service 获取最新数据 (Service 内部读 IndexedDB)
          const latestKnowledgeBases = await KnowledgeService.getKnowledgeBases();
          set({ knowledgeBases: sortKnowledgeBasesByCreatedAtDesc(latestKnowledgeBases), loading: false });
        } catch (error) {
          const message = (error as Error).message;
          // 即使出错，如果本地有数据，也不要清空
          if (get().knowledgeBases.length === 0) {
            set({ error: message, loading: false });
          } else {
            set({ loading: false });
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

      createKnowledgeBase: async (request: CreateKnowledgeBaseRequest, options?: { skipSync?: boolean }) => {
        set({ loading: true, error: null });
        try {
          const newKnowledgeBase = await KnowledgeService.createKnowledgeBase(request);
          const { knowledgeBases } = get();
          
          const baseWithStatus = {
            ...newKnowledgeBase,
            pendingUpload: !options?.skipSync
          };

          set({ 
            knowledgeBases: sortKnowledgeBasesByCreatedAtDesc([baseWithStatus, ...knowledgeBases]),
            loading: false 
          });
          return baseWithStatus;
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      updateKnowledgeBase: async (id: string, request: UpdateKnowledgeBaseRequest, options?: { skipSync?: boolean }) => {
        set({ loading: true, error: null });
        try {
          const updatedKnowledgeBase = await KnowledgeService.updateKnowledgeBase(id, request);
          const { knowledgeBases, currentKnowledgeBase } = get();
          
          const baseWithStatus = {
            ...updatedKnowledgeBase,
            pendingUpload: !options?.skipSync
          };

          const updatedKnowledgeBases = sortKnowledgeBasesByCreatedAtDesc(knowledgeBases.map(kb => 
            kb.id === id ? baseWithStatus : kb
          ));
          set({ 
            knowledgeBases: updatedKnowledgeBases,
            currentKnowledgeBase: currentKnowledgeBase?.id === id ? baseWithStatus : currentKnowledgeBase,
            loading: false 
          });
          return baseWithStatus;
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      deleteKnowledgeBase: async (id: string, options?: { skipSync?: boolean }) => {
        const prevState = get()
        set({
          error: null,
          loading: false,
          knowledgeBases: prevState.knowledgeBases.filter(kb => kb.id !== id),
          currentKnowledgeBase: prevState.currentKnowledgeBase?.id === id ? null : prevState.currentKnowledgeBase,
          knowledgeEntries: prevState.entriesKnowledgeBaseId === id ? [] : prevState.knowledgeEntries,
          entriesKnowledgeBaseId: prevState.entriesKnowledgeBaseId === id ? null : prevState.entriesKnowledgeBaseId,
          allKnowledgeEntries: prevState.allKnowledgeEntries.filter(e => e.knowledge_base_id !== id)
        })
        try {
          await KnowledgeService.deleteKnowledgeBase(id);
          if (!options?.skipSync) {
            try {
              const { dataSyncService } = await import('@/services/DataSyncService')
              await dataSyncService.queueSync('knowledge_base', { id }, 'delete')
            } catch (error) {
              set({ error: error instanceof Error ? error.message : String(error) })
            }
          }
        } catch (error) {
          set({ ...prevState, error: (error as Error).message, loading: false });
          throw error;
        }
      },

      setCurrentKnowledgeBase: (knowledgeBase: KnowledgeBase | null) => {
        set({ currentKnowledgeBase: knowledgeBase });
      },

      // 知识条目操作
      loadKnowledgeEntries: async (knowledgeBaseId: string) => {
        const { allKnowledgeEntries } = get();

        // 1. 优先使用缓存渲染
        const cachedEntries = allKnowledgeEntries
          .filter(e => e.knowledge_base_id === knowledgeBaseId)
          .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());

        set({
          knowledgeEntries: cachedEntries,
          entriesKnowledgeBaseId: knowledgeBaseId,
          loading: false,
          error: null
        });

        try {
          // 2. 异步获取最新数据
          const latestEntries = await KnowledgeService.getKnowledgeEntries(knowledgeBaseId);
          
          // 如果没有新数据且有缓存，直接返回
          if (latestEntries.length === 0 && cachedEntries.length > 0) {
            return
          }

          set((state) => {
            // 始终更新全量缓存（合并新数据）
            const otherEntries = state.allKnowledgeEntries.filter(e => e.knowledge_base_id !== knowledgeBaseId);
            const newAllEntries = [...otherEntries, ...latestEntries];

            // 关键修复：检查当前 UI 是否还停留在请求的知识库上
            if (state.entriesKnowledgeBaseId === knowledgeBaseId) {
              // 如果是，更新当前显示列表
              return {
                knowledgeEntries: latestEntries,
                entriesKnowledgeBaseId: knowledgeBaseId,
                allKnowledgeEntries: newAllEntries,
                loading: false
              };
            } else {
              // 如果用户已切换到其他知识库，仅更新后台缓存，不干扰 UI
              return {
                allKnowledgeEntries: newAllEntries
              };
            }
          });
        } catch (error) {
          // 出错时也只在当前页面处理 loading 状态
          set((state) => {
              if (state.entriesKnowledgeBaseId === knowledgeBaseId) {
                  return { loading: false };
              }
              return {};
          });
        }
      },

      createKnowledgeEntry: async (request: CreateKnowledgeEntryRequest, options?: { skipSync?: boolean }) => {
        set({ loading: true, error: null });
        try {
          const newEntry = await KnowledgeService.createKnowledgeEntry(request);
          const { knowledgeEntries, entriesKnowledgeBaseId, allKnowledgeEntries } = get();
          
          const entryWithStatus = {
            ...newEntry,
            pendingUpload: !options?.skipSync
          };

          set({ 
            knowledgeEntries: entriesKnowledgeBaseId === request.knowledge_base_id ? [entryWithStatus, ...knowledgeEntries] : knowledgeEntries,
            allKnowledgeEntries: [entryWithStatus, ...allKnowledgeEntries],
            loading: false 
          });
          return entryWithStatus;
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      updateKnowledgeEntry: async (id: string, request: UpdateKnowledgeEntryRequest, options?: { skipSync?: boolean }) => {
        set({ loading: true, error: null });
        try {
          const updatedEntry = await KnowledgeService.updateKnowledgeEntry(id, request);
          const { knowledgeEntries, allKnowledgeEntries } = get();
          
          const entryWithStatus = {
            ...updatedEntry,
            pendingUpload: !options?.skipSync
          };

          const updatedEntries = knowledgeEntries.map(entry => 
            entry.id === id ? entryWithStatus : entry
          );
          const updatedAllEntries = allKnowledgeEntries.map(entry =>
            entry.id === id ? entryWithStatus : entry
          );
          set({ 
            knowledgeEntries: updatedEntries,
            allKnowledgeEntries: updatedAllEntries,
            loading: false 
          });
          return entryWithStatus;
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      deleteKnowledgeEntry: async (id: string, options?: { skipSync?: boolean }) => {
        const prevState = get()
        set({
          error: null,
          loading: false,
          knowledgeEntries: prevState.knowledgeEntries.filter(entry => entry.id !== id),
          allKnowledgeEntries: prevState.allKnowledgeEntries.filter(entry => entry.id !== id)
        })
        try {
          await KnowledgeService.deleteKnowledgeEntry(id);
          if (!options?.skipSync) {
            try {
              const { dataSyncService } = await import('@/services/DataSyncService')
              await dataSyncService.queueSync('knowledge_entry', { id }, 'delete')
            } catch (error) {
              set({ error: error instanceof Error ? error.message : String(error) })
            }
          }
        } catch (error) {
          set({ ...prevState, error: (error as Error).message, loading: false });
          throw error;
        }
      },

      importKnowledgeEntries: async (request: ImportKnowledgeEntriesRequest, options?: { skipSync?: boolean }) => {
        set({ loading: true, error: null });
        try {
          const importedEntries = await KnowledgeService.importKnowledgeEntries(request);
          const { knowledgeEntries, entriesKnowledgeBaseId, allKnowledgeEntries } = get();
          
          const entriesWithStatus = importedEntries.map(e => ({
            ...e,
            pendingUpload: !options?.skipSync
          }));

          set({ 
            knowledgeEntries: entriesKnowledgeBaseId === request.knowledge_base_id ? [...entriesWithStatus, ...knowledgeEntries] : knowledgeEntries,
            allKnowledgeEntries: [...entriesWithStatus, ...allKnowledgeEntries],
            loading: false 
          });
          return entriesWithStatus;
        } catch (error) {
          set({ error: (error as Error).message, loading: false });
          throw error;
        }
      },

      bulkImportKnowledgeEntries: async (knowledgeBaseId: string, entries: ImportKnowledgeEntry[], options?: { skipSync?: boolean }) => {
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
              
              const entryWithStatus = {
                ...newEntry,
                pendingUpload: !options?.skipSync
              };
              
              importedEntries.push(entryWithStatus);
              successCount++;
            } catch (error) {
              failedCount++;
              console.error('Failed to import entry:', entry.name, error);
            }
          }

          // 更新本地状态
          const { knowledgeEntries, entriesKnowledgeBaseId, allKnowledgeEntries } = get();
          set({ 
            knowledgeEntries: entriesKnowledgeBaseId === knowledgeBaseId ? [...importedEntries, ...knowledgeEntries] : knowledgeEntries,
            allKnowledgeEntries: [...importedEntries, ...allKnowledgeEntries],
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
        allKnowledgeEntries: [],
        knowledgeBaseStats: [],
        loading: false,
        error: null,
        managementState: initialManagementState
      })
    }),
    {
      name: 'knowledge-store-persist',
      storage: createJSONStorage(() => indexedDBStorage),
      partialize: (state) => ({
        knowledgeBases: state.knowledgeBases,
        knowledgeEntries: state.knowledgeEntries,
        entriesKnowledgeBaseId: state.entriesKnowledgeBaseId,
        allKnowledgeEntries: state.allKnowledgeEntries // 持久化全量缓存
      })
    }
  )
));
