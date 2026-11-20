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
const SVG_EXAMPLES = ['example-hash-join-sip.html', 'example-hash-join-sip.en.html', 'example-lost-update.html', 'example-lost-update.en.html', 'example-bloom-filter.html', 'example-bloom-filter.en.html', 'example-event-loop.html', 'example-event-loop.en.html'];
// The chapters of each svg example, in order.
const EXAMPLE_SCENES = { 'hash-join-sip': ['plan', 'build', 'sip', 'compare', 'nodes'], 'lost-update': ['serial', 'lost', 'lock', 'version', 'compare'], 'bloom-filter': ['add', 'lookup', 'bits', 'hashes', 'sizing'], 'event-loop': ['stack', 'timeout', 'promise', 'predict', 'chain'] };
let browser, server, origin;

// Scenes that use every svg part: a row-level step diagram with a filter (s1), side-by-side panels fed by one trigger (s2),
// and an operator tree next to node columns (s3).
const LANE_CHAPTERS = { extra: ['s4', 's5', 's6', 's7'] }; // SVG_SCENES has two lanes chapters, a playground and a code-state chapter after the template's three
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
// Lanes: two sessions and the row they share, time running down. A locks the row; B waits until A commits.
defineScene('s4', {
  kit: 'svg',
  title: '4  Two sessions, one row',
  build(d) {
    const L = d.lanes([{ id: 'a', name: 'Session A', tone: 'bound' }, { id: 'row', name: 'accounts id 1', resource: true }, { id: 'b', name: 'Session B', tone: 'matter' }], { steps: 6 });
    L.event('row', 0, '100');
    const lockA = L.event('a', 1, 'SELECT … FOR UPDATE', { short: 'lock, read' });
    L.message('row', 'a', 1);
    L.span('a', 1, 4, 'lock');
    const askB = L.event('b', 2, 'SELECT … FOR UPDATE', { short: 'lock?' });
    const band = L.span('b', 2, 4, 'wait');
    L.event('a', 3, 'UPDATE … SET balance = 120', { short: 'write 120' });
    L.message('a', 'row', 3);
    L.event('row', 3, '120');
    L.event('a', 4, 'COMMIT', { state: 'commit' });
    const readB = L.event('b', 5, 'reads 120', { mono: false });
    L.message('row', 'b', 5);
    L.event('b', 6, 'UPDATE … SET balance = 150', { short: 'write 150' });
    L.message('b', 'row', 6);
    const last = L.event('row', 6, '150', { tone: 'actor' });
    window.__lanes = { L, band, askB, readB, last };
    return {
      diagram: L,
      async run(a, say) {
        await a.play(L, 2);
        window.__lanes.mid = { now: L.now, wait: +band.g.querySelector('rect').getAttribute('height'), row: L.rowH() };
        say('1. A locked the row; B asked for the lock and waits.', { anchor: askB });
        await a.play(L, 4);
        window.__lanes.atCommit = { wait: +band.g.querySelector('rect').getAttribute('height') };
        say('2. A wrote 120 and committed; the lock is released.');
        await a.play(L, 6);
        say('3. B read 120 and wrote 150.', { anchor: last });
      },
    };
  },
});
// Lanes inside panels: the same schedule under two rules.
defineScene('s5', {
  kit: 'svg',
  title: '5  Same schedule, two rules',
  build(d) {
    const side = lock => {
      const L = d.lanes([{ id: 'a', name: 'A', tone: 'bound' }, { id: 'row', name: 'row', resource: true }, { id: 'b', name: 'B', tone: 'matter' }], { steps: 4, axis: false });
      L.event('row', 0, '100');
      L.event('a', 1, 'read 100', { short: 'r 100' }); L.event('b', 2, lock ? 'wait' : 'read 100', { short: lock ? 'wait' : 'r 100' });
      if (lock) L.span('b', 2, 3, 'wait');
      L.event('a', 3, 'write 120', { short: 'w 120' }); L.message('a', 'row', 3); L.event('row', 3, '120');
      L.event('b', 4, lock ? 'write 150' : 'write 130', { short: lock ? 'w 150' : 'w 130' }); L.message('b', 'row', 4); L.event('row', 4, lock ? '150' : '130', { tone: lock ? '' : 'actor' });
      return L;
    };
    const plain = side(false), locked = side(true);
    window.__lanesBuilder = d; // for the error checks (calls after build only throw; they draw nothing that is shown)
    return {
      diagram: d.panels([{ title: 'No lock', body: plain }, { title: 'FOR UPDATE', body: locked }]),
      async run(a, say) {
        await Promise.all([a.play(plain, 4), a.play(locked, 4)]);
        say('Without a lock, 120 is lost; with it, B writes 150.');
      },
    };
  },
});
// A parameter playground: two sliders (bits m: a range; hash functions k: a list), presets, a line chart with a marker
// and a reference line, a stacked meter and a readout. The run is the tour; the reader explores afterwards.
defineScene('s6', {
  kit: 'svg',
  title: '6  Bits and false positives',
  params: {
    m: { label: 'Bits m', min: 100, max: 2000, step: 100, value: 800, unit: 'bits' },
    k: { label: 'Hash functions k', values: [1, 2, 3, 4, 5, 6, 7, 8], value: 4 },
  },
  presets: [{ label: '4 bits per item', values: { m: 400 } }, { label: '16 bits per item', values: { m: 1600, k: 8 } }],
  build(d) {
    const n = 100, f = (m, k) => (1 - Math.exp(-k * n / m)) ** k;
    const pct = v => (v * 100).toFixed(2) + '%';
    const chart = d.chart({ title: 'False positive rate', x: { label: 'bits m', min: 100, max: 2000, ticks: [100, 500, 1000, 1500, 2000] },
      y: { min: 1e-4, max: 1, log: true, ticks: [1e-4, 1e-3, 1e-2, 1e-1, 1], format: v => (v * 100) + '%' } });
    const curve = chart.line(m => f(m, 4), { tone: 'actor' });
    const mark = chart.marker(curve);
    chart.ref('y', 0.01, { label: '1%' });
    const fill = d.meter({ title: 'Bits set to 1', parts: [{ label: '1', tone: 'matter' }, { label: '0' }] });
    const out = d.readout({ label: 'False positive rate', sample: '100.00%' });
    window.__pg = { n };
    return {
      diagram: d.stack([chart, d.stack([fill, out], { dir: 'row' })], { dir: 'col' }),
      update(p) {
        curve.set(m => f(m, p.k));
        mark.at(p.m);
        const ones = 1 - Math.exp(-p.k * n / p.m);
        fill.set([ones], [pct(ones), pct(1 - ones)]);
        out.set(pct(f(p.m, p.k)));
        return 'With ' + p.m + ' bits and k = ' + p.k + ', about ' + pct(f(p.m, p.k)) + ' of lookups for absent keys say maybe.';
      },
      async run(a, say) {
        await a.set({ m: 200 });
        say('1. With 2 bits per item, most lookups said maybe.', { anchor: chart.near(200, f(200, 4)) }); // a point by the curve, not the moving marker
        await a.wait(500);
        await a.set({ m: 1600 }, { ms: 1500 });
        say('2. With 16 bits per item, the rate fell below 1%.', { anchor: chart.near(1600, f(1600, 4)) });
      },
    };
  },
});// Code and state in sync: a code panel with a marker, a call stack, two queues and a console. Steppable.
defineScene('s7', {
  kit: 'svg',
  title: '7  Code and state',
  step: true,
  build(d) {
    const code = d.code({ title: 'main.js', lines: ["console.log('1');", 'setTimeout(cb, 0);', 'Promise.resolve().then(p);', "console.log('4');"] });
    const frames = d.frames({ title: 'Call stack', max: 3 });
    const micro = d.queue({ title: 'Microtasks', max: 3 });
    const tasks = d.queue({ title: 'Tasks', max: 3 });
    const out = d.console({ title: 'Console', max: 4 });
    window.__cs = { code, frames, micro, tasks, out };
    return {
      diagram: d.flow([code, d.flow([frames, d.stack([micro, tasks], { dir: 'col' }), out])]),
      async run(a, say) {
        await a.line(code, 1); frames.push('script'); out.log('1'); say('1. The script logged 1.', { anchor: out.last() });
        await a.line(code, 2); await a.carry('cb', code.end(2), tasks.tail()); tasks.enqueue('cb'); say('2. The timer callback went to the task queue.', { anchor: tasks });
        await a.line(code, 3); await a.carry('p', code.end(3), micro.tail()); micro.enqueue('p'); say('3. The promise callback went to the microtask queue.', { anchor: micro });
        await a.line(code, 4); out.log('4'); await a.line(code, null, { step: false }); frames.pop(); say('4. The script logged 4 and ended; the stack is empty.', { anchor: frames });
        await a.checkpoint(); frames.push(micro.dequeue()); out.log('3'); frames.pop(); say('5. The microtask ran first.', { anchor: out.last() });
        await a.checkpoint(); frames.push(tasks.dequeue()); out.log('2'); frames.pop(); say('6. Then the task ran.', { anchor: out.last() });
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
// Lanes edge cases: two resource lanes (a lock bar faces the nearest one), a message that arrives two steps later,
// and compact lanes (axis: false) whose playhead marker must stay inside the part.
const LANES_EXTRA = `
defineScene('s1', { kit: 'svg', title: '1  Lanes edge cases', build(d) {
  const L = d.lanes([{ id: 'q', name: 'queue', resource: true }, { id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'row', name: 'row', resource: true }], { steps: 4 });
  L.event('a', 1, 'take'); L.event('b', 1, 'hold');
  L.span('a', 1, 3, 'lock'); L.span('b', 1, 3, 'lock');
  L.event('a', 2, 'send'); L.event('b', 2, 'work');
  const late = L.message('a', 'q', 2, { toStep: 4 });
  L.event('a', 3, 'done'); L.event('b', 3, 'done'); L.event('q', 4, 'got');
  const C = d.lanes([{ id: 'a', name: 'A' }, { id: 'r', name: 'r', resource: true }, { id: 'b', name: 'B' }], { steps: 2, axis: false });
  C.event('a', 1, 'x'); C.event('b', 2, 'y');
  const tip = () => { const m = /L([0-9.-]+),([0-9.-]+)$/.exec(late.path.getAttribute('d') ?? ''); return m ? +m[2] : null; };
  window.__x = { L, C, late, tip };
  return { diagram: d.stack([L, C], { dir: 'col' }), async run(a, say) {
    await a.play(L, 2);
    window.__x.mid = { tip: tip(), y2: L.yOf(2) };
    await a.play(L, 4);
    await a.play(C, 2);
    say('Done.');
  } };
} });
`;
const BAD_GATE = `
defineScene('s1', { kit: 'svg', title: '1', build(d) { const b = d.box({ title: 'Join', lanes: 2 }); const t = d.table({ title: 'T', keys: [1, 2] }); d.gate(t, { label: 'F' }); return { diagram: d.grid([[b, t]]), async run() {} }; } });
`;
const BAD_LINK = `
defineScene('s1', { kit: 'svg', title: '1', build(d) { const t = d.table({ title: 'T', keys: [1, 2] }); d.link([t.out(0)]); return { diagram: d.grid([[t]]), async run() {} }; } });
`;

before(async () => {
  const tpl = await readFile(join(assets, 'template.html'), 'utf8');
  const variants = {
    'variant-svg-only.html': variantWithScenes(tpl, SVG_SCENES, 'svg', LANE_CHAPTERS),
    ...Object.fromEntries(['ko', 'ja', 'zh-CN'].map(lang => [`variant-svg-only.${lang}.html`, variantWithScenes(tpl, SVG_SCENES, 'svg', LANE_CHAPTERS).replace('<html lang="en">', `<html lang="${lang}">`)])),
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
    'variant-es-svg.html': withOverrides(variantWithScenes(tpl, SVG_SCENES, 'svg', LANE_CHAPTERS), 'es', ES_NOTES),
    'variant-es-svg-steps.html': withOverrides(variantWithScenes(tpl, SVG_SCENES, 'svg', LANE_CHAPTERS), 'es', { ...ES_NOTES, noteSteps: 'ES pasos' }),
    'variant-es-mixed.html': withOverrides(tpl, 'es', ES_NOTES),
    // data-kits lists a kit no scene uses.
    'variant-unused-kit.html': variantWithScenes(tpl, SVG_SCENES, 'axo svg', LANE_CHAPTERS),
    'variant-lanes-extra.html': variantWithScenes(tpl, LANES_EXTRA, 'svg'),
    'variant-pg-extra.html': variantWithScenes(tpl, PG_EXTRA, 'svg'),
    // s7's flow inside a column stack: the kit must still compare the flow's wrappings.
    'variant-svg-nested-flow.html': (() => { const v = variantWithScenes(tpl, SVG_SCENES, 'svg', LANE_CHAPTERS), a = "diagram: d.flow([code, d.flow([frames, d.stack([micro, tasks], { dir: 'col' }), out])]),"; assert.ok(v.includes(a)); return v.replace(a, () => "diagram: d.stack([d.flow([code, d.flow([frames, d.stack([micro, tasks], { dir: 'col' }), out])])], { dir: 'col' }),"); })(),
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
  await page.evaluate(() => window.__explainer.instant(true));
  await page.evaluate(() => window.__explainer.run('s4'));
  const lanesInstant = await laneState(page);
  await page.evaluate(() => window.__explainer.run('s7'));
  const csInstant = await csState(page);
  await close();
  const reduced = await openPage(t, 'variant-svg-only.html', { reducedMotion: 'reduce' });
  await reduced.page.evaluate(() => window.__explainer.speed(2));
  await reduced.page.evaluate(() => window.__explainer.run('s4'));
  assert.equal(await laneState(reduced.page), lanesInstant, 'lanes: reduced motion reaches the instant end state');
  await reduced.page.evaluate(() => window.__explainer.run('s7'));
  assert.equal(await csState(reduced.page), csInstant, 'code and state: reduced motion reaches the instant end state');
  await reduced.page.evaluate(() => window.__explainer.speed(1));
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
    if (!phone && ['right', 'below'].includes(r.kit?.arrangement)) { // the kit placed the captions: every caption of the run is in view
      const shown = await page.evaluate(() => { const rail = document.querySelector('.rail'), b = rail.getBoundingClientRect(); return rail.scrollHeight <= rail.clientHeight + 1 && [...rail.querySelectorAll('.cap')].every(c => { const q = c.getBoundingClientRect(); return q.top >= b.top - 0.5 && q.bottom <= b.bottom + 0.5; }); });
      assert.ok(shown, `${tag} ${n}: every caption is in view (${r.kit.arrangement})`);
    }
    const f = await minFont(page);
    assert.ok(f >= (phone ? 11 : 12) - 0.01, `${tag} ${n}: smallest label ${f}px`);
    // A playground: also at the minimum and maximum of every slider, then back to the defaults.
    const ext = await page.evaluate(n => {
      const p = window.__explainer.params(n), spec = window.__explainer.paramSpec(n);
      if (!p) return [];
      const out = [];
      for (const [id, s] of Object.entries(spec)) for (const v of [s.min, s.max]) {
        window.__explainer.params(n, { ...p, [id]: v });
        out.push({ at: `${id}=${v}`, overlaps: window.__explainer.overlaps(), clipped: window.__explainer.clipped() });
      }
      window.__explainer.params(n, p);
      return out;
    }, n);
    for (const e of ext) assert.deepEqual([e.overlaps, e.clipped], [[], []], `${tag} ${n} at ${e.at}`);
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
      const k = await page.evaluate(async () => { const n = window.__explainer.scenes().includes('s3') ? 's3' : window.__explainer.scenes()[0]; await window.__explainer.run(n); return window.__explainer.kitInfo().scale; }); // s3, or an example's first chapter
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
      const k = await page.evaluate(async () => { const n = window.__explainer.scenes().includes('s3') ? 's3' : window.__explainer.scenes()[0]; await window.__explainer.run(n); return window.__explainer.kitInfo().scale; }); // s3, or an example's first chapter
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
    assert.deepEqual(scenes, EXAMPLE_SCENES[/^example-(.+?)(\.en)?\.html$/.exec(file)[1]]);
    for (const n of scenes) assert.ok((await page.evaluate(n => window.__explainer.run(n), n)).length > 0, n);
    assert.deepEqual(threeRequests, []);
    assert.equal(await page.locator('.hint').isVisible(), false);
    if (file.endsWith('.en.html')) assert.equal(await page.evaluate(() => /[가-힣]/.test(document.body.innerText + document.title)), false, 'no Hangul on the English page');
    for (const n of await noteTexts(page)) assert.doesNotMatch(n, file.endsWith('.en.html') ? ROTATE.en : ROTATE.ko, 'the step-by-step note, without overrides');
    if (file.includes('bloom-filter')) await bloomNumbers(page);
    if (file.includes('event-loop')) await eventLoopOrders(page);
    assert.deepEqual(errors, []);
  });
}

// The Bloom filter page computes its numbers; they must match an independent calculation.
const fnv1a = s => { let h = 2166136261; for (const ch of s) { h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0; } return h; };
async function bloomNumbers(page) {
  const positions = await page.evaluate(() => Object.fromEntries(['apple', 'grape', 'lemon', 'plum', 'melon'].map(k => [k, window.__bloom.positions(k)])));
  for (const [k, pos] of Object.entries(positions)) assert.deepEqual(pos, [0, 1, 2].map(i => fnv1a(`${i}:${k}`) % 12), `positions of ${k}`);
  const readouts = async (name, values) => page.evaluate(([n, v]) => {
    window.__explainer.params(n, v);
    return [...document.querySelectorAll('.svg-scene')].find(g => g.style.display !== 'none').querySelectorAll('.readout .rv').length
      ? [...[...document.querySelectorAll('.svg-scene')].find(g => g.style.display !== 'none').querySelectorAll('.readout .rv')].map(t => t.textContent) : null;
  }, [name, values]);
  const close = (text, want, label) => { const v = parseFloat(text); assert.ok(Math.abs(v - want) <= Math.abs(want) * 0.051 + 1e-9, `${label}: page ${text}, expected ${want}`); };
  await page.evaluate(() => window.__explainer.run('bits'));
  let r = await readouts('bits', { m: 8000 });
  close(r[0], fp(8000, 1000, 4) * 100, 'm = 8n, k = 4'); // just over 2% (Broder & Mitzenmacher)
  assert.equal(r[1], '8');
  r = await readouts('bits', { m: 1000 });
  close(r[0], fp(1000, 1000, 4) * 100, 'm = n');
  await page.evaluate(() => window.__explainer.run('hashes'));
  r = await readouts('hashes', { k: 7 });
  close(r[0], fp(10000, 1000, 7) * 100, 'k = 7, m/n = 10');
  r = await readouts('hashes', { k: 1 });
  close(r[0], fp(10000, 1000, 1) * 100, 'k = 1');
  await page.evaluate(() => window.__explainer.run('sizing'));
  const per = p => -Math.log(p) / Math.LN2 ** 2;
  for (const [n, p] of [[1e6, 0.01], [1e6, 0.001], [1e7, 0.0001], [1000, 0.1]]) {
    r = await readouts('sizing', { n, p });
    close(r[0], per(p), `bits per key at p = ${p}`);
    const bytes = per(p) * n / 8, mem = bytes < 1e6 ? bytes / 1e3 : bytes / 1e6;
    close(r[1], mem, `memory for n = ${n}, p = ${p}`);
    assert.equal(r[2], String(Math.round(per(p) * Math.LN2)), `hash functions at p = ${p}`);
  }
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

// ---- Lanes (time-axis swimlanes) ----
// The visible state of the lanes scene: playhead, item classes and opacity, span heights, message paths.
const LANE_STATE = () => {
  const L = window.__lanes.L, root = L.g;
  return JSON.stringify({
    now: L.now,
    playhead: root.querySelector('.playhead line')?.getAttribute('y1'),
    items: [...root.querySelectorAll('[data-step]')].map(n => `${n.getAttribute('class')}|${n.style.opacity}`),
    spans: [...root.querySelectorAll('.lspan rect')].map(r => r.getAttribute('height')),
    msgs: [...root.querySelectorAll('.lmsg path')].map(p => p.getAttribute('d')),
  });
};
const laneState = page => page.evaluate(LANE_STATE);

test('lanes: the playhead advances and leaves a trace, the waiting band grows then stops, reset restores the start, and a mid-run drag keeps the layout', { timeout: 90_000 }, async t => {
  const { page, errors } = await openPage(t, 'variant-svg-only.html');
  await page.evaluate(() => window.__explainer.run('s3')); // leave s4 untouched until it is the active chapter
  await page.evaluate(() => document.querySelector('[data-scene="s4"]').scrollIntoView({ block: 'center', behavior: 'instant' }));
  await page.waitForFunction(() => window.__explainer.current() === 's4');
  const fresh = await laneState(page);
  const start = JSON.parse(fresh);
  assert.equal(start.now, 0);
  assert.ok(start.items.filter(i => i.endsWith('|0')).length >= 10, 'every item after the start row is hidden before the run');
  assert.ok(start.spans.every(h => +h === 0), `no span drawn before the run: ${start.spans}`);
  await page.evaluate(() => window.__explainer.instant(true));
  const text = await page.evaluate(() => window.__explainer.run('s4'));
  assert.equal(text, '3. B read 120 and wrote 150.');
  const end = JSON.parse(await laneState(page));
  const probe = await page.evaluate(() => ({ mid: window.__lanes.mid, atCommit: window.__lanes.atCommit, y6: window.__lanes.L.yOf(6) }));
  assert.equal(probe.mid.now, 2);
  assert.ok(Math.abs(probe.mid.wait - probe.mid.row) < 1, `the waiting band covers its first step: ${JSON.stringify(probe)}`);
  assert.ok(Math.abs(probe.atCommit.wait - 3 * probe.mid.row) < 1, `the band reaches its end step: ${JSON.stringify(probe)}`);
  assert.equal(end.now, 6);
  assert.ok(Math.abs(+end.playhead - probe.y6) < 0.5, 'the playhead stands at the last step');
  assert.ok(end.items.every(i => !i.endsWith('|0')), `every passed item stays visible (static trace): ${end.items.filter(i => i.endsWith('|0'))}`);
  assert.equal(+end.spans[1], +probe.atCommit.wait, 'the waiting band stopped at its end step');
  const resource = await page.evaluate(() => [...window.__lanes.L.g.querySelectorAll('.lane.res [data-step]')].map(n => n.getAttribute('class')));
  assert.ok(resource.slice(0, -1).every(c => /\bold\b/.test(c)) && !/\bold\b/.test(resource.at(-1)), `older values of the row are dimmed: ${resource}`);
  assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
  // A value that is both old and lost is red (lost wins over old).
  const fills = await page.evaluate(() => {
    const v = window.__lanes.L.g.querySelector('.lane.res [data-step="3"]');
    v.classList.add('lost');
    const ref = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    ref.style.fill = 'var(--actor-ink)'; v.appendChild(ref);
    const out = { lost: getComputedStyle(v.querySelector('text')).fill, actor: getComputedStyle(ref).fill, old: v.classList.contains('old') };
    ref.remove(); v.classList.remove('lost');
    return out;
  });
  assert.ok(fills.old && fills.lost === fills.actor, `an old, lost value is drawn in the actor ink: ${JSON.stringify(fills)}`);
  // Lane widths follow the measured text: each lane is as wide as its widest text needs (header or card), not wider.
  const fitWidths = await page.evaluate(() => [...window.__lanes.L.g.querySelectorAll('.lane')].map(lane => {
    const w = +lane.querySelector('.lanebg').getAttribute('width');
    const head = lane.querySelector(':scope > text').getComputedTextLength() + 16;
    const bar = lane.querySelector('.lspan.lock') ? 4 : 0; // room for the lock bar
    const cards = [...lane.querySelectorAll('.lev')].map(e => e.querySelector('text').getComputedTextLength() + 16 + 12 + bar);
    return { w, need: Math.max(64, head, ...cards) };
  }));
  assert.ok(fitWidths.every(l => Math.abs(l.w - l.need) < 2.5), `lane widths: ${JSON.stringify(fitWidths)}`);
  // A stage too narrow for the full text: the lanes switch to the short texts, and the kit centres what is drawn.
  await page.focus('.split-v'); await page.keyboard.press('End'); await nextFrames(page);
  for (const name of ['s4', 's5']) {
    await page.evaluate(n => window.__explainer.run(n), name);
    const c = await centreX(page);
    assert.ok(Math.abs(c.diagram - c.stage) < 3, `${name} on a narrow stage is centred: ${JSON.stringify(c)}`);
  }
  await page.dblclick('.split-v'); await nextFrames(page); // back to the default split
  await page.evaluate(() => window.__explainer.run('s4')); // still instant: the rail has captions again
  // A new run starts from the reset state, captured when reset clears the rail.
  await page.evaluate(() => window.__explainer.instant(false));
  const atReset = await page.evaluate(async src => {
    const state = new Function(`return (${src})()`), list = document.querySelector('.rail-list');
    let snap = null;
    const mo = new MutationObserver(() => { if (snap === null && list.children.length === 0) snap = state(); });
    mo.observe(list, { childList: true });
    window.__explainer.speed(2);
    window.__run = window.__explainer.run('s4');
    for (let i = 0; i < 100 && snap === null; i++) await new Promise(r => setTimeout(r, 30));
    mo.disconnect();
    return snap;
  }, LANE_STATE.toString());
  assert.equal(atReset, fresh, 'reset puts the playhead back and hides every passed step');
  // Drag the split while the run is going: the run completes and the lanes follow the new layout.
  await page.waitForFunction(() => document.querySelectorAll('.rail-list .cap').length >= 1);
  const h = await page.$eval('.split-v', el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: innerHeight / 2 }; });
  await page.mouse.move(h.x, h.y); await page.mouse.down();
  for (let i = 1; i <= 6; i++) { await page.mouse.move(h.x - i * 15, h.y); await sleep(60); }
  await page.mouse.up();
  assert.equal(await page.evaluate(() => window.__run), text);
  const after = await page.evaluate(() => ({ y: +window.__lanes.L.g.querySelector('.playhead line').getAttribute('y1'), y6: window.__lanes.L.yOf(6) }));
  assert.ok(Math.abs(after.y - after.y6) < 0.5, `the playhead follows the relayout: ${JSON.stringify(after)}`);
  assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
  await page.evaluate(() => window.__explainer.speed(1));
  assert.deepEqual(errors, []);
});

test('lanes: a bad lane id, step or lane count fails with a clear error', async t => {
  const { page, errors, close } = await openPage(t, 'variant-svg-only.html');
  const msgs = await page.evaluate(() => {
    const out = [];
    const d = window.__lanesBuilder;
    for (const f of [
      () => d.lanes([{ id: 'a', name: 'A' }], { steps: 3 }),
      () => d.lanes([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { steps: 0 }),
      () => { const L = d.lanes([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { steps: 3 }); L.event('c', 1, 'x'); },
      () => { const L = d.lanes([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { steps: 3 }); L.event('a', 4, 'x'); },
      () => { const L = d.lanes([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { steps: 3 }); L.span('a', 3, 2, 'wait'); },
      () => { const L = d.lanes([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { steps: 3 }); L.span('a', 1, 2, 'sleep'); },
    ]) { try { f(); out.push('no error'); } catch (e) { out.push(e.message); } }
    return out;
  });
  assert.ok(msgs.every(m => /^\[plz\] lanes/.test(m)), JSON.stringify(msgs));
  assert.deepEqual(errors, []);
  await close();
});

test('lanes on a phone: lock bars face the nearest resource lane and stay visible, a late message follows the playhead, and compact lanes keep the playhead marker inside', async t => {
  const { page, errors, close } = await openPage(t, 'variant-lanes-extra.html', { viewport: { width: 390, height: 844 } });
  await page.evaluate(() => window.__explainer.instant(true));
  await page.evaluate(() => window.__explainer.run('s1'));
  const r = await page.evaluate(() => {
    const { L, C, mid, tip } = window.__x, box = n => n.getBBox();
    const lanes = [...L.g.querySelectorAll('.lane')].map(lane => {
      const bg = box(lane.querySelector('.lanebg')), bar = lane.querySelector('.lspan.lock rect');
      if (!bar) return null;
      const b = box(bar), cards = [...lane.querySelectorAll('.lev rect')].map(box);
      const covered = cards.some(c => Math.min(c.x + c.width, b.x + b.width) - Math.max(c.x, b.x) > 0.5 && Math.min(c.y + c.height, b.y + b.height) - Math.max(c.y, b.y) > 0.5);
      return { side: b.x + b.width / 2 < bg.x + bg.width / 2 ? 'left' : 'right', covered };
    }).filter(Boolean);
    const mark = box(C.g.querySelector('.playhead path'));
    return { lanes, mid, endTip: tip(), y3: L.yOf(3), y4: L.yOf(4), mark: mark.x, cx: C.box.x };
  });
  assert.deepEqual(r.lanes.map(l => l.side), ['left', 'right'], `each lock bar faces its nearest resource lane: ${JSON.stringify(r.lanes)}`);
  assert.ok(r.lanes.every(l => !l.covered), `no lock bar is under a card: ${JSON.stringify(r.lanes)}`);
  assert.ok(r.mid.tip === null || r.mid.tip <= r.mid.y2 + 0.5, `a late message is not ahead of the playhead: ${JSON.stringify(r.mid)}`);
  assert.ok(r.endTip > r.y3 && r.endTip < r.y4, `the late message arrives in its last step: ${JSON.stringify(r)}`);
  assert.ok(r.mark >= r.cx - 0.5, `the playhead marker of compact lanes is inside the part: ${JSON.stringify(r)}`);
  assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
  assert.deepEqual(errors, []);
  await close();
});

// ---- Parameter playground ----
const fp = (m, n, k) => (1 - Math.exp(-k * n / m)) ** k; // independent of the page
const pgState = page => page.evaluate(() => ({
  params: window.__explainer.params('s6'),
  inputs: [...document.querySelectorAll('.pg:not([hidden]) input[type=range]')].map(i => ({ value: i.value, label: i.labels?.[0]?.textContent ?? i.getAttribute('aria-label'), h: i.getBoundingClientRect().height, text: i.getAttribute('aria-valuetext') })),
  outs: [...document.querySelectorAll('.pg:not([hidden]) output')].map(o => o.textContent),
  presets: [...document.querySelectorAll('.pg:not([hidden]) .pg-preset')].map(b => ({ text: b.textContent, h: b.getBoundingClientRect().height })),
  readout: [...document.querySelectorAll('.svg-scene')].find(g => g.style.display !== 'none').querySelector('.readout .rv')?.textContent,
  live: document.querySelector('.pg:not([hidden]) .pg-live')?.textContent ?? null,
  liveRole: document.querySelector('.pg:not([hidden]) .pg-live')?.getAttribute('aria-live'),
  caps: document.querySelectorAll('.rail-list .cap').length,
}));
const pct = v => (v * 100).toFixed(2) + '%';
const gotoChapter = async (page, name) => {
  await page.evaluate(n => document.querySelector(`[data-scene="${n}"]`).scrollIntoView({ block: 'center', behavior: 'instant' }), name);
  await page.waitForFunction(n => window.__explainer.current() === n, name);
};

test('playground: sliders and presets render, work by keyboard and pointer, redraw at once, and the tour restores the defaults on reset', { timeout: 90_000 }, async t => {
  for (const viewport of [DESKTOP, { width: 390, height: 844 }]) {
    const { page, errors, close } = await openPage(t, 'variant-svg-only.html', { viewport });
    await gotoChapter(page, 's6');
    let st = await pgState(page);
    assert.deepEqual(st.params, { m: 800, k: 4 });
    assert.deepEqual(st.inputs.map(i => i.label), ['Bits m', 'Hash functions k']);
    assert.deepEqual(st.outs, ['800 bits', '4']);
    assert.equal(st.inputs[0].text, '800 bits');
    assert.ok([...st.inputs, ...st.presets].every(c => c.h >= 44), `touch targets: ${JSON.stringify(st)}`);
    assert.equal(st.readout, pct(fp(800, 100, 4)));
    assert.equal(st.liveRole, 'polite');
    // keyboard: one step right
    await page.focus('.pg:not([hidden]) input[type=range]');
    await page.keyboard.press('ArrowRight');
    await nextFrames(page);
    st = await pgState(page);
    assert.deepEqual(st.params, { m: 900, k: 4 });
    assert.equal(st.readout, pct(fp(900, 100, 4)), 'the chart and readout follow the slider at once');
    assert.match(st.live, /900 bits/, 'the live line describes the new value');
    const caps0 = st.caps;
    // the ordinal slider moves through its list
    await page.focus('.pg:not([hidden]) .pg-row:nth-of-type(2) input[type=range]');
    await page.keyboard.press('End');
    await nextFrames(page);
    assert.deepEqual((await pgState(page)).params, { m: 900, k: 8 });
    // pointer: press at the far left of the first slider
    const box = await page.locator('.pg:not([hidden]) input[type=range]').first().boundingBox();
    await page.mouse.click(box.x + 2, box.y + box.height / 2);
    await nextFrames(page);
    assert.equal((await pgState(page)).params.m, 100);
    // a preset sets several sliders at once
    await page.locator('.pg:not([hidden]) .pg-preset', { hasText: '16 bits per item' }).click();
    await nextFrames(page);
    st = await pgState(page);
    assert.deepEqual(st.params, { m: 1600, k: 8 });
    assert.equal(st.readout, pct(fp(1600, 100, 8)));
    assert.equal(st.caps, caps0, 'exploring writes the live line, not captions');
    // the hook sets values deterministically
    assert.deepEqual(await page.evaluate(() => window.__explainer.params('s6', { m: 500 })), { m: 500, k: 8 });
    assert.equal((await pgState(page)).readout, pct(fp(500, 100, 8)));
    assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
    // the run is the tour; a new run starts from the defaults (captured when reset clears the rail)
    await page.evaluate(() => window.__explainer.instant(true));
    assert.equal(await page.evaluate(() => window.__explainer.run('s6')), '2. With 16 bits per item, the rate fell below 1%.');
    assert.deepEqual((await pgState(page)).params, { m: 1600, k: 4 }, 'the tour ends at its last stop');
    const atReset = await page.evaluate(async () => {
      const list = document.querySelector('.rail-list');
      let snap = null;
      const mo = new MutationObserver(() => { if (snap === null && list.children.length === 0) snap = window.__explainer.params('s6'); });
      mo.observe(list, { childList: true });
      window.__explainer.instant(false); window.__explainer.speed(2); // a real-time run, so the reset state is observable
      await window.__explainer.run('s6');
      mo.disconnect();
      window.__explainer.speed(1);
      return snap;
    });
    assert.deepEqual(atReset, { m: 800, k: 4 }, 'reset restores the defaults');
    assert.deepEqual(errors, []);
    await close();
  }
});

// The reader's hand on a control, without focus (Safari and Firefox on macOS do not focus buttons or sliders on click).
const press = (page, sel) => page.evaluate(sel => { const n = document.querySelector(sel); n.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, pointerId: 1 })); }, sel);
const release = page => page.evaluate(() => window.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, pointerId: 1 })));
const capCount = page => page.evaluate(() => document.querySelectorAll('.rail-list .cap').length);
const autoplayOn = async (page, name) => {
  await gotoChapter(page, name);
  await page.evaluate(() => { window.__explainer.speed(2); window.__explainer.autorun(true); });
  await page.waitForFunction(() => document.querySelectorAll('.rail-list .cap').length >= 1, null, { timeout: 20_000 });
};
const GRACE = 2500; // the shell's hold after the last reader input (ms)

test('playground hold: a focus-less preset press stops the tour, keeps the reader\'s values until they leave the chapter, then auto-play resumes', { timeout: 90_000 }, async t => {
  const { page, errors, close } = await openPage(t, 'variant-svg-only.html');
  await autoplayOn(page, 's6');
  const preset = '.pg:not([hidden]) .pg-preset:nth-child(2)';
  await press(page, preset);
  await release(page);
  await page.evaluate(sel => document.querySelector(sel).click(), preset); // click() does not focus
  assert.equal(await page.evaluate(() => document.activeElement?.matches?.('.pg *') ?? false), false, 'the controls never took focus');
  const caps = await capCount(page);
  assert.deepEqual((await pgState(page)).params, { m: 1600, k: 8 });
  await sleep(GRACE + 1500);
  assert.deepEqual((await pgState(page)).params, { m: 1600, k: 8 }, 'the reader\'s values stay after the hold ends');
  assert.equal(await capCount(page), caps, 'auto-play does not restart a chapter the reader changed');
  await gotoChapter(page, 's5');
  await gotoChapter(page, 's6');
  await page.waitForFunction(() => document.querySelectorAll('.rail-list .cap').length >= 1, null, { timeout: 20_000 });
  await page.waitForFunction(() => JSON.stringify(window.__explainer.params('s6')) !== JSON.stringify({ m: 1600, k: 8 }), null, { timeout: 20_000 });
  await page.evaluate(() => { window.__explainer.autorun(false); window.__explainer.speed(1); });
  assert.deepEqual(errors, []);
  await close();
});

test('playground hold: a press without a change releases after the grace period, a pointer never released is released by a chapter change, and keys hold too', { timeout: 120_000 }, async t => {
  const { page, errors, close } = await openPage(t, 'variant-svg-only.html');
  await autoplayOn(page, 's6');
  // press and release on the controls, no value change: auto-play comes back after the grace period
  await press(page, '.pg:not([hidden])');
  await release(page);
  const caps = await capCount(page);
  await sleep(800);
  assert.equal(await capCount(page), caps, 'nothing runs during the hold');
  await page.waitForFunction(c => document.querySelectorAll('.rail-list .cap').length !== c, caps, { timeout: GRACE + 15_000 });
  // keyboard: an arrow key changes the value and holds; the value stays
  await page.focus('.pg:not([hidden]) input[type=range]');
  await page.keyboard.press('ArrowRight');
  const kept = (await pgState(page)).params;
  await sleep(GRACE + 1500);
  assert.deepEqual((await pgState(page)).params, kept, 'a keyboard change is kept');
  await page.evaluate(() => document.activeElement.blur());
  // a pointer pressed and never released: leaving the chapter releases it, and the next chapter's auto-play runs
  await press(page, '.pg:not([hidden]) input[type=range]');
  await gotoChapter(page, 's5');
  await page.waitForFunction(() => document.querySelectorAll('.rail-list .cap').length >= 1, null, { timeout: 20_000 });
  await page.evaluate(() => { window.__explainer.autorun(false); window.__explainer.speed(1); });
  assert.deepEqual(errors, []);
  await close();
});

test('playground controls are not chapters, and a docked slider keeps focus across relayouts (landscape phone)', async t => {
  const { page, errors, close } = await openPage(t, 'variant-svg-only.html', { viewport: { width: 844, height: 390 } });
  assert.equal(await page.evaluate(() => document.querySelectorAll('.pg[data-scene]').length), 0, 'the controls carry no data-scene');
  await gotoChapter(page, 's6');
  assert.equal(await page.evaluate(() => document.querySelector('.pg:not([hidden])').classList.contains('docked')), true);
  await page.focus('.pg:not([hidden]) input[type=range]');
  const before = await page.evaluate(() => { window.__pgInput = document.activeElement; window.__pgParent = document.activeElement.closest('.pg').parentElement; return true; });
  for (const h of [391, 392, 390]) { await page.setViewportSize({ width: 844, height: h }); await nextFrames(page, 3); }
  assert.ok(before && await page.evaluate(() => document.activeElement === window.__pgInput && window.__pgInput.closest('.pg').parentElement === window.__pgParent), 'the focused slider stayed where it was');
  assert.deepEqual(errors, []);
  await close();
});

// Part details: a table note sized with the key column it is drawn after, list and stepped params, chart and meter state
// restored by reset in a step-diagram scene, and x tick labels that keep a gap.
const PG_EXTRA = `
defineScene('s1', { kit: 'svg', title: '1  Notes and charts', build(d) {
  const t = d.table({ title: 'Answers', keys: [1, 2], header: ['Input key in the original request', 'answer'], note: 'a rather long answer' });
  const chart = d.chart({ title: 'Rate', x: { label: 'n', min: 1000, max: 20000, ticks: [1000, 2000, 3000, 4000, 5000, 10000, 15000, 20000], format: v => v.toLocaleString('en-US') }, y: { min: 0, max: 1, ticks: [0, 0.5, 1] } });
  const s = chart.line(x => 0.5);
  const mk = chart.marker(s); mk.at(1000);
  const meter = d.meter({ title: 'Share', parts: [{ label: 'a', tone: 'matter' }, { label: 'b' }] }); meter.set([0.25]);
  window.__px = { t, chart, s, mk, meter };
  return { diagram: d.stack([t, chart, meter], { dir: 'col' }), async run(a, say) {
    t.row(0).note('a rather long answer'); s.set(x => x / 20000); mk.at(15000); meter.set([0.8], ['80%', '20%']);
    await a.wait(400); say('Done.');
  } };
} });
defineScene('s3', { kit: 'svg', title: '3  Long line', build(d) {
  const code = d.code({ title: 'long.js', lines: ['ok();', 'const aVeryLongVariableNameThatDoesNotFit = someFunction(withArguments, andMoreArguments, andEvenMore);'] });
  const vars = d.vars({ title: 'Vars', names: ['a', 'aLongerName'], sample: '123456' });
  vars.set('aLongerName', '123456');
  window.__vars = vars;
  return { diagram: d.stack([code, vars], { dir: 'col' }), async run(a, say) { await a.line(code, 2); say('Done.'); } };
} });
defineScene('s2', { kit: 'svg', title: '2  List and step', params: { mode: { label: 'Mode', values: ['off', 'on', 'auto'], value: 'on' }, r: { label: 'R', min: 0, max: 10, step: 4, value: 8 } },
  build(d) { const out = d.readout({ label: 'Value', sample: 'auto 10' }); return { diagram: out, update(p) { out.set(p.mode + ' ' + p.r); return p.mode + ' ' + p.r; }, async run(a, say) { say('Done.'); } }; } });
`;
const PX_STATE = () => {
  const P = window.__px, seg = [...P.meter.g.querySelectorAll('.mseg')].slice(0, 2).map(r => r.getAttribute('width'));
  return JSON.stringify({ path: P.s.path.getAttribute('d'), dot: [P.mk.dot.getAttribute('cx'), P.mk.dot.getAttribute('cy')], seg });
};

test('parts: a long table note stays clear of the × mark, list and stepped params snap, chart and meter state is restored by reset, and x tick labels keep a gap', { timeout: 60_000 }, async t => {
  for (const viewport of [DESKTOP, { width: 390, height: 844 }]) {
    const { page, errors, close } = await openPage(t, 'variant-pg-extra.html', { viewport });
    const fresh = await page.evaluate(PX_STATE);
    await page.evaluate(() => window.__explainer.instant(true));
    await page.evaluate(() => window.__explainer.run('s1'));
    const note = await page.evaluate(() => { const r = window.__px.t.row(0); return { note: r.noteText.getBoundingClientRect().right, x: r.xc.getBoundingClientRect().left }; });
    assert.ok(note.note <= note.x - 2, `the note ends before the × mark: ${JSON.stringify(note)}`);
    const ticks = await page.evaluate(() => [...window.__px.chart.g.querySelectorAll('.tk')].filter(n => n.getBoundingClientRect().top > window.__px.chart.g.querySelector('.plot').getBoundingClientRect().bottom - 1)
      .map(n => ({ text: n.textContent, shown: n.style.display !== 'none', r: n.getBoundingClientRect() })));
    const shown = ticks.filter(x => x.shown);
    for (let i = 1; i < shown.length; i++) assert.ok(shown[i].r.left - shown[i - 1].r.right >= 3, `${viewport.width}: tick labels ${shown[i - 1].text} and ${shown[i].text} keep a gap`);
    assert.ok(shown[0].text === '1,000' && shown.at(-1).text === '20,000', `the end ticks stay: ${shown.map(x => x.text)}`);
    assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
    // reset restores the chart and meter of a step-diagram scene (captured when reset clears the rail)
    const atReset = await page.evaluate(async src => {
      const state = new Function(`return (${src})()`), list = document.querySelector('.rail-list');
      let snap = null;
      const mo = new MutationObserver(() => { if (snap === null && list.children.length === 0) snap = state(); });
      mo.observe(list, { childList: true });
      window.__explainer.instant(false);
      await window.__explainer.run('s1');
      mo.disconnect();
      return snap;
    }, PX_STATE.toString());
    assert.equal(atReset, fresh, 'reset restores the series, the marker and the meter');
    // list params snap by index, stepped params stay within max and agree with the native slider
    const p = await page.evaluate(() => { window.__explainer.instant(true); return window.__explainer.run('s2').then(() => {
      const a = window.__explainer.params('s2', { mode: 'auto' });
      const b = window.__explainer.params('s2', { r: 10 });
      const inputs = [...document.querySelectorAll('.pg:not([hidden]) input[type=range]')].map(i => i.value);
      return { a, b, inputs };
    }); });
    assert.equal(p.a.mode, 'auto');
    assert.ok(p.b.r <= 10 && String(p.b.r) === p.inputs[1], `stepped value ${p.b.r} vs slider ${p.inputs[1]}`);
    assert.equal(p.inputs[0], '2', 'the list slider stands at the third entry');
    assert.deepEqual(errors, []);
    await close();
  }
});

// ---- Code and state in sync ----
const CS_STATE = () => {
  const C = window.__cs;
  return JSON.stringify({ current: C.code.current, ran: [...C.code.ran].sort(), frames: C.frames.list(), micro: C.micro.list(), tasks: C.tasks.list(), out: C.out.list(),
    marker: C.code.g.querySelector('.cmark')?.getAttribute('transform') ?? null });
};
const csState = page => page.evaluate(CS_STATE);

test('code and state: the marker leaves traces, the stack pushes and pops, queues are FIFO, the console grows, and reset restores everything', { timeout: 60_000 }, async t => {
  const { page, errors, close } = await openPage(t, 'variant-svg-only.html');
  await gotoChapter(page, 's7');
  const fresh = await csState(page);
  assert.deepEqual(JSON.parse(fresh), { ...JSON.parse(fresh), current: null, ran: [], frames: [], micro: [], tasks: [], out: [] });
  await page.evaluate(() => window.__explainer.instant(true));
  assert.equal(await page.evaluate(() => window.__explainer.run('s7')), '6. Then the task ran.');
  const end = JSON.parse(await csState(page));
  assert.deepEqual([end.current, end.ran, end.frames, end.micro, end.tasks, end.out], [null, [1, 2, 3, 4], [], [], [], ['1', '4', '3', '2']]);
  const fifo = await page.evaluate(() => { const q = window.__cs.micro; q.enqueue('x'); q.enqueue('y'); const first = q.dequeue(); const rest = q.list(); q.dequeue(); return { first, rest }; });
  assert.deepEqual(fifo, { first: 'x', rest: ['y'] });
  const lifo = await page.evaluate(() => { const f = window.__cs.frames; f.push('a'); f.push('b'); const top = f.list().at(-1); f.pop(); const left = f.list(); f.pop(); return { top, left }; });
  assert.deepEqual(lifo, { top: 'b', left: ['a'] });
  assert.deepEqual(await page.evaluate(() => [window.__explainer.overlaps(), window.__explainer.clipped()]), [[], []]);
  const atReset = await page.evaluate(async src => {
    const state = new Function(`return (${src})()`), list = document.querySelector('.rail-list');
    let snap = null;
    const mo = new MutationObserver(() => { if (snap === null && list.children.length === 0) snap = state(); });
    mo.observe(list, { childList: true });
    window.__explainer.instant(false); window.__explainer.speed(2);
    await window.__explainer.run('s7');
    mo.disconnect(); window.__explainer.speed(1);
    return snap;
  }, CS_STATE.toString());
  assert.equal(atReset, fresh, 'reset restores the marker, the traces, the stack, the queues and the console');
  assert.deepEqual(errors, []);
  await close();
});

test('code and state: Step advances one authored step, Run after partial stepping completes, stepping holds auto-play, and a too-long line is reported', { timeout: 90_000 }, async t => {
  const { page, errors, close } = await openPage(t, 'variant-svg-only.html');
  await gotoChapter(page, 's7');
  assert.equal(await page.locator('[data-scene="s7"] .act .step-btn').count(), 1, 'a Step button beside the run button');
  assert.equal(await page.locator('[data-scene="s6"] .act .step-btn').count(), 0, 'only where the scene asks for it');
  await page.evaluate(() => window.__explainer.instant(true));
  let r = await page.evaluate(() => window.__explainer.step('s7'));
  assert.deepEqual([r.done, JSON.parse(await csState(page)).current, JSON.parse(await csState(page)).out], [false, 1, ['1']]);
  r = await page.evaluate(() => window.__explainer.step('s7'));
  assert.deepEqual([r.done, JSON.parse(await csState(page)).current, JSON.parse(await csState(page)).tasks], [false, 2, ['cb']]);
  assert.equal(await page.evaluate(() => window.__explainer.run('s7')), '6. Then the task ran.', 'Run continues a stepped run to the end');
  assert.deepEqual(JSON.parse(await csState(page)).out, ['1', '4', '3', '2']);
  // stepping is reader input: auto-play holds and the stepped state stays
  await page.evaluate(() => window.__explainer.instant(false));
  await page.evaluate(() => { window.__explainer.speed(2); window.__explainer.autorun(true); });
  await page.waitForFunction(() => document.querySelectorAll('.rail-list .cap').length >= 1, null, { timeout: 20_000 });
  await page.evaluate(() => document.querySelector('[data-scene="s7"] .act .step-btn').click());
  await page.waitForFunction(() => window.__cs.code.current !== null, null, { timeout: 10_000 });
  await sleep(1200); // the step itself finishes (it pauses at the next line)
  const held = await csState(page);
  await sleep(GRACE + 1500);
  assert.equal(await csState(page), held, 'auto-play does not move a chapter the reader is stepping');
  await page.evaluate(() => { window.__explainer.autorun(false); window.__explainer.speed(1); });
  assert.deepEqual(errors, []);
  await close();
  // a line that does not fit is reported (the kit does not shrink text below its minimum)
  const long = await openPage(t, 'variant-pg-extra.html', { viewport: { width: 390, height: 844 } });
  await long.page.evaluate(() => window.__explainer.instant(true));
  await long.page.evaluate(() => window.__explainer.run('s3'));
  const clipped = await long.page.evaluate(() => window.__explainer.clipped());
  assert.ok(clipped.some(x => x.startsWith('const aVeryLong')), `the long line is reported: ${JSON.stringify(clipped)}`);
  assert.ok(!clipped.some(x => ['a', 'aLongerName', '123456'].includes(x)), `named values fit their part: ${JSON.stringify(clipped)}`);
  assert.match(await long.page.evaluate(() => { try { window.__vars.slot('nope'); return 'no error'; } catch (e) { return e.message; } }), /^\[plz\] d\.vars/);
  await long.close();
});

// Every console order the event-loop page shows is the real one: each chapter's program runs in this browser page
// (its own console, real timers and promises) and must print what the page's console part shows after the chapter's run.
async function eventLoopOrders(page) {
  for (const name of EXAMPLE_SCENES['event-loop']) {
    await page.evaluate(n => window.__explainer.run(n), name);
    const shown = await page.evaluate(() => [...[...document.querySelectorAll('.svg-scene')].find(g => g.style.display !== 'none').querySelectorAll('.console .chip-i text')].map(t => t.textContent));
    const real = await page.evaluate(n => new Promise(resolve => {
      const logs = [];
      new Function('console', window.__el.PROGRAMS[n])({ log: v => logs.push(String(v)) });
      setTimeout(() => resolve(logs), 100);
    }), name);
    assert.deepEqual(shown, real, `${name}: the page's console matches the program's real output`);
    const lines = await page.evaluate(n => [...[...document.querySelectorAll('.svg-scene')].find(g => g.style.display !== 'none').querySelectorAll('.code .ctext')].map(t => t.textContent).join('\n') === window.__el.PROGRAMS[n], name);
    assert.ok(lines, `${name}: the code panel shows the program that was run`);
    // stepping: every step shows a new caption, the last one too
    const caps = await page.evaluate(async n => { const out = []; for (let i = 0; i < 20; i++) { const r = await window.__explainer.step(n); out.push(r.caption); if (r.done) break; } return out; }, name);
    assert.ok(caps.every((c, i) => i === 0 || c !== caps[i - 1]), `${name}: a new caption at every step: ${JSON.stringify(caps)}`);
  }
  // a wide stage uses its width: the state parts are not one tall column (two of them share a line)
  await page.evaluate(() => window.__explainer.run('predict'));
  const tops = await page.evaluate(() => { const g = [...document.querySelectorAll('.svg-scene')].find(g => g.style.display !== 'none'); return ['.frames', '.queue', '.console'].map(sel => Math.round(g.querySelector('.part' + sel).getBoundingClientRect().top)); });
  assert.ok(new Set(tops).size < tops.length, `state parts share a line on a wide stage: ${tops}`);
}

test('code and state: stepping never hangs a pending step, every step changes the caption, the current line wins over its ran dot, and frames are not leaked', { timeout: 90_000 }, async t => {
  const { page, errors, close } = await openPage(t, 'variant-svg-only.html');
  await gotoChapter(page, 's7');
  // a step in progress, then a step in another chapter: the first one settles
  const settled = await page.evaluate(async () => {
    window.__explainer.speed(0.5);
    const p1 = window.__explainer.step('s7').then(() => 'settled');
    await new Promise(r => setTimeout(r, 300));
    const p2 = window.__explainer.step('s6');
    const r1 = await Promise.race([p1, new Promise(r => setTimeout(() => r('hung'), 8000))]);
    await p2;
    window.__explainer.speed(1);
    return r1;
  });
  assert.equal(settled, 'settled', 'a pending step settles when the reader steps another chapter');
  // every step shows a new caption, including the last
  await page.evaluate(() => window.__explainer.instant(true));
  const captions = await page.evaluate(async () => {
    const out = [];
    for (let i = 0; i < 20; i++) { const r = await window.__explainer.step('s7'); out.push(r.caption); if (r.done) break; }
    return out;
  });
  assert.ok(captions.every((c, i) => i === 0 || c !== captions[i - 1]), `a new caption at every step: ${JSON.stringify(captions)}`);
  // current wins over ran
  const dot = await page.evaluate(() => { const c = window.__cs.code; c.setCurrent(2); c.setCurrent(2); const row = c.line(2); const r = { now: row.g.classList.contains('now'), dot: getComputedStyle(row.dot).opacity, ran: c.ran.has(2) }; c.setCurrent(null); return r; });
  assert.deepEqual(dot, { now: true, dot: '0', ran: true }, 'the current line hides its ran dot');
  // framed registrations do not grow with repeated runs
  const counts = [];
  for (let i = 0; i < 3; i++) { await page.evaluate(() => window.__explainer.run('s7')); counts.push(await page.evaluate(() => window.__explainer.kitInfo().framed)); }
  assert.ok(counts[0] > 0 && counts.every(c => c === counts[0]), `framed entries stay the same across runs: ${counts}`);
  assert.deepEqual(errors, []);
  await close();
});

test('stacked phones: a chapter whose stage height differs from its neighbour stays active (no flip back)', { timeout: 60_000 }, async t => {
  const { page, errors, close } = await openPage(t, 'variant-svg-only.html', { viewport: { width: 390, height: 844 } });
  await page.evaluate(() => window.__explainer.instant(true));
  for (const [from, to] of [['s6', 's7'], ['s7', 's6'], ['s5', 's6']]) {
    await page.evaluate(n => window.__explainer.run(n), from);
    const r = await page.evaluate(async n => {
      const seen = [];
      const mo = new MutationObserver(() => seen.push(window.__explainer.current()));
      document.querySelectorAll('.chapter').forEach(c => mo.observe(c, { attributes: true, attributeFilter: ['class'] }));
      const text = await window.__explainer.run(n);
      await new Promise(r => setTimeout(r, 600));
      mo.disconnect();
      return { text, seen: [...new Set(seen)], current: window.__explainer.current() };
    }, to);
    assert.ok(r.text.length > 0 && r.current === to, `${from} → ${to}: ${JSON.stringify(r)}`);
    assert.ok(!r.seen.includes(from) || r.seen.lastIndexOf(from) < r.seen.indexOf(to), `${from} → ${to} did not flip back: ${JSON.stringify(r.seen)}`);
  }
  assert.deepEqual(errors, []);
  await close();
});

// Wide stages: a d.flow diagram (code and state) tries each of its wrappings with each caption arrangement and keeps the one
// drawn largest, under the same 1.3× preference for captions beside the drawing as any diagram. The chosen layout box is
// centred on the stage, and the caption column has room for every caption of the chapter (none scrolled out of view).
const FLOW_STAGE = page => page.evaluate(() => {
  const kit = window.__explainer.kitInfo(), rail = document.querySelector('.rail'), r = rail.getBoundingClientRect();
  const caps = [...rail.querySelectorAll('.cap')].map(c => c.getBoundingClientRect());
  return {
    kit, overlaps: window.__explainer.overlaps(), clipped: window.__explainer.clipped(),
    // every caption lies inside the rail's visible box, and the rail does not scroll
    captionsShown: caps.length > 0 && rail.scrollHeight <= rail.clientHeight + 1 && caps.every(c => c.top >= r.top - 0.5 && c.bottom <= r.bottom + 0.5),
  };
});
// The arrangement the 1.3× rule picks among the candidates the kit reports: the largest k beside, the largest k below,
// and below only when its k is 1.3 times larger.
const ruleScale = cands => {
  const max = list => Math.max(0, ...list.map(c => c.k));
  const right = max(cands.filter(c => !c.below)), below = max(cands.filter(c => c.below));
  return below > right * 1.3 ? { below: true, k: below } : { below: false, k: right };
};
for (const file of ['example-event-loop.html', 'example-event-loop.en.html']) {
  test(`${file}: code and state take the arrangement drawn largest, centred, with every caption in view`, { timeout: 120_000 }, async t => {
    for (const [width, height, floor] of [[1440, 900, 0.2], [2282, 1293, 0.14]]) {
      const { page, errors, close } = await openPage(t, file, { viewport: { width, height } });
      await page.evaluate(() => window.__explainer.instant(true));
      for (const n of EXAMPLE_SCENES['event-loop']) {
        await page.evaluate(n => window.__explainer.run(n), n);
        const r = await FLOW_STAGE(page), kit = r.kit, tag = `${width}x${height} ${n}`;
        assert.ok(['right', 'below'].includes(kit.arrangement), `${tag}: the kit placed the captions as a column (${kit.arrangement})`);
        assert.ok(kit.candidates.length >= 3, `${tag}: the flow's wrappings were all tried (${kit.candidates.length})`);
        const want = ruleScale(kit.candidates);
        assert.equal(kit.arrangement === 'below', want.below, `${tag}: captions ${kit.arrangement}, the rule says ${want.below ? 'below' : 'right'}`);
        assert.ok(kit.scale >= want.k / 1.02 - 1e-9, `${tag}: scale ${kit.scale} is the largest the rule allows (${want.k})`);
        const b = kit.block, share = (kit.box.w * kit.box.h) / (kit.W * kit.H);
        assert.ok(share > floor, `${tag}: the diagram's layout box covers ${share.toFixed(3)} of the stage`);
        assert.ok(Math.abs(b.x - (kit.W - b.x - b.w)) <= 2, `${tag}: the layout block is centred: ${JSON.stringify(b)} in ${kit.W}`);
        assert.ok(r.captionsShown, `${tag}: every caption is in view`);
        assert.deepEqual([r.overlaps, r.clipped], [[], []], `${tag}: overlaps and clipped`);
      }
      assert.deepEqual(errors, []);
      await close();
    }
  });
}

test('d.flow: a nested flow wraps beside the item before it, and a flow inside a container is still compared by wrapping', { timeout: 60_000 }, async t => {
  const scales = [];
  for (const file of ['variant-svg-only.html', 'variant-svg-nested-flow.html']) {
    const { page, errors, close } = await openPage(t, file);
    await page.evaluate(() => window.__explainer.instant(true));
    await page.evaluate(() => window.__explainer.run('s7'));
    const kit = await page.evaluate(() => window.__explainer.kitInfo());
    assert.ok(kit.candidates.length >= 3, `${file}: wrappings tried (${JSON.stringify(kit.candidates)})`);
    scales.push(kit.scale);
    if (file === 'variant-svg-only.html') {
      // the code beside a state that wraps onto more lines: one top line holds both, narrower than the one-row width
      const oneRow = Math.max(...kit.candidates.map(c => c.w));
      assert.ok(kit.candidates.some(c => c.lines?.length === 1 && c.lines[0] === 2 && c.w < oneRow - 1), `${file}: a candidate with the state wrapped beside the code: ${JSON.stringify(kit.candidates)}`);
    }
    assert.deepEqual(errors, []);
    await close();
  }
  assert.ok(Math.abs(scales[0] - scales[1]) < 0.01, `a flow inside a column stack is drawn as large as the same flow alone: ${scales}`);
});
