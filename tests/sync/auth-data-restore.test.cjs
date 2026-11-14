// Optional dependencies: react@18.3.1 and react-test-renderer@18.3.1.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { build } = require('esbuild');
const dependencies = createRequire(path.join(process.env.SYNC_TEST_MODULES || process.cwd(), 'package.json'));
const React = dependencies('react');
const { create, act } = dependencies('react-test-renderer');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));

(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  Object.defineProperty(global, 'navigator', { value: { onLine: true }, configurable: true });
  global.window = { addEventListener() {}, removeEventListener() {}, location: { origin: 'http://localhost:5173' } };
  global.document = { documentElement: { setAttribute() {}, classList: { toggle() {} } } };
  const authUser = { id: 'auth-user-id', email: 'test@example.invalid', user_metadata: {} };
  const profile = { id: 'profile-row-id', user_id: authUser.id, display_name: 'test', preferences: {} };
  const cloud = { llmConfigs: [{ id: 'cloud-model' }], aiRoles: [{ id: 'cloud-role' }], userRoles: [{ id: 'cloud-user-role' }], agentSkills: [], globalPrompts: [], generalSettings: { currentModelId: 'cloud-model' } };
  const listeners = new Set();
  global.__authRestoreSupabase = {
    auth: {
      getSession: async () => ({ data: { session: { user: authUser } }, error: null }),
      onAuthStateChange(callback) { listeners.add(callback); return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }; }
    },
    from(table) {
      assert.equal(table, 'user_profiles');
      const q = { select() { return this; }, eq() { return this; }, update() { return this; }, single: async () => ({ data: profile, error: null }) };
      return q;
    }
  };
  const queued = [];
  global.__authRestoreService = {
    queueSync: async (type, data) => { queued.push({ type, data }); return true; },
    manualSync: async () => ({ success: true, syncedItems: 0 }),
    ensureDefaultRolesExist: async () => {}
  };
  let pull = async () => cloud;
  global.__authRestorePull = (...args) => pull(...args);
  const store = () => global.__authRestoreState;
  const setState = patch => Object.assign(store(), typeof patch === 'function' ? patch(store()) : patch);
  const reset = () => {
    global.__authRestoreState = {
      currentUser: null, llmConfigs: [], aiRoles: [], userRoles: [], chatSessions: [], pendingSettingsSync: [],
      assistantConfig: {}, autoTitleConfig: {}, searchConfig: {},
      setCurrentUser: user => setState({ currentUser: user }), syncGeneralSettingsFull: async () => {}
    };
  };
  reset();
  global.__authRestoreStore = Object.assign(store, { getState: store, setState, persist: { hasHydrated: () => true } });
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'auth-restore-test-'));
  const outfile = path.join(folder, 'hook.cjs');
  let tree;
  // The hook's long auth timeout must not keep an otherwise completed test alive.
  const originalSetTimeout = global.setTimeout;
  global.setTimeout = (fn, ms, ...args) => { const timer = originalSetTimeout(fn, ms, ...args); if (ms >= 10000) timer.unref(); return timer; };
  try {
    await build({ entryPoints: ['src/hooks/useAuth.ts'], outfile, bundle: true, platform: 'node', format: 'cjs', drop: ['console'], define: { 'import.meta.env': '{}' },
      plugins: [{ name: 'isolated-auth', setup(b) {
        b.onResolve({ filter: /^react$/ }, () => ({ path: dependencies.resolve('react'), external: true }));
        b.onResolve({ filter: /^@\/|^\.\/useDataSync$/ }, args => ({ path: args.path, namespace: 'stub' }));
        b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents:
          args.path === '@/lib/supabase' ? 'export const supabase=globalThis.__authRestoreSupabase;' :
          args.path === '@/store' ? 'export const useAppStore=globalThis.__authRestoreStore;' :
          args.path === './useDataSync' ? 'const pullFromCloud=(...args)=>globalThis.__authRestorePull(...args);export const useDataSync=()=>({pullFromCloud});' :
          args.path === '@/services/DataSyncService' ? 'export const dataSyncService=globalThis.__authRestoreService;' :
          args.path === '@/utils/errorUtils' ? 'export const getErrorMessage=String;export const getErrorDetails=String;' :
          args.path === '@/store/knowledgeStore' ? 'export const useKnowledgeStore={getState:()=>({}),setState:()=>{}};' :
          'export const KnowledgeService={overwriteLocalData:async()=>{}};'
        }));
      }}]
    });
    const { useAuth } = require(outfile);
    function Consumer() { useAuth(); return null; }
    const mount = async (count = 1) => act(async () => {
      tree = create(React.createElement(React.Fragment, null, Array.from({ length: count }, (_, key) => React.createElement(Consumer, { key }))));
    });
    const settle = async () => act(async () => { await pause(700); });
    await mount(2);
    await settle();
    assert.equal(store().currentUser.id, authUser.id, 'currentUser.id must be the auth ID, not the profile row primary key');
    assert.equal(store().currentUser.email, authUser.email);
    assert.deepEqual(store().llmConfigs, cloud.llmConfigs, 'valid login must restore cloud models');
    assert.deepEqual(store().aiRoles, cloud.aiRoles, 'valid login must restore cloud roles');
    assert.equal(store().currentModelId, 'cloud-model');
    await act(async () => tree.unmount());

    reset(); queued.length = 0;
    store().currentUser = { id: profile.id };
    store().pendingSettingsSync = [{ token: 'pending', type: 'llm_config', data: { id: 'unsent-model' }, userId: profile.id }];
    await mount(); await settle();
    assert.equal(queued[0]?.data.id, 'unsent-model', 'legacy pending entries keyed by profile ID must be reclaimed for the authenticated owner');
    assert.equal(store().pendingSettingsSync.length, 0);
    await act(async () => tree.unmount());

    reset(); store().currentUser = { id: authUser.id };
    let resolvePull;
    pull = () => new Promise(resolve => { resolvePull = resolve; });
    await mount();
    await act(async () => { await pause(200); });
    assert(resolvePull, 'cloud request should be in flight');
    store().currentUser = { id: 'other-auth-user' };
    store().llmConfigs = [{ id: 'other-user-model' }];
    await act(async () => { resolvePull(cloud); await pause(30); });
    assert.equal(store().llmConfigs[0].id, 'other-user-model', 'a stale response must not overwrite another account');
    console.log('Passed: distinct profile/auth IDs, concurrent auth hooks, cloud model/role restore, legacy pending ownership and stale-account protection.');
  } finally {
    if (tree) await act(async () => tree.unmount());
    global.setTimeout = originalSetTimeout;
    fs.rmSync(folder, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
