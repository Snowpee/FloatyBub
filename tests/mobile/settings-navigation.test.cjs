// Run: node tests/mobile/settings-navigation.test.cjs
// Render actual mobile sections without a legacy NavProvider. Network and data
// dependencies are isolated; the real navigation components remain in use.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { build } = require('esbuild');
const React = require('react');
const { renderToString } = require('react-dom/server');

(async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'settings-navigation-'));
  const outfile = path.join(folder, 'sections.cjs');
  const rendererPath = process.env.SETTINGS_TEST_MODULES ? require.resolve('react-test-renderer', { paths: [process.env.SETTINGS_TEST_MODULES] }) : null;
  global.window = { innerWidth: 390 };
  const skill = { id: 'skill-1', name: 'test-skill', description: 'test', createdAt: new Date() };
  const kb = { id: 'kb-1', name: 'test-knowledge', description: 'test', created_at: new Date().toISOString() };
  global.__settingsTestState = { agentSkills: [skill] };
  global.__settingsTestKnowledge = { knowledgeBases: [kb], loading: false };
  try {
    await build({
      stdin: { contents: `
        export { default as SkillsSettings } from './src/screens/settings/sections/SkillsSettings';
        export { default as KnowledgeSettings } from './src/screens/settings/sections/KnowledgeSettings';
        export { SettingsNavigationContext } from './src/screens/settings/SettingsNavigationContext';
        export { BackButton } from './src/screens/settings/SettingsNavigation';
        ${rendererPath ? `export {create,act} from ${JSON.stringify(rendererPath)};` : ''}
      `, resolveDir: process.cwd() },
      tsconfig: 'tsconfig.app.json', outfile, bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic',
      plugins: [{ name: 'isolated-settings-data', setup(b) {
        b.onResolve({ filter: /^(react|react-dom)(\/.*)?$/ }, args => ({ path: require.resolve(args.path), external: true }));
        b.onResolve({ filter: /^(@\/store(?:\/knowledgeStore)?|@\/lib\/utils|@\/hooks\/useToast|@\/utils\/dateUtils|@\/components\/(?:ConfirmDialog|EmptyState)|\.\/(?:SkillDetailView|KnowledgeBaseModal|KnowledgeBulkImportModal|KnowledgeEntryManager))$/ }, args => ({ path: args.path, namespace: 'stub' }));
        b.onLoad({ filter: /.*/, namespace: 'stub' }, args => ({ contents:
          args.path === '@/store' ? 'export const useAppStore=()=>globalThis.__settingsTestState;' :
          args.path === '@/store/knowledgeStore' ? 'export const useKnowledgeStore=()=>globalThis.__settingsTestKnowledge;' :
          args.path === '@/lib/utils' ? 'export const cn=(...v)=>v.filter(Boolean).join(" ");export const isCapacitorIOS=()=>false;' :
          args.path === '@/hooks/useToast' ? 'export const toast={success(){},error(){}};' :
          args.path === '@/utils/dateUtils' ? 'export const safeFormatDate=()=>"test-date";' :
          args.path === './SkillDetailView' ? 'import React from "react";export default props=><skill-detail {...props}/>;' :
          'export default ()=>null;export const KnowledgeEntryManager=()=>null;',
          loader: 'tsx',
        }));
      }}],
    });
    const { SkillsSettings, KnowledgeSettings, SettingsNavigationContext, BackButton } = require(outfile);
    const navigation = { push() {}, pop() {} };
    const render = Component => renderToString(React.createElement(SettingsNavigationContext.Provider,
      { value: navigation }, React.createElement(Component)));
    for (const width of [320, 375, 393, 767, 768, 820, 1024, 1440]) {
      global.window.innerWidth = width;
      assert.match(render(SkillsSettings), /添加技能/);
      assert.match(render(SkillsSettings), /查看详情/);
      assert.match(render(KnowledgeSettings), /test-knowledge/);
      assert.match(render(KnowledgeSettings), /查看详情/);
      // Standalone /settings/* routes have no navigation context. They must
      // use inline details at every width, including H5 and tablet breakpoints.
      assert.doesNotThrow(() => renderToString(React.createElement(SkillsSettings)));
      assert.doesNotThrow(() => renderToString(React.createElement(KnowledgeSettings)));
    }
    global.__settingsTestState.agentSkills = [];
    global.__settingsTestKnowledge.knowledgeBases = [];
    assert.match(render(SkillsSettings), /添加技能/);
    assert.match(render(KnowledgeSettings), /新建知识库/);
    assert.match(render(BackButton), /返回/);
    assert.throws(() => renderToString(React.createElement(BackButton)), /requires SettingsNavigationContext/);
    console.log('PASS: skills/knowledge populated and empty states, with and without Ionic context, across 8 viewport widths; detail back button.');
    if (rendererPath) {
      global.IS_REACT_ACT_ENVIRONMENT = true;
      // Give the stateful renderer a fresh context after the SSR checks.
      delete require.cache[require.resolve(outfile)];
      const interactive = require(outfile);
      const { create, act } = interactive;
      const added = [], updated = [];
      let pushed, pops = 0, tree;
      global.__settingsTestState.addAgentSkill = data => added.push(data);
      global.__settingsTestState.updateAgentSkill = (id, data) => updated.push({ id, data });
      const actions = { push: (Component, props) => { pushed = { Component, props }; }, pop: () => { pops++; } };
      const wrap = child => React.createElement(interactive.SettingsNavigationContext.Provider, { value: actions }, child);
      try {
        await act(async () => { tree = create(wrap(React.createElement(interactive.SkillsSettings))); });
        await act(async () => tree.root.findAllByType('button').find(button => button.children.includes('添加技能')).props.onClick());
        assert.ok(pushed, 'add button routes through Ionic navigation context');
        await act(async () => tree.update(wrap(React.createElement(pushed.Component, pushed.props))));
        const data = { name: 'test', description: 'test', content: '# test', files: [] };
        await act(async () => tree.root.findByType('skill-detail').props.onSave(data));
        assert.equal(added.length, 1);
        assert.equal(pops, 1, 'create returns to list instead of leaving a duplicate-save creation form');
        await act(async () => tree.update(wrap(React.createElement(pushed.Component, { initialSkill: skill }))));
        await act(async () => tree.root.findByType('skill-detail').props.onSave(data));
        assert.equal(updated[0].id, skill.id);
        assert.equal(added.length, 1, 'editing must update rather than create');
        await act(async () => tree.root.findByType('skill-detail').props.onClose());
        assert.equal(pops, 2, 'detail cancel returns through Ionic navigation');
        await act(async () => tree.root.findByProps({ 'aria-label': '返回' }).props.onClick({ preventDefault() {}, stopPropagation() {} }));
        assert.equal(pops, 3);
        console.log('PASS: actual skill add/edit dispatch, create-success return, cancel and detail back navigation.');
      } finally {
        if (tree) await act(async () => tree.unmount());
      }
    }

  } finally {
    fs.rmSync(folder, { recursive: true, force: true });
    delete global.window;
    delete global.__settingsTestState;
    delete global.__settingsTestKnowledge;
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
