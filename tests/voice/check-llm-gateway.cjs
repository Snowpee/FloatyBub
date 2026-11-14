const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { EventEmitter } = require('node:events');
const { completionUrl } = require('../../api/_lib/voice-runtime');
const { pipeVoiceCompletion, VoiceGatewayError } = require('../../api/_lib/voice-stream');

const packet = (content, finish_reason = null) => `data: ${JSON.stringify({ id: 'completion-test', object: 'chat.completion.chunk', created: 1, model: 'test', choices: [{ index: 0, delta: content === null ? {} : { content }, finish_reason }] })}\n\n`;
const ending = packet(null, 'stop') + 'data: [DONE]\n\n';
const response = chunks => new Response(new ReadableStream({ start(controller) { chunks.forEach(chunk => controller.enqueue(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)); controller.close(); } }), { headers: { 'content-type': 'text/event-stream' } });
const tick = () => new Promise(resolve => setImmediate(resolve));
async function until(check) { for (let i = 0; i < 100 && !check(); i++) await tick(); assert(check(), 'expected async condition'); }

class Reply extends EventEmitter {
  headersSent = false; writableEnded = false; destroyed = false; statusCode = 200; output = ''; headers = {};
  status(code) { this.statusCode = code; return this; }
  setHeader(key, value) { this.headers[key] = value; }
  flushHeaders() { this.headersSent = true; }
  json(body) { this.body = body; this.writableEnded = true; return this; }
  write(text) { this.headersSent = true; this.output += text; if (this.backpressure) { this.backpressure = false; queueMicrotask(() => this.emit('drain')); return false; } return true; }
  end() { this.writableEnded = true; this.emit('close'); return this; }
}

function harness(options = {}) {
  const timers = [];
  const requests = [];
  const config = { provider: 'openrouter', model: 'x-ai/grok-4.7', config: { apiKey: 'model-test-key', maxTokens: 2048 }, ...options.config };
  const req = new EventEmitter(); req.method = 'POST'; req.headers = { authorization: 'Bearer gateway-test' };
  req.body = { user_id: 'user-test', fishaudio_extra_body: { runtime_token: 'valid' }, messages: [{ role: 'system', content: 'role prompt' }, { role: 'user', content: 'hello' }] };
  const res = new Reply();
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync('api/llm-gateway.js', 'utf8'), {
    module, Buffer, AbortController, Date,
    process: { env: { FLOATY_LLM_GATEWAY_SECRET: 'gateway-test' } },
    console: { error() {} },
    setTimeout(fn, ms) { const timer = { fn, ms, cleared: false }; timers.push(timer); return timer; },
    clearTimeout(timer) { if (timer) timer.cleared = true; },
    fetch: async (url, init) => { requests.push({ url, init, body: JSON.parse(init.body) }); return options.fetch ? options.fetch(url, init) : response([packet('hello'), ending]); },
    require(name) {
      if (name === './_lib/voice-stream') return { pipeVoiceCompletion, VoiceGatewayError };
      if (name === './_lib/voice-runtime') return {
        compatibleProviders: new Set(['openrouter', 'deepseek', 'custom']), completionUrl,
        openRuntime(token) { if (token !== 'valid') throw Error('invalid sealed runtime'); return { userId: 'user-test', modelConfigId: 'model-test', accessToken: 'access-test', conversationId: null }; },
        async supabaseFetch(path) { if (options.dbError) throw Error('database connection failed'); return path.includes('llm_configs') ? [config] : []; }
      };
      throw Error(`Unexpected import ${name}`);
    }
  }, { filename: 'api/llm-gateway.js' });
  const run = () => module.exports(req, res);
  const clean = () => { assert.equal(req.listenerCount('aborted'), 0); assert.equal(res.listenerCount('close'), 0); assert(timers.every(t => t.cleared), 'all timeouts are cleaned'); };
  return { req, res, timers, requests, run, clean };
}

(async () => {
  let h = harness(); delete h.req.body.fishaudio_extra_body; await h.run();
  assert.equal(h.res.statusCode, 400); assert.equal(h.res.body.error.code, 'voice_runtime_missing'); assert.equal(h.requests.length, 0); h.clean();
  h = harness(); h.req.body.fishaudio_extra_body.runtime_token = 'expired'; await h.run();
  assert.equal(h.res.statusCode, 401); assert.equal(h.res.body.error.code, 'voice_runtime_invalid'); h.clean();
  h = harness(); h.req.body.user_id = 'other-user'; await h.run(); assert.equal(h.res.statusCode, 403); h.clean();
  h = harness(); h.req.headers.authorization = 'Bearer wrong-key'; await h.run(); assert.equal(h.res.statusCode, 401); assert.equal(h.requests.length, 0);

  h = harness({ dbError: true }); await h.run(); assert.equal(h.res.statusCode, 502); assert.equal(h.res.body.error.code, 'llm_gateway_failed'); h.clean();
  h = harness({ fetch: () => new Response('sensitive-provider-error', { status: 503 }) }); await h.run();
  assert.equal(h.res.statusCode, 502); assert.equal(h.res.body.error.code, 'llm_upstream_http_error'); assert(!JSON.stringify(h.res.body).includes('sensitive-provider-error')); h.clean();

  const unicode = Buffer.from((packet('你好') + ending).replace(/\n/g, '\r\n'));
  const split = unicode.indexOf(Buffer.from('你')) + 1;
  h = harness({ fetch: () => response([unicode.subarray(0, split), unicode.subarray(split, split + 2), unicode.subarray(split + 2)]) });
  h.res.backpressure = true; await h.run();
  assert(h.res.output.includes('你好')); assert.equal((h.res.output.match(/\[DONE\]/g) || []).length, 1);
  assert.deepEqual(h.requests[0].body.reasoning, { effort: 'low', exclude: true });
  assert.equal(h.requests[0].body.model, 'x-ai/grok-4.7'); assert(!h.res.output.includes('model-test-key')); h.clean();

  h = harness({ fetch: () => response([packet('hello'), packet(null, 'stop')]) }); await h.run();
  assert(h.res.output.endsWith('data: [DONE]\n\n')); h.clean();
  h = harness({ fetch: () => response([packet('hello'), 'data: [DONE]\n\n']) }); await h.run();
  assert(h.res.output.includes('"finish_reason":"stop"')); assert(h.res.output.includes('completion-test')); h.clean();
  h = harness({ fetch: () => response([packet('partial')]) }); await h.run();
  assert(h.res.output.includes('llm_stream_incomplete')); assert(!h.res.output.includes('[DONE]')); h.clean();
  h = harness({ fetch: () => response(['data: {"choices":[{"index":0,"delta":{"reasoning":"thinking"},"finish_reason":null}]}\n\n', packet(null, 'length'), 'data: [DONE]\n\n']) }); await h.run();
  assert.equal(h.res.statusCode, 502); assert.equal(h.res.body.error.code, 'llm_empty_reply'); assert(!h.res.output.includes('thinking')); h.clean();
  h = harness({ fetch: () => new Response('{"choices":[]}', { headers: { 'content-type': 'application/json' } }) }); await h.run();
  assert.equal(h.res.statusCode, 502); assert.equal(h.res.body.error.code, 'llm_not_event_stream'); h.clean();

  let stream;
  h = harness({ fetch: () => new Response(new ReadableStream({ start(c) { stream = c; c.enqueue(Buffer.from(packet('already speaking'))); } }), { headers: { 'content-type': 'text/event-stream' } }) });
  const running = h.run(); await until(() => h.res.output.includes('already speaking'));
  assert(h.timers.find(t => t.ms === 8500)?.cleared, 'first-content timeout stops when speech starts');
  assert(h.timers.some(t => t.ms === 35000 && !t.cleared), 'speaking stream has its own completion budget');
  assert(!h.timers.some(t => t.ms <= 9000 && !t.cleared), 'healthy streams are not aborted by the old 9-second cap');
  stream.enqueue(Buffer.from(ending)); stream.close(); await running; h.clean();

  h = harness({ fetch: (_url, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(init.signal.reason), { once: true })) });
  const stalled = h.run(); await until(() => h.requests.length === 1); h.timers.find(t => t.ms === 8500).fn(); await stalled;
  assert.equal(h.res.statusCode, 504); assert.equal(h.res.body.error.code, 'llm_first_content_timeout'); h.clean();

  h = harness({ config: { provider: 'deepseek', model: 'deepseek-v4-flash', config: { deepseekThinkingMode: 'disabled', deepseekReasoningEffort: 'high' } } }); await h.run();
  assert.deepEqual(h.requests[0].body.thinking, { type: 'disabled' }); assert.equal(h.requests[0].body.reasoning_effort, undefined); h.clean();
  console.log('Passed: runtime authentication, accurate failure codes, SSE framing/Unicode/backpressure, completion markers, truncated/empty replies, separate response deadlines, Grok voice reasoning and DeepSeek settings.');
})().catch(error => { console.error(error); process.exitCode = 1; });
