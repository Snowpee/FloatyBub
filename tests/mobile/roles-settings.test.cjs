const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const { build } = require('esbuild');
const dependencies = createRequire(path.join(process.env.SETTINGS_TEST_MODULES || process.cwd(), 'package.json'));
const React = dependencies('react');
const { create, act } = dependencies('react-test-renderer');
(async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'role-settings-'));
  let tree;
  global.window = { innerWidth: 390, addEventListener() {}, removeEventListener() {} };
  global.__confirm = false;
  global.__store = { globalPrompts: [], agentSkills: [], voiceSettings: {} };
  try {
    await build({ stdin: { contents: `export {default as Editor} from './src/screens/settings/sections/RolesModal'; export {SettingsNavigationContext} from './src/screens/settings/SettingsNavigationContext';`, resolveDir: process.cwd() }, outfile: path.join(folder, 'test.cjs'), bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', tsconfig: 'tsconfig.app.json', plugins: [{ name: 'isolate', setup(b) {
      b.onResolve({ filter: /^react(\/.*)?$/ }, a => ({ path: dependencies.resolve(a.path), external: true }));
      b.onResolve({ filter: /^@ionic\/react$|^@\/store$|^@\/hooks\/useToast$|^@\/components\/InputProvider$|^@\/components\/BottomSheetModal$|^@\/screens\/settings\/components\/RoleAvatarUpload$|^@\/utils\/avatarUtils$/ }, a => ({ path: a.path, namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, a => ({ loader: 'tsx', contents:
        a.path === '@ionic/react' ? `import React from 'react'; export const useIonAlert=()=>[async o=>{if(globalThis.__confirm)o.buttons[1].handler();o.onDidDismiss();}];` + ['Button','Buttons','Content','Header','Title','Toolbar'].map(n => `export const Ion${n}=p=>React.createElement('ion-${n.toLowerCase()}',p);`).join('\n') :
        a.path === '@/store' ? 'export const useAppStore=()=>globalThis.__store;' :
        a.path.includes('useToast') ? 'export const toast={error:v=>globalThis.__error=v};' :
        a.path.includes('avatarUtils') ? "export const generateRandomLocalAvatar=()=>'/avatar.png';" :
        a.path.includes('InputProvider') ? 'export const InputProvider=({children})=>children;' : 'export default ()=>null;' }));
    } }] });
    const { Editor, SettingsNavigationContext } = require(path.join(folder, 'test.cjs'));
    let guard, pops = 0, saved = [], pending;
    const navigation = { pop() { pops++; }, setBackNavigationGuard(g) { guard = g; } };
    const role = { id: 'one', name: '原角色', systemPrompt: '提示词', description: '', openingMessages: ['你好'], globalPromptIds: [], skillIds: [], replyMode: 'text' };
    const props = { page: true, isOpen: true, initialRole: role, initialKnowledgeBaseId: 'kb', knowledgeBases: [{id:'kb',name:'知识库'}], onClose() {}, onConfirm: data => { saved.push(data); return new Promise(resolve => { pending = resolve; }); } };
    await act(async () => { tree = create(React.createElement(SettingsNavigationContext.Provider, {value:navigation}, React.createElement(Editor, props))); });
    const button = text => tree.root.findAllByType('ion-button').find(n => n.children.includes(text));
    const name = () => tree.root.findAllByType('input').find(n => n.props.type === 'text');
    assert.equal(await guard(), true, 'initial loaded values are clean');
    await act(async () => name().props.onChange({target:{value:'草稿'}}));
    assert.equal(saved.length, 0, 'typing does not persist');
    assert.equal(await guard(), false, 'cancel discard keeps draft');
    await act(async () => button('返回').props.onClick());
    assert.equal(pops, 0);
    global.__confirm = true;
    await act(async () => button('返回').props.onClick());
    assert.equal(pops, 1);
    await act(async () => { void button('保存').props.onClick(); });
    assert.equal(saved.length, 1);
    assert.equal(saved[0].knowledgeBaseId, 'kb');
    assert.equal(saved[0].name, '草稿');
    assert.equal(button('保存中…').props.disabled, true);
    assert.equal(await guard(), false, 'saving prevents dismissal');
    await act(async () => { void button('保存中…').props.onClick(); });
    assert.equal(saved.length, 1, 'double tap saves once');
    await act(async () => pending());
    assert.equal(button('保存').props.disabled, false);
    await act(async () => name().props.onChange({target:{value:'  '}}));
    await act(async () => button('保存').props.onClick());
    assert.equal(saved.length, 1, 'blank name does not save');
    await act(async () => tree.unmount()); tree = null;
    assert.equal(guard, null, 'unmount clears navigation guard');
    console.log('Role editor: draft, guarded back, knowledge association, pending save, duplicate save and validation passed.');
  } finally { if(tree) await act(async()=>tree.unmount()); fs.rmSync(folder,{recursive:true,force:true}); }
})().catch(error => { console.error(error); process.exitCode=1; });
