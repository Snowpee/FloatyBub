let waveformQueue: Promise<unknown> = Promise.resolve();

/** Width grows with actual audio duration, with bounded mobile-friendly sizing. */
export const voiceBarWidth = (seconds: number) => Math.round(132 + Math.min(148, Math.max(0, seconds) * 3));
export const replyDelayMs = (min = 1, max = 3, random = Math.random()) => {
  const low = Math.min(60, Math.max(0, Number.isFinite(min) ? min : 1));
  const high = Math.min(60, Math.max(low, Number.isFinite(max) ? max : 3));
  return Math.round((low + (high - low) * random) * 1000);
};

export async function inspectVoiceAudio(url: string, signal: AbortSignal): Promise<{ duration: number }> {
  const duration = await new Promise<number>((resolve, reject) => {
    const audio = new Audio();
    const cleanup = () => { audio.onloadedmetadata = null; audio.onerror = null; clearTimeout(timer); audio.removeAttribute('src'); audio.load(); signal.removeEventListener('abort', abort); };
    const abort = () => { cleanup(); reject(new DOMException('Aborted', 'AbortError')); };
    const timer = setTimeout(() => { cleanup(); reject(new Error('读取语音时长超时')); }, 15000);
    audio.onloadedmetadata = () => {
      const value = audio.duration;
      audio.onloadedmetadata = null;
      audio.onerror = null;
      cleanup();
      if (Number.isFinite(value) && value > 0) resolve(value);
      else reject(new Error('无法读取语音时长'));
    };
    audio.onerror = () => { audio.onerror = null; cleanup(); reject(new Error('无法读取语音文件')); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    else { audio.preload = 'metadata'; audio.src = url; }
  });
  return { duration };
}

// Schedule optional analysis after rendering; cancellation also removes idle work.
const waitForIdle = (signal: AbortSignal): Promise<void> => new Promise(resolve => {
  if (signal.aborted) { resolve(); return; }
  const finish = () => { signal.removeEventListener('abort', cancel); resolve(); };
  const useIdleCallback = typeof window !== 'undefined' && typeof window.requestIdleCallback === 'function';
  const id = useIdleCallback ? window.requestIdleCallback(finish, { timeout: 1500 }) : setTimeout(finish, 32);
  const cancel = () => {
    if (useIdleCallback) window.cancelIdleCallback(id as number);
    else clearTimeout(id);
    finish();
  };
  signal.addEventListener('abort', cancel, { once: true });
});

/** Best-effort waveform enrichment, never required for playback readiness. */
export function generateVoiceWaveform(url: string, duration: number, signal: AbortSignal): Promise<number[] | undefined> {
  const task = waveformQueue.then(async () => {
    if (!Number.isFinite(duration) || duration <= 0 || signal.aborted || typeof AudioContext === 'undefined') return;
    await waitForIdle(signal);
    if (signal.aborted) return;
    let context: AudioContext | undefined;
    try {
      const blob = await (await fetch(url, { signal })).blob();
      if (signal.aborted) return;
      // An amplitude envelope needs no playback-quality PCM. Decode/resample at
      // a lower rate to reduce the memory footprint of longer replies.
      try { context = new AudioContext({ sampleRate: 8000 }); }
      catch { context = new AudioContext(); }
      const buffer = await context.decodeAudioData(await blob.arrayBuffer());
      if (signal.aborted) return;
      const samples = buffer.getChannelData(0);
      const waveform: number[] = [];
      for (let bin = 0; bin < 96; bin++) {
        // Yield between small batches rather than occupying a long JS task.
        if (bin % 16 === 0) {
          await waitForIdle(signal);
          if (signal.aborted) return;
        }
        const start = Math.floor(bin * samples.length / 96);
        const end = Math.floor((bin + 1) * samples.length / 96);
        const step = Math.max(1, Math.floor((end - start) / 128));
        let sum = 0, count = 0;
        for (let i = start; i < end; i += step) { sum += samples[i] ** 2; count++; }
        waveform.push(Math.sqrt(sum / Math.max(1, count)));
      }
      const peak = Math.max(...waveform, 0.001);
      return waveform.map(value => value / peak);
    } catch {
      // Keep the simulated waveform if decoding or fetching fails.
      return;
    } finally {
      await context?.close().catch(() => undefined);
    }
  });
  waveformQueue = task.catch(() => undefined);
  return task;
}
