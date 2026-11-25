// Real Chromium hit testing: run against Vite, never the user's browser profile.
// SETTINGS_TEST_URL=http://127.0.0.1:5174 node tests/mobile/settings-hit-targets.test.cjs
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer-core');
const url = process.env.SETTINGS_TEST_URL || 'http://127.0.0.1:5173';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true, args: ['--no-first-run', '--disable-sync'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const start = 'ion-modal.show-modal .ion-page:not(.ion-page-hidden) > ion-header ion-buttons[slot="start"] ion-button';
    const open = async hash => {
      await page.goto(`${url}/chat${hash}`, { waitUntil: 'networkidle0' });
      await page.waitForSelector(start);
      await pause(650);
    };
    const point = async fraction => page.$eval(start, (button, fraction) => {
      const rect = button.getBoundingClientRect();
      const x = rect.x + rect.width / 2, y = rect.y + rect.height * fraction;
      const hit = document.elementFromPoint(x, y);
      return { x, y, tag: hit.tagName, padding: getComputedStyle(button.closest('ion-toolbar').querySelector('ion-title')).paddingInlineStart };
    }, fraction);
    // Reproduce the original Preflight regression, including real center click.
    await open('#setting');
    await page.$eval('ion-modal ion-title', title => { title.style.padding = '0px'; });
    const before = await point(.5);
    assert.equal(before.tag, 'ION-TITLE');
    await page.mouse.click(before.x, before.y);
    await pause(650);
    assert.equal(await page.$eval('ion-modal', modal => modal.classList.contains('show-modal')), true, 'title steals center click');
    const edge = await point(.15);
    assert.equal(edge.tag, 'ION-BUTTON');
    await page.mouse.click(edge.x, edge.y);
    await page.waitForFunction(() => !document.querySelector('ion-modal.show-modal'));
    console.log('REPRODUCED: padding=0; center hits ION-TITLE and does not close; upper edge closes.');
    for (const fraction of [.15, .5, .85]) {
      await open('#setting');
      const hit = await point(fraction);
      assert.equal(hit.padding, '90px');
      assert.equal(hit.tag, 'ION-BUTTON');
      await page.mouse.click(hit.x, hit.y);
      await page.waitForFunction(() => !document.querySelector('ion-modal.show-modal'));
      assert.equal(await page.evaluate(() => location.hash), '');
      console.log(`PASS close at ${fraction}: ION-BUTTON, modal dismissed, hash cleared`);
    }
    for (const fraction of [.15, .5, .85]) {
      await open('#setting/roles');
      // Isolate the unrelated knowledge backend, while using real app/nav/forms.
      await page.evaluate(async () => {
        const { KnowledgeService } = await import('/src/services/knowledgeService.ts');
        KnowledgeService.getKnowledgeBases = async () => [];
        KnowledgeService.getRoleKnowledgeBaseId = async () => null;
        const { useAppStore } = await import('/src/store/index.ts');
        if (!useAppStore.getState().aiRoles.length) useAppStore.getState().addAIRole({ name: 'Hit target test', description: '', systemPrompt: 'Test', openingMessages: [''], currentOpeningIndex: 0, avatar: '', globalPromptIds: [], skillIds: [], replyMode: 'text' });
      });
      await page.waitForSelector('ion-modal .ion-page:not(.ion-page-hidden) ion-card');
      await page.click('ion-modal .ion-page:not(.ion-page-hidden) ion-card');
      await page.waitForFunction(() => [...document.querySelectorAll('ion-modal ion-input')].some(input => input.label === '角色名称（必填）'));
      await pause(650);
      assert.equal(await page.$eval(start, button => button.textContent.trim()), '', 'back is an icon, not text');
      const hit = await point(fraction);
      assert.equal(hit.tag, 'ION-BUTTON');
      await page.mouse.click(hit.x, hit.y);
      await page.waitForFunction(() => [...document.querySelectorAll('ion-modal .ion-page:not(.ion-page-hidden) ion-title')].some(title => title.textContent === '角色卡'));
      console.log(`PASS editor back at ${fraction}: ION-BUTTON, returned to role cards`);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
