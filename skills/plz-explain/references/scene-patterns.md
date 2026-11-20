# Scene patterns

Code patterns for building each form. Pick the chapter's form first ("Choosing a form per chapter" in SKILL.md, and `forms.md`), then the pattern below that builds it. The timing rules behind the numbers here are in `motion.md`.
Patterns 1–9 use the axo kit (the default); patterns 10–14 use the svg kit (2D step diagrams). Assume all code is written inside `build()` of `defineScene` (for `g`, `temp`, `a`, and `say`, see
engine-api.md). Put one-shot objects in `temporaryGroup()` and use `disposeObject()` or
`clearGroup(temp)` to release them; an ordinary `remove()` or `clear()` does not free their resources.

## Steps and captions (every pattern)

- Split the action into numbered steps and give each step one `say('N. …')`, matching `ol.steps` in the body. Captions stay on the stage, so the reader sees every step at the end.
- One step, one kind of change: a move, an appearance, or a flash. A tracked move takes about 1 s (`a.move` default); do not shorten it below 0.7 s.
- Real cause and effect: start the effect right after the cause arrives (for example `await a.move(p, wall)` then `await a.flash(wall, …)` with no wait between). Plain sequence: leave `await a.wait(…)` between the steps.
- Announce a step, then report its outcome under the same number: `say('1. The code tries to leave the room.')` … `say('1. The wall blocked it.')`. The second caption replaces the first.
- When it is not obvious which object a step is about, add `{ anchor: obj }`: the same number appears in a badge next to that object. Check `overlaps()` afterwards, because the badge is a label too.
- Leave the result visible at the end (a held `flash`, a changed label, an object that stays) rather than letting everything return to the start.

The example chapters of patterns 1–9 are the chapter numbers of `assets/example-agent-sandbox.html` (AI-agent code sandbox, 10 chapters); patterns 10–14 point at `assets/example-hash-join-sip.html` (hash join and SIP, 5 chapters, svg kit only), pattern 15 at `assets/example-lost-update.html` (two sessions and one row, 5 chapters, svg kit only), pattern 16 at `assets/example-bloom-filter.html` (Bloom filters, 5 chapters, svg kit only), and pattern 17 at `assets/example-event-loop.html` (the JavaScript event loop, 5 chapters, svg kit only). Every example has an English counterpart beside it, with the same name ending in `.en.html` (for example `assets/example-lost-update.en.html`); look at that one when building an English page.

| Shape of the concept | Pattern | Example chapter (example-agent-sandbox) |
|---|---|---|
| The lower layer supports the upper layer | 1. Layers | The shared floor (hardware → host kernel), the hypervisor layer in chapter 6 |
| Something is confined or blocked | 2. Boundary and escape attempt | First half of chapter 4, chapter 6 (two layers: wall and hypervisor) |
| Everyone shares one resource, which is dangerous | 3. Flaw in a shared foundation | Second half of chapter 4 |
| Every request passes through one point | 4. Intermediary | Chapter 2 |
| Authority is handed along like a chain | 5. Authority chain | Chapter 5 |
| Things come and go only through allowed passages | 6. Allowed exit | Chapter 7, chapter 8 (working folder and proxy allowlist) |
| Handled by passing through several components | 7. Request path | No such chapter (the template's `s2`) |
| Created, kept, stopped, and revived | 8. Lifetime | Chapter 9 |
| Two approaches compared under the same conditions | 9. Side-by-side comparison | Chapter 3 (same question, different answer), chapter 10 (four stages) |
| Which rows or keys go where, and in what order (svg) | 10. Row-level step diagram | `example-hash-join-sip.html` chapter 2 |
| Something is filtered out early (svg) | 11. Filter | `example-hash-join-sip.html` chapter 3, the template's `s3` |
| The same input with an option off and on (svg) | 12. Side-by-side panels | `example-hash-join-sip.html` chapter 4 |
| A plan of operators with counts per step (svg) | 13. Operator tree | `example-hash-join-sip.html` chapter 1 |
| Rows spread over several nodes or servers (svg) | 14. Node columns | `example-hash-join-sip.html` chapter 5 |
| A few actors whose relative timing decides the outcome (svg) | 15. Lanes | `example-lost-update.html` chapters 1–4; two rules side by side: chapter 5 |
| An outcome that responds to a continuous or ordinal parameter (svg) | 16. Parameter playground | `example-bloom-filter.html` chapters 3–5 |
| What code does to hidden state: a stack, queues, a console (svg) | 17. Code and state in sync | `example-event-loop.html` (all chapters; chapter 4 for stepping and predicting) |

## 1. Layers

Stack the base layers as light-colored slabs, and attach labels at the front left corner, at a different height for each layer.

```js
base.add(block(13, 0.6, 8, [0, 0, 0]));
const kernel = block(13, 0.45, 8, [0, 0.6, 0], { color: COLOR.boundSoft });
base.add(kernel);
base.add(tag('Hardware', [-5.6, 0.3, 4.05]));
base.add(tag('Host kernel', [-5.6, 0.83, 4.05], 'bound'));
const FLOOR = 1.05;                       // top surface height for objects placed afterward
```

When a thin layer sits in between (hypervisor, runtime), put a slab 0.2-0.25 thick on top of it in `boundMid`.

## 2. Boundary and escape attempt

The actor heads for the wall, the wall flashes, and the actor returns to its place. The template's `s1` is this pattern.
If the boundary has two layers, flash the inner floor slab and then the outer layer in turn.

```js
const p = packet(COLOR.actor, [x, inner + 0.3, z], 0.17); temp.add(p);
await a.move(p, [x, inner + 0.15, z], 500);
await a.flash(innerFloor, COLOR.actor, 800);   // the inside was breached (red)
await a.move(p, [x, midTop + 0.12, z], 500);
await a.flash(midLayer, COLOR.bound, 800);     // blocked on the outside (blue)
await a.move(p, [x, inner + 0.6, z], 500); disposeObject(p);
```

With numbered captions: `say('1. …')` before the first move, `say('1. … blocked …', { anchor: innerFloor })` after the flash.

Tell the result with color: the breached place is actor, the place that blocked is bound.

## 3. Flaw in a shared foundation

Even with several rooms, if there is one floor, a crack in the floor spreads to everyone.

```js
const crack = line([[-0.4, FLOOR + 0.02, 2.6], [0.6, FLOOR + 0.02, 1.5], [2.6, FLOOR + 0.02, 0.7], [4.4, FLOOR + 0.02, -0.4]], COLOR.actor, 0.95);
crack.visible = false; g.add(crack);            // set to false again in reset
// run:
await a.move(actor, [x, FLOOR - 0.2, z], 600);  // digs into the floor
crack.visible = true;
await a.flash(kernel, COLOR.actor, 900);
await Promise.all([a.flash(roomB, COLOR.actor, 900), a.flash(roomC, COLOR.actor, 900)]);
```

## 4. Intermediary

Make each request a small ball, send it down to the surface of the intermediary layer, flash that layer, and then send the ball to its target.
Attaching a label to each request as a child of the ball makes the label move with the ball.

```js
for (const c of calls) {
  const p = packet(COLOR.actor, src, 0.17); p.add(tag(c.name, [0, 0.45, 0], 'actor')); temp.add(p);
  await a.move(p, [src[0], FLOOR + 0.05, src[2]], 600);
  await a.flash(kernel, COLOR.bound, 600);
  await a.move(p, [c.target[0], FLOOR + 0.08, c.target[2]], 800);   // travels along over the intermediary layer
  await a.move(p, c.target, 400);
  disposeObject(p);
}
```

## 5. Authority chain

The actor crosses over to whoever holds the authority, and that side creates a new space for it. A tube (`tube`) is the passage,
and the newly created room is drawn as glass in the actor color.

```js
const evil = glass(3.7, 2.2, 1.9, [x, FLOOR, z], { color: COLOR.actor, edge: COLOR.actor, opacity: 0.1 });
evil.visible = false; g.add(evil);              // reset: visible=false, scale 1
// run:
evil.scale.setScalar(0.01); evil.visible = true;
await a.scaleTo(evil, 1, 800);
```

## 6. Allowed exit

Put the actor inside a sphere and attach exits (short cylinders) to the sphere's surface. If it goes in another direction the sphere flashes,
and matter comes and goes through the exits.

```js
const cap = new THREE.Group(); cap.position.copy(center);
const sph = new THREE.Mesh(new THREE.SphereGeometry(R, 48, 32), mat(COLOR.bound, 0.1));
cap.add(sph); cap.userData.mesh = sph;
for (const rot of [[Math.PI / 2, 0, 0], [0, 0, 0], [0, Math.PI / 2, 0]]) {
  const ring = new THREE.Mesh(new THREE.TorusGeometry(R, 0.02, 8, 96), mat(COLOR.bound, 0.85));
  ring.rotation.set(...rot); cap.add(ring);
}
const port = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.4, 18), mat(COLOR.matter));
port.position.copy(dir.clone().multiplyScalar(R));
port.quaternion.setFromUnitVectors(V(0, 1, 0), dir);
cap.add(port);
cap.add(tag('Allowed: read files', dir.clone().multiplyScalar(R + 1.1).add(V(0, 0.35, 0)).toArray(), 'matter'));
```

An R around 1.8 is right. If it is smaller, the exit label and the actor's label overlap.

## 7. Request path

Line up the components as blocks and send a ball over in an arc. The template's `s2` is this pattern.

- Write the steps in the body as `<ol class="steps">` and match them to the numbers in `say('1. ...')`. The template's `s2` anchors step 2 to the broker block.
- Put outside systems (external APIs, source data) off the floor slab in `COLOR.outside`. That makes "outside our server" visible.
- A place where results accumulate (outputs such as tables and charts) starts hidden and appears at the end with `scaleTo`.
- Get the top-surface position of a block with `top(o) = [o.position.x, o.position.y + o.userData.h / 2 + 0.5, o.position.z]`.

## 8. Lifetime

Draw a slot as a dashed rectangle, and make a resource a Group whose origin is on the floor. That way
`scaleTo` makes it rise from the floor and sink into it. Put the state inside a resource (variables, a cache) as children of that Group.

```js
const room = (x, z, name) => {
  const r = new THREE.Group(); r.position.set(x, FLOOR, z);
  r.add(glass(2.2, 1.9, 2.2, [0, 0, 0]));
  r.add(tag(name, [0, 2.25, 0], 'bound'));
  return r;
};
```

- Pause and save: while shrinking the resource, grow a flat disc (`COLOR.muted`) and move the disc to the front of the floor slab (the storage).
- Resume: bring the disc back to the slot and shrink it, then grow the resource again. The point is that the child state comes back unchanged.
- Waiting: put it outside the slot as dashed glass (`dashed: true, opacity: 0.04`) and write "waiting" in the label. When it
  gets a slot, change the label text, and restore the original text in reset.

## 9. Side-by-side comparison

Spread two stages apart in the `SCREEN_RIGHT` direction and run the same action on both at the same time with `Promise.all`.
Each stage is a Group whose origin is the stage center, so you can use the same inner coordinates.

```js
const side = offset => {
  const s = new THREE.Group();
  s.position.copy(SCREEN_RIGHT.clone().multiplyScalar(offset));
  s.add(block(5.8, 0.5, 5.8, [0, 0, 0]));
  const k = block(5.8, 0.4, 5.8, [0, 0.5, 0], { color: COLOR.boundSoft }); s.add(k);
  const temp = temporaryGroup(); s.add(temp);
  g.add(s);
  return { s, k, temp };
};
const L = side(-4.2), R = side(4.2);
L.s.add(tag('Approach A', [0, 0.25, 3.2], 'big'));
R.s.add(tag('Approach B', [0, 0.25, 3.2], 'big'));
```

If one stage is 5.8 wide, offsets of ±4.2 and a scene `fitW` of about 18.8 fit.

The **"same question, different answer"** variant was the most effective at explaining a conceptual contrast. Send the same request (a ball)
from both sides and show how far down that request goes and who answers. On one side the two requests gather on the same slab and
that slab flashes; on the other each stops at its own slab. Make the answer (a small matter slab) go back to the side that asked, and write the content in the
label, such as "A's files only". The `split` scene in example chapter 3 has this structure. Put status marks (for example "End of support" and "Experimental feature") in
`'warn'` labels floating at the top of the stage, at a different height from the title labels.

## 2D patterns (svg kit)

Which 2D form fits a chapter is in `forms.md`.
All code below is inside `build(d)` of a scene with `kit: 'svg'`; `run(a, say)` is in the object it returns (see "svg kit" in engine-api.md).
Rules that apply to every 2D pattern:

- One kind of change per step, about 1 s per tracked move (`a.along` default).
- Move rows in groups of at most 3 with `a.groups`, and create each token inside the group function, so a group appears when it starts.
- A dropped row leaves in its own step: fade the token, mark the row `'gone'`, and count it on a tally (`box.tally(n)` + `a.tick`). The struck-through row stays as the trace.
- Marks stay at the end: matched rows `'hit'` (red), dropped rows `'gone'`, dimmed connectors. The kit restores all of them on reset.
- The active element gets the ink outline or halo (`mark('active')`, `a.flash(part)`), never an extra color.

## 10. Row-level step diagram

Tables of rows with keys on the left, the operator on the right, one connector per row. Tokens carry the keys.

```js
const outer = d.table({ title: 'Target table', keys: KEYS, header: ['key', 'rest'] });
const hash = d.buckets({ title: 'Hash table (key mod 4)', count: 4, label: b => `bucket ${b}`, short: b => `#${b}` });
const join = d.box({ title: 'Join', lanes: KEYS.length, header: ['received', 'lookup'], counter: 'Join input {n}' });
KEYS.forEach((k, i) => d.link([outer.out(i), join.in(i)]));
// diagram: d.grid([[inner, hash], [outer, join]])  — a table and a box in one grid row line up lane by lane
// run:
const rows = [];
await a.groups([[0, 1, 2], [3, 4, 5]], async grp => {
  grp.forEach(i => { rows[i] = d.token(KEYS[i], outer.src(i)); });
  await Promise.all(grp.map(i => a.along(rows[i], [outer.src(i), join.chip(i)])));
  join.count(n += grp.length); a.tick(join.counterNode);
}, { size: 1, pause: 400 });
```

To show a lookup, mark the token and the bucket active for a moment, then write the result in the lane:
`rows[i].mark('active'); hash.cell(b).mark('active'); await a.wait(280); …; join.laneText(i, 'bucket 1 ✓ match', { short: 'bucket 1 ✓', tone: 'actor' }); await a.fade(join.lane(i), 1, 150);`

## 11. Filter

A gate in the gutter right of a table drops rows before they reach the operator. The contact causes the drop, so start the drop within about 100 ms of arrival. The drop itself is a separate step from the passing rows.

```js
const gate = d.gate(outer, { label: 'Filter', pass: 'Pass: 17 · 42', hidden: true });
KEYS.forEach((k, i) => d.link([outer.out(i), gate.in(i)]));
const after = KEYS.map((k, i) => d.link([gate.out(i), join.in(i)]));
const passed = d.link([hash.left(0.15), d.corner(hash.left(0.15), gate.top()), gate.top()], { dashed: true, tone: 'bound', label: 'SIP', opacity: 0.45 });
// run: the filter appears where the signal arrives
await Promise.all([a.fade(gate, 1), a.fade(passed, 1)]);
// a group reaches the gate; misses leave in their own step
await Promise.all(grp.map(i => a.along(rows[i], [outer.src(i), gate.before(i)])));
await a.wait(60);
await Promise.all([a.flash(gate, 'hot', 280), ...misses.map(async i => {
  outer.row(i).mark('gone'); join.tally(++dropped); a.tick(join.tallyNode);
  await Promise.all([a.fade(rows[i], 0), a.fade(after[i], 0.12)]);
})]);
```

## 12. Side-by-side panels

The same diagram twice, one trigger feeding both: the clearest way to show an option off and on. Build the diagram with a function, call it twice, and play both in one `Promise.all`.

```js
const side = filter => { const t = d.table({ … }), b = d.box({ … }), g = filter ? d.gate(t, { … }) : null; /* links */ return { t, b, g, grid: d.grid([[t, b]]) }; };
const off = side(false), on = side(true);
// diagram: d.panels([{ title: 'Filter off', body: off.grid }, { title: 'Filter on', body: on.grid }])
// run: await Promise.all([play(a, off), play(a, on)]);
```

Panels sit side by side when they fit and stack on phones and narrow stages. End the chapter with a table in the body that sums up the difference.

## 13. Operator tree

A query plan or any pipeline of operators, with a metric per node (rows, time). Data flows up the edges.

```js
const plan = d.tree({ id: 'del', label: 'DELETE', metric: '2 rows', children: [
  { id: 'join', label: 'Hash join', metric: '2 rows', children: [
    { id: 'scan', label: 'Scan target', metric: '6 rows' }, { id: 'temp', label: 'Scan temp', metric: '2 rows' }] }] });
// run: walk the plan one node at a time
plan.node('scan').mark('active'); say('1. The scan read 6 rows.', { anchor: plan.node('scan') });
await a.wait(800); plan.node('scan').mark('active', false); plan.node('join').mark('active');
```

Keep node labels short (about 14 characters); nodes narrow to fit on phones. To show rows handed up the plan, move a count chip along the edge and let it leave: `const t = d.token('6 rows', plan.edge('scan')[0]); await a.along(t, plan.edge('scan')); await a.fade(t, 0); plan.node('join').metric('got 6');`

## 14. Node columns

Several nodes or servers side by side; rows move to the node that owns them. Put a plan or a table next to it with `d.stack([…], { dir: 'row' })`.

```js
const nodes = d.columns(['Node 1', 'Node 2', 'Node 3'], { slots: 3 });
// run:
await a.groups(rows, (t, i) => a.along(t, [nodes.col(0).slot(i), nodes.col(owner[i]).slot(i)]));
```

Move a few representative rows (3–4) one by one and show the rest as a count. When rows leave a column, leave a faint copy behind (`d.token(k, from).g.style.opacity = 0.3`) so the end state still shows where they started.

## 15. Lanes

Two to five actors side by side, time running down, the shared resource between them.

```js
const LANES = () => [{ id: 'a', name: 'Session A' }, { id: 'row', name: 'accounts · id 1', short: 'id 1', resource: true }, { id: 'b', name: 'Session B' }];
const L = d.lanes(LANES(), { steps: 6 });
L.event('row', 0, '100');
L.event('a', 1, 'SELECT balance → 100', { short: 'read 100' }); L.message('row', 'a', 1);
L.event('b', 2, 'SELECT balance → 100', { short: 'read 100' }); L.message('row', 'b', 2);
L.event('a', 3, 'UPDATE … SET balance = 120', { short: 'write 120' }); L.message('a', 'row', 3);
const v120 = L.event('row', 3, '120');
// run: a few steps per caption; mark what was lost in its own step
await a.play(L, 2); say('1. A and B both read 100.');
await a.play(L, 5); say('3. B wrote 130.'); await a.wait(600);
v120.mark('lost'); say('4. A\'s 120 is gone.', { anchor: v120 });
```

- Give every event a short form of about 8 characters (phones show it, and narrow desktop stages too). Keep the full text to one statement; put the complete SQL in the body's `pre.code`.
- A step is a moment both lanes share. Put two actors in the same step only when they really act at the same time.
- Show a blocked actor with `L.span(id, from, to, 'wait')` and the holder with `'lock'` on the same steps, so the reader sees who waits for whom.
- Same schedule under two rules: two lanes diagrams in `d.panels` with `axis: false`, played with `Promise.all([a.play(x, n), a.play(y, n)])`. Three panels of lanes do not fit a stage; compare the third rule in the body's summary table.

## 16. Parameter playground

One to three sliders drive a chart and a few readouts; the run button plays a short tour through chosen stops, then the reader explores.

```js
defineScene('hashes', {
  kit: 'svg', title: '4  How many hash functions?',
  params: { k: { label: 'Hash functions k', values: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16], value: 3 } },
  presets: [{ label: 'k = 1', values: { k: 1 } }, { label: 'k = 7', values: { k: 7 } }],
  build(d) {
    const chart = d.chart({ title: 'False positive rate (log scale)', x: { label: 'hash functions k', min: 1, max: 16, ticks: [1, 4, 8, 12, 16] },
      y: { min: 1e-3, max: 1, log: true, ticks: [1e-3, 1e-2, 1e-1, 1], format: pct } });
    const mark = chart.marker(chart.line(k => rate(10000, 1000, k), { tone: 'actor' }));
    chart.ref('x', 10 * Math.LN2, { label: '(m/n)·ln 2 ≈ 6.9' });
    const out = d.readout({ label: 'False positive rate', sample: '0.00%' });
    return {
      diagram: d.stack([chart, out], { dir: 'col' }),
      update(p) { mark.at(p.k); out.set(pct(rate(10000, 1000, p.k))); return `With ${p.k} hashes: about ${pct(rate(10000, 1000, p.k))}.`; },
      async run(a, say) {
        for (const [n, k] of [[1, 1], [2, 7], [3, 16]]) { await a.set({ k }, { ms: 1100 }); say(`${n}. …`, { anchor: chart.near(k, rate(10000, 1000, k)) }); await a.wait(900); }
      },
    };
  },
});
```

- Keep to 1–3 controls, and make each one a cause the reader can vary: one slider per causal variable. Fix everything else and say so in the body.
- Tour first, free exploration after: the tour visits the stops that matter (both ends and the interesting point), each with a numbered caption that states the value. Body text invites the reader to move the slider afterwards.
- Presets jump to the values a reader should not miss (the minimum of a U-shaped curve, a common target).
- Every number the page shows comes from the formula in the scene, never typed in. Show the formula in the body and say when it is an approximation.
- End the chapter with a small table of the key values (the same formula, computed once for the table).

## 17. Code and state in sync

A short program beside the state it changes; the marker moves line by line and each line changes one thing. Arrange it with `d.flow`; the kit picks the wrapping it draws largest.

```js
const code = d.code({ title: 'main.js', lines: PROGRAMS.predict.split('\n') });
const frames = d.frames({ title: 'Call stack', max: 2 });
const micro = d.queue({ title: 'Microtasks', max: 2, tone: 'actor' }), tasks = d.queue({ title: 'Tasks', max: 2, tone: 'matter' });
const out = d.console({ title: 'Console', max: 4 });
// diagram: d.flow([code, d.flow([frames, d.stack([micro, tasks], { dir: 'col' }), out])])
// run:
await a.line(code, 2); await a.carry('log 2', code.end(2), tasks.tail()); tasks.enqueue('log 2'); say('2. …', { anchor: tasks.last() });
await a.line(code, null); frames.pop();
await a.checkpoint(); frames.push(micro.dequeue()); out.log('3'); frames.pop(); say('5. …', { anchor: out.last() });
```

- Keep code to about 6–10 lines of about 40 characters; split a long call over two lines (`Promise.resolve()` / `  .then(…)`). The panel never shrinks code: a line that does not fit a phone is reported.
- Let the shown code be the code that is checked: keep each program in one string, show it with `split('\n')`, and test that running it prints what the console part shows.
- Offer `step: true` where predicting matters (a chapter that asks "what prints next?"). Say in the body that the reader can step and predict.
- One line, one change: the marker moves, then one part changes (a frame, a queue, the console), then the caption says what changed, with a badge on that part.
