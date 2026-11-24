// SETTINGS_TEST_MODULES=/private/tmp/floaty-settings-tests node tests/mobile/settings-lifecycle.test.cjs
// Isolated React renderer: native Ionic animation/gesture internals are mocked.
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
  global.IS_REACT_ACT_ENVIRONMENT = true;
  global.__settingsCalls = [];
  global.__settingsWidth = 393;
  const mediaListeners = new Set();
  global.window = {
    matchMedia: () => ({
      get matches() { return global.__settingsWidth < 768; },
      addEventListener: (_type, fn) => mediaListeners.add(fn),
      removeEventListener: (_type, fn) => mediaListeners.delete(fn),
    }),
  };
  const observers = new Set();
  let detail = false;
  let backClicks = 0;
  const contentNode = { querySelector(selector) {
    if (selector.endsWith('-page]')) return { getAttribute: name => name === 'data-is-detail-view' ? String(detail) : 'test-detail-title' };
    if (selector === '[data-back-button]') return { click() { backClicks++; detail = false; for (const fn of observers) fn(); } };
    return null;
  } };
  global.MutationObserver = class {
    constructor(callback) { this.callback = callback; }
    observe() { observers.add(this.callback); }
    disconnect() { observers.delete(this.callback); }
  };
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-lifecycle-'));
  const outfile = path.join(folder, 'settings.cjs');
  let tree;
  try {
    await build({
      stdin: { contents: `export {default as Settings} from './src/screens/settings/Settings';
        export {parseSettingsHash, settingsTabIds} from './src/screens/settings/settingsRoutes';`, resolveDir: process.cwd() },
      tsconfig: 'tsconfig.app.json', outfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
      plugins: [{ name: 'isolated-ionic', setup(b) {
        b.onResolve({ filter: /^react(\/.*)?$/ }, args => ({ path: dependencies.resolve(args.path), external: true }));
        b.onResolve({ filter: /\.css$/ }, args => ({ path: args.path, namespace: 'empty' }));
        b.onLoad({ filter: /.*/, namespace: 'empty' }, () => ({ contents: '' }));
        b.onResolve({ filter: /^@rdlabo\/ionic-theme-ios27$|^@\/store$|^@ionic\/react$|^\.\/config$|^@\/lib\/utils$|^\.\/sections\/ConfigSettings$/ }, args => ({ path: args.path, namespace: 'stub' }));
        b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents:
          args.path === '@/store' ? 'export const useAppStore=selector=>selector({theme:"floaty"});' : args.path === '@rdlabo/ionic-theme-ios27' ? 'export const ios27ThemeConfig={mode:"ios"};' : args.path === '@ionic/react' ? `
            import React from 'react';
            export const setupIonicReact=()=>{};
            export const IonNav=React.forwardRef((props,ref)=>{
              const [pages,setPages]=React.useState(()=>[props.root]);
              const pop=()=>{globalThis.__settingsCalls.push(['pop']);setPages(v=>v.length>1?v.slice(0,-1):v);return Promise.resolve(true);};
              globalThis.__settingsNativeBack=pop;
              React.useImperativeHandle(ref,()=>({
                push:(component,params)=>{globalThis.__settingsCalls.push(['push',params]);setPages(v=>[...v,()=>component(params)]);return Promise.resolve(true);},
                pop,
                setPages:entries=>{globalThis.__settingsCalls.push(['setPages',entries.length]);setPages(entries.map(v=>v.component));return Promise.resolve(true);},
              }),[]);
              const Page=pages[pages.length-1];return <ion-nav><div className="ion-page"><Page/></div></ion-nav>;
            });
            export const IonModal=React.forwardRef((props,ref)=>{
              globalThis.__settingsModal=props;
              React.useImperativeHandle(ref,()=>({dismiss:()=>{props.onDidDismiss();return Promise.resolve(true);}}),[props.onDidDismiss]);
              return <ion-modal>{props.isOpen?props.children:null}</ion-modal>;
            });
            export const IonButton=p=><button {...p}/>;
            export const IonBackButton=p=><button {...p} onClick={()=>globalThis.__settingsNativeBack()}/>;
            export const IonItem=p=><ion-item {...p}/>;
            export const IonButtons=p=><div {...p}/>;
            export const IonContent=p=><main {...p}/>;
            export const IonHeader=p=><header {...p}/>;
            export const IonLabel=p=><label {...p}/>;
            export const IonList=p=><ul {...p}/>;
            export const IonItemGroup=p=><section {...p}/>;
            export const IonPage=p=><article {...p}/>;
            export const IonTitle=p=><h1 {...p}/>;
            export const IonToolbar=p=><nav {...p}/>;
          ` : args.path === './config' ? `
            import React from 'react';
            import {IonBackButton} from '@ionic/react';
            const ids=['global','config','roles','userRoles','globalPrompts','skills','knowledge','voice','search','data'];
            export const tabs=ids.map(id=>({id,name:id,icon:()=>null,component:()=> (id==='config'||id==='roles') ? <><header><IonBackButton text="" aria-label="返回设置"/></header><section data-section={id}/></> : <section data-section={id}/> }));
          ` : args.path === '@/lib/utils' ? 'export const cn=(...v)=>v.filter(Boolean).join(" ");' : 'export default ()=>null;',
          loader: 'tsx',
        }));
      }}],
    });
    const { Settings, parseSettingsHash, settingsTabIds } = require(outfile);
    assert.deepEqual(parseSettingsHash('#setting'), { isOpen: true, tab: undefined });
    for (const id of settingsTabIds) assert.deepEqual(parseSettingsHash(`#setting/${id}`), { isOpen: true, tab: id });
    for (const hash of ['', '#settings', '#settingfake', '#setting/a/b']) assert.equal(parseSettingsHash(hash).isOpen, false);
    assert.deepEqual(parseSettingsHash('#setting/unknown'), { isOpen: true, tab: undefined });
    const count = { close: 0 };
    const onClose = () => { count.close++; };
    const props = { isOpen: true, onClose };
    await act(async () => { tree = create(React.createElement(Settings, props), { createNodeMock: () => contentNode }); });
    assert.equal(tree.root.findAllByType('ion-modal').length, 1, 'H5 must select Ionic on the first render');
    assert.equal(tree.root.findAllByType('dialog').length, 0);
    await act(async () => global.__settingsModal.onDidPresent());
    assert.equal(tree.root.findAllByType('ion-item').length, 10);
    for (const id of settingsTabIds) {
      await act(async () => tree.update(React.createElement(Settings, { ...props, defaultTab: id })));
      assert.equal(tree.root.findByType('section').props['data-section'], id, `live hash navigation: ${id}`);
      assert.equal(tree.root.findAllByProps({ 'aria-label': '关闭设置' }).length, 0, 'detail pages must not expose modal close');
      const backButton=tree.root.findByProps({ 'aria-label': '返回设置' });
      assert.equal(backButton.props.text, '');
      const navPage=tree.root.findByType('ion-nav').findByProps({className:'ion-page'});
      let headerParent=navPage.findByType('header').parent;
      while (headerParent && typeof headerParent.type !== 'string') headerParent=headerParent.parent;
      assert.equal(headerParent, navPage, 'header must be a direct delegate-page child');
      await act(async () => global.__settingsNativeBack());
      assert.equal(tree.root.findAllByType('ion-item').length, 10, 'back must reach settings list');
    }
    // Repeated list activation/back must not lose its context.
    for (let i = 0; i < 3; i++) {
      await act(async () => tree.root.findAllByType('ion-item')[5].props.onClick());
      assert.equal(tree.root.findByType('section').props['data-section'], 'skills');
      await act(async () => global.__settingsNativeBack());
    }
    // Resizing while open must retain the settings shell, not close the parent.
    const staleDismiss = global.__settingsModal.onDidDismiss;
    for (const width of [768, 820, 1024, 1440, 767, 375, 320]) {
      await act(async () => { global.__settingsWidth = width; for (const fn of mediaListeners) fn(); });
      assert.equal(tree.root.findAllByType(width < 768 ? 'ion-modal' : 'dialog').length, 1);
    }
    await act(async () => staleDismiss());
    assert.equal(count.close, 0, 'unmounted Ionic modal must not close the replacement shell');
    await act(async () => global.__settingsModal.onDidPresent());
    await act(async () => global.__settingsNativeBack());
    await act(async () => tree.root.findByProps({ 'aria-label': '关闭设置' }).props.onClick());
    assert.equal(count.close, 1, 'user close should notify the parent once');
    await act(async () => tree.update(React.createElement(Settings, { ...props, isOpen: false })));
    await act(async () => global.__settingsModal.onDidDismiss());
    assert.equal(count.close, 1, 'parent-driven dismissal must not notify again');
    await act(async () => tree.update(React.createElement(Settings, props)));
    await act(async () => global.__settingsModal.onDidPresent());
    assert.equal(tree.root.findAllByType('ion-item').length, 10, 'reopen resets to root');
    await act(async () => tree.unmount());
    tree = null;
    assert.equal(mediaListeners.size, 0, 'breakpoint subscription must be cleaned up');
    global.__settingsWidth = 1024;
    await act(async () => { tree = create(React.createElement(Settings, { ...props, defaultTab: 'skills' }), { createNodeMock: () => contentNode }); });
    await act(async () => { detail = true; for (const fn of observers) fn(); });
    assert.equal(tree.root.findByType('h1').children.join(''), 'test-detail-title', 'desktop detail title follows scoped DOM metadata');
    await act(async () => tree.root.findByProps({ 'aria-label': '返回设置列表' }).props.onClick());
    assert.equal(backClicks, 1);
    assert.equal(tree.root.findByType('h1').children.join(''), 'skills');
    await act(async () => tree.unmount());
    tree = null;
    assert.equal(observers.size, 0, 'desktop observer must disconnect');
    assert.equal(mediaListeners.size, 0);
    console.log('PASS: desktop scoped detail/back/observer cleanup; 10 live hash routes, root/back/reopen, repeated navigation, 7 resize widths, stale dismissal, parent dismissal and subscription cleanup.');
  } finally {
    if (tree) await act(async () => tree.unmount());
    fs.rmSync(folder, { recursive: true, force: true });
    delete global.window;
    delete global.MutationObserver;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
