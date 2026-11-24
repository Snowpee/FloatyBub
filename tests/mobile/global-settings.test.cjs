// SETTINGS_TEST_MODULES=/private/tmp/floaty-settings-tests node tests/mobile/global-settings.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { createHash } = require('node:crypto');
const { build } = require('esbuild');
const dependencies = createRequire(path.join(process.env.SETTINGS_TEST_MODULES || process.cwd(), 'package.json'));
const React = dependencies('react');
const { create, act } = dependencies('react-test-renderer');

(async () => {
  global.IS_REACT_ACT_ENVIRONMENT = true;
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'global-settings-'));
  const outfile = path.join(folder, 'global.cjs');
  const listeners = new Set();
  let state, tree, pushed, pops = 0;
  const patch = value => { state = { ...state, ...value }; for (const fn of listeners) fn(); };
  state = {
    chatStyle: 'conversation', theme: 'floaty', sendMessageShortcut: 'ctrlEnter', defaultRoleId: 'custom-role',
    assistantConfig: { enabled: true, strategy: 'follow', modelId: null },
    llmConfigs: [{ id: 'model-1', name: 'Test model', provider: 'test', model: 'test-model', enabled: true },
      { id: 'model-2', name: 'Disabled model', provider: 'test', model: 'disabled', enabled: false }],
    aiRoles: [{ id: 'custom-role', name: 'Custom role' }, { id: 'default-assistant', name: 'System role' }],
    setChatStyle: chatStyle => patch({ chatStyle }), setTheme: theme => patch({ theme }),
    setDefaultRoleId: defaultRoleId => patch({ defaultRoleId }),
    setSendMessageShortcut: sendMessageShortcut => patch({ sendMessageShortcut }),
    updateAssistantConfig: updates => patch({ assistantConfig: { ...state.assistantConfig, ...updates } }),
  };
  global.__useGlobalSettingsStore = () => React.useSyncExternalStore(
    fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => state, () => state,
  );
  global.window = { innerWidth: 390 };
  Object.defineProperty(global, 'navigator', { value: { platform: 'iPhone', userAgent: 'iPhone' }, configurable: true });
  try {
    // Desktop controls and markup are preserved byte-for-byte from the baseline.
    assert.equal(createHash('sha256').update(fs.readFileSync('src/screens/settings/sections/GlobalSettings.Desktop.tsx')).digest('hex'),
      'dda0d9c47bc3a26a6cc176062e987b5bae0d695811a5fd0ae8f5764eb8648db5', 'desktop baseline must remain unchanged');
    assert.ok(!fs.readFileSync('src/main.tsx', 'utf8').includes('@ionic/'), 'desktop startup must not initialize Ionic');
    await build({
      stdin: { contents: `export {default as GlobalSettings} from './src/screens/settings/sections/GlobalSettings';
        export {SettingsNavigationContext} from './src/screens/settings/SettingsNavigationContext';`, resolveDir: process.cwd() },
      outfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', tsconfig: 'tsconfig.app.json',
      plugins: [{ name: 'isolated-global-settings', setup(b) {
        b.onResolve({ filter: /^react(\/.*)?$/ }, args => ({ path: dependencies.resolve(args.path), external: true }));
        b.onResolve({ filter: /\.css$/ }, args => ({ path: args.path, namespace: 'empty' }));
        b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '' }));
        b.onResolve({ filter: /^@ionic\/react$|^@\/store$|^@\/lib\/utils$|^@\/hooks\/useToast$|^@\/hooks\/usePageContext$/ }, args => ({ path: args.path, namespace: 'stub' }));
        b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents:
          args.path === '@ionic/react' ? `import React from 'react';` +
            ['BackButton','Button','Buttons','Content','Header','Item','ItemGroup','Label','List','ListHeader','Note','Radio','RadioGroup','Segment','SegmentButton','Title','Toggle','Toolbar']
              .map(name => `export const Ion${name}=props=>React.createElement('ion-${name.replace(/[A-Z]/g,(c,i)=>(i?'-':'')+c.toLowerCase())}',props);`).join('\n') :
          args.path === '@/store' ? 'export const useAppStore=()=>globalThis.__useGlobalSettingsStore();' :
          args.path === '@/lib/utils' ? 'export const cn=(...values)=>values.filter(Boolean).join(" ");' :
          args.path === '@/hooks/useToast' ? 'export const toast={};' : 'export const usePageContext=()=>({});',
        }));
      }}],
    });
    const { GlobalSettings, SettingsNavigationContext } = require(outfile);
    const navigation = { push: (Component, props, options) => { pushed = { Component, props, options }; }, pop: () => { pops++; } };
    const main = () => React.createElement(SettingsNavigationContext.Provider, { value: navigation }, React.createElement(GlobalSettings));
    const mountMain = async () => act(async () => { tree.update(main()); });
    const open = async label => {
      await act(async () => tree.root.findAllByType('ion-item').find(item => item.props['aria-label']?.startsWith(label+'，')).props.onClick());
      assert.equal(pushed.options.layout, 'ionic', 'secondary page must not inherit legacy top padding');
      await act(async () => tree.update(React.createElement(SettingsNavigationContext.Provider,
        { value: navigation }, React.createElement(pushed.Component, pushed.props))));
    };
    const choose = async value => act(async () => tree.root.findByType('ion-radio-group').props.onIonChange({ detail: { value } }));

    await act(async () => { tree = create(React.createElement(GlobalSettings)); });
    assert.equal(tree.root.findAllByType('select').length, 4, 'standalone/desktop keeps original dropdowns at narrow widths');
    global.window.innerWidth = 1440;
    await act(async () => tree.update(React.createElement(GlobalSettings)));
    assert.equal(tree.root.findAllByType('select').length, 4);
    await mountMain();
    assert.equal(tree.root.findAllByType('select').length, 0, 'mobile must not render web selects');
    assert.equal(tree.root.findAllByType('ion-segment').length, 0);
    await open('显示方式');
    assert.equal(tree.root.findAllByType('ion-radio').length, 2);
    await choose('document');
    assert.equal(state.chatStyle, 'document');
    await choose(undefined);
    assert.equal(state.chatStyle, 'document');
    await mountMain();
    assert.ok(tree.root.findAllByType('ion-item').some(item => item.props['aria-label'] === '显示方式，文档'));
    assert.equal(tree.root.findByType('ion-toggle').props.color, 'success');
    assert.equal(tree.root.findByType('ion-toggle').props.className, undefined, 'Ionic toggle must not carry a DaisyUI class');
    await act(async () => tree.root.findByType('ion-toggle').props.onIonChange({ detail: { checked: false } }));
    assert.equal(state.assistantConfig.enabled, false);
    assert.equal(state.assistantConfig.strategy, 'follow');

    await open('主题');
    assert.equal(tree.root.findAllByType('ion-radio').length, 4);
    for (const theme of ['light', 'cupcake', 'floaty', 'dark']) {
      await choose(theme);
      assert.equal(state.theme, theme);
    }
    assert.equal(tree.root.findByType('ion-radio-group').props.value, 'dark');
    await choose('invalid');
    assert.equal(state.theme, 'dark');
    assert.equal(pops, 0, 'selection remains on choice page for preview');
    const nativeBack=tree.root.findByType('ion-back-button');
    assert.equal(nativeBack.props.text, '');
    assert.ok(nativeBack.props.icon);
    assert.equal(nativeBack.props.onClick, undefined, 'Ionic owns popping; no double-pop handler');
    await mountMain();
    assert.ok(tree.root.findAllByType('ion-item').some(item => item.props['aria-label'] === '主题，暗色'));

    await open('全局辅助模型');
    assert.equal(tree.root.findAllByType('ion-radio').length, 2, 'disabled models are excluded');
    await choose('model-1');
    assert.equal(state.assistantConfig.modelId, 'model-1');
    assert.equal(state.assistantConfig.enabled, false, 'model selection must preserve toggle state');
    await choose('follow');
    assert.equal(state.assistantConfig.modelId, null);
    await act(async () => patch({ llmConfigs: [], assistantConfig: { ...state.assistantConfig, strategy: 'custom', modelId: 'missing-model' } }));
    assert.ok(JSON.stringify(tree.toJSON()).includes('暂无已启用的模型'));
    assert.ok(JSON.stringify(tree.toJSON()).includes('原选项已不可用'));
    await mountMain();
    await open('默认角色');
    assert.deepEqual(tree.root.findAllByType('ion-radio').map(item => item.props.value), ['', 'default-assistant', 'custom-role']);
    await choose('');
    assert.equal(state.defaultRoleId, null);
    await choose('custom-role');
    assert.equal(state.defaultRoleId, 'custom-role');
    await mountMain();
    await open('发送快捷键');
    await choose('enter');
    assert.equal(state.sendMessageShortcut, 'enter');
    await choose('ctrlEnter');
    assert.equal(state.sendMessageShortcut, 'ctrlEnter');
    await act(async () => tree.unmount());
    tree = null;
    assert.equal(listeners.size, 0);
    console.log('PASS: unchanged desktop source/4 selects, shell isolation, mobile display-choice/toggle, 4 theme choices/live selection/back, model filtering/follow, null role, shortcuts, invalid events and subscription cleanup.');
  } finally {
    if (tree) await act(async () => tree.unmount());
    delete global.__useGlobalSettingsStore;
    delete global.window;
    fs.rmSync(folder, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
