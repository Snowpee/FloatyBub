# Settings compatibility regressions

```sh
node tests/mobile/settings-navigation.test.cjs
```

This renders the actual SkillsSettings and KnowledgeSettings components at eight widths,
with populated/empty data and with/without the Ionic navigation context. Data/network
services and unrelated editor components are isolated; the navigation adapters are real.

For stateful shell lifecycle checks, install the optional renderer outside the app:

```sh
npm install --prefix /private/tmp/floaty-settings-tests --no-audit --no-fund react@18.3.1 react-test-renderer@18.3.1
SETTINGS_TEST_MODULES=/private/tmp/floaty-settings-tests node tests/mobile/settings-navigation.test.cjs
SETTINGS_TEST_MODULES=/private/tmp/floaty-settings-tests node tests/mobile/settings-lifecycle.test.cjs
```

With the optional renderer, the navigation test also checks actual skill create/edit dispatch,
create-success return, cancel and back button behavior with isolated storage calls.

The lifecycle test runs the actual Settings, SettingsModal.Mobile and SettingsModal.Desktop
components with mocked Ionic elements and section bodies. It verifies route changes,
back/reopen, viewport switching, dismissal and subscription/observer cleanup. It does not
verify native Ionic animation, CSS layout or gesture handling. See
[the browser test report](../../docs/ionic-settings-pilot.md) for actual Chrome coverage
and remaining browser/device/backend gaps.

Global settings desktop isolation and mobile controls:

```sh
SETTINGS_TEST_MODULES=/private/tmp/floaty-settings-tests node tests/mobile/global-settings.test.cjs
```

This compares the desktop source to its preserved baseline hash and exercises the actual
mobile settings component with isolated store updates and mocked Ionic controls.

Scoped upstream iOS 27 theme (preserves all declarations and prevents desktop CSS leakage):

```sh
node tests/mobile/settings-theme.test.mjs
```

Mobile model settings (drafts, validation, save/delete, guarded exit, selection and request handling):

```sh
SETTINGS_TEST_MODULES=/private/tmp/floaty-settings-tests node tests/mobile/model-settings.test.cjs
```

The test preserves the desktop list/editor by SHA-256 baseline, exercises the actual mobile
components with a reactive isolated store, and verifies request construction for OpenAI-compatible,
Claude and Gemini APIs. HTTP calls and deletion are simulated; it does not validate live API
credentials, cloud sync or device keyboards/gestures.

Role card editor draft and navigation checks:

```sh
SETTINGS_TEST_MODULES=/private/tmp/floaty-settings-tests node tests/mobile/roles-settings.test.cjs
```

Exercises the real Ionic editor controls: clean/dirty exits, cancel/discard,
knowledge selection preservation, prompt ordering and legacy prompt compatibility, skill selection,
voice delay (including zero), pending saves, duplicate taps, and required-name validation.
The lifecycle test also checks the card presenting element and button close without an imperative modal ref.
Native layout/gestures and live backend persistence are not covered by this test.

Real Chrome toolbar hit-target regression (requires a running Vite server):

```sh
SETTINGS_TEST_URL=http://127.0.0.1:5173 node tests/mobile/settings-hit-targets.test.cjs
```

Uses an isolated headless Chrome profile (override `CHROME_PATH` if needed).
Reproduces the Tailwind title-padding regression with actual center/edge clicks,
then checks close and editor back at three vertical positions each.
The role is temporary test data and the knowledge backend is isolated.
