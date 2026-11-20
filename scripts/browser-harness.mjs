// Shared setup for the Chromium browser tests: a local page server, the browser launch, and the network route
// that serves three.js and the web fonts from pinned npm packages at their CDN URLs. Tests never need the live CDN,
// and every other external request is rejected.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { dirname, resolve, sep } from 'node:path';
import { chromium } from 'playwright';

export const threeCdnPrefix = 'https://cdn.jsdelivr.net/npm/three@0.170.0/';
const require = createRequire(import.meta.url);
const threeRoot = dirname(dirname(require.resolve('three')));

// The pages' web fonts come from Google Fonts. The tests serve the same families from pinned @fontsource packages, so text is
// measured and drawn with the fonts readers get, the same on every operating system (system fallback fonts differ widely:
// DejaVu on a Linux runner is much wider than the macOS fonts). The Pretendard stylesheet (the h1 headline only) stays empty.
const GOOGLE_FONTS_CSS = 'https://fonts.googleapis.com/css2';
const FONT_FILES_PREFIX = 'https://fonts.gstatic.com/plz-tests/';
const FONT_PACKAGES = { Hahmlet: '@fontsource/hahmlet', 'IBM Plex Mono': '@fontsource/ibm-plex-mono', 'IBM Plex Sans KR': '@fontsource/ibm-plex-sans-kr' };
const fontRoot = pkg => dirname(require.resolve(`${pkg}/package.json`));
// The @font-face rules for a Google Fonts css2 URL (family=Name:wght@400;500&family=…), from the packages' per-weight CSS.
export async function googleFontsCss(url) {
  const css = [];
  for (const spec of new URL(url).searchParams.getAll('family')) {
    const [name, axes = ''] = spec.split(':');
    const pkg = FONT_PACKAGES[name];
    assert.ok(pkg, `no test font package for the web font "${name}"; add it to FONT_PACKAGES in scripts/browser-harness.mjs`);
    const weights = /wght@([\d;]+)/.exec(axes)?.[1].split(';') ?? ['400'];
    for (const w of weights) {
      const text = await readFile(resolve(fontRoot(pkg), `${w}.css`), 'utf8');
      css.push(text.replace(/url\(\.\/files\//g, `url(${FONT_FILES_PREFIX}${pkg}/files/`));
    }
  }
  return css.join('\n');
}
async function fontFile(url) {
  const rest = url.slice(FONT_FILES_PREFIX.length), pkg = Object.values(FONT_PACKAGES).find(p => rest.startsWith(`${p}/files/`));
  assert.ok(pkg, `unknown test font file ${url}`);
  const root = fontRoot(pkg), path = resolve(root, rest.slice(pkg.length + 1));
  assert.ok(path.startsWith(`${root}${sep}`), 'font route must stay inside its package');
  return readFile(path);
}

// Serves HTML from `pageFor(path)`, which returns the page source (string or Buffer) or null for a 404.
export async function startPageServer(pageFor) {
  const server = createServer(async (req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname.slice(1);
    try {
      const body = await pageFor(path);
      if (body === null || body === undefined) { res.writeHead(404).end(); return; }
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }).end(body);
    } catch (error) {
      res.destroy(error);
    }
  });
  await new Promise((ok, fail) => { server.once('error', fail); server.listen(0, '127.0.0.1', ok); });
  return {
    origin: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise(ok => server.close(ok)),
  };
}

// Software WebGL so the axo kit renders in headless Chromium.
export function launchBrowser() {
  return chromium.launch({ chromiumSandbox: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
}

// Route every request of `context`: the page origin passes, three.js comes from node_modules (or is aborted when
// `cdn(url)` returns 'abort'; it may also wait), the Google Fonts stylesheet and its font files come from the font packages,
// other stylesheets are empty, everything else is blocked.
// `onThree(url)` sees every three.js request.
export async function routeNetwork(context, origin, { cdn = () => 'serve', onThree = () => {} } = {}) {
  await context.route('**/*', async route => {
    const url = route.request().url();
    if (url.startsWith(`${origin}/`)) return route.continue();
    if (url.startsWith(threeCdnPrefix)) {
      onThree(url);
      if (await cdn(url) === 'abort') return route.abort('failed');
      const path = resolve(threeRoot, url.slice(threeCdnPrefix.length));
      assert.ok(path.startsWith(`${threeRoot}${sep}`), 'CDN route must stay inside the pinned three package');
      return route.fulfill({
        contentType: 'application/javascript',
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: await readFile(path),
      });
    }
    if (url.startsWith(GOOGLE_FONTS_CSS)) return route.fulfill({ contentType: 'text/css', body: await googleFontsCss(url) });
    if (url.startsWith(FONT_FILES_PREFIX)) return route.fulfill({ contentType: url.endsWith('.woff') ? 'font/woff' : 'font/woff2', headers: { 'Access-Control-Allow-Origin': '*' }, body: await fontFile(url) });
    if (route.request().resourceType() === 'stylesheet') return route.fulfill({ contentType: 'text/css', body: '' }); // Pretendard
    return route.abort('blockedbyclient');
  });
}

// ---- plz-explain pages ----
export const sleep = ms => new Promise(r => setTimeout(r, ms));
// The kits the plz-explain template declares on its stage. Variants replace this one string.
export const TEMPLATE_KITS = 'axo svg';

// The template with its SCENES code replaced by `code` (banner comments kept) and the stage's data-kits set to `kits`.
// extra: names of more chapters to add after the template's s3 chapter (copies of it), for scenes beyond s3.
export function variantWithScenes(templateSource, code, kits = TEMPLATE_KITS, { extra = [] } = {}) {
  const lines = templateSource.split('\n');
  const scenes = lines.findIndex(l => /^SCENES\b/.test(l.trim()));
  const cont = lines.findIndex(l => /^ENGINE \(/.test(l.trim()));
  assert.ok(scenes > 0 && cont > scenes, 'template banners');
  const start = lines.findIndex((l, i) => i > scenes && l.includes('*/')) + 1;
  const out = [...lines.slice(0, start), code, ...lines.slice(cont - 1)].join('\n'); // cont - 1: the "/* ====" line of the continued banner
  const attr = `data-kits="${TEMPLATE_KITS}"`;
  assert.ok(out.includes(attr), `the template declares ${attr} on the stage`);
  const s3 = /\n    <section class="chapter" data-scene="s3">[\s\S]*?<\/section>\n/.exec(out);
  assert.ok(!extra.length || s3, 'the template has an s3 chapter to copy');
  const copies = extra.map((name, i) => s3[0]
    .replace(/(data-(?:scene|run))="s3"/g, (_, a) => `${a}="${name}"`)
    .replace('<span class="n">3</span>', () => `<span class="n">${4 + i}</span>`)).join('');
  return (extra.length ? out.replace(s3[0], () => s3[0] + copies) : out).replace(attr, () => `data-kits="${kits}"`);
}

// Open a plz-explain page in a fresh context. Phones get a mobile, touch, 3× context. Console errors and page errors are collected.
// waitReady: false returns while the stage may still be loading; cdn(url) may hold or abort three.js; storage is set before load.
// One page per test at a time, so loops over viewports do not keep several software-GL pages alive: call the returned
// close() before opening the next page (opening one while another is open fails). Whatever is still open when the test
// ends is closed then. Results read from a closed page (errors, requests) stay readable.
const openContexts = new WeakMap(); // test → its open context, or null once closed
export async function openExplainPage(browser, origin, t, file, { viewport = { width: 1440, height: 900 }, reducedMotion = 'no-preference', storage = {}, waitReady = true, cdn } = {}) {
  assert.ok(!openContexts.get(t), `${file}: this test still has a page open; call close() on it first`);
  if (!openContexts.has(t)) t.after(() => openContexts.get(t)?.close());
  const phone = viewport.width <= 860 || viewport.height <= 520;
  const context = await browser.newContext({ viewport, reducedMotion, ...(phone ? { deviceScaleFactor: 3, isMobile: true, hasTouch: true } : {}) });
  openContexts.set(t, context);
  const close = async () => {
    if (openContexts.get(t) === context) openContexts.set(t, null);
    await context.close();
  };
  if (Object.keys(storage).length) await context.addInitScript(s => { for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v); }, storage);
  const threeRequests = [];
  await routeNetwork(context, origin, { cdn, onThree: url => threeRequests.push(url) });
  const page = await context.newPage();
  page.setDefaultTimeout(60_000);
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(`${origin}/${file}`, { waitUntil: waitReady ? 'load' : 'commit' });
  if (waitReady) {
    await page.waitForFunction(() => document.querySelector('.stage')?.dataset.state === 'ready');
    await page.evaluate(() => document.fonts.ready); // the stage lays out again with the web fonts once they are in
  }
  return { page, errors, threeRequests, close };
}

export const railTexts = page => page.$$eval('.rail-list .cap', caps => caps.map(c => c.textContent));
// Resolves after the page has drawn `n` more frames.
export const nextFrames = (page, n = 2) => page.evaluate(n => new Promise(r => { const step = k => (k ? requestAnimationFrame(() => step(k - 1)) : r()); step(n); }), n);

// A page without one kit: removes that kit's KIT sections (css and js), as a page author does for a kit the page does not use.
export function withoutKit(source, kit) {
  const out = source.replace(new RegExp(`^[ \\t]*/\\*\\s*KIT ${kit} (css|js)\\b[\\s\\S]*?^[ \\t]*/\\*\\s*END KIT ${kit} \\1 \\*/\\n`, 'gm'), '');
  assert.ok(!new RegExp(`KIT ${kit} `).test(out), `the ${kit} sections were removed`);
  return out;
}
