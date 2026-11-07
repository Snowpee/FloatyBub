// Optional test dependencies: fake-indexeddb, react-test-renderer@18, react-dom@18.
// VOICE_TEST_MODULES=/path/to/test/package node tests/voice/check-voice-runtime.cjs
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');
const { build } = require('esbuild');
const dependencies = createRequire(path.join(process.env.VOICE_TEST_MODULES || process.cwd(), 'package.json'));
const { indexedDB } = dependencies('fake-indexeddb');
const React = dependencies('react');
const renderer = dependencies('react-test-renderer');
const { act } = renderer;
const pause = (ms = 25) => new Promise(resolve => setTimeout(resolve, ms));
const deferred = () => { let resolve; const promise = new Promise(ok => { resolve = ok; }); return { resolve, promise }; };

(async () => {
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'voice-runtime-')), 'runtime.cjs');
  await build({ stdin: { contents: `export * from './src/utils/voiceUtils'; export * from './src/utils/voiceAudioCache'; export * from './src/utils/voiceRequestQueue'; export * from './src/utils/voicePresentation'; export {default as VoiceReply} from './src/screens/chats/components/VoiceReply';`, resolveDir: process.cwd(), loader: 'ts' }, outfile: out, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', define: { 'import.meta.env': '{}' }, plugins: [{ name: 'isolate-services', setup(b) {
    b.onResolve({ filter: /^react(?:\/.*)?$|^react-dom$/ }, a => ({ path: dependencies.resolve(a.path), external: true }));
    b.onResolve({ filter: /^@\// }, a => {
      if (a.path === '@/store') return { path: a.path, namespace: 'stub' };
      if (a.path === '@/lib/utils') return { path: a.path, namespace: 'stub' };
      return { path: path.join(process.cwd(), 'src', a.path.slice(2)) + (a.path.includes('ConfirmDialog') ? '.tsx' : '.ts') };
    });
    b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ contents: a.path === '@/store' ? 'export const useAppStore = select => select(globalThis.__voiceStore);' : 'export const getApiBaseUrl=()=>"";' }));
  } }] });
  global.indexedDB = indexedDB;
  global.IS_REACT_ACT_ENVIRONMENT = true;
  if (!global.crypto) global.crypto = require('node:crypto').webcrypto;
  global.Audio = class extends EventTarget {
    duration = 8; currentTime = 0; ended = false;
    set src(value) { this.url = value; queueMicrotask(() => this.onloadedmetadata?.()); }
    get src() { return this.url; }
    removeAttribute() {} load() {} pause() {} async play() {}
  };
  const api = require(out);

  // A shared queue bounds concurrency and gives each consumer independent cancellation.
  const q = new api.VoiceRequestQueue(2);
  let active = 0, max = 0, starts = 0;
  const gates = Array.from({ length: 5 }, deferred);
  const jobs = gates.map((gate, i) => q.request(String(i), async () => { starts++; active++; max = Math.max(max, active); await gate.promise; active--; return i; }));
  const duplicate = q.request('0', async () => { throw Error('duplicate work'); });
  assert.equal(starts, 2);
  gates.forEach(gate => gate.resolve());
  assert.deepEqual(await Promise.all(jobs), [0, 1, 2, 3, 4]); assert.equal(await duplicate, 0); assert.equal(max, 2);
  const sharedGate = deferred(); let upstreamAborted = false;
  const a = new AbortController(), b = new AbortController();
  const first = q.request('shared', async signal => { signal.addEventListener('abort', () => { upstreamAborted = true; }); await sharedGate.promise; return 7; }, a.signal);
  const second = q.request('shared', async () => 8, b.signal);
  a.abort(); await assert.rejects(first, { name: 'AbortError' }); assert.equal(upstreamAborted, false);
  sharedGate.resolve(); assert.equal(await second, 7);
  const cancelGate = deferred(), all = new AbortController();
  let allSignal;
  const cancelled = q.request('cancel-all', async signal => { allSignal = signal; await cancelGate.promise; signal.throwIfAborted(); }, all.signal);
  all.abort(); await assert.rejects(cancelled, { name: 'AbortError' }); assert.equal(allSignal.aborted, true); cancelGate.resolve();

  // Completed writes are durable, old message bindings survive expiry and parameter changes.
  await api.clearAllCache();
  assert.equal(await api.saveVoiceCache('old-key', new Blob(['old'])), true);
  assert.equal(await api.bindMessageVoice('message-identity', 'old-key'), true);
  const now = Date.now; Date.now = () => now() + 8 * 24 * 60 * 60 * 1000;
  assert.equal(await api.readVoiceCache('old-key'), undefined);
  assert.equal((await api.readMessageVoice('message-identity')).cacheKey, 'old-key');
  Date.now = now;
  await api.saveVoiceCache('new-key', new Blob(['new']));
  assert.equal((await api.readMessageVoice('message-identity')).cacheKey, 'old-key');
  assert.equal((await api.readVoiceCache('old-key', true)).audioBlob.size, 3);

  const settings = { provider: 'fish-audio', apiUrl: 'https://api.fish.audio', apiKey: 'fake', readingMode: 'all', modelVersion: 'drama-3', customModels: [{ id: 'voice', name: 'test', isPreset: true }] };
  const model = { id: 'voice', name: 'test' };
  let calls = 0;
  global.fetch = async () => { calls++; await pause(); return { ok: true, blob: async () => new Blob(['audio']) }; };
  await api.clearAllCache();
  const pair = await Promise.all([api.requestVoiceAudio('same', model, settings), api.requestVoiceAudio('same', model, settings)]);
  assert.equal(calls, 1); assert.equal(pair[0].cacheKey, pair[1].cacheKey); assert.equal(pair[0].persisted, true);
  await api.requestVoiceAudio('same', model, settings); assert.equal(calls, 1);
  await api.requestVoiceAudio('same', model, settings, { force: true }); assert.equal(calls, 2);

  // Storage failure retains a bounded hot copy instead of repeatedly regenerating.
  const Database = dependencies('fake-indexeddb').IDBDatabase;
  const transaction = Database.prototype.transaction;
  Database.prototype.transaction = function(stores, mode, ...rest) {
    if (mode === 'readwrite') throw new DOMException('quota', 'QuotaExceededError');
    return transaction.call(this, stores, mode, ...rest);
  };
  const warn = console.warn; console.warn = () => {};
  try {
    const ephemeral = await api.requestVoiceAudio('quota reply', model, settings);
    assert.equal(ephemeral.persisted, false);
    const callCount = calls;
    const again = await api.requestVoiceAudio('quota reply', model, settings);
    assert.equal(again.persisted, false); assert.equal(calls, callCount);
  } finally { Database.prototype.transaction = transaction; console.warn = warn; }

  // Historical cache misses wait for a click, which generates without a dialog.
  await api.clearAllCache(); calls = 0;
  global.__voiceStore = { voiceSettings: settings };
  const props = { messageId: 'history', text: 'old reply', streaming: false, promptOnParameterChange: true, role: null, playing: false, expanded: false, onToggleText() {} };
  let tree;
  await act(async () => { tree = renderer.create(React.createElement(api.VoiceReply, props)); await pause(150); });
  assert.equal(calls, 0, 'Historical cache miss must not generate automatically');
  const generateButton = tree.root.findAll(node => node.type === 'button' && node.children.includes('生成语音'))[0];
  assert(generateButton, 'Missing cache must provide a generation button');
  await act(async () => { generateButton.props.onClick({ stopPropagation() {} }); await pause(100); });
  assert.equal(calls, 1, 'Click must generate directly');
  assert.equal(tree.root.findAll(node => node.props.onConfirm && node.props.isOpen).length, 0, 'Missing cache must not open a confirmation');
  calls = 0;
  await act(async () => { tree.update(React.createElement(api.VoiceReply, { ...props, messageId: 'live', text: 'new reply', streaming: true })); await pause(); });
  await act(async () => { tree.update(React.createElement(api.VoiceReply, { ...props, messageId: 'live', text: 'new reply' })); await pause(5); });
  assert(JSON.stringify(tree.toJSON()).includes('对方语音回复中'));
  assert(!JSON.stringify(tree.toJSON()).includes('排队'));
  assert(!JSON.stringify(tree.toJSON()).includes('语音缓存不存在'));
  await act(async () => { await pause(100); });
  assert.equal(calls, 1);
  assert(tree.root.findAll(node => node.props['aria-label'] === '播放语音').length > 0);
  assert.equal(tree.root.findAllByProps({ 'aria-label': '重新生成语音' }).length, 0, 'Unchanged parameters must hide regeneration');
  const oldKey = await api.generateCacheKey('new reply', 'voice', settings);
  const playingUrl = tree.root.findByProps({ 'aria-label': '播放语音' });
  await act(async () => { playingUrl.props.onClick({ stopPropagation() {} }); await pause(); });
  const playingAudio = api.getVoiceState().currentAudio;

  global.__voiceStore = { voiceSettings: { ...settings, modelVersion: 's2.1-pro' } };
  await act(async () => { tree.update(React.createElement(api.VoiceReply, { ...props, messageId: 'live', text: 'new reply' })); await pause(80); });
  assert.equal(calls, 1); assert(JSON.stringify(tree.toJSON()).includes('保留原语音'));
  assert.equal(api.getVoiceState().currentAudio, playingAudio);
  assert.equal(api.getVoiceState().isPlaying, true);
  const autoDialog = tree.root.findAll(node => node.props.onConfirm && node.props.isOpen)[0];
  assert(autoDialog, 'Latest reply prompts once on synthesis parameter change');
  await act(async () => { autoDialog.props.onClose(); });
  assert.equal(calls, 1);

  await act(async () => { tree.root.findByProps({ 'aria-label': '重新生成语音' }).props.onClick({ stopPropagation() {} }); });
  const dialog = tree.root.findAll(node => node.props.onConfirm && node.props.isOpen)[0];
  assert.equal(dialog.props.title, '参数变化是否重新生成');
  await act(async () => { dialog.props.onConfirm(); await pause(100); });
  assert.equal(calls, 2); assert(await api.readVoiceCache(oldKey, true));
  assert.equal(tree.root.findAllByProps({ 'aria-label': '重新生成语音' }).length, 0, 'Successful regeneration hides the button');
  await act(async () => { tree.unmount(); });
  await act(async () => { tree = renderer.create(React.createElement(api.VoiceReply, { ...props, messageId: 'live', text: 'new reply' })); await pause(80); });
  assert.equal(calls, 2); // persisted association restores without another request
  assert.equal(tree.root.findAllByProps({ 'aria-label': '重新生成语音' }).length, 0);
  await act(async () => { tree.unmount(); });

  // Expiry alone does not expose regeneration when synthesis parameters still match.
  const realNow = Date.now;
  Date.now = () => realNow() + 8 * 24 * 60 * 60 * 1000;
  try {
    await act(async () => { tree = renderer.create(React.createElement(api.VoiceReply, { ...props, messageId: 'live', text: 'new reply' })); await pause(80); });
    assert.equal(tree.root.findAllByProps({ 'aria-label': '重新生成语音' }).length, 0);
    assert.equal(calls, 2);
    await act(async () => { tree.unmount(); });
  } finally { Date.now = realNow; }

  // A legacy audio with no message binding can still be recovered after a model change.
  await api.clearAllCache(); calls = 0;
  const legacyKey = await api.generateCacheKey('legacy reply', 'voice', { ...settings, modelVersion: 's2-pro' });
  await api.saveVoiceCache(legacyKey, new Blob(['legacy']));
  await act(async () => { tree = renderer.create(React.createElement(api.VoiceReply, { ...props, text: 'legacy reply', promptOnParameterChange: false })); await pause(150); });
  assert.equal(calls, 0);
  assert(tree.root.findAll(node => node.props['aria-label'] === '播放语音').length > 0);
  assert.equal((await api.readMessageVoice(await api.hashVoiceIdentity(['history', 'legacy reply']))).cacheKey, legacyKey);
  await act(async () => { tree.unmount(); });

  // Analysis persists with an exact audio revision and never flashes fallback bars on a cold mount.
  await api.clearAllCache();
  const waveformKey = await api.generateCacheKey('cached waveform reply', 'voice', settings);
  await api.saveVoiceCache(waveformKey, new Blob(['waveform audio']), 'wave-rev-1');
  const wave = Array.from({ length: 96 }, (_, i) => (i % 12) / 12);
  const created = (await api.readVoiceCache(waveformKey)).createdAt;
  assert.equal(await api.saveVoiceAnalysis(waveformKey, 'wave-rev-1', { version: 1, duration: 12, waveform: wave }), true);
  // A late duration-only result must not erase a completed waveform.
  await api.saveVoiceAnalysis(waveformKey, 'wave-rev-1', { version: 1, duration: 12 });
  await api.bindMessageVoice(await api.hashVoiceIdentity(['wave-message', 'cached waveform reply']), waveformKey);
  assert.equal((await api.readVoiceCache(waveformKey)).createdAt, created);
  delete require.cache[require.resolve(out)];
  const cold = require(out); // resets module hot caches, forcing IndexedDB reads
  const restored = await cold.readMessageVoice(await cold.hashVoiceIdentity(['wave-message', 'cached waveform reply']));
  assert.deepEqual(restored.analysis.waveform, wave);
  let metadataReads = 0, decodes = 0;
  const Audio = global.Audio;
  global.Audio = class extends Audio { constructor(...args) { super(...args); metadataReads++; } };
  global.AudioContext = class { constructor() { decodes++; throw Error('cached wave must not decode'); } };
  global.__voiceStore = { voiceSettings: settings };
  const painted = [];
  const onRender = () => {
    if (!tree) return;
    for (const bar of tree.root.findAll(node => typeof node.type === 'function' && node.type.name === 'VoiceReplyBar')) painted.push(bar.props.waveform);
  };
  tree = null;
  await act(async () => {
    tree = renderer.create(React.createElement(React.Profiler, { id: 'cached-wave', onRender }, React.createElement(cold.VoiceReply, { ...props, messageId: 'wave-message', text: 'cached waveform reply' })));
    await pause(100);
  });
  assert(painted.length > 0); painted.forEach(value => assert.deepEqual(value, wave));
  assert.equal(metadataReads, 0); assert.equal(decodes, 0); assert.equal(calls, 0);
  await act(async () => { tree.unmount(); });
  global.Audio = Audio; delete global.AudioContext;
  // A late old analysis cannot overwrite regenerated audio, or resurrect cleared audio.
  await cold.saveVoiceCache(waveformKey, new Blob(['regenerated']), 'wave-rev-2');
  assert.equal((await cold.readVoiceCache(waveformKey)).analysis, undefined);
  assert.equal(await cold.saveVoiceAnalysis(waveformKey, 'wave-rev-1', { version: 1, duration: 12, waveform: wave }), false);
  assert.equal((await cold.readVoiceCache(waveformKey)).analysis, undefined);
  await cold.clearAllCache();
  assert.equal(await cold.saveVoiceAnalysis(waveformKey, 'wave-rev-2', { version: 1, duration: 12, waveform: wave }), false);
  assert.equal(await cold.readVoiceCache(waveformKey), undefined);

  // Long audio and larger compressed files must be analyzed, not skipped.
  const previousFetch = global.fetch;
  let decodeJobs = 0, runningDecodes = 0, peakDecodes = 0, closedContexts = 0;
  global.fetch = async () => ({ blob: async () => new Blob([new Uint8Array(3 * 1024 * 1024)]) });
  global.AudioContext = class {
    constructor(options) { assert.equal(options.sampleRate, 8000); }
    async decodeAudioData() {
      decodeJobs++; runningDecodes++; peakDecodes = Math.max(peakDecodes, runningDecodes);
      await pause(10); runningDecodes--;
      return { getChannelData: () => Float32Array.from({ length: 8000 }, (_, i) => Math.sin(i / 8)) };
    }
    async close() { closedContexts++; }
  };
  try {
    const results = await Promise.all([
      cold.generateVoiceWaveform('blob:31-seconds', 31, new AbortController().signal),
      cold.generateVoiceWaveform('blob:180-seconds', 180, new AbortController().signal)
    ]);
    for (const result of results) { assert.equal(result.length, 96); assert(result.every(value => value >= 0 && value <= 1)); }
    assert.equal(decodeJobs, 2); assert.equal(peakDecodes, 1); assert.equal(closedContexts, 2);
  } finally { global.fetch = previousFetch; delete global.AudioContext; }

  // Proxy cancellation propagates to Axios and to an already attached stream.
  const createCancellation = require('../../api/_lib/tts-cancellation');
  const req = new EventEmitter(), res = new EventEmitter(); res.writableEnded = false;
  const cancellation = createCancellation(req, res); let destroyed = false;
  cancellation.attach({ destroy() { destroyed = true; } }); res.emit('close');
  assert.equal(cancellation.signal.aborted, true); assert.equal(destroyed, true);
  const req2 = new EventEmitter(), res2 = new EventEmitter(); res2.writableEnded = true;
  const normal = createCancellation(req2, res2); res2.emit('finish'); res2.emit('close');
  assert.equal(normal.signal.aborted, false); assert.equal(req2.listenerCount('aborted'), 0);
  console.log('Passed: queue limit, single-flight, independent/all cancellation, durable cache, stale history retention, confirmation, regeneration, remount restore, cached waveform cold mount without placeholder/decode, audio revision protection, upstream cancellation.');
})().catch(error => { console.error(error); process.exitCode = 1; });
