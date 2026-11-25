import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import postcss from 'postcss';
import type { Plugin } from 'vite';

// Keep the upstream demo stylesheet intact, but confine its selectors and palette
// to the mobile pilot. Loading the theme must not restyle the desktop after resize.
export function settingsIosTheme(): Plugin {
  const id = 'virtual:settings-ios27.css';
  return {
    name: 'settings-ios27-theme',
    resolveId(source) { return source === id ? `\0${id}` : undefined; },
    load(source) {
      if (source !== `\0${id}`) return;
      const require = createRequire(import.meta.url);
      const file = require.resolve('@rdlabo/ionic-theme-ios27/styles/class.css');
      const root = postcss.parse(readFileSync(file, 'utf8'));
      root.walkRules(rule => {
        // Keyframe steps are not DOM selectors. @property names are upstream
        // namespaced animation registrations; they do not style desktop elements.
        if (rule.parent?.type === 'atrule' && /keyframes$/i.test(rule.parent.name)) return;
        rule.selectors = rule.selectors.map(selector => {
          if (selector.startsWith(':root')) return selector.replace(':root', '.ionic-settings-modal');
          if (selector.startsWith('.ion-palette-dark')) {
            return selector.replace('.ion-palette-dark', '.ionic-settings-modal.ion-palette-dark');
          }
          return /^ion-(modal|popover)/.test(selector)
            ? selector.replace(/^(ion-(?:modal|popover))/, '$1:where(.ionic-settings-modal)')
            : `:where(.ionic-settings-modal) ${selector}`;
        });
      });
      return root.toString();
    },
  };
}
