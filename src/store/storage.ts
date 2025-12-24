
// 简单的 IndexedDB 封装
const DB_NAME = 'floaty-bub-db';
const STORE_NAME = 'key-value-store';
const DB_VERSION = 1;

interface IDBAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

// 初始化数据库连接
function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      console.error('Failed to open IndexedDB');
      reject(request.error);
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
}

export const indexedDBStorage: IDBAdapter = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      // 1. 尝试从 IndexedDB 读取
      const db = await getDB();
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(name);

      const idbResult = await new Promise<string | undefined>((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });

      if (idbResult) {
        return idbResult;
      }

      // 2. 如果 IndexedDB 为空，检查 localStorage (迁移逻辑)
      if (typeof window !== 'undefined') {
        const localValue = localStorage.getItem(name);
        if (localValue) {
          console.log(`[Storage] Migrating ${name} from localStorage to IndexedDB`);
          // 写入 IndexedDB
          await indexedDBStorage.setItem(name, localValue);
          // 清除 localStorage 以释放空间
          try {
            localStorage.removeItem(name);
            console.log(`[Storage] Removed ${name} from localStorage`);
          } catch (e) {
            console.warn('[Storage] Failed to remove from localStorage:', e);
          }
          return localValue;
        }
      }

      return null;
    } catch (error) {
      console.error('[Storage] Error in getItem:', error);
      // Fallback to localStorage just in case IndexedDB fails completely?
      // No, mixed usage is dangerous. Just return null or throw.
      return null;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const db = await getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.put(value, name);

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[Storage] Error in setItem:', error);
      
      // 如果 IndexedDB 写入失败，尝试清理旧数据
      if (error instanceof DOMException && error.name === 'QuotaExceededError') {
        console.warn('[Storage] QuotaExceededError detected, attempting to clear old data...');
        // 这里可以添加清理逻辑，例如删除最旧的非活跃会话
        // 但目前简单抛出错误，交由上层处理
      }
      
      // 不抛出错误，而是降级处理或记录日志，避免应用崩溃
      // 注意：这意味着数据可能未保存成功
      console.error('[Storage] Failed to save data to IndexedDB. Changes may be lost.');
    }
  },

  removeItem: async (name: string): Promise<void> => {
    try {
      const db = await getDB();
      const transaction = db.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(name);

      await new Promise<void>((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error('[Storage] Error in removeItem:', error);
    }
  },
};
