// Optional dependencies: react-test-renderer@18.3.1 and react@18.3.1.
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('esbuild');
const { RealtimeClient } = require('@supabase/supabase-js');
const dependencies = createRequire(path.join(process.env.SYNC_TEST_MODULES || process.cwd(), 'package.json'));
const React = dependencies('react');
const { create, act } = dependencies('react-test-renderer');

(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(global, 'navigator', { value: { onLine: true }, configurable: true });
  global.window = { addEventListener() {}, removeEventListener() {} };
  const realtime = new RealtimeClient('wss://example.invalid/realtime/v1', { params: { apikey: 'test' }, timeout: 100 });
  // Use the actual installed SDK's channel deduplication and subscription rules,
  // while preventing any network connection or authentication request.
  realtime.connect = () => {};
  const authListeners = new Set();
  let user = null;
  const removals = [];
  global.__syncSupabase = {
    auth: {
      getUser: async () => ({ data: { user } }),
      onAuthStateChange(callback) {
        authListeners.add(callback);
        return { data: { subscription: { unsubscribe: () => authListeners.delete(callback) } } };
      }
    },
    channel: topic => realtime.channel(topic),
    removeChannel(channel) {
      return new Promise(resolve => removals.push(async () => resolve(await realtime.removeChannel(channel))));
    }
  };
  const writes = [];
  global.__syncStore = { agentSkills: [], globalPrompts: [] };
  global.__knowledgeStore = { knowledgeBases: [], knowledgeEntries: [] };
  for (const name of ['addAgentSkill', 'updateAgentSkill', 'deleteAgentSkill', 'addGlobalPrompt', 'updateGlobalPrompt', 'deleteGlobalPrompt']) {
    global.__syncStore[name] = (...args) => writes.push([name, ...args]);
  }
  for (const name of ['createKnowledgeBase', 'updateKnowledgeBase', 'deleteKnowledgeBase', 'createKnowledgeEntry', 'updateKnowledgeEntry', 'deleteKnowledgeEntry']) {
    global.__knowledgeStore[name] = (...args) => writes.push([name, ...args]);
  }
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'realtime-sync-test-'));
  const outfile = path.join(folder, 'hook.cjs');
  let tree;
  try {
    await build({ entryPoints: ['src/hooks/useDataSync.ts'], outfile, bundle: true, platform: 'node', format: 'cjs', drop: ['console'],
      plugins: [{ name: 'isolated-stores', setup(b) {
        b.onResolve({ filter: /^react$/ }, () => ({ path: dependencies.resolve('react'), external: true }));
        b.onResolve({ filter: /^@\// }, args => {
          if (args.path === '@/services/dataSyncSubscriptions') return { path: path.join(process.cwd(), 'src/services/dataSyncSubscriptions.ts') };
          return { path: args.path, namespace: 'stub' };
        });
        b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents:
          args.path === '@/lib/supabase' ? 'export const supabase=globalThis.__syncSupabase;' :
          args.path === '@/store' ? 'export const useAppStore=()=>globalThis.__syncStore;' :
          args.path === '@/store/knowledgeStore' ? 'export const useKnowledgeStore=()=>globalThis.__knowledgeStore;' :
          'export const dataSyncService={getStatus:()=>"idle",getLastSyncTime:()=>null,onStatusChange:()=>()=>{}};'
        }));
      }}]
    });
    const { useDataSync } = require(outfile);
    const Consumer = () => { useDataSync(); return null; };
    const render = (count, offset = 0) => React.createElement(React.StrictMode, null,
      Array.from({ length: count }, (_, i) => React.createElement(Consumer, { key: i + offset })));
    const auth = async next => act(async () => {
      user = next;
      authListeners.forEach(callback => callback(next ? 'SIGNED_IN' : 'SIGNED_OUT', next ? { user: next } : null));
    });
    const drainRemovals = async () => { for (const remove of removals.splice(0)) await remove(); };
    const channels = () => realtime.getChannels();
    const event = { eventType: 'INSERT', new: { id: 'record', name: 'test', title: 'test', created_at: '2026-11-14', updated_at: '2026-11-14' }, old: {} };
    const dispatch = channel => channel.bindings.postgres_changes[0].callback(event);

    await act(async () => { tree = create(render(2)); });
    assert.equal(channels().length, 0);
    await auth({ id: 'user-a' });
    assert.equal(channels().length, 4, 'multiple hooks share one subscription per table');
    const firstChannels = [...channels()];
    assert.throws(() => firstChannels[0].on('postgres_changes', { event: '*', schema: 'public' }, () => {}), /after `subscribe\(\)`/);
    for (const channel of firstChannels) {
      assert.equal(channel.bindings.postgres_changes.length, 1);
      assert.equal(channel.bindings.postgres_changes[0].filter.filter, 'user_id=eq.user-a');
      dispatch(channel);
    }
    assert.equal(writes.length, 4, 'one store update per event');
    for (const eventType of ['UPDATE', 'DELETE']) {
      for (const channel of firstChannels) channel.bindings.postgres_changes[0].callback({ ...event, eventType, old: { id: 'record' } });
    }
    assert.equal(writes.length, 12, 'updates and deletes are applied once for all four tables');
    for (const channel of firstChannels) channel.bindings.postgres_changes[0].callback({ ...event, eventType: 'DELETE', old: {} });
    assert.equal(writes.length, 12, 'delete events without a primary key are ignored');
    const beforeLifecycleWrites = writes.length;
    await act(async () => { tree.update(render(1, 1)); });
    assert.equal(removals.length, 0, 'unmounting one consumer preserves the shared subscription');
    dispatch(firstChannels[0]);
    assert.equal(writes.length, beforeLifecycleWrites + 1, 'the subscription survives its original consumer');
    await auth({ id: 'user-a' });
    assert.equal(channels().length, 4, 'repeat auth events do not add callbacks');

    await act(async () => { tree.unmount(); });
    firstChannels.forEach(dispatch);
    assert.equal(writes.length, beforeLifecycleWrites + 1, 'late events after release are ignored');
    await act(async () => { tree = create(render(2)); });
    assert.equal(channels().length, 8, 'remount may occur before old removeChannel resolves');
    assert.equal(new Set(channels().map(c => c.topic)).size, 8, 'remount uses fresh physical channel names');
    await drainRemovals();
    assert.equal(channels().length, 4, 'old cleanup does not remove remounted subscriptions');
    const beforeSwitch = [...channels()];
    await auth({ id: 'user-b' });
    beforeSwitch.forEach(dispatch);
    assert.equal(writes.length, beforeLifecycleWrites + 1, 'old account events cannot update the current store');
    await drainRemovals();
    assert.equal(channels().length, 4);
    channels().forEach(channel => assert.equal(channel.bindings.postgres_changes[0].filter.filter, 'user_id=eq.user-b'));
    await auth(null);
    await drainRemovals();
    assert.equal(channels().length, 0);
    console.log('Passed: actual SDK guard, concurrent hook mounts, single store delivery, partial unmount, auth refresh, StrictMode-style remount, delayed removal, account switching and logout.');
  } finally {
    if (tree) await act(async () => tree.unmount());
    for (const remove of removals.splice(0)) await remove();
    await realtime.removeAllChannels();
    await realtime.disconnect();
    fs.rmSync(folder, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
