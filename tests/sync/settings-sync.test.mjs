import { build } from 'esbuild';
import assert from 'node:assert/strict';

const result = await build({
  entryPoints: ['src/services/DataSyncService.ts'], bundle: true, write: false, platform: 'node', format: 'esm',
  plugins: [{ name: 'mock-dependencies', setup(build) {
    build.onResolve({ filter: /^@\// }, args => ({ path: args.path, namespace: 'mock' }));
    build.onLoad({ filter: /.*/, namespace: 'mock' }, args => ({ contents:
      args.path.includes('supabase') ? 'export const supabase = globalThis.mockSupabase;' :
      args.path.includes('storage') ? 'export const indexedDBStorage = {getItem: async () => null, setItem: async () => {}};' :
      'export const convertAvatarFromImport = value => value;'
    }));
  }}]
});
Object.defineProperty(globalThis, 'navigator', { value: { onLine: true }, configurable: true });
const rows = {};
const writes = [];
let readError = null;
globalThis.mockSupabase = {
  auth: { getUser: async () => ({ data: { user: { id: 'user' } } }) },
  from(table) {
    const query = {
      select() { return this; }, eq() { return this; },
      maybeSingle: async () => ({ data: rows[table] ?? null, error: readError }),
      upsert: async data => { writes.push({ table, data }); rows[table] = data; return { error: null }; },
      then(resolve) { return Promise.resolve({ data: rows[table] ?? [], error: null }).then(resolve); }
    };
    return query;
  }
};
const { DataSyncService } = await import(`data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text).toString('base64')}`);
const service = new DataSyncService();
rows.general_settings = { settings: { unknownFutureField: 42, defaultRoleId: 'role' } };
await service.queueSync('general_settings', { currentModelId: 'model', currentUserProfileId: null, theme: 'dark' });
assert.deepEqual(rows.general_settings.settings, { unknownFutureField: 42, defaultRoleId: 'role', currentModelId: 'model', currentUserProfileId: null, theme: 'dark' });
await service.queueSync('general_settings', { __full: true, settings: { chatStyle: 'document' } });
assert.equal(rows.general_settings.settings.unknownFutureField, 42);
await service.queueSync('llm_config', { id: 'model', temperature: 0, maxTokens: 0, enabled: false });
rows.llm_configs = [rows.llm_configs];
await service.queueSync('ai_role', { id: 'role', replyMode: 'voice-text', replyDelayMinSeconds: 0 });
rows.ai_roles = [rows.ai_roles];
const pulled = await service.pullFromCloud();
assert.equal(pulled.generalSettings.currentModelId, 'model');
assert.equal(pulled.generalSettings.defaultRoleId, 'role');
assert.equal(pulled.generalSettings.currentUserProfileId, null);
assert.equal(pulled.llmConfigs[0].temperature, 0);
assert.equal(pulled.llmConfigs[0].maxTokens, 0);
assert.equal(pulled.aiRoles[0].replyMode, 'voice-text');
assert.equal(pulled.aiRoles[0].replyDelayMinSeconds, 0);
readError = { message: 'permission denied' };
await assert.rejects(() => service.pullFromCloud(), /拉取语音设置失败/);
const count = writes.length;
await assert.rejects(() => service.syncGeneralSettings({ user_id: 'user', theme: 'light' }), /读取通用设置失败/);
assert.equal(writes.length, count);
console.log('Passed: settings round trip, role reply mode, zero values, null selection, unknown fields, read errors.');
