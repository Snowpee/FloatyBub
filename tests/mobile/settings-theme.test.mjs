// Verify the real build adapter preserves upstream declarations while preventing
// the lazy stylesheet from changing desktop elements after a mobile visit.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import postcss from 'postcss';
import { loadConfigFromFile } from 'vite';
const require = createRequire(import.meta.url);
const { config } = await loadConfigFromFile({ command: 'build', mode: 'production' });
const plugin = config.plugins.find(value => value?.name === 'settings-ios27-theme');
const css = await plugin.load('\0virtual:settings-ios27.css');
const scoped = postcss.parse(css);
let count = 0;
scoped.walkRules(rule => {
  if (rule.parent.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
  for (const selector of rule.selectors) {
    assert.ok(selector.startsWith('.ionic-settings-modal') || selector.startsWith(':where(.ionic-settings-modal) ') || /^ion-(modal|popover):where\(\.ionic-settings-modal\)/.test(selector), selector);
    count++;
  }
});
const original = postcss.parse(readFileSync(require.resolve('@rdlabo/ionic-theme-ios27/styles/class.css'), 'utf8'));
const declarations = root => { const values = []; root.walkDecls(d => values.push([d.prop, d.value, d.important])); return values; };
assert.deepEqual(declarations(scoped), declarations(original), 'upstream geometry, colors and motion must remain intact');
assert.ok(count > 100);
console.log(`PASS: ${count} upstream theme selectors confined to mobile settings; declarations preserved.`);
