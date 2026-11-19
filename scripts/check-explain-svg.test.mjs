// Browser checks for the plz-explain `svg` kit (2D step diagrams): kit loading, kit switching on a mixed page,
// the timing contract (run, reset, instant, reduced motion, speed, mid-run split drag), layout checks at every size,
// scale on a large stage, and part states restored by reset.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { launchBrowser, nextFrames, openExplainPage, railTexts, sleep, startPageServer, variantWithScenes, withoutKit } from './browser-harness.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const assets = join(root, 'skills/plz-explain/assets');
const DESKTOP = { width: 1440, height: 900 };
// Shipped example pages drawn only by the svg kit.
const SVG_EXAMPLES = ['example-hash-join-sip.html', 'example-hash-join-sip.en.html'];
let browser, server, origin;

// Scenes that use every svg part: a row-level step diagram with a filter (s1), side-by-side panels fed by one trigger (s2),
// and an operator tree next to node columns (s3).
const SVG_SCENES = `
const KEYS = [8, 17, 23, 31, 42, 56], IN = [17, 42], HIT = KEYS.map(k => IN.includes(k));
defineScene('s1', {
  kit: 'svg',
  title: '1  Filter before the join',
  build(d) {
    const inner = d.table({ title: 'Inner table', keys: IN, tone: 'matter', header: ['key', 'rest'] });
    const outer = d.table({ title: 'Outer table', keys: KEYS, header: ['key', 'rest'] });
    const hash = d.buckets({ title: 'Hash table (key mod 4)', count: 4, label: b => 'bucket ' + b, short: b => '#' + b });
    const join = d.box({ title: 'Join', lanes: KEYS.length, header: ['rows', 'lookup'], counter: 'Join input {n}', tally: 'Dropped {n}' });
    const gate = d.gate(outer, { label: 'Filter', pass: 'Pass: ' + IN.join(' · '), hidden: true });
    d.link([inner.right(hash.left()), hash.left()]);
    KEYS.forEach((k, i) => d.link([outer.out(i), gate.in(i)]));
    const post = KEYS.map((k, i) => d.link([gate.out(i), join.in(i)]));
    const sip = d.link([hash.left(0.15), d.corner(hash.left(0.15), gate.top()), gate.top()], { dashed: true, tone: 'bound', label: 'SIP', hidden: true });
    window.__parts = { ...window.__parts, inner, outer, hash, join, gate };
    return {
      diagram: d.grid([[inner, hash], [outer, join]]),
      async run(a, say) {
        const ins = IN.map((k, i) => d.token(k, inner.src(i), { tone: 'matter' }));
        await Promise.all(ins.map((t, i) => a.along(t, [inner.src(i), hash.left(), hash.slot(IN[i] % 4)])));
        IN.forEach(k => hash.fill(k % 4));
        await a.flash(hash);
        say('1. The keys built the hash table.', { anchor: hash });
        await a.wait(600);
        await Promise.all([a.fade(gate, 1), a.fade(sip, 1)]);
        say('2. The filter went up beside the scan.', { anchor: gate });
        await a.wait(600);
        const rows = [];
        let dropped = 0, passed = 0;
        await a.groups(KEYS.map((k, i) => i), async i => {
          rows[i] = d.token(KEYS[i], outer.src(i));
          await a.along(rows[i], [outer.src(i), gate.before(i)]);
          if (HIT[i]) return;
          outer.row(i).mark('gone');
          join.tally(++dropped); a.tick(join.tallyNode);
          await Promise.all([a.fade(rows[i], 0), a.fade(post[i], 0.12)]);
        }, { size: 3, pause: 300 });
        say('3. Rows without a match were dropped at the filter.', { anchor: join.tallyNode });
        await a.groups(KEYS.map((k, i) => i).filter(i => HIT[i]), async i => {
          await a.along(rows[i], [gate.before(i), gate.after(i), join.chip(i)]);
          outer.row(i).mark('hit'); rows[i].mark('hit');
          join.count(++passed); a.tick(join.counterNode);
          join.laneText(i, 'bucket ' + (KEYS[i] % 4) + ' match', { short: '#' + (KEYS[i] % 4), tone: 'actor' });
          await a.fade(join.lane(i), 1, 150);
        });
        say('Only the matching rows reached the join.');
      },
    };
  },
});
defineScene('s2', {
  kit: 'svg',
  title: '2  Same input, filter off and on',
  build(d) {
    const side = filter => {
      const t = d.table({ title: 'Scan', keys: [8, 17, 23], header: ['key', 'rest'] });
      const b = d.box({ title: 'Join', lanes: 3, counter: 'in {n}' });
      const g = filter ? d.gate(t, { label: 'Filter', pass: 'Pass: 17' }) : null;
      [0, 1, 2].forEach(i => (g ? (d.link([t.out(i), g.in(i)]), d.link([g.out(i), b.in(i)])) : d.link([t.out(i), b.in(i)])));
      return { t, b, g, grid: d.grid([[t, b]]) };
    };
    const off = side(false), on = side(true);
    const play = async (a, s) => {
      let n = 0;
      await a.groups([0, 1, 2], async i => {
        const tok = d.token([8, 17, 23][i], s.t.src(i));
        if (s.g && i !== 1) { await a.along(tok, [s.t.src(i), s.g.before(i)]); s.t.row(i).mark('gone'); await a.fade(tok, 0); return; }
        await a.along(tok, s.g ? [s.t.src(i), s.g.before(i), s.g.after(i), s.b.chip(i)] : [s.t.src(i), s.b.chip(i)]);
        s.b.count(++n); a.tick(s.b.counterNode);
      });
    };
    return {
      diagram: d.panels([{ title: 'Filter off', body: off.grid }, { title: 'Filter on', body: on.grid }]),
      async run(a, say) {
        say('1. The same three rows went to both sides.');
        await Promise.all([play(a, off), play(a, on)]);
        say('2. Without the filter the join got 3 rows; with it, 1.', { anchor: on.b });
      },
    };
  },
});
defineScene('s3', {
  kit: 'svg',
  title: '3  Plan and nodes',
  build(d) {
    const tree = d.tree({ id: 'del', label: 'DELETE', metric: '2 rows', children: [
      { id: 'join', label: 'Hash join', metric: '2 rows', children: [{ id: 'scanA', label: 'Scan target', metric: '6 rows' }, { id: 'scanB', label: 'Scan temp', metric: '2 rows' }] },
    ] });
    const nodes = d.columns(['Node 1', 'Node 2', 'Node 3'], { slots: 3 });
    window.__parts = { ...window.__parts, tree, nodes };
    return {
      diagram: d.stack([tree, nodes], { dir: 'row' }),
      async run(a, say) {
        tree.node('scanA').mark('active');
        // A count chip travels up the drawn edge to the parent; its width follows its text.
        const count = d.token('6 rows read', tree.edge('scanA')[0]);
        await a.along(count, tree.edge('scanA'));
        window.__edgeToken = count;
        await a.fade(count, 0, 150); // the count is handed on: the chip leaves (its position stays measurable)
        say('1. The scan read 6 rows.', { anchor: tree.node('scanA') });
        await a.wait(400);
        tree.node('scanA').mark('active', false);
        tree.node('join').mark('active');
        tree.node('join').metric('kept 2'); // node text stays short: it must fit the node on phones
        say('2. The join kept 2.', { anchor: tree.node('join') });
        const toks = [17, 42].map((k, i) => d.token(k, nodes.col(0).slot(i)));
        await a.fade(toks[1], 0.3); // a dimmed token keeps its opacity while it moves (reduced motion included)
        await a.groups(toks, (t, i) => a.along(t, [nodes.col(0).slot(i), nodes.col(i + 1).slot(0)]));
        window.__tokOpacity = toks[1].g.style.opacity;
        say('3. Each row moved to the node that owns its key.', { anchor: [12, 12] }); // a badge at a fixed point
      },
    };
  },
});
`;

// Long Korean text in every framed label: counters, tally, gate chip, link label, lane text.
const KO_SCENES = `
defineScene('s1', { kit: 'svg', title: '1  한국어 라벨', build(d) {
  const t = d.table({ title: '바깥쪽: 대상 테이블', keys: [8, 17, 23], header: ['키', '나머지 열'] });
  const b = d.box({ title: '', lanes: 3, header: ['받은 행', '해시 조회'], counter: '조인 입력 {n}행 (예상보다 많음)', tally: '버려진 행 {n}개' });
  const g = d.gate(t, { label: 'SIP 필터 (런타임 필터)', pass: '통과: 17 · 42 · 108 · 2048' });
  [0, 1, 2].forEach(i => { d.link([t.out(i), g.in(i)]); d.link([g.out(i), b.in(i)]); });
  d.link([b.right(0.2), d.corner(b.right(0.2), g.top()), g.top()], { dashed: true, tone: 'bound', label: '사이드웨이 정보 전달' });
  return { diagram: d.grid([[t, b]]), async run(a, say) {
    b.count(2); b.tally(1);
    b.laneText(0, '버킷 0 ✕ 짝 없음', { short: '버킷 0 ✕' }); await a.fade(b.lane(0), 1);
    say('조인 입력과 버려진 행을 셌습니다.');
  } };
} });
defineScene('s2', { kit: 'svg', title: '2  빈 장', build(d) { const t = d.table({ title: '표', keys: [1] }); return { diagram: d.grid([[t]]), async run(a, say) { say('끝.'); } }; } });
defineScene('s3', { kit: 'svg', title: '3  빈 장', build(d) { const t = d.table({ title: '표', keys: [1] }); return { diagram: d.grid([[t]]), async run(a, say) { say('끝.'); } }; } });
`;
// Two compact panels (key-only tables, narrow boxes) that fit side by side on a landscape phone.
const NARROW_SCENES = `
const KEYS = [8, 17, 23, 31, 42, 56];
defineScene('s1', { kit: 'svg', title: '1  Narrow panels', build(d) {
  const side = f => { const t = d.table({ title: 'Scan', keys: KEYS, payload: false }); const b = d.box({ title: 'Join', lanes: 6, counter: 'in {n}', narrow: true });
    const g = f ? d.gate(t, { label: 'Filter', pass: '17 · 42' }) : null;
    KEYS.forEach((k, i) => (g ? (d.link([t.out(i), g.in(i)]), d.link([g.out(i), b.in(i)])) : d.link([t.out(i), b.in(i)])));
    return d.grid([[t, b]]); };
  window.__panels = d.panels([{ title: 'Off', body: side(false) }, { title: 'On', body: side(true) }]);
  return { diagram: window.__panels, async run(a, say) { say('Done.'); } };
} });
// A diagram that is a single part (a tree), not a container.
defineScene('s2', { kit: 'svg', title: '2  Plan only', build(d) {
  const plan = d.tree({ id: 'j', label: 'Join', metric: '2 rows', children: [{ id: 'a', label: 'Scan A', metric: '6' }, { id: 'b', label: 'Scan B', metric: '2' }] });
  return { diagram: plan, async run(a, say) { say('Done.'); } };
} });
// A gate chip next to a tally pill that is wider than its narrow box (on a phone the two frames meet),
// and a gate with neither label nor pass, which has no chip.
defineScene('s3', { kit: 'svg', title: '3  Chip and tally', build(d) {
  const t = d.table({ title: 'Scan', keys: KEYS, payload: false });
  const b = d.box({ title: '', lanes: 6, counter: 'in {n}', tally: '스캔에서 버림 {n}', narrow: true });
  d.gate(t, { label: 'SIP 필터', pass: '통과: 17 · 42 · 108' });
  const t2 = d.table({ title: 'Scan 2', keys: [1, 2], payload: false });
  const b2 = d.box({ title: '', lanes: 2, narrow: true });
  window.__chipless = d.gate(t2, {});
  return { diagram: d.grid([[t, b], [t2, b2]]), async run(a, say) { b.tally(4); say('Done.'); } };
} });
`;
// Panels on their own (s1) and nested in a column with a table below (s2): size() must agree with what place() does.
const LAYOUT_SCENES = `
const KEYS = [8, 17, 23, 31, 42, 56];
const panelsOf = d => d.panels([0, 1].map(f => {
  const t = d.table({ title: 'Scan', keys: KEYS, payload: false }), b = d.box({ title: '', lanes: 6, counter: 'in {n}', narrow: true });
  const g = f ? d.gate(t, {}) : null;
  KEYS.forEach((k, i) => (g ? (d.link([t.out(i), g.in(i)]), d.link([g.out(i), b.in(i)])) : d.link([t.out(i), b.in(i)])));
  return { title: f ? 'On' : 'Off', body: d.grid([[t, b]]) };
}));
defineScene('s1', { kit: 'svg', title: '1  Panels', build(d) { const p = panelsOf(d); return { diagram: p, async run(a, say) { say('Done.'); } }; } });
defineScene('s2', { kit: 'svg', title: '2  Panels and a table', build(d) {
  window.__below = d.table({ title: 'Below', keys: [1, 2], payload: false });
  return { diagram: d.stack([panelsOf(d), window.__below], { dir: 'col' }), async run(a, say) { say('Done.'); } };
} });
defineScene('s3', { kit: 'svg', title: '3', build(d) { return { diagram: d.grid([[d.table({ title: 'T', keys: [1] })]]), async run(a, say) { say('Done.'); } }; } });
`;
// Wide tokens at resting points (s1), a token too wide for its bucket (s2), table headers and gate chips (s3).
const TOKEN_SCENES = `
defineScene('s1', { kit: 'svg', title: '1  Wide tokens', build(d) {
  const t = d.table({ title: 'Orders', keys: [8, 17], header: ['key', 'rest'] }), b = d.box({ title: 'Join', lanes: 2, header: ['in', 'lookup'] });
  const g = d.gate(t, { label: 'Filter', pass: 'pass: 17' });
  [0, 1].forEach(i => { d.link([t.out(i), g.in(i)]); d.link([g.out(i), b.in(i)]); });
  window.__w = { t, b, g };
  return { diagram: d.grid([[t, b]]), async run(a, say) {
    window.__w.atGate = d.token('order-000008', t.src(0)); await a.along(window.__w.atGate, [t.src(0), g.before(0)]);
    window.__w.inBox = d.token('order-000017', t.src(1)); await a.along(window.__w.inBox, [t.src(1), g.before(1), g.after(1), b.chip(1)]);
    say('Done.');
  } };
} });
defineScene('s2', { kit: 'svg', title: '2  Too wide for its bucket', build(d) {
  const h = d.buckets({ title: 'Hash', count: 4 });
  return { diagram: d.grid([[h]]), async run(a, say) { const tk = d.token('a-very-long-key-0042', h.slot(2)); window.__slotToken = tk; say('Done.'); } };
} });
defineScene('s3', { kit: 'svg', title: '3  Headers and chips', build(d) {
  const keyOnly = d.table({ title: 'Key only', keys: [1, 2], header: ['key', 'rest'], payload: false });
  const bare = d.table({ title: 'No header', keys: [1, 2] });
  const b1 = d.box({ title: '', lanes: 2, narrow: true }), b2 = d.box({ title: '', lanes: 2, narrow: true });
  const g = d.gate(keyOnly, { label: 'Filter' });   // a label but no pass list
  window.__h = { keyOnly, bare, g };
  return { diagram: d.grid([[keyOnly, b1], [bare, b2]]), async run(a, say) { say('Done.'); } };
} });
`;
const BAD_EDGE = `
defineScene('s1', { kit: 'svg', title: '1', build(d) { const tr = d.tree({ id: 'a', label: 'A', children: [{ id: 'b', label: 'B' }] }); tr.edge('nope'); return { diagram: tr, async run() {} }; } });
`;
const MISSING_KIT = `
defineScene('s1', { kit: 'axo', title: '1', build() { return { reset() {}, async run() {} }; } });
`;
const AXO_TOPLEVEL = `
const FLOOR = 0.6;
base.add(block(13, FLOOR, 8, [0, 0, 0], { color: COLOR.boundSoft }));
defineScene('s1', { kit: 'svg', title: '1', build(d) { const t = d.table({ title: 'T', keys: [1, 2] }); return { diagram: d.grid([[t]]), async run() {} }; } });
`;
const ES_NOTES = { noteWide: 'ES ancho: el botón de cada capítulo', noteNarrow: 'ES estrecho: el botón de cada capítulo' };
// The page in language `lang` with UI_OVERRIDES[lang] = strings.
function withOverrides(source, lang, strings) {
  const out = source.replace('<html lang="en">', `<html lang="${lang}">`).replace('window.UI_OVERRIDES = {', `window.UI_OVERRIDES = {\n  ${lang}: ${JSON.stringify(strings)},`);
  assert.ok(out.includes(`<html lang="${lang}">`) && out.includes(`${lang}: {`), 'override fixture');
  return out;
}
const BAD_GATE = `
defineScene('s1', { kit: 'svg', title: '1', build(d) { const b = d.box({ title: 'Join', lanes: 2 }); const t = d.table({ title: 'T', keys: [1, 2] }); d.gate(t, { label: 'F' }); return { diagram: d.grid([[b, t]]), async run() {} }; } });
`;
const BAD_LINK = `
defineScene('s1', { kit: 'svg', title: '1', build(d) { const t = d.table({ title: 'T', keys: [1, 2] }); d.link([t.out(0)]); return { diagram: d.grid([[t]]), async run() {} }; } });
`;

before(async () => {
  const tpl = await readFile(join(assets, 'template.html'), 'utf8');
  const variants = {
    'variant-svg-only.html': variantWithScenes(tpl, SVG_SCENES, 'svg'),
    ...Object.fromEntries(['ko', 'ja', 'zh-CN'].map(lang => [`variant-svg-only.${lang}.html`, variantWithScenes(tpl, SVG_SCENES, 'svg').replace('<html lang="en">', `<html lang="${lang}">`)])),
    'variant-svg-ko.html': variantWithScenes(tpl, KO_SCENES, 'svg').replace('<html lang="en">', '<html lang="ko">'),
    'variant-svg-bad-gate.html': variantWithScenes(tpl, BAD_GATE, 'svg'),
    'variant-svg-narrow.html': variantWithScenes(tpl, NARROW_SCENES, 'svg'),
    'variant-svg-layout.html': variantWithScenes(tpl, LAYOUT_SCENES, 'svg'),
    'variant-svg-tokens.html': variantWithScenes(tpl, TOKEN_SCENES, 'svg'),
    'variant-svg-bad-edge.html': variantWithScenes(tpl, BAD_EDGE, 'svg'),
    // An svg-only page (axo sections deleted) whose scene asks for the axo kit.
    'variant-missing-kit.html': withoutKit(variantWithScenes(tpl, MISSING_KIT, 'svg'), 'axo'),
    'variant-svg-bad-link.html': variantWithScenes(tpl, BAD_LINK, 'svg'),
    // The realistic mistake: the template with its axo sections deleted (data-kits updated or not) and its SCENES left as they are.
    'variant-axo-deleted.html': withoutKit(tpl, 'axo').replace('data-kits="axo svg"', 'data-kits="svg"'),
    'variant-axo-deleted-listed.html': withoutKit(tpl, 'axo'),
    // Older-style SCENES that use axo globals at the top level, on a page without axo.
    'variant-axo-toplevel.html': withoutKit(variantWithScenes(tpl, AXO_TOPLEVEL, 'svg'), 'axo'),
    // A page in a language outside the built-in ones, with its own note strings.
    'variant-es-svg.html': withOverrides(variantWithScenes(tpl, SVG_SCENES, 'svg'), 'es', ES_NOTES),
    'variant-es-svg-steps.html': withOverrides(variantWithScenes(tpl, SVG_SCENES, 'svg'), 'es', { ...ES_NOTES, noteSteps: 'ES pasos' }),
    'variant-es-mixed.html': withOverrides(tpl, 'es', ES_NOTES),
    // data-kits lists a kit no scene uses.
    'variant-unused-kit.html': variantWithScenes(tpl, SVG_SCENES, 'axo svg'),
  };
  server = await startPageServer(path => variants[path] ?? (['template.html', 'example-agent-sandbox.en.html', ...SVG_EXAMPLES].includes(path) ? readFile(join(assets, path)) : null));
  origin = server.origin;
  browser = await launchBrowser();
}, { timeout: 30_000 });

after(async () => {
  await browser?.close();
  await server?.close();
}, { timeout: 15_000 });

const openPage = (t, file, opts) => openExplainPage(browser, origin, t, file, opts);

// Classes of every part element and the opacity of every link: the visible state of a diagram (also defined in the page as __partState).
const PART_STATE = () => {
  const sceneEl = [...document.querySelectorAll('.svg-scene')].find(g => g.style.display !== 'none');
  return [...sceneEl.querySelectorAll('.parts *, .flows > g')].map(n => `${n.getAttribute('class') ?? ''}|${n.style.opacity}`).join('\n');
};
const partState = page => page.evaluate(PART_STATE);
const stampRun = (page, name, speed = 1) => page.evaluate(async ([name, speed]) => {
  window.__explainer.speed(speed);
  const list = document.querySelector('.rail-list'), stamps = [];
  const mo = new MutationObserver(() => stamps.push(performance.now()));
  mo.observe(list, { childList: true, subtree: true, characterData: true });
  const text = await window.__explainer.run(name);
  mo.disconnect();
  const timing = window.__explainer.timing();
  window.__explainer.speed(1);
  return { text, timing, firstToLast: Math.round(stamps.at(-1) - stamps[0]), moments: new Set(stamps.map(s => Math.round(s / 60))).size };
}, [name, speed]);

test('an svg-only page never requests three.js and hides rotation controls', async t => {
  const { page, errors, threeRequests } = await openPage(t, 'variant-svg-only.html');
  for (const name of ['s1', 's2', 's3']) {
    const text = await page.evaluate(n => window.__explainer.run(n), name);
    assert.ok(text.length > 0, `${name} final caption`);
    const labels = await page.evaluate(() => [...document.querySelectorAll('.svg-scene text')].filter(n => n.textContent.trim()).length);
    assert.ok(labels > 5, `${name} draws labels`);
  }
  assert.deepEqual(threeRequests, []);
  assert.equal(await page.locator('.hint').isVisible(), false);
  assert.equal(await page.locator('.reset-view').isVisible(), false);
  assert.deepEqual(errors, []);
});

test('a mixed page switches between the axo and svg kits on chapter change', async t => {
  const { page, errors, threeRequests } = await openPage(t, 'template.html');
  const layers = () => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('.kit-layer')].map(l => [l.dataset.kit, !l.hidden])));
  await page.evaluate(() => window.__explainer.run('s3'));
  assert.deepEqual(await layers(), { axo: false, svg: true });
  assert.equal(await page.locator('.hint').isVisible(), false);
  await page.evaluate(() => window.__explainer.run('s1'));
  assert.deepEqual(await layers(), { axo: true, svg: false });
  assert.equal(await page.locator('.hint').isVisible(), true);
  assert.ok(threeRequests.length > 0);
  assert.deepEqual(errors, []);
});

test('svg runs: instant mode reaches the same end state, and reset restores every part (dimmed connectors included)', { timeout: 60_000 }, async t => {
  const { page, errors } = await openPage(t, 'variant-svg-only.html');
  const fresh = await partState(page);
  const normal = await page.evaluate(() => window.__explainer.run('s1'));
  const caps = await railTexts(page), end = await partState(page);
  const dimmed = await page.evaluate(() => [...document.querySelectorAll('.svg-scene .flows > g')].filter(g => parseFloat(g.style.opacity) < 0.2).length);
  assert.equal(dimmed, 4, 'the four dropped rows dim their connector past the filter');
  const badges = await page.evaluate(() => [...document.querySelectorAll('.svg-scene .sb')].filter(b => b.style.opacity !== '0').map(b => b.textContent));
  assert.deepEqual(badges, ['1', '2', '3'], 'say(…, { anchor }) puts numbered badges on svg parts');
  await page.evaluate(() => window.__explainer.instant(true));
  assert.equal(await page.evaluate(() => window.__explainer.run('s1')), normal);
  assert.deepEqual(await railTexts(page), caps);
  assert.equal(await partState(page), end);
  await page.evaluate(() => window.__explainer.instant(false));
  // A new run starts from the reset state: nothing dimmed, no row marked, no token left. The state is captured in the page
  // at the moment reset clears the rail (before the run's first step can change anything), so machine load cannot shift it.
  const atReset = await page.evaluate(async src => {
    const state = new Function(`return (${src})()`);
    const list = document.querySelector('.rail-list');
    let snap = null;
    const mo = new MutationObserver(() => {
      if (snap === null && list.children.length === 0) snap = { parts: state(), tokens: document.querySelectorAll('.svg-scene .tok').length };
    });
    mo.observe(list, { childList: true });
    await window.__explainer.run('s1');
    mo.disconnect();
    return snap;
  }, PART_STATE.toString());
  assert.ok(atReset, 'the rail was cleared when the run started');
  assert.equal(atReset.parts, fresh, 'reset restores the initial state of every part');
  assert.ok(atReset.tokens <= 2, `only the new run's first tokens exist (${atReset.tokens})`);
  assert.deepEqual(errors, []);
});

test('svg timing: speed scales the run, and reduced motion keeps captions arriving one by one', { timeout: 90_000 }, async t => {
  const { page, errors, close } = await openPage(t, 'variant-svg-only.html');
  const x1 = await stampRun(page, 's1', 1), x2 = await stampRun(page, 's1', 2);
  // The director's own timeline is load-independent; the wall clock gets a loose check only.
  assert.ok(x1.timing.base > 1000 && x2.timing.base === x1.timing.base, JSON.stringify([x1.timing, x2.timing]));
  assert.ok(Math.abs(x1.timing.scaled / x2.timing.scaled - 2) < 0.02, `2× halves the schedule (${x1.timing.scaled} / ${x2.timing.scaled})`);
  assert.ok(x1.firstToLast > x2.firstToLast * 1.1, `2× is also faster on the wall clock (${x1.firstToLast} / ${x2.firstToLast} ms)`);
  assert.equal(x2.text, x1.text);
  await close();
  const reduced = await openPage(t, 'variant-svg-only.html', { reducedMotion: 'reduce' });
  const r = await stampRun(reduced.page, 's1', 1);
  assert.equal(r.text, x1.text);
  assert.ok(r.timing.scaled >= r.timing.base * 0.99, `reduced motion keeps every step's time (${JSON.stringify(r.timing)})`);
  assert.ok(r.firstToLast > 1500 && r.moments >= 4, `reduced motion kept the steps apart: ${JSON.stringify(r)}`);
  assert.deepEqual([...errors, ...reduced.errors], []);
});

test('svg: dragging the split mid-run keeps the run, and tokens continue on the new layout', { timeout: 60_000 }, async t => {
  const { page, errors } = await openPage(t, 'variant-svg-only.html');
  const ref = await page.evaluate(() => window.__explainer.run('s1'));
  const refCaps = await railTexts(page);
  await page.evaluate(() => { window.__drag = window.__explainer.run('s1'); });
  await page.waitForFunction(() => document.querySelectorAll('.rail-list .cap').length >= 2);
  const h = await page.$eval('.split-v', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: innerHeight / 2 }; });
  await page.mouse.move(h.x, h.y); await page.mouse.down();
  for (let i = 1; i <= 10; i++) { await page.mouse.move(h.x + (i % 2 ? -1 : 1) * i * 20, h.y); await sleep(60); } // pacing a user's drag
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.__drag), ref);
  assert.deepEqual(await railTexts(page), refCaps);
  assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
  assert.deepEqual(errors, []);
});

// Smallest rendered label size (font-size × diagram scale) among visible svg labels.
const minFont = page => page.evaluate(() => {
  const k = window.__explainer.kitInfo()?.scale ?? 1;
  const sizes = [...document.querySelectorAll('.svg-scene text')].filter(n => n.textContent.trim() && n.getBoundingClientRect().width > 0)
    .filter(n => { for (let e = n; e && e.tagName !== 'svg'; e = e.parentNode) { const cs = getComputedStyle(e); if (cs.display === 'none' || parseFloat(cs.opacity) < 0.05) return false; } return true; })
    .map(n => parseFloat(getComputedStyle(n).fontSize) * k);
  return Math.min(...sizes);
});
async function svgChapterChecks(page, tag, { phone }) {
  for (const n of await page.evaluate(() => window.__explainer.scenes())) {
    const r = await page.evaluate(async n => { const text = await window.__explainer.run(n); return { text, kit: window.__explainer.kitInfo(), overlaps: window.__explainer.overlaps(), clipped: window.__explainer.clipped() }; }, n);
    if (r.kit?.scale === undefined) continue; // an axo chapter of the mixed template
    assert.ok(r.text.length > 0, `${tag} ${n}: final caption`);
    assert.deepEqual(r.overlaps, [], `${tag} ${n}: overlaps`);
    assert.deepEqual(r.clipped, [], `${tag} ${n}: clipped`);
    const f = await minFont(page);
    assert.ok(f >= (phone ? 11 : 12) - 0.01, `${tag} ${n}: smallest label ${f}px`);
    if (phone && (await page.evaluate(() => document.querySelector('.rail').classList.contains('compact')))) {
      await page.evaluate(() => window.__explainer.rail(true));
      assert.deepEqual(await page.evaluate(() => window.__explainer.clipped()), [], `${tag} ${n}: clipped with the sheet open`);
      await page.evaluate(() => window.__explainer.rail(false));
    }
  }
}

for (const file of ['variant-svg-only.html', 'template.html', ...SVG_EXAMPLES]) {
  test(`${file}: svg chapters have no overlaps or clipped labels at every size, and scale up on a large stage`, { timeout: 240_000 }, async t => {
    await t.test('1440x900 default, min and max split', async t => {
      const { page, errors } = await openPage(t, file);
      await page.evaluate(() => window.__explainer.instant(true));
      await svgChapterChecks(page, 'default', { phone: false });
      const k = await page.evaluate(async () => { await window.__explainer.run('s3'); return window.__explainer.kitInfo().scale; });
      assert.ok(k >= 1, `scale ${k} at 1440x900`);
      for (const key of ['Home', 'End']) {
        await page.focus('.split-v'); await page.keyboard.press(key); await nextFrames(page);
        await svgChapterChecks(page, key === 'Home' ? 'min' : 'max', { phone: false });
      }
      assert.deepEqual(errors, []);
    });
    await t.test('2282x1293', async t => {
      const { page, errors } = await openPage(t, file, { viewport: { width: 2282, height: 1293 } });
      await page.evaluate(() => window.__explainer.instant(true));
      await svgChapterChecks(page, '2282', { phone: false });
      const k = await page.evaluate(async () => { await window.__explainer.run('s3'); return window.__explainer.kitInfo().scale; });
      assert.ok(k > 1.15 && k <= 1.6, `scale ${k} grows on a large stage`);
      assert.deepEqual(errors, []);
    });
    for (const viewport of [{ width: 390, height: 844 }, { width: 360, height: 800 }, { width: 844, height: 390 }]) {
      await t.test(`${viewport.width}x${viewport.height}`, async t => {
        const { page, errors } = await openPage(t, file, { viewport });
        await page.evaluate(() => window.__explainer.instant(true));
        await svgChapterChecks(page, `${viewport.width}x${viewport.height}`, { phone: true });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth === innerWidth), true);
        assert.deepEqual(errors, []);
      });
    }
  });
}

// Text wider than its frame: every framed svg label (pills, gate chip, link label, lane text in its box).
const frameOverflow = page => page.evaluate(() => {
  const sceneEl = [...document.querySelectorAll('.svg-scene')].find(g => g.style.display !== 'none');
  const out = [];
  const check = (text, frame) => {
    if (!text?.textContent.trim() || getComputedStyle(text).opacity === '0') return;
    const a = text.getBoundingClientRect(), b = frame.getBoundingClientRect();
    if (a.width && (a.left < b.left - 0.5 || a.right > b.right + 0.5)) out.push(text.textContent);
  };
  sceneEl.querySelectorAll('.pill').forEach(p => check(p.querySelector('text'), p.querySelector('rect')));
  sceneEl.querySelectorAll('.gate').forEach(g => g.querySelectorAll('text').forEach(t => check(t, g.querySelector('.chip'))));
  sceneEl.querySelectorAll('.opbox').forEach(b => b.querySelectorAll(':scope > text.meta').forEach(t => check(t, b.querySelector('.box'))));
  return out;
});

test('B1: framed labels grow with their text (Korean), and clipped() reports text wider than its frame', async t => {
  for (const viewport of [DESKTOP, { width: 390, height: 844 }]) {
    await t.test(`${viewport.width}x${viewport.height}`, async t => {
      const { page, errors } = await openPage(t, 'variant-svg-ko.html', { viewport });
      await page.evaluate(() => window.__explainer.run('s1'));
      assert.deepEqual(await frameOverflow(page), [], 'no text wider than its frame');
      assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
      // clipped() itself catches an overflow: squeeze a pill frame and look again.
      const reported = await page.evaluate(() => {
        const r = [...document.querySelectorAll('.svg-scene')].find(g => g.style.display !== 'none').querySelector('.pill.counter rect');
        r.setAttribute('width', 20);
        return window.__explainer.clipped();
      });
      assert.ok(reported.some(text => text.includes('조인 입력')), `clipped() reports the overflowing pill text: ${JSON.stringify(reported)}`);
      // A frame too short for its text is reported as well.
      const short = await page.evaluate(() => {
        const r = [...document.querySelectorAll('.svg-scene')].find(g => g.style.display !== 'none').querySelector('.pill.tally rect');
        r.setAttribute('width', 400); r.setAttribute('height', 4);
        return window.__explainer.clipped();
      });
      assert.ok(short.some(text => text.includes('버려진 행')), `clipped() reports text taller than its frame: ${JSON.stringify(short)}`);
      assert.deepEqual(errors, []);
    });
  }
});

test('B2: reset clears lane text set during the previous run', async t => {
  const { page, errors } = await openPage(t, 'variant-svg-only.html');
  await page.evaluate(() => window.__explainer.instant(true));
  await page.evaluate(() => window.__explainer.run('s1'));
  const atReset = await page.evaluate(async () => {
    const list = document.querySelector('.rail-list');
    let snap = null;
    const lanes = () => [...window.__parts.join.g.querySelectorAll(':scope > text.meta')].slice(2).map(n => n.textContent);
    const mo = new MutationObserver(() => { if (snap === null && list.children.length === 0) snap = lanes(); });
    mo.observe(list, { childList: true });
    window.__explainer.instant(false);
    window.__explainer.speed(2);
    await window.__explainer.run('s1');
    mo.disconnect();
    return snap;
  });
  assert.ok(atReset.length === 6 && atReset.every(text => text === ''), `lane text after reset: ${JSON.stringify(atReset)}`);
  assert.deepEqual(errors, []);
});

test('B3: the stage-height minimum follows the chapter (svg diagrams are never cut off on phones)', async t => {
  await t.test('shrunk on a short chapter, then a tall one', async t => {
    const { page, errors } = await openPage(t, 'variant-svg-only.html', { viewport: { width: 390, height: 844 } });
    await page.evaluate(() => window.__explainer.instant(true));
    await page.evaluate(() => window.__explainer.run('s3'));
    await page.focus('.split-h'); await page.keyboard.press('Home'); await nextFrames(page);
    await page.evaluate(() => window.__explainer.run('s1'));
    assert.deepEqual(await page.evaluate(() => window.__explainer.clipped()), [], 'the tall diagram fits after the chapter change');
    assert.deepEqual(errors, []);
  });
  await t.test('no saved height on a short phone', async t => {
    const { page, errors } = await openPage(t, 'variant-svg-only.html', { viewport: { width: 360, height: 600 } });
    await page.evaluate(() => window.__explainer.instant(true));
    await page.evaluate(() => window.__explainer.run('s1'));
    assert.deepEqual(await page.evaluate(() => window.__explainer.clipped()), [], 'the default stage grows to the diagram\'s minimum');
    assert.deepEqual(errors, []);
  });
});

test('B4: a gate sits in its grid gutter, and an unsupported placement fails with a clear error', async t => {
  const good = await openPage(t, 'variant-svg-only.html');
  await good.page.evaluate(() => window.__explainer.run('s1'));
  const pos = await good.page.evaluate(() => {
    const P = window.__parts, b = P.gate.g.querySelector('.barrier').getBoundingClientRect();
    return { barrier: b.left + b.width / 2, left: P.outer.g.querySelector('.tbl').getBoundingClientRect().right, right: P.join.g.querySelector('.box').getBoundingClientRect().left };
  });
  assert.ok(Math.abs(pos.barrier - (pos.left + pos.right) / 2) < 1, `the gate is centered in the gutter: ${JSON.stringify(pos)}`);
  await good.close();
  const { page, errors } = await openPage(t, 'variant-svg-bad-gate.html', { waitReady: false });
  await page.waitForFunction(() => document.querySelector('.stage')?.dataset.state === 'failed');
  assert.ok(errors.some(e => /d\.gate.*gutter/i.test(e)), `clear error: ${JSON.stringify(errors)}`);
});

test('B5: reduced motion keeps a token\'s opacity while it moves', async t => {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const { page, close } = await openPage(t, 'variant-svg-only.html', { reducedMotion });
    await page.evaluate(() => window.__explainer.run('s3'));
    assert.equal(await page.evaluate(() => window.__tokOpacity), '0.3', `${reducedMotion}: the faded token stays at 0.3`);
    await close();
  }
});

test('B6: the ink-outline emphasis (mark(\'on\') / a.flash) shows on every part type', async t => {
  const { page, errors } = await openPage(t, 'variant-svg-only.html');
  await page.evaluate(() => window.__explainer.instant(true)); // no CSS transitions: the computed stroke is the final one
  const ink = 'rgb(30, 42, 51)';
  const check = async (name, scene, mark, frame) => {
    await page.evaluate(n => window.__explainer.run(n), scene);
    const r = await page.evaluate(([mark, frame]) => {
      const P = window.__parts, target = new Function('P', `return ${mark}`)(P);
      target.mark('on');
      const el = new Function('P', `return ${frame}`)(P), cs = getComputedStyle(el);
      const out = { stroke: cs.stroke, width: parseFloat(cs.strokeWidth) };
      target.mark('on', false);
      return out;
    }, [mark, frame]);
    assert.equal(r.stroke, ink, `${name}: ink outline`);
    assert.ok(r.width >= 2, `${name}: stroke width ${r.width}`);
  };
  await check('table', 's1', 'P.outer', "P.outer.g.querySelector('.tbl')");
  await check('row', 's1', 'P.outer.row(1)', "P.outer.row(1).bg");
  await check('buckets', 's1', 'P.hash', "P.hash.g.querySelector('.box')");
  await check('bucket cell', 's1', 'P.hash.cell(0)', "P.hash.cell(0).rect");
  await check('box', 's1', 'P.join', "P.join.g.querySelector('.box')");
  await check('gate', 's1', 'P.gate', "P.gate.g.querySelector('.barrier')");
  await check('tree', 's3', 'P.tree', "P.tree.node('del').rect");
  await check('tree node', 's3', "P.tree.node('join')", "P.tree.node('join').rect");
  await check('columns', 's3', 'P.nodes', "P.nodes.col(0).rect");
  await check('column', 's3', 'P.nodes.col(1)', "P.nodes.col(1).rect");
  assert.deepEqual(errors, []);
});

test('B7: a badge may sit at a fixed point, and a one-point link fails with a clear error', async t => {
  const ok = await openPage(t, 'variant-svg-only.html');
  await ok.page.evaluate(() => window.__explainer.run('s3'));
  const badges = await ok.page.evaluate(() => [...document.querySelectorAll('.svg-scene .sb')].filter(b => b.isConnected).map(b => b.textContent));
  assert.ok(badges.includes('3'), `badge at a fixed point: ${JSON.stringify(badges)}`);
  assert.deepEqual(ok.errors, []);
  await ok.close();
  const bad = await openPage(t, 'variant-svg-bad-link.html', { waitReady: false });
  await bad.page.waitForFunction(() => document.querySelector('.stage')?.dataset.state === 'failed');
  assert.ok(bad.errors.some(e => /d\.link.*two points/i.test(e)), `clear error: ${JSON.stringify(bad.errors)}`);
});

test('tree.edge(id) leads a token up the drawn edge to the parent, and a token is as wide as its text', async t => {
  for (const viewport of [DESKTOP, { width: 390, height: 844 }]) {
    const { page, errors, close } = await openPage(t, 'variant-svg-only.html', { viewport });
    await page.evaluate(() => window.__explainer.run('s3'));
    const r = await page.evaluate(() => {
      const tok = window.__edgeToken, body = tok.body.getBoundingClientRect(), text = tok.text.getBoundingClientRect();
      const parent = window.__parts.tree.node('join').rect.getBoundingClientRect();
      return { dx: Math.abs((body.left + body.right) / 2 - (parent.left + parent.right) / 2), atParentBottom: Math.abs((body.top + body.bottom) / 2 - parent.bottom), inside: text.left >= body.left - 0.5 && text.right <= body.right + 0.5 };
    });
    assert.ok(r.dx < 1 && r.atParentBottom < 1, `${viewport.width}: the token ends at the parent's bottom center: ${JSON.stringify(r)}`);
    assert.ok(r.inside, `${viewport.width}: the token text fits its chip`);
    assert.deepEqual(errors, []);
    await close();
  }
});

test('columns: each column exposes top() and bottom() points on its frame', async t => {
  const { page, errors } = await openPage(t, 'variant-svg-only.html');
  await page.evaluate(() => window.__explainer.run('s3'));
  const r = await page.evaluate(() => {
    const c = window.__parts.nodes.col(1), top = c.top()(), bottom = c.bottom()(), slot = c.slot(0)();
    const box = c.rect;
    return { top, bottom, slotX: slot[0], frame: { x: +box.getAttribute('x'), y: +box.getAttribute('y'), w: +box.getAttribute('width'), h: +box.getAttribute('height') } };
  });
  assert.deepEqual(r.top, [r.frame.x + r.frame.w / 2, r.frame.y]);
  assert.deepEqual(r.bottom, [r.frame.x + r.frame.w / 2, r.frame.y + r.frame.h]);
  assert.equal(r.slotX, r.top[0]);
  assert.deepEqual(errors, []);
});

test('key-only tables and narrow boxes let panels sit side by side on a landscape phone; token text height does not count as overflow', async t => {
  for (const viewport of [{ width: 844, height: 390 }, { width: 390, height: 844 }]) {
    const { page, errors, close } = await openPage(t, 'variant-svg-narrow.html', { viewport });
    await page.evaluate(() => window.__explainer.instant(true));
    await page.evaluate(() => window.__explainer.run('s1'));
    const r = await page.evaluate(() => {
      const titles = [...document.querySelectorAll('.svg-scene .panel-title')].filter(n => n.getBoundingClientRect().width).map(n => n.getBoundingClientRect());
      return { sideBySide: Math.abs(titles[0].top - titles[1].top) < 1, clipped: window.__explainer.clipped(), overlaps: window.__explainer.overlaps() };
    });
    assert.equal(r.sideBySide, viewport.width > viewport.height, `${viewport.width}x${viewport.height}: panels side by side only when they fit`);
    assert.deepEqual([r.overlaps, r.clipped], [[], []], `${viewport.width}x${viewport.height}`);
    assert.deepEqual(errors, []);
    await close();
  }
  // Phone tokens are shorter than their text box; only a text wider than its chip is an overflow.
  const { page } = await openPage(t, 'variant-svg-only.html', { viewport: { width: 390, height: 844 } });
  await page.evaluate(() => window.__explainer.instant(true));
  await page.evaluate(() => window.__explainer.run('s1'));
  assert.deepEqual(await page.evaluate(() => window.__explainer.clipped()), []);
});

test('a diagram that is a single part (a tree) lays out at every size without errors', async t => {
  for (const viewport of [DESKTOP, { width: 2282, height: 1293 }, { width: 390, height: 844 }]) {
    const { page, errors, close } = await openPage(t, 'variant-svg-narrow.html', { viewport });
    await page.evaluate(() => window.__explainer.run('s2'));
    const r = await page.evaluate(() => ({ k: window.__explainer.kitInfo().scale, transform: [...document.querySelectorAll('.svg-scene')].find(g => g.style.display !== 'none').getAttribute('transform') }));
    assert.ok(Number.isFinite(r.k) && !/NaN/.test(r.transform), `${viewport.width}: ${JSON.stringify(r)}`);
    assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
    assert.deepEqual(errors, [], `${viewport.width}: no console errors`);
    await close();
  }
});

for (const file of SVG_EXAMPLES) {
  test(`${file}: an svg-only example never requests three.js, and every chapter ends with its final caption`, { timeout: 120_000 }, async t => {
    const { page, errors, threeRequests } = await openPage(t, file);
    await page.evaluate(() => window.__explainer.instant(true));
    const scenes = await page.evaluate(() => window.__explainer.scenes());
    assert.deepEqual(scenes, ['plan', 'build', 'sip', 'compare', 'nodes']);
    for (const n of scenes) assert.ok((await page.evaluate(n => window.__explainer.run(n), n)).length > 0, n);
    assert.deepEqual(threeRequests, []);
    assert.equal(await page.locator('.hint').isVisible(), false);
    if (file.endsWith('.en.html')) assert.equal(await page.evaluate(() => /[가-힣]/.test(document.body.innerText + document.title)), false, 'no Hangul on the English page');
    for (const n of await noteTexts(page)) assert.doesNotMatch(n, file.endsWith('.en.html') ? ROTATE.en : ROTATE.ko, 'the step-by-step note, without overrides');
    assert.deepEqual(errors, []);
  });
}

test('a gate without label or pass has no chip, and a pill covered by another frame is reported by clipped()', async t => {
  const phone = await openPage(t, 'variant-svg-narrow.html', { viewport: { width: 390, height: 844 } });
  await phone.page.evaluate(() => window.__explainer.instant(true));
  await phone.page.evaluate(() => window.__explainer.run('s3'));
  const r = await phone.page.evaluate(() => ({
    chips: [...window.__chipless.g.querySelectorAll('.chip')].filter(c => c.getBoundingClientRect().width > 0).length,
    clipped: window.__explainer.clipped(),
  }));
  assert.equal(r.chips, 0, 'no chip for a gate with neither label nor pass');
  assert.ok(r.clipped.some(text => text.startsWith('스캔에서 버림')), `the tally text under the chip is reported: ${JSON.stringify(r.clipped)}`);
  assert.deepEqual(phone.errors, []);
});

const centreX = page => page.evaluate(() => {
  const boxes = [...document.querySelectorAll('.svg-scene')].find(g => g.style.display !== 'none').querySelector('.parts').getBoundingClientRect();
  const wrap = document.querySelector('.canvas-wrap').getBoundingClientRect();
  return { diagram: (boxes.left + boxes.right) / 2, stage: (wrap.left + wrap.right) / 2 };
});
test('R1/R4: panels report the size of the arrangement they use (centred when stacked; no blank band or overlap when nested)', async t => {
  for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, DESKTOP]) {
    const { page, errors, close } = await openPage(t, 'variant-svg-layout.html', { viewport });
    await page.evaluate(() => window.__explainer.instant(true));
    await page.evaluate(() => window.__explainer.run('s1'));
    if (viewport.width === 390) {
      const c = await centreX(page);
      assert.ok(Math.abs(c.diagram - c.stage) < 3, `stacked panels are centred: ${JSON.stringify(c)}`);
    }
    await page.evaluate(() => window.__explainer.run('s2'));
    const gap = await page.evaluate(() => {
      const sceneEl = [...document.querySelectorAll('.svg-scene')].find(g => g.style.display !== 'none');
      const panelBottom = Math.max(...[...sceneEl.querySelectorAll('.part')].filter(p => !window.__below.g.contains(p)).map(p => p.getBoundingClientRect().bottom));
      const below = window.__below.g.getBoundingClientRect().top;
      return { panelBottom, below, gap: below - panelBottom };
    });
    assert.ok(gap.gap >= 0 && gap.gap < 60, `${viewport.width}x${viewport.height}: the table below follows the panels: ${JSON.stringify(gap)}`);
    assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
    assert.deepEqual(errors, []);
    await close();
  }
});

test('R6: a wide token rests clear of the gate barrier and inside its box; a token leaving its container is reported', async t => {
  for (const viewport of [DESKTOP, { width: 390, height: 844 }]) {
    const { page, errors, close } = await openPage(t, 'variant-svg-tokens.html', { viewport });
    await page.evaluate(() => window.__explainer.instant(true));
    await page.evaluate(() => window.__explainer.run('s1'));
    const r = await page.evaluate(() => {
      const W = window.__w, R = n => n.getBoundingClientRect();
      const barrier = R(W.g.g.querySelector('.barrier')), box = R(W.b.g.querySelector('.box'));
      const gateTok = R(W.atGate.body), boxTok = R(W.inBox.body);
      return { clearOfBarrier: gateTok.right <= barrier.left + 0.5, insideBox: boxTok.left >= box.left - 0.5 && boxTok.right <= box.right + 0.5, clipped: window.__explainer.clipped() };
    });
    assert.ok(r.clearOfBarrier && r.insideBox, `${viewport.width}: ${JSON.stringify(r)}`);
    assert.deepEqual(r.clipped, []);
    await page.evaluate(() => window.__explainer.run('s2'));
    const reported = await page.evaluate(() => window.__explainer.clipped());
    assert.ok(reported.includes('a-very-long-key-0042'), `${viewport.width}: a token wider than its bucket is reported: ${JSON.stringify(reported)}`);
    assert.deepEqual(errors, []);
    await close();
  }
});

test('R3: a token re-measures its width when its text changes', async t => {
  const { page, errors } = await openPage(t, 'variant-svg-tokens.html');
  await page.evaluate(() => window.__explainer.instant(true));
  await page.evaluate(() => window.__explainer.run('s1'));
  await page.evaluate(() => { window.__w.inBox.text.textContent = 'order-000017-with-a-longer-suffix'; });
  await page.setViewportSize({ width: 1400, height: 900 }); // any relayout redraws the token
  await nextFrames(page, 3);
  const r = await page.evaluate(() => { const b = window.__w.inBox.body.getBoundingClientRect(), x = window.__w.inBox.text.getBoundingClientRect(); return { body: b.width, text: x.width }; });
  assert.ok(r.body >= r.text, `the chip grew with its new text: ${JSON.stringify(r)}`);
  assert.deepEqual(errors, []);
});

test('R9/R8: a key-only table has at most a key header and no row when none is given; a gate never draws an empty chip', async t => {
  for (const viewport of [DESKTOP, { width: 390, height: 844 }]) {
    const { page, errors, close } = await openPage(t, 'variant-svg-tokens.html', { viewport });
    await page.evaluate(() => window.__explainer.instant(true));
    await page.evaluate(() => window.__explainer.run('s3'));
    const r = await page.evaluate(() => {
      const H = window.__h, R = n => n.getBoundingClientRect();
      const shown = n => n.textContent.trim() && R(n).width > 0 && getComputedStyle(n).opacity !== '0' && n.getAttribute('opacity') !== '0';
      const keyFrame = R(H.keyOnly.g.querySelector('.tbl'));
      const keyHeads = [...H.keyOnly.g.querySelectorAll(':scope > text.meta')].filter(shown).map(n => ({ text: n.textContent, inside: R(n).right <= keyFrame.right + 0.5 }));
      const bareFrame = R(H.bare.g.querySelector('.tbl')), bareRow = R(H.bare.rows[0].bg);
      const chip = H.g.g.querySelector('.chip'), chipText = [...H.g.g.querySelectorAll('text')].filter(shown).map(n => n.textContent);
      return { keyHeads, bareGap: bareRow.top - bareFrame.top, chipShown: Boolean(chip && R(chip).width > 0 && chip.style.display !== 'none'), chipText };
    });
    assert.ok(r.keyHeads.length <= 1 && r.keyHeads.every(h => h.inside), `${viewport.width}: key-only header ${JSON.stringify(r.keyHeads)}`);
    assert.ok(r.bareGap < 2, `${viewport.width}: no empty header row (${r.bareGap}px)`);
    if (viewport.width < 500) assert.equal(r.chipShown, false, 'phones hide the gate label, so a label-only gate has no chip there');
    else assert.ok(r.chipShown && r.chipText.includes('Filter'), 'desktop shows the label chip');
    assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
    assert.deepEqual(errors, []);
    await close();
  }
});

test('R7: tree.edge with an unknown id fails with a clear error', async t => {
  const { page, errors } = await openPage(t, 'variant-svg-bad-edge.html', { waitReady: false });
  await page.waitForFunction(() => document.querySelector('.stage')?.dataset.state === 'failed');
  assert.ok(errors.some(e => /\[plz\] tree\.edge\(nope\)/.test(e)), `clear error: ${JSON.stringify(errors)}`);
});

// The intro note follows the kits the page uses: no rotatable kit → no rotate hint; axo only → today's text; both → the hint names 3D chapters.
const ROTATE = { en: /drag|rotate|swipe/i, ko: /드래그|돌려|밀면|밀어/, ja: /ドラッグ|回転|スワイプ/, 'zh-CN': /拖动|旋转|滑动/ };
const SCRIPT = { en: /^[^가-힣぀-ヿ]+$/, ko: /[가-힣]/, ja: /[぀-ヿ]/, 'zh-CN': /[一-鿿]/ };
const noteTexts = page => page.evaluate(() => [...document.querySelectorAll('.intro .note > span')].map(n => n.textContent));
test('the intro note fits the page\'s kits: svg-only pages have no rotate hint, in every built-in language', async t => {
  for (const [lang, file] of [['en', 'variant-svg-only.html'], ['ko', 'variant-svg-only.ko.html'], ['ja', 'variant-svg-only.ja.html'], ['zh-CN', 'variant-svg-only.zh-CN.html']]) {
    const { page, errors, close } = await openPage(t, file);
    const notes = await noteTexts(page);
    assert.equal(notes.length, 2);
    for (const n of notes) {
      assert.ok(n.length > 10 && SCRIPT[lang].test(n), `${lang}: a note in the page language: ${n}`);
      assert.doesNotMatch(n, ROTATE[lang], `${lang}: no rotate hint on an svg-only page`);
    }
    assert.deepEqual(errors, []);
    await close();
  }
  const axo = await openPage(t, 'example-agent-sandbox.en.html');
  const axoNotes = await noteTexts(axo.page);
  assert.equal(axoNotes[0], 'Drag the model on the right to rotate it. The button in each chapter makes that event actually happen in the model.', 'axo-only pages keep today\'s note');
  await axo.close();
  const mixed = await openPage(t, 'template.html');
  const mixedNotes = await noteTexts(mixed.page);
  assert.ok(mixedNotes.every(n => /3D/.test(n) && ROTATE.en.test(n)), `a mixed page limits the rotate hint to 3D chapters: ${JSON.stringify(mixedNotes)}`);
});

test('a scene whose kit section is missing stops the page with a readable [plz] message on the stage', async t => {
  const { page, errors } = await openPage(t, 'variant-missing-kit.html', { waitReady: false });
  await page.waitForFunction(() => document.querySelector('.stage')?.dataset.state === 'failed');
  const notice = await page.locator('.fallback').innerText();
  assert.match(notice, /\[plz\][^\n]*"axo"/, `the stage names the missing kit: ${notice}`);
  assert.match(notice, /KIT axo/);
  assert.ok(errors.some(e => /\[plz\]/.test(e)));
});

const stageFailure = async (t, file) => {
  const { page, errors, close } = await openPage(t, file, { waitReady: false });
  await page.waitForFunction(() => document.querySelector('.stage')?.dataset.state === 'failed');
  const notice = await page.locator('.fallback').innerText();
  await close();
  return { notice, errors };
};

test('a page whose axo sections were deleted but whose SCENES still use axo stops with a readable [plz] message', async t => {
  for (const file of ['variant-axo-deleted.html', 'variant-axo-deleted-listed.html']) {
    const { notice, errors } = await stageFailure(t, file);
    assert.match(notice, /\[plz\][^\n]*kit "axo" is not on this page/, `${file}: ${notice}`);
    assert.match(notice, /scene s1, scene s2, setupKit\('axo'\)/, `${file}: names everything that uses axo: ${notice}`);
    assert.ok(!errors.some(e => /ReferenceError|is not defined/.test(e)), `${file}: no bare ReferenceError: ${JSON.stringify(errors)}`);
  }
  const { notice } = await stageFailure(t, 'variant-axo-toplevel.html');
  assert.match(notice, /\[plz\] SCENES uses "base" at its top level, but this page does not define it/, notice);
  assert.match(notice, /setupKit/, notice);
});

test('data-kits is the page\'s list of kits: a listed kit that no scene uses stops the page with a [plz] message', async t => {
  const { notice } = await stageFailure(t, 'variant-unused-kit.html');
  assert.match(notice, /\[plz\] data-kits lists kit "axo", but no scene uses it/, notice);
});

test('the intro note in a language outside the built-in ones uses the page\'s own strings on svg-only and mixed pages', async t => {
  for (const [file, want] of [
    ['variant-es-svg.html', [ES_NOTES.noteWide, ES_NOTES.noteNarrow]],
    ['variant-es-mixed.html', [ES_NOTES.noteWide, ES_NOTES.noteNarrow]],
    ['variant-es-svg-steps.html', ['ES pasos', 'ES pasos']],
  ]) {
    const { page, errors, close } = await openPage(t, file);
    assert.deepEqual(await noteTexts(page), want, file);
    assert.deepEqual(errors, []);
    await close();
  }
});

test('the intro note is decided once, from data-kits, before any kit loads (and stays right when the load fails)', async t => {
  const { page, close } = await openPage(t, 'template.html', { waitReady: false, cdn: () => 'abort' });
  await page.waitForFunction(() => document.querySelector('.stage')?.dataset.state === 'failed');
  const notes = await noteTexts(page);
  assert.ok(notes.every(n => /3D/.test(n)), `the mixed note on a page whose three.js load failed: ${JSON.stringify(notes)}`);
  await close();
  const held = await openPage(t, 'template.html', { waitReady: false, cdn: () => new Promise(() => {}) });
  await held.page.waitForFunction(() => document.querySelector('.stage')?.dataset.state === 'loading');
  const before = await noteTexts(held.page);
  assert.ok(before.every(n => /3D/.test(n)), `the mixed note while three.js is still loading: ${JSON.stringify(before)}`);
  await held.close();
});
