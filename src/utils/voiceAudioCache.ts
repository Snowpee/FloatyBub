export interface VoiceAnalysis {
  version: 1;
  duration: number;
  waveform?: number[];
}
export interface CachedVoice {
  id: string;
  cacheKey: string;
  audioBlob: Blob;
  createdAt: number;
  size: number;
  persisted?: boolean;
  revision?: string;
  analysis?: VoiceAnalysis;
}
interface Binding { id: string; cacheKey: string }
const DB_NAME = 'VoiceAudioCache';
const AUDIO = 'audioCache';
const BINDINGS = 'messageAudio';
const TTL = 7 * 24 * 60 * 60 * 1000;
const MAX_BYTES = 100 * 1024 * 1024;
let dbPromise: Promise<IDBDatabase> | undefined;
// A bounded hot cache bridges failed persistence and immediately repeated reads.
const memory = new Map<string, CachedVoice>();
const memoryBindings = new Map<string, string>();
function remember(item: CachedVoice) {
  memory.delete(item.cacheKey);
  memory.set(item.cacheKey, item);
  let bytes = [...memory.values()].reduce((sum, row) => sum + row.size, 0);
  for (const [key, row] of memory) {
    if (bytes <= 20 * 1024 * 1024) break;
    memory.delete(key); bytes -= row.size;
  }
}
function db(): Promise<IDBDatabase> {
  if (!dbPromise) dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 2);
    open.onupgradeneeded = () => {
      const database = open.result;
      if (!database.objectStoreNames.contains(AUDIO)) {
        database.createObjectStore(AUDIO, { keyPath: 'id' }).createIndex('cacheKey', 'cacheKey', { unique: true });
      }
      if (!database.objectStoreNames.contains(BINDINGS)) database.createObjectStore(BINDINGS, { keyPath: 'id' });
    };
    open.onsuccess = () => {
      open.result.onversionchange = () => { open.result.close(); dbPromise = undefined; };
      resolve(open.result);
    };
    open.onerror = () => reject(open.error);
    open.onblocked = () => reject(new Error('请关闭其他旧版页面后重试音频缓存'));
  }).catch(error => { dbPromise = undefined; throw error; });
  return dbPromise;
}
const result = <T>(request: IDBRequest<T>): Promise<T> => new Promise((resolve, reject) => {
  request.onsuccess = () => resolve(request.result);
  request.onerror = () => reject(request.error);
});
const committed = (tx: IDBTransaction): Promise<void> => new Promise((resolve, reject) => {
  tx.oncomplete = () => resolve();
  tx.onerror = tx.onabort = () => reject(tx.error || new Error('音频缓存事务失败'));
});
export const isVoiceExpired = (item: CachedVoice) => Date.now() - item.createdAt >= TTL;
export async function readVoiceCache(key: string, allowExpired = false): Promise<CachedVoice | undefined> {
  let item = memory.get(key);
  if (!item) try {
    item = await result<CachedVoice | undefined>((await db()).transaction(AUDIO).objectStore(AUDIO).index('cacheKey').get(key));
    if (item) { item.persisted = true; remember(item); }
  } catch (error) { console.warn('读取音频缓存失败', error); }
  return item && (allowExpired || !isVoiceExpired(item)) ? item : undefined;
}
export async function readMessageVoice(id: string): Promise<CachedVoice | undefined> {
  let key = memoryBindings.get(id);
  if (!key) try {
    const binding = await result<Binding | undefined>((await db()).transaction(BINDINGS).objectStore(BINDINGS).get(id));
    key = binding?.cacheKey;
  } catch (error) { console.warn('读取消息语音关联失败', error); }
  return key ? readVoiceCache(key, true) : undefined;
}
export async function bindMessageVoice(id: string, cacheKey: string): Promise<boolean> {
  memoryBindings.set(id, cacheKey);
  try {
    const tx = (await db()).transaction([AUDIO, BINDINGS], 'readwrite');
    const done = committed(tx);
    const found = tx.objectStore(AUDIO).index('cacheKey').get(cacheKey);
    found.onsuccess = () => { if (found.result) tx.objectStore(BINDINGS).put({ id, cacheKey }); };
    await done;
    return !!found.result;
  } catch (error) { console.warn('保存消息语音关联失败', error); return false; }
}
export async function saveVoiceCache(cacheKey: string, audioBlob: Blob, revision = crypto.randomUUID()): Promise<boolean> {
  // Regenerated audio always gets a fresh revision and no analysis from the old blob.
  const item: CachedVoice = { id: cacheKey, cacheKey, audioBlob, revision, createdAt: Date.now(), size: audioBlob.size };
  remember({ ...item, persisted: false });
  try {
    // Capacity decision, eviction, and upsert are serialized in one transaction.
    const tx = (await db()).transaction([AUDIO, BINDINGS], 'readwrite');
    const done = committed(tx);
    let saved = false;
    const rowsRequest = tx.objectStore(AUDIO).getAll();
    rowsRequest.onsuccess = () => {
      const rows = rowsRequest.result as CachedVoice[];
      const bindingsRequest = tx.objectStore(BINDINGS).getAll();
      bindingsRequest.onsuccess = () => {
        const protectedKeys = new Set((bindingsRequest.result as Binding[]).map(binding => binding.cacheKey));
        const old = rows.find(row => row.cacheKey === cacheKey);
        let bytes = rows.reduce((sum, row) => sum + row.size, 0) - (old?.size || 0);
        const removable = rows.filter(row => row.cacheKey !== cacheKey && !protectedKeys.has(row.cacheKey)).sort((a, b) => a.createdAt - b.createdAt);
        const remove: CachedVoice[] = [];
        for (const row of removable) {
          if (bytes + item.size <= MAX_BYTES) break;
          remove.push(row); bytes -= row.size;
        }
        if (bytes + item.size > MAX_BYTES) return; // Never evict an existing message's voice automatically.
        remove.forEach(row => tx.objectStore(AUDIO).delete(row.id));
        tx.objectStore(AUDIO).put({ ...item, id: old?.id || item.id });
        saved = true;
      };
    };
    await done;
    if (saved) remember({ ...item, persisted: true });
    return saved;
  } catch (error) { console.warn('音频仅保存在当前会话内存中', error); return false; }
}
export async function clearAllCache(): Promise<void> {
  const tx = (await db()).transaction([AUDIO, BINDINGS], 'readwrite');
  const done = committed(tx);
  tx.objectStore(AUDIO).clear(); tx.objectStore(BINDINGS).clear();
  await done;
  memory.clear(); memoryBindings.clear();
}
export async function getCacheStats(): Promise<{ size: number; count: number; sizeFormatted: string }> {
  const rows = await result<CachedVoice[]>((await db()).transaction(AUDIO).objectStore(AUDIO).getAll());
  const size = rows.reduce((sum, row) => sum + row.size, 0);
  return { size, count: rows.length, sizeFormatted: size < 1024 ? `${size} B` : size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : `${(size / 1024 / 1024).toFixed(1)} MB` };
}
export async function hashVoiceIdentity(value: unknown): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(value)));
  return [...new Uint8Array(hash)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

/** One read-only batch for legacy caches that predate message-to-audio bindings. */
export async function findVoiceCacheVariant(keys: string[]): Promise<CachedVoice | undefined> {
  const matches = keys.map(key => memory.get(key)).filter((row): row is CachedVoice => !!row);
  try {
    const index = (await db()).transaction(AUDIO).objectStore(AUDIO).index('cacheKey');
    const rows = await Promise.all(keys.map(key => result<CachedVoice | undefined>(index.get(key))));
    rows.forEach(row => { if (row) { row.persisted = true; matches.push(row); } });
  } catch (error) { console.warn('读取旧版语音缓存失败', error); }
  const found = matches.sort((a, b) => b.createdAt - a.createdAt)[0];
  if (found) remember(found);
  return found;
}


export const voiceRevision = (item: CachedVoice): string => item.revision || `legacy:${item.createdAt}:${item.size}`;
export const usableVoiceAnalysis = (analysis?: VoiceAnalysis): VoiceAnalysis | undefined => {
  if (analysis?.version !== 1 || !Number.isFinite(analysis.duration) || analysis.duration <= 0) return;
  if (analysis.waveform && (analysis.waveform.length !== 96 || analysis.waveform.some(value => !Number.isFinite(value) || value < 0 || value > 1))) return;
  return analysis;
};

/** Enrich only the exact audio revision analyzed; never recreate deleted cache entries. */
export async function saveVoiceAnalysis(cacheKey: string, revision: string, analysis: VoiceAnalysis): Promise<boolean> {
  if (!usableVoiceAnalysis(analysis)) return false;
  const hot = memory.get(cacheKey);
  if (hot && voiceRevision(hot) === revision) remember({ ...hot, analysis: { ...analysis, waveform: analysis.waveform || hot.analysis?.waveform } });
  try {
    const tx = (await db()).transaction(AUDIO, 'readwrite');
    const done = committed(tx);
    const request = tx.objectStore(AUDIO).index('cacheKey').get(cacheKey);
    let saved = false;
    request.onsuccess = () => {
      const row = request.result as CachedVoice | undefined;
      if (row && voiceRevision(row) === revision) {
        tx.objectStore(AUDIO).put({ ...row, analysis: { ...analysis, waveform: analysis.waveform || row.analysis?.waveform } });
        saved = true;
      }
    };
    await done;
    return saved;
  } catch (error) { console.warn('波形暂未持久保存', error); return false; }
}
