import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, join, resolve, sep } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const threeRoot = dirname(dirname(createRequire(import.meta.url).resolve('three')));
const cdnPrefix = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';
const controls = '[data-run], .autorun, .reset-view';
const pages = [
  { file: 'template.html', lang: 'en' },
  { file: 'example-agent-sandbox.html', lang: 'ko' },
  { file: 'example-agent-sandbox.en.html', lang: 'en' },
];
let browser, server, origin;

before(async () => {
  server = createServer(async (req, res) => {
    const file = new URL(req.url, 'http://localhost').pathname.slice(1);
    if (!pages.some(page => page.file === file)) {
      res.writeHead(404).end();
      return;
    }
    try {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(await readFile(join(root, 'skills/plz-3d-explain/assets', file)));
    } catch (error) {
      res.destroy(error);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({
    chromiumSandbox: true,
    args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  });
}, { timeout: 30_000 });

after(async () => {
  await browser?.close();
  if (server) await new Promise(resolve => server.close(resolve));
}, { timeout: 15_000 });

// Serve the pinned npm copy at the real CDN URLs. Browser tests never need the
// live CDN or web fonts, and every unexpected external request is rejected.
async function openPage(t, file, { viewport = { width: 390, height: 844 }, cdn = () => 'serve', noWebGL = false, reducedMotion = 'reduce' } = {}) {
  const context = await browser.newContext({
    viewport, reducedMotion,
    ...(viewport.width <= 430 ? { deviceScaleFactor: 3, isMobile: true, hasTouch: true } : {}),
  });
  t.after(() => context.close());
  if (noWebGL) await context.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      return /^webgl/.test(type) ? null : original.call(this, type, ...args);
    };
  });
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(`${origin}/`)) return route.continue();
    if (url.startsWith(cdnPrefix)) {
      if (await cdn(url) === 'abort') return route.abort('failed');
      const path = resolve(threeRoot, url.slice(cdnPrefix.length));
      assert.ok(path.startsWith(`${threeRoot}${sep}`), 'CDN route must stay inside the pinned three package');
      return route.fulfill({
        contentType: 'application/javascript',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: await readFile(path),
      });
    }
    if (route.request().resourceType() === 'stylesheet') return route.fulfill({ contentType: 'text/css', body: '' });
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`${origin}/${file}`, { waitUntil: 'commit' });
  return { page, errors };
}

async function state(page, expected) {
  await page.waitForFunction(value => document.querySelector('.stage')?.dataset.state === value, expected);
  assert.equal(await page.locator('.stage').getAttribute('aria-busy'), String(expected === 'loading'));
}

async function assertControls(page, disabled) {
  const actual = await page.locator(controls).evaluateAll(buttons => buttons.map(button => button.disabled));
  assert.ok(actual.length >= 4, 'the page must have chapter, auto-play and reset controls');
  assert.ok(actual.every(value => value === disabled), `all 3D controls should be ${disabled ? 'disabled' : 'enabled'}`);
}

async function assertFailure(page, lang, { webgl = false } = {}) {
  await state(page, 'failed');
  await assertControls(page, true);
  assert.equal(await page.evaluate(() => typeof window.__explainer), 'undefined');
  assert.ok(await page.locator('.fallback').isVisible());
  const message = page.locator(`.fallback [data-ui="${webgl ? 'fallback' : 'loadError'}"]`);
  assert.ok(await message.isVisible());
  assert.match(await message.innerText(), /3D/);
  const retry = page.locator('.retry-load');
  assert.ok(await retry.isVisible());
  assert.ok(await retry.isEnabled());
  if (lang === 'ko') {
    assert.match(await message.innerText(), /[가-힣]/);
    assert.match(await retry.innerText(), /다시|재시도|새로/);
  } else {
    assert.doesNotMatch(await message.innerText(), /[가-힣]/);
    assert.match(await retry.innerText(), /retry|reload|try again/i);
  }
}

for (const { file, lang } of pages) {
  test(`${file}: focusing stage controls preserves reading position and code focus clears the sticky stage`, async t => {
    const { page, errors } = await openPage(t, file);
    await state(page, 'ready');
    await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'instant' }));
    await page.waitForFunction(() => {
      const stage = document.querySelector('.stage');
      return window.scrollY > 0 && getComputedStyle(stage).position === 'sticky' && stage.getBoundingClientRect().top === 0;
    });

    for (const selector of ['.stage .autorun', '.stage .reset-view']) {
      const before = await page.evaluate(() => window.scrollY);
      await page.locator(selector).focus();
      const after = await page.evaluate(() => window.scrollY);
      assert.equal(after, before, `focusing ${selector} should not shift the reading position`);
    }

    if (file !== 'template.html') {
      const code = page.locator('pre.code').first();
      await code.focus();
      const layout = await page.evaluate(() => {
        const stage = document.querySelector('.stage').getBoundingClientRect();
        const code = document.querySelector('pre.code').getBoundingClientRect();
        return { stageBottom: stage.bottom, codeTop: code.top, codeBottom: code.bottom, viewportHeight: innerHeight };
      });
      assert.ok(layout.codeTop >= layout.stageBottom, 'focused code should be visible below the sticky stage');
      assert.ok(layout.codeBottom <= layout.viewportHeight, 'the focused code should fit in the viewport');
    }
    assert.deepEqual(errors, []);
  });

  test(`${file}: loading remains readable with disabled controls until CDN modules arrive`, async t => {
    let release;
    const pending = new Promise(resolve => { release = resolve; });
    const { page, errors } = await openPage(t, file, { cdn: async () => { await pending; return 'serve'; } });
    t.after(release);
    await state(page, 'loading');
    await assertControls(page, true);
    const loading = page.locator('.fallback [data-ui="loading"]');
    assert.ok(await loading.isVisible());
    assert.ok((await loading.innerText()).length > 10);
    if (lang === 'ko') assert.match(await loading.innerText(), /[가-힣]/);
    assert.equal(await page.locator('canvas').count(), 0);
    release();
    await state(page, 'ready');
    await assertControls(page, false);
    assert.equal(await page.locator('.fallback').isVisible(), false);
    assert.equal(await page.evaluate(() => window.__explainer.lang()), lang);
    assert.deepEqual(errors, []);
  });

  test(`${file}: initializes and plays a scene on desktop and mobile`, async t => {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await t.test(`${viewport.width}×${viewport.height}`, async t => {
        const { page, errors } = await openPage(t, file, { viewport });
        await state(page, 'ready');
        await assertControls(page, false);
        assert.equal(await page.locator('.canvas-wrap canvas').count(), 1);
        assert.equal(await page.locator('.fallback').isVisible(), false);
        const result = await page.evaluate(async () => {
          const name = window.__explainer.scenes()[0];
          return { name, text: await window.__explainer.run(name), current: window.__explainer.current() };
        });
        assert.equal(result.current, result.name);
        assert.ok(result.text.length > 0, 'the initialized scene must complete its animation');
        assert.deepEqual(errors, []);
      });
    }
  });

  test(`${file}: CDN failure offers localized retry and recovers after reload`, async t => {
    let blocked = true;
    const { page, errors } = await openPage(t, file, { cdn: () => blocked ? 'abort' : 'serve' });
    await assertFailure(page, lang);
    assert.equal(await page.locator('canvas').count(), 0);
    blocked = false;
    await page.locator('.retry-load').click();
    await state(page, 'ready');
    await assertControls(page, false);
    assert.equal(await page.evaluate(() => window.__explainer.lang()), lang);
    assert.equal(await page.locator('.fallback').isVisible(), false);
    assert.deepEqual(errors, []);
  });

  test(`${file}: an addon failure is handled when the three.js core succeeds`, async t => {
    for (const addon of ['controls/OrbitControls.js', 'renderers/CSS2DRenderer.js']) {
      await t.test(addon, async t => {
        const { page, errors } = await openPage(t, file, { cdn: url => url.endsWith(addon) ? 'abort' : 'serve' });
        await assertFailure(page, lang);
        assert.equal(await page.locator('canvas').count(), 0);
        assert.deepEqual(errors, []);
      });
    }
  });

  test(`${file}: failed stage gives mobile readers their screen space back`, async t => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }, { width: 844, height: 390 }]) {
      await t.test(`${viewport.width}×${viewport.height}`, async t => {
        const { page } = await openPage(t, file, { viewport, cdn: () => 'abort' });
        await assertFailure(page, lang);
        const layout = await page.evaluate(() => {
          const stage = document.querySelector('.stage');
          const notice = document.querySelector('.fallback').getBoundingClientRect();
          const retry = document.querySelector('.retry-load').getBoundingClientRect();
          return {
            position: getComputedStyle(stage).position,
            height: stage.getBoundingClientRect().height,
            viewportHeight: innerHeight,
            width: innerWidth,
            scrollWidth: document.documentElement.scrollWidth,
            noticeFits: retry.bottom <= notice.bottom && retry.right <= notice.right,
          };
        });
        assert.ok(!['sticky', 'fixed'].includes(layout.position), 'an unavailable model should not stay pinned');
        if (viewport.height > viewport.width) assert.ok(layout.height < layout.viewportHeight * 0.35, 'failure notice should be smaller than the original 44svh stage');
        assert.equal(layout.scrollWidth, layout.width, 'the error must not introduce horizontal page scrolling');
        assert.ok(layout.noticeFits, 'retry must fit inside the failure notice');
        await page.locator('.chapter').first().scrollIntoViewIfNeeded();
        await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'instant' }));
        assert.ok(await page.locator('.stage').evaluate(stage => stage.getBoundingClientRect().bottom <= 0), 'the failed stage should scroll out of the reading area');
      });
    }
  });

  test(`${file}: repeated playback keeps label and GPU resource counts stable`, { timeout: 30_000 }, async t => {
    const { page, errors } = await openPage(t, file);
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await state(page, 'ready');
    const result = await page.evaluate(async () => {
      const api = window.__explainer;
      const name = api.scenes().includes('kernel') ? 'kernel' : 's2';
      await api.run(name); // Warm renderer allocations and persistent label state first.
      const baseline = api.resources();
      const runs = [];
      for (let i = 0; i < 8; i += 1) {
        const text = await api.run(name);
        runs.push({ text, resources: api.resources() });
      }
      return { baseline, runs };
    });
    assert.ok(result.baseline.labels > 0);
    for (const run of result.runs) {
      assert.ok(run.text.length > 0);
      assert.deepEqual(run.resources, result.baseline, 'temporary labels, state, and renderer geometries must not accumulate');
    }
    assert.deepEqual(errors, []);
  });

  test(`${file}: a chapter change releases a request interrupted during animation`, { timeout: 30_000 }, async t => {
    const { page, errors } = await openPage(t, file, { reducedMotion: 'no-preference' });
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    await state(page, 'ready');
    const setup = await page.evaluate(async () => {
      const api = window.__explainer;
      const name = api.scenes().includes('kernel') ? 'kernel' : 's2';
      await api.run(name);
      return { name, next: api.scenes()[0], baseline: api.resources() };
    });
    await page.locator(`[data-run="${setup.name}"]`).click();
    await page.waitForFunction(baseline => {
      const resources = window.__explainer.resources();
      return resources.labels > baseline.labels || resources.geometries > baseline.geometries;
    }, setup.baseline);
    await page.locator(`[data-run="${setup.next}"]`).click();
    await page.waitForFunction(name => window.__explainer.current() === name, setup.next);
    const resources = await page.evaluate(async () => {
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
      return window.__explainer.resources();
    });
    assert.equal(resources.labels, setup.baseline.labels, 'interrupted request labels must be unregistered immediately');
    assert.equal(resources.labelStates, setup.baseline.labelStates);
    assert.equal(resources.geometries, setup.baseline.geometries, 'the interrupted request geometry must be released too');
    assert.deepEqual(errors, []);
  });

  test(`${file}: WebGL initialization failure keeps text and recovery available`, async t => {
    const { page, errors } = await openPage(t, file, { noWebGL: true });
    await assertFailure(page, lang, { webgl: true });
    assert.deepEqual(errors, []);
  });
}
