// Offline regression check: model discovery and upstream model/tag forwarding.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

async function check(file, local) {
  const requests = [];
  const routes = new Map();
  const app = { use() {}, listen() {} };
  for (const method of ['get', 'post']) app[method] = (route, ...handlers) => routes.set(`${method}:${route}`, handlers.at(-1));
  const express = Object.assign(() => app, { json() {}, urlencoded() {} });
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), {
    module, Buffer, URL, URLSearchParams,
    console: { log() {}, warn() {}, error() {} },
    process: { env: { API_SECRET: 'test-secret' }, on() {} },
    require(name) {
      if (name.endsWith('tts-cancellation')) return require('../../api/_lib/tts-cancellation');
      if (name === 'axios') return async options => {
        requests.push(options);
        return { status: 200, headers: {}, data: { pipe() {}, on() {} } };
      };
      if (name === 'msgpack5') return () => ({ encode: value => Buffer.from(JSON.stringify(value)) });
      if (name === 'express') return express;
      if (name === 'cors') return () => () => {};
      if (name === 'dotenv') return { config() {} };
      if (['cheerio', 'puppeteer'].includes(name)) return {};
      throw new Error(`Unexpected dependency: ${name}`);
    },
  }, { filename: file });
  const req = (method, fields) => ({ method, headers: { 'x-api-key': 'test-secret' }, connection: { remoteAddress: 'test' }, query: method === 'GET' ? fields : {}, body: method === 'POST' ? fields : {} });
  const response = () => ({ setHeader() {}, status(code) { this.code = code; return this; }, json(data) { this.body = data; return this; }, end() {} });
  const catalog = response();
  await (local ? routes.get('get:/api/tts') : module.exports)(req('GET', {}), catalog);
  assert(catalog.body.models.includes('drama-3'));
  assert.equal(catalog.body.default, 'drama-3');
  const text = '[温柔地说]你好，<whisper>请听我说</whisper>[短暂停顿]。';
  for (const method of ['GET', 'POST']) for (const model of ['drama-3', 's2.1-pro', 's2-pro', undefined]) {
    const fields = { text, fish_audio_key: 'fake-key', ...(model ? { model } : {}) };
    const handler = local ? routes.get(method === 'GET' ? 'get:/api/tts/stream' : 'post:/api/tts') : module.exports;
    const res = response();
    await handler(req(method, fields), res);
    assert(!res.code || res.code < 400, `${file} ${method} failed: ${JSON.stringify(res.body)}`);
    const upstream = requests.at(-1);
    assert(upstream.signal instanceof AbortSignal, 'TTS must forward a cancellation signal');
    assert.equal(upstream.headers.Model, model || 'drama-3');
    assert.equal(JSON.parse(upstream.data.toString()).text, text);
  }
  console.log(`${file}: catalog, defaults, GET/POST forwarding, legacy selection, Drama 3 tags passed`);
}
(async () => {
  process.chdir(path.join(__dirname, '../..'));
  await check('api/tts.js', false);
  await check('local-server/server.js', true);
})().catch(error => { console.error(error); process.exitCode = 1; });
