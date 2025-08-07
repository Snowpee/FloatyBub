import { AIRole, VoiceSettings, VoiceModel } from '../store';

// 音频缓存相关接口和常量
interface AudioCacheItem {
  id: string;
  audioBlob: Blob;
  createdAt: number;
  size: number;
  cacheKey: string;
}

const CACHE_DB_NAME = 'VoiceAudioCache';
const CACHE_DB_VERSION = 1;
const CACHE_STORE_NAME = 'audioCache';
const CACHE_EXPIRY_DAYS = 7;
const CACHE_MAX_SIZE_MB = 100;
const CACHE_MAX_SIZE_BYTES = CACHE_MAX_SIZE_MB * 1024 * 1024;

// IndexedDB 数据库实例
let cacheDB: IDBDatabase | null = null;

// 初始化缓存数据库
const initCacheDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (cacheDB) {
      resolve(cacheDB);
      return;
    }

    const request = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);

    request.onerror = () => {
      reject(new Error('无法打开缓存数据库'));
    };

    request.onsuccess = () => {
      cacheDB = request.result;
      resolve(cacheDB);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // 创建对象存储
      if (!db.objectStoreNames.contains(CACHE_STORE_NAME)) {
        const store = db.createObjectStore(CACHE_STORE_NAME, { keyPath: 'id' });
        store.createIndex('cacheKey', 'cacheKey', { unique: true });
        store.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };
  });
};

// 生成缓存键（MD5哈希）
const generateCacheKey = async (text: string, voiceModelId: string, settings: VoiceSettings): Promise<string> => {
  const data = {
    text: text.trim(),
    voiceModelId,
    readingMode: settings.readingMode,
    apiUrl: settings.apiUrl
  };
  
  const encoder = new TextEncoder();
  const dataString = JSON.stringify(data);
  const dataBuffer = encoder.encode(dataString);
  
  const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
};

// 从缓存获取音频
const getCachedAudio = async (cacheKey: string): Promise<Blob | null> => {
  try {
    const db = await initCacheDB();
    const transaction = db.transaction([CACHE_STORE_NAME], 'readonly');
    const store = transaction.objectStore(CACHE_STORE_NAME);
    const index = store.index('cacheKey');
    
    return new Promise((resolve, reject) => {
      const request = index.get(cacheKey);
      
      request.onsuccess = () => {
        const result = request.result as AudioCacheItem | undefined;
        if (result) {
          // 检查是否过期
          const now = Date.now();
          const expiryTime = result.createdAt + (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
          
          if (now < expiryTime) {
            resolve(result.audioBlob);
          } else {
            // 过期，删除缓存项
            deleteCachedAudio(result.id).catch(console.error);
            resolve(null);
          }
        } else {
          resolve(null);
        }
      };
      
      request.onerror = () => {
        reject(new Error('读取缓存失败'));
      };
    });
  } catch (error) {
    console.error('获取缓存音频失败:', error);
    return null;
  }
};

// 保存音频到缓存
const setCachedAudio = async (cacheKey: string, audioBlob: Blob): Promise<void> => {
  try {
    const db = await initCacheDB();
    
    // 检查缓存大小限制
    const currentSize = await getCacheSize();
    if (currentSize + audioBlob.size > CACHE_MAX_SIZE_BYTES) {
      // 清理过期缓存
      await cleanExpiredCache();
      
      // 再次检查大小
      const newSize = await getCacheSize();
      if (newSize + audioBlob.size > CACHE_MAX_SIZE_BYTES) {
        console.warn('缓存空间不足，跳过缓存');
        return;
      }
    }
    
    const cacheItem: AudioCacheItem = {
      id: crypto.randomUUID(),
      audioBlob,
      createdAt: Date.now(),
      size: audioBlob.size,
      cacheKey
    };
    
    const transaction = db.transaction([CACHE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(CACHE_STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.add(cacheItem);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error('保存缓存失败'));
      };
    });
  } catch (error) {
    console.error('保存缓存音频失败:', error);
  }
};

// 删除缓存项
const deleteCachedAudio = async (id: string): Promise<void> => {
  try {
    const db = await initCacheDB();
    const transaction = db.transaction([CACHE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(CACHE_STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.delete(id);
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error('删除缓存失败'));
      };
    });
  } catch (error) {
    console.error('删除缓存音频失败:', error);
  }
};

// 获取缓存总大小
const getCacheSize = async (): Promise<number> => {
  try {
    const db = await initCacheDB();
    const transaction = db.transaction([CACHE_STORE_NAME], 'readonly');
    const store = transaction.objectStore(CACHE_STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const items = request.result as AudioCacheItem[];
        const totalSize = items.reduce((sum, item) => sum + item.size, 0);
        resolve(totalSize);
      };
      
      request.onerror = () => {
        reject(new Error('获取缓存大小失败'));
      };
    });
  } catch (error) {
    console.error('获取缓存大小失败:', error);
    return 0;
  }
};

// 清理过期缓存
const cleanExpiredCache = async (): Promise<void> => {
  try {
    const db = await initCacheDB();
    const transaction = db.transaction([CACHE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(CACHE_STORE_NAME);
    
    const now = Date.now();
    const expiryThreshold = now - (CACHE_EXPIRY_DAYS * 24 * 60 * 60 * 1000);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const items = request.result as AudioCacheItem[];
        const expiredItems = items.filter(item => item.createdAt < expiryThreshold);
        
        // 删除过期项
        const deletePromises = expiredItems.map(item => deleteCachedAudio(item.id));
        Promise.all(deletePromises).then(() => resolve()).catch(reject);
      };
      
      request.onerror = () => {
        reject(new Error('清理过期缓存失败'));
      };
    });
  } catch (error) {
    console.error('清理过期缓存失败:', error);
  }
};

// 清空所有缓存
export const clearAllCache = async (): Promise<void> => {
  try {
    const db = await initCacheDB();
    const transaction = db.transaction([CACHE_STORE_NAME], 'readwrite');
    const store = transaction.objectStore(CACHE_STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.clear();
      
      request.onsuccess = () => {
        resolve();
      };
      
      request.onerror = () => {
        reject(new Error('清空缓存失败'));
      };
    });
  } catch (error) {
    console.error('清空缓存失败:', error);
    throw error;
  }
};

// 获取缓存统计信息
export const getCacheStats = async (): Promise<{ size: number; count: number; sizeFormatted: string }> => {
  try {
    const db = await initCacheDB();
    const transaction = db.transaction([CACHE_STORE_NAME], 'readonly');
    const store = transaction.objectStore(CACHE_STORE_NAME);
    
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      
      request.onsuccess = () => {
        const items = request.result as AudioCacheItem[];
        const totalSize = items.reduce((sum, item) => sum + item.size, 0);
        const count = items.length;
        
        // 格式化大小显示
        let sizeFormatted: string;
        if (totalSize < 1024) {
          sizeFormatted = `${totalSize} B`;
        } else if (totalSize < 1024 * 1024) {
          sizeFormatted = `${(totalSize / 1024).toFixed(1)} KB`;
        } else {
          sizeFormatted = `${(totalSize / (1024 * 1024)).toFixed(1)} MB`;
        }
        
        resolve({ size: totalSize, count, sizeFormatted });
      };
      
      request.onerror = () => {
        reject(new Error('获取缓存统计失败'));
      };
    });
  } catch (error) {
    console.error('获取缓存统计失败:', error);
    return { size: 0, count: 0, sizeFormatted: '0 B' };
  }
};

// 语音播放状态管理
interface VoicePlaybackState {
  isPlaying: boolean;
  currentAudio: HTMLAudioElement | null;
  currentMessageId: string | null;
  isGenerating: boolean;
}

let voiceState: VoicePlaybackState = {
  isPlaying: false,
  currentAudio: null,
  currentMessageId: null,
  isGenerating: false
};

// 语音播放状态监听器
type VoiceStateListener = (state: VoicePlaybackState) => void;
const listeners: VoiceStateListener[] = [];

export const addVoiceStateListener = (listener: VoiceStateListener) => {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) {
      listeners.splice(index, 1);
    }
  };
};

const notifyListeners = () => {
  listeners.forEach(listener => listener({ ...voiceState }));
};

// 停止当前播放
export const stopCurrentVoice = () => {
  if (voiceState.currentAudio) {
    voiceState.currentAudio.pause();
    voiceState.currentAudio.currentTime = 0;
    voiceState.currentAudio = null;
  }
  voiceState.isPlaying = false;
  voiceState.currentMessageId = null;
  notifyListeners();
};

// 确定使用的语音模型
export const getVoiceModelForMessage = (
  role: AIRole | null,
  voiceSettings: VoiceSettings | null
): VoiceModel | null => {
  if (!voiceSettings?.customModels) return null;

  // 优先级：角色专属 > 默认 > 第一个预设模型
  let targetModelId: string | undefined;

  // 1. 角色专属语音模型
  if (role?.voiceModelId) {
    targetModelId = role.voiceModelId;
  }
  // 2. 默认语音模型
  else if (voiceSettings.defaultVoiceModelId) {
    targetModelId = voiceSettings.defaultVoiceModelId;
  }
  // 3. 第一个预设模型
  else {
    const presetModel = voiceSettings.customModels.find(m => m.isPreset);
    if (presetModel) {
      targetModelId = presetModel.id;
    }
  }

  if (!targetModelId) return null;

  return voiceSettings.customModels.find(m => m.id === targetModelId) || null;
};

// 处理朗读内容（根据朗读模式过滤）
export const processTextForReading = (
  text: string,
  readingMode: 'all' | 'dialogue-only'
): string => {
  if (readingMode === 'all') {
    return text;
  }

  // 仅朗读对白模式：移除斜体文字（场景描述、心理描述等）
  if (readingMode === 'dialogue-only') {
    // 移除 *斜体文字* 和 _斜体文字_
    return text
      .replace(/\*([^*]+)\*/g, '') // 移除 *text*
      .replace(/_([^_]+)_/g, '') // 移除 _text_
      .replace(/\s+/g, ' ') // 合并多个空格
      .trim();
  }

  return text;
};

// 调用语音API生成音频（带缓存）
export const generateVoiceAudio = async (
  text: string,
  voiceModel: VoiceModel,
  voiceSettings: VoiceSettings
): Promise<string> => {
  try {
    // 生成缓存键
    const cacheKey = await generateCacheKey(text, voiceModel.id, voiceSettings);
    
    // 先检查缓存
    const cachedBlob = await getCachedAudio(cacheKey);
    if (cachedBlob) {
      console.log('使用缓存的音频文件');
      return URL.createObjectURL(cachedBlob);
    }
    
    console.log('缓存未命中，调用API生成音频');
    
    // 设置生成状态
    voiceState.isGenerating = true;
    notifyListeners();
    
    try {
      // 使用本地代理服务器而不是直接调用官方API
      const apiBaseUrl = import.meta.env.PROD ? '' : 'http://localhost:3001';
      
      const response = await fetch(`${apiBaseUrl}/api/tts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': import.meta.env.VITE_API_SECRET || ''
        },
        body: JSON.stringify({
          text,
          reference_id: voiceModel.id,
          format: 'mp3',
          mp3_bitrate: 128,
          model: voiceSettings.modelVersion || 'speech-1.6',
          fish_audio_key: voiceSettings.apiKey
        })
      });

      if (!response.ok) {
        throw new Error(`语音生成失败: ${response.status} ${response.statusText}`);
      }

      const audioBlob = await response.blob();
      
      // 保存到缓存（异步，不阻塞返回）
      setCachedAudio(cacheKey, audioBlob).catch(error => {
        console.warn('保存音频缓存失败:', error);
      });
      
      return URL.createObjectURL(audioBlob);
    } finally {
      // 重置生成状态
      voiceState.isGenerating = false;
      notifyListeners();
    }
  } catch (error) {
    console.error('生成音频失败:', error);
    // 确保重置生成状态
    voiceState.isGenerating = false;
    notifyListeners();
    throw error;
  }
};

// 播放语音
export const playVoice = async (
  messageId: string,
  text: string,
  role: AIRole | null,
  voiceSettings: VoiceSettings | null
): Promise<void> => {
  return new Promise((resolve, reject) => {
    try {
      // 如果正在播放同一条消息，则停止播放
      if (voiceState.isPlaying && voiceState.currentMessageId === messageId) {
        stopCurrentVoice();
        resolve();
        return;
      }

      // 停止当前播放
      stopCurrentVoice();

      if (!voiceSettings) {
        reject(new Error('语音设置未配置'));
        return;
      }

      // 获取语音模型
      const voiceModel = getVoiceModelForMessage(role, voiceSettings);
      if (!voiceModel) {
        reject(new Error('未找到可用的语音模型'));
        return;
      }

      // 处理朗读内容
      const processedText = processTextForReading(text, voiceSettings.readingMode);
      if (!processedText.trim()) {
        reject(new Error('没有可朗读的内容'));
        return;
      }

      // 更新状态
      voiceState.isPlaying = true;
      voiceState.currentMessageId = messageId;
      notifyListeners();

      // 生成音频
      generateVoiceAudio(processedText, voiceModel, voiceSettings)
        .then(audioUrl => {
          // 创建音频对象
          const audio = new Audio(audioUrl);
          voiceState.currentAudio = audio;

          // 设置音频事件监听器
          audio.onended = () => {
            URL.revokeObjectURL(audioUrl); // 清理URL
            stopCurrentVoice();
            resolve();
          };

          audio.onerror = (event) => {
            console.error('音频播放错误:', event);
            URL.revokeObjectURL(audioUrl); // 清理URL
            stopCurrentVoice();
            reject(new Error('音频播放失败'));
          };

          // 播放音频
          audio.play().catch(error => {
            console.error('音频播放启动失败:', error);
            URL.revokeObjectURL(audioUrl);
            stopCurrentVoice();
            reject(new Error('音频播放启动失败'));
          });
        })
        .catch(error => {
          stopCurrentVoice();
          reject(error);
        });

    } catch (error) {
      stopCurrentVoice();
      reject(error);
    }
  });
};

// 获取当前播放状态
export const getVoiceState = (): VoicePlaybackState => {
  return { ...voiceState };
};