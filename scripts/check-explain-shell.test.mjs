// Browser checks for the plz-explain page shell: speed menu, director timing, caption rail, split, auto-play,
// layout checks for every chapter, and a page without the axo kit that must never request three.js.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { launchBrowser, nextFrames, openExplainPage, railTexts, sleep, startPageServer, variantWithScenes } from './browser-harness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'skills/plz-explain/assets');
const examples = ['template.html', 'example-agent-sandbox.html', 'example-agent-sandbox.en.html'];
const DESKTOP = { width: 1440, height: 900 };
const PHONES = [{ width: 390, height: 844 }, { width: 360, height: 800 }, { width: 844, height: 390 }];
let browser, server, origin;

// A page with no axo scene: the template with its SCENES section replaced by a small DOM-only kit.
const DOM_KIT_SCENES = `
defineKit('dom', {
  async load(host) { this.root = host.layer; },
  build(scene) {
    const el = document.createElement('div');
    el.className = 'tag'; el.hidden = true;
    el.style.cssText = 'position:absolute;left:40%;top:45%';
    this.root.append(el);
    return { el, ...scene.build(el) };
  },
  show(scene) { scene.el.hidden = false; },
  hide(scene) { scene.el.hidden = true; },
  labels() { return [...this.root.querySelectorAll('.tag:not([hidden])')]; },
});
defineScene('s1', {
  kit: 'dom',
  title: '1  Plain',
  build(el) {
    return {
      reset() { el.textContent = 'Box'; },
      // Only "N. " (period and whitespace) starts a step; numbers such as 2.5 or 10.0.0.5 are ordinary text.
      async run(a, say) { say('1. Start.'); say('2.5 GB was reclaimed.'); say('10.0.0.5 answered.'); await a.wait(50); say('2. Second.'); },
    };
  },
});
defineScene('s2', {
  kit: 'dom',
  title: '2  Plain',
  build(el) {
    return {
      reset() { el.textContent = 'Box'; },
      async run(a, say) { say('1. Start.'); await a.wait(300); el.textContent = 'Done'; say('Finished.'); },
    };
  },
});
`;

// An axo page whose scenes exercise animator options (s1) and a badge whose anchor is disposed mid-run (s2).
const AXO_PROBE_SCENES = `
defineScene('s1', {
  title: '1  Tween options',
  build() {
    const g = new THREE.Group();
    g.add(block(2, 1, 2, [0, 0, 0]));
    return {
      group: g,
      reset() {},
      async run(a, say) {
        const seen = { color: [], eased: [] };
        await a.tween(400, t => seen.color.push(t), { motion: false });
        await a.tween(300, t => seen.eased.push(t), { motion: false, ease: () => 0.5 });
        window.__seen = seen;
        say('Done.');
      },
    };
  },
});
defineScene('s2', {
  title: '2  Badge',
  build() {
    const g = new THREE.Group();
    const temp = temporaryGroup(); g.add(temp);
    g.add(block(2, 1, 2, [0, 0, 0]));
    g.add(tag('Home', [0, 1.6, 0]));
    return {
      group: g,
      reset() { clearGroup(temp); },
      async run(a, say) {
        const p = packet(COLOR.actor, [-1.5, 2, 0]); temp.add(p);
        say('1. Sent.', { anchor: p });
        await a.move(p, [1.5, 2, 0], 300);
        disposeObject(p);
        await a.wait(300);
        say('Done.');
      },
    };
  },
});
`;

const templateSource = () => readFile(join(assets, 'template.html'), 'utf8');
const variantNoAxo = async () => variantWithScenes(await templateSource(), DOM_KIT_SCENES, 'dom');

before(async () => {
  const variants = { 'variant-no-axo.html': await variantNoAxo(), 'variant-axo-probe.html': variantWithScenes(await templateSource(), AXO_PROBE_SCENES, 'axo') };
  server = await startPageServer(path => variants[path] ?? (examples.includes(path) ? readFile(join(assets, path)) : null));
  origin = server.origin;
  browser = await launchBrowser();
}, { timeout: 30_000 });

after(async () => {
  await browser?.close();
  await server?.close();
}, { timeout: 15_000 });

const openPage = (t, file, opts) => openExplainPage(browser, origin, t, file, opts);

// Runs a scene and records when each caption joined the rail (or changed in place).
const stampRun = (page, name, { speed = 1, speedAt = null, speedTo = null } = {}) => page.evaluate(async ([name, speed, speedAt, speedTo]) => {
  const api = window.__explainer;
  api.speed(speed);
  const stamps = [];
  const list = document.querySelector('.rail-list');
  const mo = new MutationObserver(() => stamps.push({ t: performance.now(), n: list.children.length, text: list.lastElementChild?.textContent ?? '' }));
  mo.observe(list, { childList: true, subtree: true, characterData: true });
  const p = api.run(name);
  let t0 = null;
  const first = () => stamps.find(s => s.n > 0);
  const poll = speedAt === null ? 0 : setInterval(() => { const f = first(); if (f && performance.now() - f.t >= speedAt) { api.speed(speedTo); clearInterval(poll); } }, 20);
  const text = await p;
  clearInterval(poll); // a run that ends before speedAt must not change the speed of the next one
  mo.disconnect();
  t0 = first()?.t ?? 0;
  const caps = [...list.children].map(c => c.textContent);
  const timing = api.timing();
  api.speed(1);
  return { text, caps, timing, firstToLast: Math.round(stamps.at(-1).t - t0), distinctTimes: new Set(stamps.filter(s => s.n > 0).map(s => Math.round(s.t / 50))).size };
}, [name, speed, speedAt, speedTo]);

const railCaps = page => page.$$eval('.rail-list .cap', caps => caps.map(c => ({
  n: c.querySelector('.n')?.textContent ?? '', text: c.textContent, isNew: c.classList.contains('new'), shown: getComputedStyle(c).display !== 'none',
})));

test('speed menu: opens from the split button, syncs every chapter, persists, and works from the keyboard', async t => {
  for (const viewport of [DESKTOP, { width: 390, height: 844 }]) {
    await t.test(`${viewport.width}x${viewport.height}`, async t => {
      const { page, errors } = await openPage(t, 'template.html', { viewport });
      const seg = '[data-scene="s2"] .speed-seg';
      await page.evaluate(() => document.querySelector('[data-scene="s2"] .act').scrollIntoView({ block: 'center', behavior: 'instant' }));
      await nextFrames(page);
      const attrs = await page.$eval(seg, s => ({ haspopup: s.getAttribute('aria-haspopup'), expanded: s.getAttribute('aria-expanded'), label: s.getAttribute('aria-label'), h: s.getBoundingClientRect().height }));
      assert.equal(attrs.haspopup, 'menu');
      assert.equal(attrs.expanded, 'false');
      assert.match(attrs.label, /1×/);
      if (viewport.width < 500) assert.ok(attrs.h >= 44, `speed segment ${attrs.h}px tall on a phone`);
      await page.click(seg);
      const menu = await page.evaluate(() => {
        const m = document.querySelector('.speed-menu'), r = m.getBoundingClientRect();
        return { hidden: m.hidden, role: m.getAttribute('role'), items: [...m.querySelectorAll('.speed-item')].map(i => [i.getAttribute('role'), i.dataset.v, i.getAttribute('aria-checked'), i.getBoundingClientRect().height]), inside: r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, focus: document.activeElement.dataset.v };
      });
      assert.equal(menu.hidden, false);
      assert.equal(menu.role, 'menu');
      assert.deepEqual(menu.items.map(i => i[1]), ['0.5', '1', '1.5', '2']);
      assert.ok(menu.items.every(i => i[0] === 'menuitemradio'));
      assert.deepEqual(menu.items.map(i => i[2]), ['false', 'true', 'false', 'false']);
      if (viewport.width < 500) assert.ok(menu.items.every(i => i[3] >= 44), 'menu items are touch-sized on phones');
      assert.ok(menu.inside, 'the menu stays inside the viewport');
      assert.equal(menu.focus, '1', 'the current value gets focus');
      await page.click('.speed-item[data-v="2"]');
      const after2 = await page.evaluate(() => ({ vals: [...document.querySelectorAll('.speed-seg .val')].map(v => v.textContent), speed: window.__explainer.speed(), stored: localStorage.getItem('plz-explain:speed'), hidden: document.querySelector('.speed-menu').hidden, focus: document.activeElement.classList.contains('speed-seg') }));
      assert.ok(after2.vals.length >= 2 && after2.vals.every(v => v === '2×'), `segments synced: ${after2.vals}`);
      assert.equal(after2.speed, 2);
      assert.equal(after2.stored, '2');
      assert.ok(after2.hidden && after2.focus, 'choosing closes the menu and returns focus');
      // keyboard: ArrowDown opens on the current item, Escape returns focus, Enter opens, ArrowDown + Enter picks the next item (wraps)
      await page.focus(seg); await page.keyboard.press('ArrowDown');
      assert.equal(await page.evaluate(() => document.activeElement.dataset.v), '2');
      await page.keyboard.press('Escape');
      assert.deepEqual(await page.evaluate(() => [document.querySelector('.speed-menu').hidden, document.activeElement.classList.contains('speed-seg')]), [true, true]);
      await page.keyboard.press('Enter');
      await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
      assert.equal(await page.evaluate(() => window.__explainer.speed()), 0.5);
      // flips above the button when there is no room below
      await page.evaluate(() => document.querySelector('[data-scene="s2"] .act').scrollIntoView({ block: 'end', behavior: 'instant' }));
      await nextFrames(page);
      await page.click(seg);
      const flip = await page.evaluate(sel => { const m = document.querySelector('.speed-menu').getBoundingClientRect(); const s = document.querySelector(sel).getBoundingClientRect(); return { inside: m.top >= 0 && m.bottom <= innerHeight, above: m.bottom <= s.top + 1 }; }, seg);
      assert.ok(flip.inside && flip.above, `menu flips above: ${JSON.stringify(flip)}`);
      await page.keyboard.press('Escape');
      // persisted across reloads
      await page.reload({ waitUntil: 'load' });
      await page.waitForFunction(() => document.querySelector('.stage')?.dataset.state === 'ready');
      assert.equal(await page.evaluate(() => window.__explainer.speed()), 0.5);
      assert.deepEqual(errors, []);
    });
  }
});

// A scroll that leaves the segment on screen (a late layout shift, the tail of a smooth scroll that brought the button into
// view) keeps the menu open and attached to its segment. The menu closes once the segment is fully out of view.
test('speed menu: stays open and follows its segment through a small scroll, closes when the segment leaves the screen', async t => {
  for (const viewport of [DESKTOP, { width: 390, height: 844 }]) {
    const { page, errors, close } = await openPage(t, 'template.html', { viewport });
    const seg = '[data-scene="s2"] .speed-seg';
    await page.evaluate(() => document.querySelector('[data-scene="s2"] .act').scrollIntoView({ block: 'end', behavior: 'instant' }));
    await nextFrames(page);
    await page.click(seg);
    await page.evaluate(() => window.scrollBy({ top: 30, behavior: 'instant' }));
    await nextFrames(page, 3);
    const r = await page.evaluate(sel => {
      const m = document.querySelector('.speed-menu'), mr = m.getBoundingClientRect(), sr = document.querySelector(sel).getBoundingClientRect();
      return { hidden: m.hidden, attached: Math.abs(mr.bottom - (sr.top - 4)) < 1.5 || Math.abs(mr.top - (sr.bottom + 4)) < 1.5 };
    }, seg);
    assert.deepEqual(r, { hidden: false, attached: true }, `${viewport.width}: the menu stays with its segment`);
    await page.click('.speed-item[data-v="1.5"]');
    assert.equal(await page.evaluate(() => window.__explainer.speed()), 1.5);
    await page.click(seg);
    if (viewport.width === 390) {
      await page.evaluate(sel => {
        const segment = document.querySelector(sel).getBoundingClientRect();
        const stage = document.querySelector('.stage').getBoundingClientRect();
        window.scrollBy({ top: segment.bottom - stage.bottom + 8, behavior: 'instant' });
      }, seg);
      await nextFrames(page, 3);
      const covered = await page.evaluate(sel => {
        const segment = document.querySelector(sel).getBoundingClientRect();
        const stage = document.querySelector('.stage').getBoundingClientRect();
        return { behindStage: segment.top > 0 && segment.bottom <= stage.bottom, hidden: document.querySelector('.speed-menu').hidden };
      }, seg);
      assert.deepEqual(covered, { behindStage: true, hidden: true }, 'closed once the pinned stage covered its segment');
      await page.evaluate(() => document.querySelector('[data-scene="s2"] .act').scrollIntoView({ block: 'end', behavior: 'instant' }));
      await nextFrames(page);
      await page.click(seg);
    }
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    await nextFrames(page, 3);
    assert.equal(await page.evaluate(() => document.querySelector('.speed-menu').hidden), true, `${viewport.width}: closed once its segment left the screen`);
    assert.deepEqual(errors, []);
    await close();
  }
});

// Timing is checked on the director's own timeline (__explainer.timing(): the time each wait and tween asked for at 1×,
// and the time it was scheduled for at the speeds in effect), which does not depend on machine load. Wall clock gets a loose check only.
test('director: run time scales with speed, and a mid-run speed change applies live', { timeout: 120_000 }, async t => {
  const { page, errors } = await openPage(t, 'template.html');
  const x1 = await stampRun(page, 's2', { speed: 1 });
  const x2 = await stampRun(page, 's2', { speed: 2 });
  assert.ok(x1.timing.base > 1000, `the run asked for ${x1.timing.base} ms`);
  assert.equal(x2.timing.base, x1.timing.base, 'the same steps at both speeds');
  assert.ok(Math.abs(x1.timing.scaled - x1.timing.base) <= x1.timing.base * 0.01, `1× is scheduled at 1× (${JSON.stringify(x1.timing)})`);
  assert.ok(Math.abs(x1.timing.scaled / x2.timing.scaled - 2) < 0.02, `2× halves the schedule (${x1.timing.scaled} / ${x2.timing.scaled})`);
  assert.ok(x1.firstToLast > x2.firstToLast * 1.1, `2× is also faster on the wall clock (${x1.firstToLast} / ${x2.firstToLast} ms)`);
  assert.equal(x2.text, x1.text);
  const mid = await stampRun(page, 's2', { speed: 1, speedAt: 700, speedTo: 2 });
  assert.equal(mid.text, x1.text, 'same final caption after a mid-run speed change');
  assert.deepEqual(mid.caps, x1.caps);
  assert.equal(mid.timing.base, x1.timing.base);
  assert.ok(mid.timing.scaled < x1.timing.scaled * 0.95 && mid.timing.scaled > x2.timing.scaled * 1.05, `a mid-run change applied to the rest of the run (${JSON.stringify(mid.timing)})`);
  assert.deepEqual(errors, []);
});

test('split: dragging the divider mid-run keeps the run and its final caption', { timeout: 60_000 }, async t => {
  const { page, errors } = await openPage(t, 'template.html');
  const ref = await stampRun(page, 's2', { speed: 1 });
  await page.evaluate(() => { window.__drag = window.__explainer.run('s2'); });
  await page.waitForFunction(() => document.querySelectorAll('.rail-list .cap').length >= 1);
  const h = await page.$eval('.split-v', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: innerHeight / 2 }; });
  await page.mouse.move(h.x, h.y); await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(h.x + (i % 2 ? -1 : 1) * i * 20, h.y); await sleep(60); } // pacing a user's drag
  await page.mouse.up();
  const text = await page.evaluate(() => window.__drag);
  assert.equal(text, ref.text);
  assert.deepEqual(await railTexts(page), ref.caps);
  assert.equal(await page.evaluate(() => window.__explainer.current()), 's2');
  const stored = await page.evaluate(() => localStorage.getItem('plz-explain:split-x'));
  assert.ok(stored && Number.isFinite(parseFloat(stored)), 'the split position is persisted');
  const sep = await page.$eval('.split-v', el => ({ role: el.getAttribute('role'), tab: el.tabIndex, now: +el.getAttribute('aria-valuenow'), min: +el.getAttribute('aria-valuemin'), max: +el.getAttribute('aria-valuemax') }));
  assert.equal(sep.role, 'separator');
  assert.equal(sep.tab, 0);
  assert.ok(sep.min <= sep.now && sep.now <= sep.max);
  await page.focus('.split-v'); await page.keyboard.press('Home');
  assert.equal(await page.$eval('.split-v', el => +el.getAttribute('aria-valuenow')), sep.min, 'Home moves the divider to its minimum');
  await page.dblclick('.split-v');
  assert.equal(await page.evaluate(() => localStorage.getItem('plz-explain:split-x')), null, 'double-click resets the split');
  assert.deepEqual(errors, []);
});

test('caption rail: every step caption accumulates on the stage, newest emphasized, with an anchored badge', async t => {
  const { page, errors, close } = await openPage(t, 'template.html');
  const text = await page.evaluate(() => window.__explainer.run('s2'));
  const caps = await railCaps(page);
  assert.equal(caps.length, 4, JSON.stringify(caps));
  assert.deepEqual(caps.map(c => c.n), ['1', '2', '3', '']);
  assert.deepEqual(caps.map(c => c.isNew), [false, false, false, true]);
  assert.ok(caps.every(c => c.shown), 'all captions are visible on a wide stage');
  assert.equal(caps.at(-1).text, text, 'run() returns the final caption');
  const rail = await page.evaluate(() => { const r = document.querySelector('.rail'), s = document.querySelector('.stage').getBoundingClientRect(), b = r.getBoundingClientRect(); return { live: r.getAttribute('aria-live'), inStage: b.left >= s.left && b.right <= s.right, compact: r.classList.contains('compact'), dim: getComputedStyle(r.querySelector('.cap')).opacity }; });
  assert.equal(rail.live, 'polite');
  assert.ok(rail.inStage && !rail.compact);
  const badge = await page.evaluate(() => [...document.querySelectorAll('.tag.badge')].filter(b => b.offsetParent && getComputedStyle(b).display !== 'none').map(b => b.textContent));
  assert.deepEqual(badge, ['2'], 'say(..., { anchor }) puts the step number next to the object');
  assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
  // the old left-column result line is gone
  assert.equal(await page.locator('.act .result').count(), 0);
  assert.deepEqual(errors, []);
  await close();
  // repeated step numbers update the step in place (announcement, then outcome)
  const { page: ko, errors: koErrors } = await openPage(t, 'example-agent-sandbox.html');
  await ko.evaluate(() => window.__explainer.instant(true));
  await ko.evaluate(() => window.__explainer.run('container'));
  const kcaps = await railCaps(ko);
  assert.deepEqual(kcaps.map(c => c.n), ['1', '2', '3']);
  assert.match(kcaps[0].text, /막혔습니다/);
  assert.deepEqual(koErrors, []);
});

// Model labels that are drawn on top of the open caption sheet (the sheet must cover the model).
// Labels have pointer-events: none, which hit testing skips, so enable them while probing.
const labelsOverSheet = page => page.evaluate(() => {
  const tags = [...document.querySelectorAll('.kit-layer .tag')].filter(t => t.offsetParent && t.style.display !== 'none');
  tags.forEach(t => { t.style.pointerEvents = 'auto'; });
  const shown = tags.filter(t => { const r = t.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return hit && t.contains(hit); });
  tags.forEach(t => { t.style.pointerEvents = ''; });
  return shown.map(t => t.textContent);
});

test('caption rail on phones: newest caption, k / n and a toggle that opens a sheet inside the stage', async t => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }]) {
    await t.test(`${viewport.width}x${viewport.height}`, async t => {
      const { page, errors } = await openPage(t, 'template.html', { viewport });
      await page.evaluate(() => window.__explainer.instant(true));
      await page.evaluate(() => window.__explainer.run('s2'));
      const closed = await page.evaluate(() => ({ compact: document.querySelector('.rail').classList.contains('compact'), count: document.querySelector('.rail-count').textContent, toggle: document.querySelector('.rail-toggle').getAttribute('aria-expanded'), toggleH: document.querySelector('.rail-toggle').getBoundingClientRect().height }));
      assert.equal(closed.compact, true);
      assert.equal(closed.count.replace(/\s/g, ''), '4/4');
      assert.equal(closed.toggle, 'false');
      const caps = await railCaps(page);
      assert.deepEqual(caps.map(c => c.shown), [false, false, false, true]);
      assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
      await page.click('.rail-toggle');
      const open = await page.evaluate(() => { const r = document.querySelector('.rail'), s = document.querySelector('.stage').getBoundingClientRect(), b = r.getBoundingClientRect(); return { open: r.classList.contains('open'), api: window.__explainer.rail(), toggle: document.querySelector('.rail-toggle').getAttribute('aria-expanded'), inside: b.top >= s.top - 0.5 && b.bottom <= s.bottom + 0.5 }; });
      assert.deepEqual(open, { open: true, api: true, toggle: 'true', inside: true });
      assert.ok((await railCaps(page)).every(c => c.shown));
      assert.deepEqual(await labelsOverSheet(page), [], 'labels must not draw over the open caption sheet');
      assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
      assert.equal(await page.evaluate(() => window.__explainer.rail(false)), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), true);
      // stage-height handle on stacked phones
      const sep = await page.$eval('.split-h', el => ({ role: el.getAttribute('role'), visible: el.getBoundingClientRect().height > 0 }));
      assert.deepEqual(sep, { role: 'separator', visible: true });
      const h0 = await page.$eval('.stage', s => s.getBoundingClientRect().height);
      await page.focus('.split-h'); await page.keyboard.press('End');
      const h1 = await page.$eval('.stage', s => s.getBoundingClientRect().height);
      assert.ok(h1 > h0 + 40, `stage grew from ${h0} to ${h1}`);
      assert.ok(await page.evaluate(() => localStorage.getItem('plz-explain:split-h')));
      assert.deepEqual(errors, []);
    });
  }
  await t.test('open sheet over a chapter with many labels', async t => {
    const { page, errors } = await openPage(t, 'example-agent-sandbox.html', { viewport: { width: 390, height: 844 } });
    await page.evaluate(() => window.__explainer.instant(true));
    await page.evaluate(() => window.__explainer.run('lifecycle'));
    assert.ok((await page.evaluate(() => document.querySelectorAll('.kit-layer .tag').length)) > 10);
    await page.evaluate(() => window.__explainer.rail(true));
    assert.deepEqual(await labelsOverSheet(page), [], 'labels must not draw over the open caption sheet');
    assert.deepEqual(errors, []);
  });
});

test('reduced motion keeps the step order and the dwell: captions arrive one by one', { timeout: 60_000 }, async t => {
  const { page, errors } = await openPage(t, 'template.html', { reducedMotion: 'reduce' });
  const r = await stampRun(page, 's2');
  assert.equal(r.caps.length, 4);
  assert.ok(r.timing.scaled >= r.timing.base * 0.99, `reduced motion keeps every step's time (${JSON.stringify(r.timing)})`);
  assert.ok(r.firstToLast >= 1500, `sequence lasted ${r.firstToLast} ms`);
  assert.ok(r.distinctTimes >= 4, 'captions arrive at separate moments');
  assert.deepEqual(errors, []);
});

test('instant mode reaches the same final state without waiting', { timeout: 60_000 }, async t => {
  const { page, errors } = await openPage(t, 'template.html');
  const normal = await stampRun(page, 's2');
  const labelsNormal = await page.evaluate(() => [...document.querySelectorAll('.tag')].filter(e => e.style.display !== 'none' && e.offsetParent).map(e => e.textContent).sort());
  assert.equal(await page.evaluate(() => window.__explainer.instant(true)), true);
  const fast = await stampRun(page, 's2');
  const labelsFast = await page.evaluate(() => [...document.querySelectorAll('.tag')].filter(e => e.style.display !== 'none' && e.offsetParent).map(e => e.textContent).sort());
  assert.equal(fast.text, normal.text);
  assert.deepEqual(fast.caps, normal.caps);
  assert.deepEqual(labelsFast, labelsNormal);
  assert.equal(fast.timing.base, normal.timing.base, 'instant mode runs the same steps');
  assert.equal(fast.timing.scaled, 0, 'and schedules no time for them');
  assert.equal(await page.evaluate(() => window.__explainer.instant(false)), false);
  assert.deepEqual(errors, []);
});

async function chapterChecks(page, tag) {
  const out = await page.evaluate(async () => {
    const res = {};
    for (const n of window.__explainer.scenes()) {
      const text = await window.__explainer.run(n);
      res[n] = { text, overlaps: window.__explainer.overlaps(), clipped: window.__explainer.clipped() };
    }
    return res;
  });
  for (const [n, r] of Object.entries(out)) {
    assert.ok(r.text.length > 0, `${tag} ${n}: empty final caption`);
    assert.deepEqual(r.overlaps, [], `${tag} ${n}: overlaps`);
    assert.deepEqual(r.clipped, [], `${tag} ${n}: clipped`);
  }
}

for (const file of examples) {
  test(`${file}: overlaps() and clipped() are empty for every chapter on desktop splits and phones`, { timeout: 240_000 }, async t => {
    await t.test('1440x900 default, min and max split', async t => {
      const { page, errors } = await openPage(t, file);
      await page.evaluate(() => window.__explainer.instant(true));
      await chapterChecks(page, 'default');
      for (const key of ['Home', 'End']) {
        await page.focus('.split-v'); await page.keyboard.press(key); await nextFrames(page);
        await chapterChecks(page, key === 'Home' ? 'min' : 'max');
      }
      const legend = await page.evaluate(() => { const b = document.querySelector('.legend').getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight; });
      assert.ok(legend, 'the legend is inside the viewport');
      assert.deepEqual(errors, []);
    });
    for (const viewport of PHONES) {
      await t.test(`${viewport.width}x${viewport.height}`, async t => {
        const { page, errors } = await openPage(t, file, { viewport });
        await page.evaluate(() => window.__explainer.instant(true));
        await chapterChecks(page, `${viewport.width}x${viewport.height}`);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), true, 'no horizontal scroll');
        assert.deepEqual(errors, []);
      });
    }
  });
}

test('auto-play loops at the chosen speed and remembers its state under the plz-explain key', { timeout: 60_000 }, async t => {
  const { page, errors } = await openPage(t, 'template.html', { storage: { 'plz-explain:speed': '2' } });
  assert.equal(await page.evaluate(() => window.__explainer.autorun()), false);
  await page.evaluate(() => {
    // One finished cycle = the rail filled during a run, then cleared by the loop's reset.
    window.__ends = 0;
    const list = document.querySelector('.rail-list');
    let had = 0;
    new MutationObserver(() => { if (list.children.length === 0 && had > 0) window.__ends += 1; had = list.children.length; }).observe(list, { childList: true });
    document.querySelector('[data-scene="s1"].chapter').scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await page.waitForFunction(() => window.__explainer.current() === 's1' && scrollY > 40);
  await page.evaluate(() => window.__explainer.autorun(true));
  assert.equal(await page.evaluate(() => localStorage.getItem('plz-explain:autorun')), '1');
  await page.waitForFunction(() => window.__ends >= 2, null, { timeout: 90_000, polling: 100 });
  assert.equal(await page.evaluate(() => window.__explainer.current()), 's1');
  await page.evaluate(() => window.__explainer.autorun(false));
  assert.deepEqual(errors, []);
});

test('the drag-to-rotate hint shows only for a rotatable kit, and a page with no axo scene never requests three.js', async t => {
  const axo = await openPage(t, 'template.html');
  assert.equal(await axo.page.locator('.hint').isVisible(), true);
  assert.ok(axo.threeRequests.length > 0);
  await axo.close();
  const { page, errors, threeRequests } = await openPage(t, 'variant-no-axo.html');
  assert.equal(await page.evaluate(() => window.__explainer.run('s2')), 'Finished.');
  assert.deepEqual(threeRequests, [], 'three.js was requested by a page without an axo scene');
  assert.equal(await page.locator('.hint').isVisible(), false);
  assert.equal(await page.locator('.reset-view').isVisible(), false);
  assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
  assert.deepEqual(errors, []);
});

// Model label sizes: phones (media query) and any stage 600px or narrower (container query) get the small labels.
const tagSizes = page => page.evaluate(() => {
  const host = document.querySelector('.labels');
  const probe = cls => {
    const e = Object.assign(document.createElement('div'), { className: cls, textContent: '1' });
    host.append(e);
    const s = getComputedStyle(e), out = [s.fontSize, s.padding, ...(cls.includes('badge') ? [s.width, s.height] : [])].join(' ');
    e.remove();
    return out;
  };
  return { tag: probe('tag'), big: probe('tag big'), badge: probe('tag badge'), stage: document.querySelector('.stage').getBoundingClientRect().width };
});
const LARGE = { tag: '12.5px 3px 7px', big: '14px 4px 9px', badge: '12px 0px 22px 22px' };
const SMALL = { tag: '11px 2px 5px', big: '12px 3px 6px', badge: '11px 0px 19px 19px' };
test('model labels are small on phones and on a stage 600px or narrower, full size otherwise', async t => {
  for (const [label, viewport, key, want] of [['desktop', DESKTOP, null, LARGE], ['desktop, narrow stage', DESKTOP, 'End', SMALL], ['phone', { width: 390, height: 844 }, null, SMALL], ['landscape phone', { width: 844, height: 390 }, null, SMALL]]) {
    const { page, errors, close } = await openPage(t, 'template.html', { viewport });
    if (key) { await page.focus('.split-v'); await page.keyboard.press(key); await nextFrames(page); }
    const { stage, ...sizes } = await tagSizes(page);
    if (label === 'desktop') assert.ok(stage > 600, `desktop stage ${stage}px`);
    if (key) assert.ok(stage <= 600, `narrow stage ${stage}px`);
    assert.deepEqual(sizes, want, `${label} (stage ${stage}px)`);
    assert.deepEqual(errors, []);
    await close();
  }
});

test('captions: only "N. " starts a numbered step; 2.5 and 10.0.0.5 are ordinary text', async t => {
  const { page, errors } = await openPage(t, 'variant-no-axo.html');
  await page.evaluate(() => window.__explainer.run('s1'));
  const caps = await railCaps(page);
  assert.deepEqual(caps.map(c => c.n), ['1', '', '', '2']);
  assert.deepEqual(caps.map(c => c.text), ['1Start.', '2.5 GB was reclaimed.', '10.0.0.5 answered.', '2Second.']);
  assert.deepEqual(errors, []);
});

test('axo animator passes tween options through: { motion: false } animates under reduced motion, and a custom ease is used', { timeout: 45_000 }, async t => {
  const { page, errors } = await openPage(t, 'variant-axo-probe.html', { reducedMotion: 'reduce' });
  // Give the tween intermediate frames even when software rendering stalls on a busy test machine.
  await page.clock.install();
  await page.clock.pauseAt(Date.now() + 10_000);
  await page.evaluate(() => { window.__probeRun = window.__explainer.run('s1'); });
  await page.clock.runFor(2_500);
  const seen = await page.evaluate(async () => { await window.__probeRun; return window.__seen; });
  assert.ok(seen.color.some(v => v > 0 && v < 1), `a color tween animates under reduced motion: ${JSON.stringify(seen.color.slice(0, 5))}`);
  assert.ok(seen.eased.length > 1 && seen.eased.every(v => v === 0.5), `the custom ease is applied: ${JSON.stringify(seen.eased.slice(0, 5))}`);
  assert.deepEqual(errors, []);
});

test('a badge whose anchor is disposed mid-run stays where it was until reset, and resources() stays exact', async t => {
  const { page, errors } = await openPage(t, 'variant-axo-probe.html');
  const before = await page.evaluate(() => window.__explainer.resources());
  const text = await page.evaluate(() => window.__explainer.run('s2'));
  assert.equal(text, 'Done.');
  const after = await page.evaluate(() => window.__explainer.resources());
  assert.equal(after.labels, before.labels, 'badges are excluded and nothing else leaks');
  assert.equal(after.labelStates, before.labelStates);
  const badges = () => page.evaluate(() => [...document.querySelectorAll('.tag.badge')]
    .filter(b => b.isConnected && b.style.display !== 'none' && parseFloat(b.style.opacity || '1') > 0.5)
    .map(b => { const r = b.getBoundingClientRect(); return { text: b.textContent, x: Math.round(r.left), y: Math.round(r.top) }; }));
  const shown = await badges();
  assert.deepEqual(shown.map(b => b.text), ['1'], 'the badge outlives its disposed anchor');
  await nextFrames(page, 10);
  assert.deepEqual(await badges(), shown, 'it stays at its last position');
  await page.evaluate(() => window.__explainer.run('s1'));
  assert.deepEqual(await badges(), [], 'reset removes it');
  assert.deepEqual(errors, []);
});

test('the saved split applies while the stage is loading and after a load failure', async t => {
  for (const [viewport, pct] of [[DESKTOP, 50], [{ width: 844, height: 390 }, 40]]) {
    await t.test(`${viewport.width}x${viewport.height}`, async t => {
      let release;
      const held = new Promise(r => { release = r; });
      const { page } = await openPage(t, 'template.html', { viewport, waitReady: false, storage: { 'plz-explain:split-x': String(pct) }, cdn: async () => { await held; return 'serve'; } });
      t.after(release);
      await page.waitForFunction(() => document.querySelector('.stage')?.dataset.state === 'loading'
        && document.querySelector('.split-v')?.hasAttribute('aria-valuenow'));
      const loading = await page.evaluate(() => ({ text: document.querySelector('.text').getBoundingClientRect().width, handle: document.querySelector('.split-v').getBoundingClientRect(), w: innerWidth }));
      const want = pct / 100 * loading.w;
      assert.ok(Math.abs(loading.text - want) < 2, `text column ${loading.text}px while loading, want ${want}px`);
      assert.ok(Math.abs(loading.handle.left + loading.handle.width / 2 - want) < 2, `divider at ${loading.handle.left + loading.handle.width / 2}px, want ${want}px`);
      release();
      await page.waitForFunction(() => document.querySelector('.stage')?.dataset.state === 'ready');
      assert.ok(Math.abs(await page.evaluate(() => document.querySelector('.text').getBoundingClientRect().width) - want) < 2, 'no jump at ready');
    });
  }
  await t.test('after a load failure (desktop)', async t => {
    const { page } = await openPage(t, 'template.html', { waitReady: false, storage: { 'plz-explain:split-x': '50' }, cdn: () => 'abort' });
    await page.waitForFunction(() => document.querySelector('.stage')?.dataset.state === 'failed');
    assert.ok(Math.abs(await page.evaluate(() => document.querySelector('.text').getBoundingClientRect().width) - 720) < 2);
  });
});

test('side-by-side windows narrower than 920px keep a working divider range', { timeout: 240_000 }, async t => {
  for (const file of examples) {
    for (const viewport of [{ width: 880, height: 800 }, { width: 844, height: 390 }]) {
      await t.test(`${file} ${viewport.width}x${viewport.height}`, async t => {
        const { page, errors } = await openPage(t, file, { viewport });
        await page.evaluate(() => window.__explainer.instant(true));
        const info = () => page.$eval('.split-v', h => ({ now: +h.getAttribute('aria-valuenow'), min: +h.getAttribute('aria-valuemin'), max: +h.getAttribute('aria-valuemax'), text: document.querySelector('.text').getBoundingClientRect().width, stage: document.querySelector('.stage').getBoundingClientRect().width }));
        const start = await info();
        assert.ok(start.min < start.max, `divider range ${start.min}-${start.max}`);
        assert.ok(start.min <= start.now && start.now <= start.max);
        await page.focus('.split-v'); await page.keyboard.press('Home'); await nextFrames(page);
        const lo = await info();
        await chapterChecks(page, `${viewport.width} min`);
        await page.focus('.split-v'); await page.keyboard.press('End'); await nextFrames(page);
        const hi = await info();
        await chapterChecks(page, `${viewport.width} max`);
        assert.ok(hi.text > lo.text + 40, `the divider moves the column (${lo.text} → ${hi.text})`);
        assert.equal(lo.now, lo.min); assert.equal(hi.now, hi.max);
        assert.deepEqual(errors, []);
      });
    }
  }
});

test('auto-play resume after a hidden tab does not reset a run that is still playing', { timeout: 60_000 }, async t => {
  const { page, errors } = await openPage(t, 'template.html');
  await page.evaluate(() => {
    document.querySelector('[data-scene="s1"].chapter').scrollIntoView({ block: 'center', behavior: 'instant' });
  });
  await page.waitForFunction(() => window.__explainer.current() === 's1' && scrollY > 40);
  await page.evaluate(() => window.__explainer.autorun(true));
  // First loop run ends: two captions, then the hold timer is pending.
  await page.waitForFunction(() => document.querySelectorAll('.rail-list .cap').length === 2);
  const setHidden = hidden => page.evaluate(h => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => h }); document.dispatchEvent(new Event('visibilitychange')); }, hidden);
  await setHidden(true);
  await page.evaluate(() => {
    window.__clears = 0;
    const list = document.querySelector('.rail-list');
    let had = list.children.length;
    window.__mo = new MutationObserver(() => { if (list.children.length === 0 && had > 0) window.__clears += 1; had = list.children.length; });
    window.__mo.observe(list, { childList: true });
    document.querySelector('[data-run="s1"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  // Show the tab while the button run is still playing (it has said its first caption and has more steps to go).
  await page.waitForFunction(() => document.querySelectorAll('.rail-list .cap').length === 1);
  await setHidden(false);
  // The button run must reach its last caption without the rail being cleared under it.
  await page.waitForFunction(() => document.querySelectorAll('.rail-list .cap').length === 2, null, { timeout: 15_000 });
  // (Clearing at the start of the button run is batched with its first caption, so the observer never sees an empty rail for it.)
  assert.equal(await page.evaluate(() => window.__clears), 0, 'the rail was emptied under the button run');
  await page.evaluate(() => window.__explainer.autorun(false));
  assert.deepEqual(errors, []);
});
