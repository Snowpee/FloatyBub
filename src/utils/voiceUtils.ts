import { AIRole, VoiceSettings, VoiceModel } from '@/store';
import { getApiBaseUrl } from '@/lib/utils';
import { VoiceRequestQueue } from './voiceRequestQueue';
import { findVoiceCacheVariant, hashVoiceIdentity, readVoiceCache, saveVoiceCache, voiceRevision } from './voiceAudioCache';
import type { VoiceAnalysis } from './voiceAudioCache';
export { clearAllCache, getCacheStats } from './voiceAudioCache';

export const generateCacheKey = (text: string, voiceModelId: string, settings: VoiceSettings): Promise<string> => hashVoiceIdentity({
  text: text.trim(), voiceModelId, readingMode: settings.readingMode,
  modelVersion: settings.modelVersion || 'drama-3', apiUrl: settings.apiUrl
});
// Earlier releases stored only a hash, not a message binding. Recover known
// model/voice variants locally; no migration path is allowed to generate audio.
export const findLegacyMessageVoice = async (text: string, settings: VoiceSettings, voiceIds: string[]) => {
  const versions = [...new Set([settings.modelVersion || 'drama-3', 'drama-3', 's2.1-pro', 's2.1-pro-free', 's2-pro', 's1', 'speech-1.6', 'speech-1.5'])];
  const keys: string[] = [];
  for (const voiceId of new Set(voiceIds)) for (const readingMode of ['all', 'dialogue-only'] as const) {
    const readingText = processTextForReading(text, readingMode);
    if (!readingText.trim()) continue;
    keys.push(await hashVoiceIdentity({ text: readingText.trim(), voiceModelId: voiceId, readingMode, apiUrl: settings.apiUrl }));
    for (const modelVersion of versions) keys.push(await generateCacheKey(readingText, voiceId, { ...settings, readingMode, modelVersion }));
  }
  return findVoiceCacheVariant([...new Set(keys)]);
};
interface VoiceAudioResult { audioBlob: Blob; cacheKey: string; persisted: boolean; revision: string; analysis?: VoiceAnalysis }
const generationQueue = new VoiceRequestQueue<VoiceAudioResult>(2);
let playbackRequest: AbortController | null = null;
let ownedPlaybackUrl: string | null = null;

// 语音播放状态管理
interface VoicePlaybackState {
  isPlaying: boolean;
  currentAudio: HTMLAudioElement | null;
  currentMessageId: string | null;
  isGenerating: boolean;
  isFallingBack: boolean; // 是否正在降级播放
}

const voiceState: VoicePlaybackState = {
  isPlaying: false,
  currentAudio: null,
  currentMessageId: null,
  isGenerating: false,
  isFallingBack: false
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
  playbackRequest?.abort();
  playbackRequest = null;
  if (voiceState.currentAudio) {
    voiceState.currentAudio.onended = null;
    voiceState.currentAudio.onerror = null;
    voiceState.currentAudio.oncanplay = null;
    voiceState.currentAudio.onloadstart = null;
    voiceState.currentAudio.pause();
    voiceState.currentAudio.currentTime = 0;
    voiceState.currentAudio = null;
  }
  if (ownedPlaybackUrl) { URL.revokeObjectURL(ownedPlaybackUrl); ownedPlaybackUrl = null; }
  voiceState.isPlaying = false;
  voiceState.isGenerating = false;
  voiceState.currentMessageId = null;
  voiceState.isFallingBack = false;
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
// 生成流式播放的音频URL（边下边播）
export const generateStreamingVoiceUrl = (
  text: string,
  voiceModel: VoiceModel,
  voiceSettings: VoiceSettings
): string => {
  const apiBaseUrl = getApiBaseUrl();
  
  // 构建查询参数
  const params = new URLSearchParams({
    text,
    reference_id: voiceModel.id,
    format: 'mp3',
    mp3_bitrate: '192',
    model: voiceSettings.modelVersion || 'drama-3',
    fish_audio_key: voiceSettings.apiKey,
    x_api_key: import.meta.env.VITE_API_SECRET || '',
    normalize: 'true',
    latency: 'normal',
    chunk_length: '300',
    stream: 'true' // 添加流式播放标识
  });
  
  // 在生产环境中使用 /api/tts，在开发环境中使用 /api/tts/stream
  const endpoint = import.meta.env.PROD ? '/api/tts' : '/api/tts/stream';
  return `${apiBaseUrl}${endpoint}?${params.toString()}`;
};

export const requestVoiceAudio = async (
  text: string,
  voiceModel: VoiceModel,
  voiceSettings: VoiceSettings,
  options: { signal?: AbortSignal; force?: boolean } = {}
): Promise<VoiceAudioResult> => {
  const cacheKey = await generateCacheKey(text, voiceModel.id, voiceSettings);
  options.signal?.throwIfAborted();
  if (!options.force) {
    const cached = await readVoiceCache(cacheKey);
    options.signal?.throwIfAborted();
    if (cached) return { audioBlob: cached.audioBlob, cacheKey, persisted: cached.persisted !== false, revision: voiceRevision(cached), analysis: cached.analysis };
  }
  return generationQueue.request(cacheKey, async signal => {
    if (!options.force) {
      const cached = await readVoiceCache(cacheKey);
      if (cached) return { audioBlob: cached.audioBlob, cacheKey, persisted: cached.persisted !== false, revision: voiceRevision(cached), analysis: cached.analysis };
    }
    signal.throwIfAborted();
    const response = await fetch(`${getApiBaseUrl()}/api/tts`, {
      method: 'POST', signal,
      headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_SECRET || '' },
      body: JSON.stringify({ text, reference_id: voiceModel.id, format: 'mp3', mp3_bitrate: 192,
        model: voiceSettings.modelVersion || 'drama-3', fish_audio_key: voiceSettings.apiKey })
    });
    if (!response.ok) throw new Error(`语音生成失败: ${response.status} ${response.statusText}`);
    const audioBlob = await response.blob();
    signal.throwIfAborted();
    if (!audioBlob.size) throw new Error('语音服务返回了空音频');
    // Do not release the shared request until the persistence transaction commits.
    const revision = crypto.randomUUID();
    const persisted = await saveVoiceCache(cacheKey, audioBlob, revision);
    return { audioBlob, cacheKey, persisted, revision };
  }, options.signal);
};

export const generateVoiceAudio = async (
  text: string, voiceModel: VoiceModel, voiceSettings: VoiceSettings,
  options: { silent?: boolean; signal?: AbortSignal; force?: boolean } = {}
): Promise<string> => {
  const result = await requestVoiceAudio(text, voiceModel, voiceSettings, options);
  options.signal?.throwIfAborted();
  return URL.createObjectURL(result.audioBlob);
};

// All ordinary playback uses the same cached queue, with no parallel streaming fallback.
export const playVoice = async (messageId: string, text: string, role: AIRole | null, settings: VoiceSettings | null): Promise<void> => {
  if (voiceState.currentMessageId === messageId && (voiceState.isPlaying || voiceState.isGenerating)) { stopCurrentVoice(); return; }
  stopCurrentVoice();
  if (!settings) throw new Error('语音设置未配置');
  const model = getVoiceModelForMessage(role, settings);
  if (!model) throw new Error('未找到可用的语音模型');
  const readingText = processTextForReading(text, settings.readingMode);
  if (!readingText.trim()) throw new Error('没有可朗读的内容');
  const controller = new AbortController();
  playbackRequest = controller;
  voiceState.currentMessageId = messageId;
  voiceState.isGenerating = true;
  notifyListeners();
  try {
    const result = await requestVoiceAudio(readingText, model, settings, { signal: controller.signal });
    controller.signal.throwIfAborted();
    if (playbackRequest !== controller) return;
    playbackRequest = null;
    const url = URL.createObjectURL(result.audioBlob);
    try {
      await playPreparedVoice(messageId, url);
      if (getVoiceState().currentMessageId === messageId) ownedPlaybackUrl = url;
      else URL.revokeObjectURL(url);
    } catch (error) { URL.revokeObjectURL(url); throw error; }
  } catch (error) {
    if (controller.signal.aborted) return;
    if (playbackRequest === controller) stopCurrentVoice();
    throw error;
  }
};
export const playVoiceStreaming = playVoice;

// 获取当前播放状态
export const getVoiceState = (): VoicePlaybackState => {
  return { ...voiceState };
};

// Play an already generated reply without another TTS request.
export const playPreparedVoice = async (messageId: string, audioUrl: string): Promise<void> => {
  if (voiceState.currentMessageId === messageId && voiceState.isPlaying) {
    stopCurrentVoice();
    return;
  }
  stopCurrentVoice();
  const audio = new Audio(audioUrl);
  voiceState.currentAudio = audio;
  voiceState.currentMessageId = messageId;
  voiceState.isPlaying = true;
  notifyListeners();
  audio.onended = () => { if (voiceState.currentAudio === audio) stopCurrentVoice(); };
  audio.onerror = () => { if (voiceState.currentAudio === audio) stopCurrentVoice(); };
  try {
    await audio.play();
  } catch (error) {
    if (voiceState.currentAudio === audio) stopCurrentVoice();
    throw error;
  }
};

/** Subscribe directly to native media time events without updating the chat store. */
export const addVoiceProgressListener = (
  messageId: string,
  fallbackDuration: number,
  listener: (progress: number) => void
): (() => void) => {
  let audio: HTMLAudioElement | null = null;
  const events = ['timeupdate', 'durationchange', 'loadedmetadata', 'seeked', 'ended', 'emptied'] as const;
  const update = () => {
    const state = getVoiceState();
    if (!audio || state.currentMessageId !== messageId || !state.isPlaying || audio.ended) {
      listener(0);
      return;
    }
    const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : fallbackDuration;
    listener(duration > 0 && Number.isFinite(audio.currentTime) ? Math.min(1, Math.max(0, audio.currentTime / duration)) : 0);
  };
  const detach = () => { events.forEach(event => audio?.removeEventListener(event, update)); };
  const sync = () => {
    const state = getVoiceState();
    const next = state.currentMessageId === messageId ? state.currentAudio : null;
    if (next !== audio) {
      detach();
      audio = next;
      events.forEach(event => audio?.addEventListener(event, update));
    }
    update();
  };
  const unsubscribe = addVoiceStateListener(sync);
  sync();
  return () => { unsubscribe(); detach(); audio = null; };
};
