import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquareText, Play, RefreshCw, Square } from 'lucide-react';
import { useAppStore } from '@/store';
import type { AIRole, VoiceModel, VoiceSettings } from '@/store/types';
import ConfirmDialog from '@/components/ConfirmDialog';
import { addVoiceProgressListener, findLegacyMessageVoice, generateCacheKey, getVoiceModelForMessage, getVoiceState, playPreparedVoice, processTextForReading, requestVoiceAudio, stopCurrentVoice } from '@/utils/voiceUtils';
import { bindMessageVoice, hashVoiceIdentity, isVoiceExpired, readMessageVoice, readVoiceCache, saveVoiceAnalysis, usableVoiceAnalysis, voiceRevision } from '@/utils/voiceAudioCache';
import type { VoiceAnalysis } from '@/utils/voiceAudioCache';
import { generateVoiceWaveform, inspectVoiceAudio, voiceBarWidth } from '@/utils/voicePresentation';
import { toast } from '@/hooks/useToast';

interface Props {
  messageId: string;
  text: string;
  streaming: boolean;
  allowReady?: boolean;
  promptOnParameterChange?: boolean;
  role: AIRole | null;
  playing: boolean;
  expanded: boolean;
  onToggleText: () => void;
}
interface PreparedVoice { url: string; cacheKey: string; sourceText: string; duration: number; waveform?: number[]; expired: boolean }

export default function VoiceReply({ messageId, text, streaming, role, playing, expanded, onToggleText, allowReady = true, promptOnParameterChange = false }: Props) {
  const settings = useAppStore(s => s.voiceSettings);
  const model = getVoiceModelForMessage(role, settings);
  const legacyVoiceIds = useRef<string[]>([]);
  legacyVoiceIds.current = [...new Set([...(model ? [model.id] : []), ...(settings?.customModels.map(voice => voice.id) || [])])];
  // Only effective synthesis inputs matter; editing another voice's note must not restart work.
  const signature = JSON.stringify({
    model: model ? { id: model.id, name: '' } : null,
    settings: settings ? { provider: settings.provider, apiUrl: settings.apiUrl, apiKey: settings.apiKey,
      readingMode: settings.readingMode, modelVersion: settings.modelVersion || 'drama-3', customModels: [] } : null
  });
  const config = useMemo(() => JSON.parse(signature) as { model: VoiceModel | null; settings: VoiceSettings | null }, [signature]);
  const [audio, setAudio] = useState<PreparedVoice | null>(null);
  const [targetKey, setTargetKey] = useState<string>();
  const [pending, setPending] = useState(false);
  const [loadingCache, setLoadingCache] = useState(true);
  const [error, setError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [playback, setPlayback] = useState({ messageId, progress: 0 });
  const liveReply = useRef<string | null>(streaming ? messageId : null);
  const work = useRef<AbortController>();
  const ownedUrl = useRef<string>();
  const ownedIdentity = useRef<string>();
  const activeGeneration = useRef(false);
  const promptedParameters = useRef(new Set<string>());
  useEffect(() => addVoiceProgressListener(messageId, audio?.duration || 0, progress => {
    setPlayback(previous => previous.messageId === messageId && previous.progress === progress ? previous : { messageId, progress });
  }), [messageId, audio?.duration]);

  const publish = useCallback(async (blob: Blob, cacheKey: string, expired: boolean, signal: AbortSignal, replace = false, revision?: string, storedAnalysis?: VoiceAnalysis) => {
    signal.throwIfAborted();
    const identity = JSON.stringify([messageId, text, cacheKey, revision]);
    if (!replace && ownedUrl.current && ownedIdentity.current === identity) {
      setAudio(previous => previous ? { ...previous, expired } : previous);
      return;
    }
    const url = URL.createObjectURL(blob);
    try {
      const analysis = usableVoiceAnalysis(storedAnalysis);
      const { duration } = analysis || await inspectVoiceAudio(url, signal);
      signal.throwIfAborted();
      if (ownedUrl.current) {
        if (getVoiceState().currentMessageId === messageId) stopCurrentVoice();
        URL.revokeObjectURL(ownedUrl.current);
      }
      ownedUrl.current = url;
      ownedIdentity.current = identity;
      // Restore cached analysis in the same update: no placeholder-to-real flash.
      setAudio({ url, cacheKey, duration, sourceText: text, expired, waveform: analysis?.waveform });
      if (!analysis && revision) void saveVoiceAnalysis(cacheKey, revision, { version: 1, duration });
      if (!analysis?.waveform) void generateVoiceWaveform(url, duration, signal).then(async waveform => {
        if (!waveform || signal.aborted) return;
        if (revision) await saveVoiceAnalysis(cacheKey, revision, { version: 1, duration, waveform });
        if (!signal.aborted) setAudio(previous => previous?.url === url ? { ...previous, waveform } : previous);
      }).catch(() => undefined);
    } catch (error) { URL.revokeObjectURL(url); throw error; }
  }, [messageId, text]);

  const generate = useCallback(async (signal: AbortSignal, force = false) => {
    if (!config.settings || !config.model) throw new Error('请先配置可用的语音模型');
    const readingText = processTextForReading(text, config.settings.readingMode);
    if (!readingText.trim()) throw new Error('没有可朗读的内容');
    const result = await requestVoiceAudio(readingText, config.model, config.settings, { signal, force });
    signal.throwIfAborted();
    await publish(result.audioBlob, result.cacheKey, false, signal, true, result.revision, result.analysis);
    signal.throwIfAborted();
    const id = await hashVoiceIdentity([messageId, text]);
    signal.throwIfAborted();
    const bound = await bindMessageVoice(id, result.cacheKey);
    signal.throwIfAborted();
    if (!result.persisted || !bound) toast.error('音频已生成，但本地缓存未持久保存；请检查存储空间');
    setTargetKey(result.cacheKey);
  }, [config, messageId, text, publish]);

  useEffect(() => {
    work.current?.abort();
    const controller = new AbortController();
    work.current = controller;
    activeGeneration.current = false;
    setPending(false);
    if (streaming) {
      liveReply.current = messageId;
      return () => controller.abort();
    }
    // Only a reply observed streaming in this mounted view is new. Historical
    // cache misses remain explicit user actions, including after navigation.
    const autoGenerate = liveReply.current === messageId;
    liveReply.current = null;
    setLoadingCache(true);
    setError('');
    void (async () => {
      try {
        const id = await hashVoiceIdentity([messageId, text]);
        const expected = config.settings && config.model
          ? await generateCacheKey(processTextForReading(text, config.settings.readingMode), config.model.id, config.settings) : undefined;
        controller.signal.throwIfAborted();
        setTargetKey(expected);
        // A message binding wins over changed settings and over the cache TTL.
        const saved = await readMessageVoice(id)
          || (expected ? await readVoiceCache(expected, true) : undefined)
          || (!autoGenerate && config.settings ? await findLegacyMessageVoice(text, config.settings, legacyVoiceIds.current) : undefined);
        controller.signal.throwIfAborted();
        if (saved) {
          await publish(saved.audioBlob, saved.cacheKey, isVoiceExpired(saved), controller.signal, false, voiceRevision(saved), saved.analysis);
          await bindMessageVoice(id, saved.cacheKey);
        } else if (autoGenerate && text.trim()) {
          activeGeneration.current = true;
          setPending(true);
          await generate(controller.signal);
        } else setAudio(null);
      } catch (error) {
        if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '读取语音失败');
      } finally {
        if (!controller.signal.aborted) { activeGeneration.current = false; setLoadingCache(false); setPending(false); }
      }
    })();
    return () => controller.abort();
  }, [config, generate, messageId, publish, streaming, text]);

  useEffect(() => () => {
    work.current?.abort();
    if (getVoiceState().currentMessageId === messageId) stopCurrentVoice();
    if (ownedUrl.current) URL.revokeObjectURL(ownedUrl.current);
    ownedUrl.current = undefined;
    ownedIdentity.current = undefined;
  }, [messageId]);

  const regenerate = (force = true) => {
    if (activeGeneration.current) return;
    setConfirmOpen(false);
    work.current?.abort();
    const controller = new AbortController();
    work.current = controller;
    activeGeneration.current = true;
    setPending(true); setLoadingCache(false); setError('');
    void generate(controller.signal, force).catch(error => {
      if (!controller.signal.aborted) setError(error instanceof Error ? error.message : '生成失败');
    }).finally(() => {
      if (!controller.signal.aborted) { activeGeneration.current = false; setPending(false); }
    });
  };
  const prepared = !streaming && audio?.sourceText === text ? audio : null;
  const changed = !!prepared && !!targetKey && prepared.cacheKey !== targetKey;
  const busy = streaming || !allowReady || (!prepared && (pending || loadingCache));
  useEffect(() => {
    // Only the latest reply prompts automatically; older replies keep individual
    // regeneration buttons so a setting change cannot open dozens of dialogs.
    const promptKey = `${messageId}:${targetKey}`;
    if (promptOnParameterChange && allowReady && changed && !pending && !loadingCache && !promptedParameters.current.has(promptKey)) {
      promptedParameters.current.add(promptKey);
      setConfirmOpen(true);
    }
  }, [allowReady, changed, loadingCache, messageId, pending, promptOnParameterChange, targetKey]);
  return <>
    {busy ? <div className="btn btn-md pointer-events-none min-w-52 justify-start border-0 bg-base-200 font-normal text-base-content/45 shadow-none motion-safe:animate-pulse" role="status">
      对方语音回复中
    </div> : prepared ? <div className="space-y-1">
      <div className="flex flex-wrap items-center gap-2">
        <VoiceReplyBar progress={playing && playback.messageId === messageId ? playback.progress : 0} duration={prepared.duration} waveform={prepared.waveform} playing={playing} expanded={expanded} onToggleText={onToggleText} onPlay={() => {
          void playPreparedVoice(messageId, prepared.url).catch(() => toast.error('播放失败，请点击语音条重试'));
        }} />
        {changed && !loadingCache && <button type="button" className="btn btn-circle btn-ghost btn-sm" aria-label="重新生成语音" title="重新生成语音" disabled={pending || loadingCache} onClick={event => { event.stopPropagation(); setConfirmOpen(true); }}><RefreshCw className={`h-4 w-4 ${pending ? 'animate-spin' : ''}`} /></button>}
      </div>
      {(changed || prepared.expired || pending) && <p className="text-xs text-base-content/50" role="status">{pending ? '对方语音回复中' : changed ? '语音参数已变化，保留原语音' : '缓存已过期，保留原语音'}</p>}
    </div> : <div className="flex flex-wrap items-center gap-2 text-sm text-base-content/50">
      <span>{error || '语音缓存不存在，点击生成'}</span>
      <button className="btn btn-ghost btn-sm" onClick={event => { event.stopPropagation(); regenerate(false); }}>生成语音</button>
      <button className="btn btn-circle btn-sm" aria-label="展示文字" onClick={event => { event.stopPropagation(); onToggleText(); }}><MessageSquareText className="h-4 w-4" /></button>
    </div>}
    {prepared && error && <p className="text-xs text-error" role="alert">{error}，原语音已保留</p>}
    <ConfirmDialog isOpen={confirmOpen && changed} onClose={() => setConfirmOpen(false)} onConfirm={() => regenerate(true)} title="参数变化是否重新生成" message="语音参数已变化，是否使用当前参数重新生成？生成成功前保留原语音。" confirmText="确认生成" cancelText="保留现状" variant="info" />
  </>;
}

export function VoiceReplyBar({ duration, waveform, progress = 0, playing, expanded, onToggleText, onPlay }: Pick<Props, 'playing' | 'expanded' | 'onToggleText'> & { duration: number; waveform?: number[]; progress?: number; onPlay: () => void }) {
  const length = voiceBarWidth(duration);
  const bars = Math.max(8, Math.round((length - 88) / 3));
  return <div className="inline-flex max-w-full items-center gap-2">
    <button type="button" aria-label={playing ? '停止播放语音' : '播放语音'}
      className="btn btn-md shrink-0 max-w-[calc(100%-2.5rem)] justify-start gap-2 border-0 text-neutral-700 shadow-none"
      style={{ width: length, backgroundColor: '#e5e5e5' }}
      onClick={(event) => {
        event.stopPropagation();
        onPlay();
      }}>
      {playing ? <Square className="h-4 w-4 shrink-0" fill="currentColor" /> : <Play className="h-4 w-4 shrink-0" fill="currentColor" />}
      <span className="flex flex-1 items-center justify-between gap-px overflow-hidden" role="progressbar" aria-label="语音播放进度" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
        {Array.from({ length: bars }, (_, i) => <span key={i} className={`w-[1.5px] shrink-0 rounded-full ${i < Math.ceil(progress * bars) ? 'bg-neutral-900' : 'bg-neutral-400'}`} style={{ transition: 'height 200ms ease, background-color 100ms linear', height: waveform ? 3 + 18 * waveform[Math.min(waveform.length - 1, Math.floor(i * waveform.length / bars))] : 3 + ((i * 17 + Math.round(duration) * 7) % 18) }} />)}
      </span>
      <span className="text-xs font-normal tabular-nums">{Math.ceil(duration)}″</span>
    </button>
    <button type="button" className="btn btn-circle btn-sm shrink-0 shadow-sm" title={expanded ? '隐藏文字' : '展示文字'} aria-label={expanded ? '隐藏文字' : '展示文字'} aria-expanded={expanded} onClick={(event) => { event.stopPropagation(); onToggleText(); }}>
      <MessageSquareText className="h-4 w-4" />
    </button>
  </div>;
}
