# Engine API

What the `ENGINE` sections of `assets/template.html` provide. Build scenes in the `SCENES` section with only these functions. Which form fits which chapter is in `forms.md`; the timing rules behind the defaults below are in `motion.md`.

The engine has two parts:

- **The shell**: layout, chapter switching, HUD, caption rail, speed menu, split, auto-play, the director (timing), and the verification hooks. It draws nothing.
- **Kits**: each kit draws the stage for the scenes that name it. There are two:
  - `axo` (default): a three.js axonometric block model. Sections marked "axo kit" apply to it.
  - `svg`: every 2D form in native SVG (step diagrams, operator trees, node columns, side-by-side panels, lanes, parameter playgrounds, code and state). See "svg kit" below. It needs no library.
- One page may mix both; each chapter shows the kit of its scene.

## Scene definition

```js
defineScene('name', {
  kit: 'axo',               // optional; 'axo' is the default
  title: '3  Container',    // title shown at the top left of the stage. "number, two spaces, title"
  base: true,               // axo: whether to show the shared floor (the base group)
  target: [0.3, 1.1, 0],    // axo: the point the camera looks at
  fitW: 17, fitH: 11.5,     // axo: world width and height that must fit in the model area
  build() {
    const g = new THREE.Group();
    const temp = temporaryGroup(); g.add(temp);   // things that appear and disappear during a run
    // ... add parts to g
    return {
      group: g,
      reset() { /* restore the position, size, visible, and label text that run changed. clearGroup(temp) */ },
      async run(a, say) { /* a: animator, say(text, opts): step caption */ },
    };
  },
});
```

- The kit builds every scene when the page starts, after its libraries have loaded. Chapter order does not depend on the order you call `defineScene`; the `data-scene` in the body sets the order.
- `build()` must return `reset()` and `run()`. The engine calls `reset()` before every run and on every chapter change, after restoring the colors itself.
- Each kit's code and styles are in their own template sections: `/* KIT <kit> css — … */` … `/* END KIT <kit> css */` in the `<style>` block and `/* KIT <kit> js — … */` … `/* END KIT <kit> js */` in the script. A page carries the shell plus the sections of the kits it lists; `node scripts/check-templates.mjs` checks that every kit section matches the template, sits where the template has it, and agrees with `data-kits`. A kit that a page defines itself in `SCENES` is listed in `data-kits` but has no sections.
- The page lists its kits in `data-kits` on `aside.stage` (the template has `data-kits="axo svg"`; a missing attribute means `axo`). This list is authoritative. Listed kits that are on the page load before `SCENES` runs, so `SCENES` can use their parts at the top level (for example `base.add(block(...))` on a page that keeps axo). A page with only svg scenes uses `data-kits="svg"` and never downloads three.js.
- After `SCENES` runs, the page stops with a `[plz]` message on the stage when the list and the scenes disagree: a scene or `setupKit` uses a kit that is not on the page or not listed, or a listed kit is not on the page or no scene uses it. An undefined name at the top level of `SCENES` (a kit global such as `base` on a page without that kit) gets a `[plz]` message too.
- `setupKit(kit, fn)`: kit code outside any scene, such as the axo shared floor. `fn` runs once, after the kit has loaded and before the scenes are built. The template wraps its floor in `setupKit('axo', …)`, so a page that deletes the axo kit deletes that block too, and a leftover block is reported by name.
- The intro note (`.note .wide` / `.narrow` with `data-ui`) follows `data-kits`, decided once before any kit loads: all rotatable → `noteWide` / `noteNarrow`; none → `noteSteps`; both kinds → `noteMixedWide` / `noteMixedNarrow`. A kit defined in `SCENES` counts as not rotatable. A note without `data-ui` is left alone. The text is looked up in this order: `UI_OVERRIDES[language]` for the chosen key, then `UI_OVERRIDES[language]` for the slot's `noteWide` (wide) or `noteNarrow` (narrow), then the built-in dictionary.

## Step captions: `say(text, { anchor })`

`say()` adds a caption to the caption rail on the stage. The rail replaces the old result line next to the button.

- A caption that starts with a number, a period, and a space (`'2. The broker checked the request.'`) is step 2. The number is shown in a circle. Text that only starts with a number, such as `'2.5 GB was reclaimed.'` or `'10.0.0.5 answered.'`, is an ordinary caption.
- Captions accumulate. The newest is emphasized; earlier ones stay readable in a softer color. At the end of a run all captions of the run are on the rail.
- A caption with the same number as the newest one updates that step in place. Use it for "1. The code tries to leave." followed by "1. The wall blocked it."
- A caption without a number is its own entry (use it for a closing sentence).
- `{ anchor: obj }` (numbered captions only) puts a badge with the step number next to `obj` in the model. In the axo kit it is a CSS2D label at the object's top corner that faces screen right; it follows the object and hides when the object is hidden. If the object is disposed during the run (for example a packet), the badge stays at its last position. Badges are removed when the scene resets.
- The rail clears when the scene resets (a new run, a chapter change, an auto-play cycle).
- `__explainer.run(name)` returns the text of the last `say()` call.
- Layout: on a stage 720px or wider (side by side) the rail is a column beside the model, below the HUD and above the legend; the model is fitted into the rest. Narrower stages (phones, landscape phones, a narrow split) show a bar under the model: the newest caption (up to three lines), "k / n" (captions so far / captions in the last full run of this chapter), and a toggle. The toggle opens a sheet over the model with every caption. The rail is an `aria-live="polite"` region.

## Director: one timing contract

Every duration and wait in a run goes through the director, whatever the kit. The rules it implements (about 1 s per tracked move, slow-in/slow-out, reduced motion that keeps order and dwell, auto-play off by default) and their sources are in `motion.md`.

- **Speed**: 0.5×, 1×, 1.5×, 2× from the speed menu (or `__explainer.speed(v)`). It scales every duration and every wait. A change applies at once to animations and waits in flight. It is shared by all chapters and saved in `localStorage` (`plz-explain:speed`).
- **Reduced motion** (`prefers-reduced-motion: reduce`): the step order and every wait stay. Movement (`a.move`, `a.scaleTo`, `a.tween`) becomes a cut to the end state, and the step still takes its time, so captions still arrive one by one. Color changes (`a.flash`) still animate. Chapter changes cut the camera.
- **Instant mode** (`__explainer.instant(true)`): every duration and wait is 0. For verification only; it is separate from reduced motion.
- **Cancel**: a new run or a chapter change cancels the run in progress. Everything it awaits rejects with an internal `CANCEL` value at once, and the engine handles it. You do not need to catch it.

The director that kits receive has `wait(ms)`, `tween(ms, fn, { motion = true, ease })` (`fn` gets eased progress 0→1; the default ease is slow-in/slow-out), and `live()`.

## Animator `a` (axo kit)

| Method | Description |
|---|---|
| `await a.move(obj, to, ms=1000, lift=0)` | Moves the center to `to` ([x,y,z] or Vector3). With `lift`, it goes over in an arc. About 1 s per tracked move |
| `await a.flash(obj, color, ms=700, hold=false)` | The color changes and comes back. Transparent glass also darkens briefly. Use it to show "blocked", "checked", "breached". With `hold`, it stays changed |
| `await a.scaleTo(obj, s, ms=500)` | Changes the size. To create: `obj.scale.setScalar(0.001)` then `scaleTo(obj, 1)`. To remove: `scaleTo(obj, 0.001)` then `obj.visible = false` |
| `await a.wait(ms)` | Gives reading time before the next step. 1000-1300ms per caption is about right |
| `await a.tween(ms, t => ..., opts)` | Any other value interpolation (0→1, eased). `opts.motion` (default `true`): movement is cut under reduced motion; pass `false` for color or opacity, which keep animating. `opts.ease`: a function of 0→1 that replaces slow-in/slow-out |
| `a.live()` | Whether this run is still valid |

- Wrap things that happen at the same time in `await Promise.all([...])`.
- Durations are at 1×; the speed menu scales them.

## Coordinates and size (axo kit)

- Units are arbitrary world units. The shared floor is 13×8, blocks are usually 2-3 in size, and the actor cube is 0.6.
- y is up. The camera looks down at the origin from the direction `HOME_DIR = (1, 1.15, 1.22)`. So on screen,
  +x goes to the lower right, -z to the upper right, and +z to the lower left.
- `SCREEN_RIGHT` is the world vector for the screen's horizontal direction. Use it to place two things side by side on screen (the comparison pattern in scene-patterns).
- **The `pos` y of `block`, `glass`, `actorCube`, and `matterBlock` is the floor height.** After creation, `group.position` is the
  center. So when you move something with `a.move`, give center coordinates. To put an object of height h on a slab whose top surface is Y,
  give y = Y + h/2.
- `fitW` and `fitH` must fit in the model area: the stage minus the caption rail. With the rail beside the model, the model area is narrower than the stage, so `fitW` usually decides.

## Color

```js
COLOR.model, COLOR.ink, COLOR.outside, COLOR.muted          // neutral: white model, ink, outside system, stopped things
COLOR.actor, COLOR.actorEdge                                // actor (red)
COLOR.bound, COLOR.boundSoft, COLOR.boundMid                // bound (blue), light slab, mid slab
COLOR.matter, COLOR.matterEdge                              // matter (brass)
```

To tell layers apart, use `boundSoft` (a base layer such as a kernel) and `boundMid` (a thin intermediary layer on top of it).
If you change a CSS variable (such as `--actor`), change `COLOR` with it.

## Parts (axo kit)

| Function | Returns | Use |
|---|---|---|
| `block(w, h, d, pos, opts)` | Group | Cuboid. opts: `color`, `opacity`, `edge` (no outline if null), `edgeOpacity`, `dashed`, `cast` |
| `glass(w, h, d, pos, opts)` | Group | Glass room (boundary). Default opacity 0.08. `dashed: true, opacity: 0.04` gives a "wall that is barely there" |
| `actorCube(pos, label)` | Group | Actor cube. The label is attached as a child and moves with it. `label=null` means no label |
| `matterBlock(pos, h, w)` | Group | A pile of data or files |
| `packet(color, pos, r)` | Mesh | Moving ball (request, signal, system call) |
| `tube(from, to, r, color)` | Mesh | A pipe joining two points (socket, dedicated passage) |
| `arrow(from, to, color)` | Group | Line + cone (marks an exit going outward) |
| `line(points, color, opacity, dashed)` | Line | Dashed slot, control line, crack |
| `tag(text, pos, kind)` | CSS2DObject | Label. kind: `''`, `'actor'`, `'bound'`, `'matter'`, `'warn'` (black background), `'big'` (large serif title) |
| `mat(color, opacity)` | Material | Lambert material the engine can fade and flash (for custom meshes) |
| `temporaryGroup(sharedResources=[])` | Group | Container for one-shot objects created during playback. The engine clears it when leaving a chapter |
| `disposeObject(root, sharedResources=[])` | — | Detaches an owned subtree, unregisters its labels, removes their DOM/state, and disposes its geometry/materials |
| `clearGroup(group)` | — | Disposes every child while keeping the group for the next run |

Every Group has `userData.mesh` (the mesh whose color changes) and `userData.h` (height). `THREE`, `V(x, y, z)`, `base`, and `SCREEN_RIGHT` are available once the axo kit has loaded (that is, in `SCENES`).

- Fill the shared floor into the `base` group once, at the very start of the `SCENES` section. When several chapters share the same floor,
  chapter transitions get smoother. For a chapter that needs a completely different stage, set `base: false` and build its own floor.
- A scene may make objects on the shared floor flash. The engine restores the colors when the chapter changes or the scene runs again.

## Temporary-object ownership (axo kit)

Create objects that appear during `run()` in a `temporaryGroup()`. Remove a finished packet with
`disposeObject(packet)` and empty the group in `reset()` with `clearGroup(temp)`. Plain
`Object3D.remove()` and `clear()` only detach objects; they do not release labels or GPU resources.
The engine also clears temporary groups when the reader leaves a chapter or an active run fails.
Permanent actors, labels, and end-state objects that must be reused belong in the scene's ordinary group.

The cleanup helpers own the geometry and materials of their removed subtrees. They deduplicate
resources within one cleanup operation. If a temporary object borrows geometry or materials from
another object, list those externally owned resources in `temporaryGroup([geometry, material])`,
or pass them as the second argument of `disposeObject()`. This list also protects resources used by
objects built but not yet attached to the scene. The external owner remains responsible for their
final disposal. Do not reuse disposed objects; build a fresh object for the next run. Textures are
not disposed by these helpers because materials may borrow them.

## svg kit (2D step diagrams)

It draws every 2D form; which one fits a chapter is in `forms.md`.

```js
defineScene('filter', {
  kit: 'svg',
  title: '2  Filter before the join',
  build(d) {                                  // d: the diagram builder
    const src = d.table({ title: 'Target table', keys: [8, 17, 23, 31], header: ['key', 'rest'] });
    const join = d.box({ title: 'Join', lanes: 4, counter: 'Join input {n}', tally: 'Dropped {n}' });
    const gate = d.gate(src, { label: 'Filter', pass: 'Pass: 17' });
    [0, 1, 2, 3].forEach(i => d.link([src.out(i), gate.in(i)]));
    const after = [0, 1, 2, 3].map(i => d.link([gate.out(i), join.in(i)]));
    return {
      diagram: d.grid([[src, join]]),         // the layout; the kit sizes it for the stage
      async run(a, say) { /* tokens, marks, captions */ },
      reset() {},                             // optional: the kit restores every part itself
    };
  },
});
```

`build(d)` returns `{ diagram, run }` (and optionally `reset`).
- The kit records the built state of every part and restores it before each run and on chapter changes: row marks, dimmed links, counters, lane text, opacity.
- It also removes tokens and badges.
- `reset()` is only for your own variables.

### Layout

- The kit lays the diagram out from the parts' natural sizes. You do not place parts in pixels.
- **Wide stage (720px and up), rail beside or below:**
  - The diagram is laid out at natural size and scaled by k from 1 to 1.6 to fill the stage. Captions scale with it.
  - Two caption arrangements compete: rail right and rail below. Below wins only when its k is 1.3 times larger than the best k with the rail right.
  - A diagram with a `d.flow` in it (at the top or inside `d.stack`, `d.grid` or `d.panels`) also tries each of the flow's wrappings with both rails; among them the larger k wins (the wider arrangement on a tie within 2%), under the same 1.3× rule.
  - Room is reserved for every caption the chapter shows at the end of its run, so none scrolls out of view: before the chapter has run, the kit measures the `say()` texts in its scene code (per step number the longest); after a run, the captions that run left. An arrangement whose captions do not fit at k = 1 is not taken.
  - When nothing fits at k = 1, the kit uses the narrower layout described next.
- **Narrower stages and phones:**
  - Columns are compressed toward their minimum widths, and the diagram is fitted between the HUD and the legend.
  - When desktop sizes do not fit the height, rows shrink first (36, 32, then 28px, with desktop text sizes); after that phone sizes are used. The phone row height adapts from 20px down to 15px; at 17px and below, table header rows are hidden.
- Text is at least 12px on desktop sizes and at least 11px on phone sizes.
- Every size that depends on text (table and box widths, tree nodes, column titles, chart rows, pills, code panels) is measured with the fonts that render on the reader's machine, never estimated: the kit measures labels in a hidden SVG with the same classes, and lays the stage out again when a web font arrives. A label that does not fit is reported by `clipped()` rather than hidden. A box narrower than its title and counter shortens the title with an ellipsis; a `d.stack` row that does not fit even at its parts' minimum widths is laid out as a column.
- On phones, the stage-height minimum comes from the active chapter's diagram at its smallest rows. It is applied on every chapter change, also when no height is saved, so a diagram is never cut off.

| Container | Arranges |
|---|---|
| `d.grid(rows, { gutter })` | Rows of cells (parts or `null`). Columns take the widest part; a gutter (96px, 60px on phones) separates columns and holds connectors and gates. Parts in one grid row share a top line, so a table and a box with the same row count line up lane by lane |
| `d.panels([{ title, body }, …])` | The same kind of diagram side by side, each with a title; stacked when they do not fit side by side (on most phones). Compact parts (`payload: false` tables, `narrow` boxes) let them stay side by side on a landscape phone. One run can feed both: `await Promise.all([play(a, off), play(a, on)])` |
| `d.stack(items, { dir: 'row' \| 'col', gap })` | A plain row or column of parts or containers. `gap` is px, or a function of the sizes such as `m => (m.phone ? 64 : 100)` |

### Parts

Points are functions that return `[x, y]` in diagram units. Pass them to links, tokens, and badges; they follow every relayout, including one in the middle of a run.
Resting points know how a token sits on them, so a token of any width fits: `table.src(i)` and `gate.before(i)` hold its right edge, `box.chip(i)` and `gate.after(i)` its left edge, `buckets.slot(b)` and `col(i).slot(j)` its centre. `clipped()` reports a resting token that sticks out of its table, box, bucket or column, or covers the gate barrier.

| Part | Options | Points and methods |
|---|---|---|
| `d.table({ title, keys, tone, header, payload })` | `keys`: the key shown per row (mono); a faint payload bar fills the rest (`payload: false` for a narrow key-only table). `tone: 'matter'` gives brass row bars. `header`: two column titles; without it there is no header row. A key-only table shows only the first title | `row(i).mark('hit' \| 'gone' \| 'active', on)` (matched: red; dropped: dimmed, struck through, × mark; active: ink outline). `out(i)` right edge of row i, `src(i)` where a row's token rests, `rowC(i)` |
| `d.buckets({ title, count, label, short })` | `label(b)` / `short(b)`: cell index text (short on narrow cells and phones) | `slot(b)` where a key chip rests, `fill(b)` hides the "—", `cell(b).mark('active')` |
| `d.box({ title, lanes, header, counter, tally, narrow })` | An operator with lanes. `counter`: pill text by the title, `{n}` replaced. `tally`: a pill under the box, hidden until first set. `narrow: true` for a box that only receives tokens (no lane text); give it no title when the counter names it | `in(i)` left edge of lane i, `chip(i)` where a token rests, `count(n)`, `tally(n)`, `counterNode`, `tallyNode`, `laneText(i, text, { short, tone })` (fade it in with `a.fade(box.lane(i), 1)`), `lane(i)` |
| `d.gate(table, { label, pass, hidden })` | A filter in the gutter right of `table`, spanning its rows, with a chip below listing what passes (`pass`; the chip grows with its text). `table` must sit in a `d.grid` cell with another column to its right; anywhere else (the last column, a `d.stack`) the page fails to start with an error that says so. The chip appears only when it has something to show: phones hide the label, so on phones a gate needs `pass` for a chip. Without a chip, only the bottom post's room is kept under the table. `hidden` starts invisible (show with `a.fade(gate, 1)`) | `in(i)` / `out(i)` barrier edges for connectors, `before(i)` / `after(i)` where tokens stop, `top()`. Flash with `a.flash(gate, 'hot')` |
| `d.tree(spec)` | `spec = { id, label, metric, children: [...] }`. An operator tree; edges carry data up to the parent. An unknown id in `node(id)` or `edge(id)` stops the page with an error naming it | `node(id).mark('active' \| 'hit', on)`, `node(id).metric(text)`, `node(id).top()`, `.bottom()`, `edge(id)`: the points of the drawn edge from that node up to its parent, for `a.along(token, tree.edge(id))` |
| `d.columns(names, { slots })` | Nodes or servers side by side, each with `slots` places for rows | `col(i).slot(j)`, `col(i).top()`, `col(i).bottom()`, `col(i).mark('active')` |
| `d.link(points, { dashed, tone, label, labelAt, arrow, hidden, opacity })` | A connector through two or more points (functions or fixed `[x, y]`) with an arrowhead. `dashed` + `tone: 'bound'` + `label` for a signal passed sideways (`labelAt` a point for the label pill, which grows with its text) | Fade or dim it with `a.fade(link, 0.12)` |
| `d.lanes(list, { steps, axis })` | Time-axis swimlanes, see "Lanes" below | `event()`, `message()`, `span()`, `now`, `yOf(step)`, `rowH()`, `lane(id)` (badge anchor at its header) |
| `d.token(text, at, { tone, w })` | A chip resting at point `at`, as wide as its text (at least the standard width; `w` fixes it; measured again when the text, its size or the fonts change). `tone: 'matter' \| 'bound' \| 'hit'`. Create tokens during `run()`, when their group starts | `mark('hit' \| 'active', on)` (active: ink halo). Change its text with `tok.text.textContent = '…'` (the width follows); keep the same token when the same thing changes, so the reader can follow it |

Every part also has `left(at)`, `right(at)`, `top(at)`, `bottom(at)` (a point on its frame; `at` is a 0–1 fraction along the edge or another point whose coordinate to use), `mid()`, and `mark(cls, on)`. `d.corner(a, b)` is the point `[b.x, a.y]` for an elbow. `d.phone()` tells whether phone sizes are in use.

`mark('on')` (and `a.flash(target)`) draws the ink outline on any part: a table, buckets and each cell, a box, a gate, a tree and each node, columns and each column, and a table row.
Pills (counter, tally, link label), tokens and the gate chip are sized from their measured text, so long or CJK text stays inside. `clipped()` reports text that still does not fit its frame (lane text in a box, tree node labels, bucket labels) and text covered by another pill or chip.
A diagram may also be a single part (for example `diagram: d.tree(…)`).

### Animator `a` (svg kit)

| Method | Description |
|---|---|
| `await a.along(token, points, ms=1000)` | Moves a token along points (about 1 s per tracked move); it rests at the last one. Points are read every frame, so the move follows a relayout. Reduced motion: the token cuts to the end and fades in there to its own opacity; the step keeps its time |
| `await a.groups(items, fn, { size = 3, pause = 400 })` | Runs `fn(item, i)` for items in groups that move together (at most 4), with a pause between groups. The easy way to move many rows |
| `await a.fade(target, to, ms=250)` | Opacity of a part, link, token, or `box.lane(i)` (color and opacity still animate under reduced motion) |
| `await a.flash(target, cls='on', ms=200)` | A brief emphasis: the ink outline (`'on'`), or `'hot'` on a gate |
| `a.tick(node)` | A small pulse on a counter after its number changed (not awaited) |
| `await a.play(L, step, { ms = 500 })` | Lanes: moves the playhead of `L` step by step up to `step` and reveals each step (see "Lanes"). Reduced motion: the playhead and arrows cut, every step keeps its time; instant mode reaches the same end state |
| `a.wait(ms)`, `a.tween(ms, fn, opts)`, `a.live()` | As in the director |

Captions: `say('2. …', { anchor })` puts the step number in a badge at the anchor: a part (its top-right corner), a point function, a fixed `[x, y]` in diagram units, or an SVG node such as `box.tallyNode`.

Rotation: the svg kit is not rotatable, so the drag hint and Reset view are hidden on its chapters.

### Lanes (time-axis swimlanes)

When to use lanes: "Lanes" in `forms.md`.
Each actor is a column and time runs down in steps. Columns read well at 390px when every event has a short form, and more steps grow the diagram downward, where a phone has room. A resource lane (the shared row, a lock) sits between the actors, so reads and writes are short horizontal arrows.

```js
const L = d.lanes([
  { id: 'a', name: 'Session A' },
  { id: 'row', name: 'accounts · id 1', short: 'id 1', resource: true },   // a resource lane: values, brass-tinted
  { id: 'b', name: 'Session B' },
], { steps: 6 });                      // axis: false drops the step numbers and tightens the gaps (for d.panels)
L.event('row', 0, '100');                                               // step 0: the start state, shown before the run
L.event('a', 1, 'SELECT balance → 100', { short: 'read 100' });          // mono by default; short on phones and tight stages
L.message('row', 'a', 1);                                               // an arrow between two lanes at a step
L.span('a', 1, 4, 'lock');                                              // a bar on the lane edge: holding a lock
L.span('b', 2, 4, 'wait');                                              // a hatched band: blocked
L.event('a', 4, 'COMMIT', { state: 'commit' });                         // state: 'commit' | 'rollback'
const v120 = L.event('row', 3, '120');
L.event('row', 5, '130', { tone: 'actor' });
// run:
await a.play(L, 2); say('1. Both read 100.');
await a.play(L, 5); v120.mark('lost');                                  // 'lost': struck through in red
```

| Method | Options and behavior |
|---|---|
| `L.event(id, step, text, { short, mono = true, tone, state })` | A card in a lane at a step (0 = start state). `short` for phones and stages too narrow for the full text. Text with CJK characters is set in the sans font. On a resource lane the card is a value; when a new value appears, older values dim (`old`). `mark('lost')` strikes a value through |
| `L.message(from, to, step, { toStep, tone, dashed })` | An arrow from one lane's card edge to another's at a step. It draws from sender to receiver. With `toStep` (a later arrival) its tip follows the playhead and reaches the receiver at `toStep` |
| `L.span(id, from, to, 'wait' \| 'lock')` | A lane state over steps: it grows with the playhead from `from` and stops at `to`. A lock bar stands on the lane's edge that faces the nearest resource lane, in room kept beside the cards |
| `L.now`, `L.yOf(step)`, `L.rowH()` | The playhead's step, the y of the playhead after a step, the row height (diagram units) |

`a.play(L, step)` reveals each step in causal order: the actors' events and the spans that start there, then messages, then the values they cause on resource lanes. The newest step's cards carry an ink outline until the next step, and every passed step stays as a static trace. Reset puts the playhead at the start and hides everything after step 0.
Lane widths come from the measured text (an estimate until the scene is first drawn; measured again when the fonts arrive), never from pixels the author gives. A stage too narrow for the full text switches the lanes to the short texts at desktop sizes; phones always use them. Two lanes diagrams fit side by side in `d.panels` on a landscape phone only with `axis: false` and short texts of about 8 characters. Bad lane ids, steps out of range, a lane count outside 2–5 actors and unknown span kinds stop the page with a `[plz] lanes:` error.

### Parameter playground

When to use a playground: "Parameter playground" in `forms.md`.
The scene declares 1–3 parameters and returns `update(params)`, which draws the diagram for those values. The run button plays an authored tour that moves the sliders through a few stops with numbered captions; afterwards the reader explores freely.

```js
defineScene('bits', {
  kit: 'svg',
  title: '3  More bits',
  params: {
    m: { label: 'Bits m', min: 1000, max: 20000, step: 500, value: 4000, format: v => v.toLocaleString('en-US') }, // a range
    k: { label: 'Hash functions k', values: [1, 2, 3, 4, 5, 6, 7, 8], value: 4 },                                   // a list (ordinal)
  },
  presets: [{ label: '8 bits per key', values: { m: 8000 } }, { label: '16 bits per key', values: { m: 16000, k: 8 } }],
  build(d) {
    const chart = d.chart({ title: 'False positive rate (log scale)', x: { label: 'bits m', min: 1000, max: 20000, ticks: [1000, 10000, 20000] },
      y: { min: 1e-4, max: 1, log: true, ticks: [1e-4, 1e-2, 1], format: v => v * 100 + '%' } });
    const curve = chart.line(m => rate(m, 4), { tone: 'actor' });
    const mark = chart.marker(curve);
    chart.ref('y', 0.01, { label: '1%' });
    const out = d.readout({ label: 'False positive rate', sample: '0.0012%' });
    return {
      diagram: d.stack([chart, out], { dir: 'col' }),
      update(p) { curve.set(m => rate(m, p.k)); mark.at(p.m); out.set(pct(rate(p.m, p.k))); return `With ${p.m} bits: about ${pct(rate(p.m, p.k))}.`; },
      async run(a, say) { await a.set({ m: 2000 }); say('1. …', { anchor: chart.near(2000, rate(2000, 4)) }); await a.set({ m: 16000 }, { ms: 1500 }); say('2. …'); },
    };
  },
});
```

| Piece | Behavior |
|---|---|
| `params` | 1–3 entries. A range `{ label, min, max, step, value, unit, format }` or a list `{ label, values, value, format }` (the slider steps through the list; entries may be numbers or strings, and `value` must be one of them). A range value snaps to `min + k·step` and never passes `max`, as the native slider does: when `max − min` is not a multiple of `step`, the top value is the last step below `max`, so align them. `format(v)` is the value shown next to the slider and read by screen readers (`aria-valuetext`); without it, `value unit` |
| `presets` | Optional buttons that set several parameters at once: `[{ label, values }]` |
| `update(p)` | Required. Draws the diagram for the values `p` and returns the live sentence (one line, shown under the controls while the reader explores; `aria-live="polite"`, at most every 300 ms). Called on every slider move, preset, tour frame and reset; the kit redraws right after it |
| `run(a, say)` | The tour. `await a.set(values, { ms = 900 })` sweeps the sliders to `values` (others stay); ranges move continuously, lists step. Speed, instant mode and reduced motion apply (reduced motion: the sliders jump, the step keeps its time). Anchor tour captions to `chart.near(x, y)`, not to the marker, which moves |

- **Where the controls live.** In the stage, directly under the diagram, at most 560px wide (an HTML band the kit places; the diagram gets the height above it), so the reader's hand and eyes stay on one block and the controls never cover the drawing. On a stacked phone the stage-height minimum includes them. On a short stage beside the text (a landscape phone) where both do not fit, the controls move into the chapter's text, under its run button.
- **Controls.** Native `<input type="range">` with a `<label>` and an `<output>`, 44px tall; arrow keys, Home and End work; presets are 44px buttons. Values are not saved across reloads.
- **Run and reset.** Every run and every reset start from the default values (the `value` of each parameter).
- **The reader's hand wins.** The kit reports input, never focus (Safari and Firefox on macOS do not focus buttons or sliders on click): a pointer down on the controls, a key, a changed value. Any of them stops a running tour, and auto-play waits while a pointer is down and for 2.5 s after the last input. The hold is always released: by that timer, a chapter change, or the controls moving or hiding.
- **The reader's values stay.** Once the reader changed a value, the chapter's auto-play does not restart (its reset would wipe the values) until the reader runs the chapter or leaves it. Pressing a control without changing anything only holds auto-play for the grace period.
- **Checks.** `clipped()` reports `'[controls]'` when the controls overlap the drawing or leave the stage, control text that is cut off, and `'[live]'` when the live sentence is longer than two lines.

Chart parts (sized by the layout like other parts; text at the kit's sizes, so the 12px/11px minimums hold):

| Part | Options | Methods |
|---|---|---|
| `d.chart({ title, x, y, w })` | `x`, `y`: `{ min, max, ticks, format, log, label }` (`x.label` under the axis; put the y unit in the title). The end tick labels of the x axis align with the plot edges, and an inner x label that would come within half a character of its neighbour is hidden (its tick mark stays); `clipped()` reports tick labels that still touch | `line(fn, { tone, samples })` → `series.set(fn)`; `marker(series)` → `marker.at(x)` (a dot on the curve with a guide to the axis); `ref('x' \| 'y', v, { label })` (a dashed reference line); `at(x, y)` / `near(x, y)`: points for links and badges |
| `d.meter({ title, parts })` | `parts: [{ label, tone }, …]` (two or more); the last part takes the rest | `set(fracs, texts)`: fractions for all but the last part, and a value shown after each label |
| `d.readout({ label, sample })` | A large mono number with a label. `sample` is the widest value it will show, so the frame keeps its size | `set(text)` |
| `d.bits({ title, count, tone })` | A bit array: each cell shows its index and 0/1 | `set(i, on)`, `cell(i).mark('active' \| 'zero' \| 'on')`, `top(i)`, `bottom(i)` |

Charts and meters keep their state in JS (series, marker, fractions); `set` and `at` only store it and the next paint draws it once. Reset puts them back as they were when the scene was built, in step-diagram scenes too.
`d.table({ …, note })` takes a sample of the longest row note (the table is sized so it fits between the key column and the × mark); `row(i).note(text, { tone })` writes it in the payload column (an answer, a result), and the key column widens for word keys.

### Code and state in sync

When to use it: "Code and state" in `forms.md`. Keep each chapter's code to about 6–10 short lines (about 40 characters, so it fits a 390px phone at 11.5px mono).

```js
defineScene('promise', {
  kit: 'svg', title: '3  Sooner than later',
  step: true,                                                      // a Step button beside the run button
  build(d) {
    const code = d.code({ title: 'main.js', lines: PROGRAM.split('\n') });
    const frames = d.frames({ title: 'Call stack', max: 2 });
    const micro = d.queue({ title: 'Microtasks', max: 2, tone: 'actor' }), tasks = d.queue({ title: 'Tasks', max: 2, tone: 'matter' });
    const out = d.console({ title: 'Console', max: 3 });
    return {
      diagram: d.flow([code, d.flow([frames, d.stack([micro, tasks], { dir: 'col' }), out])]),  // side by side, or stacked
      async run(a, say) {
        await a.line(code, 1); frames.push('script');
        await a.carry('timer', code.end(1), tasks.tail()); tasks.enqueue('timer'); say('1. …', { anchor: tasks.last() });
        await a.line(code, 4); out.log('sync');
        await a.line(code, null); frames.pop();                    // past the last line: the marker hides
        await a.checkpoint(); frames.push(micro.dequeue()); out.log('promise'); frames.pop(); say('5. …', { anchor: out.last() });
      },
    };
  },
});
```

| Part or method | Behavior |
|---|---|
| `d.code({ title, lines, note })` | Numbered mono lines. `code.current`, `code.ran` (lines that already ran keep a quiet dot), `code.end(n)` (the point after line n's text, where a value leaves), `code.note(n, text, { tone })` (an annotation at the line's end; `note` is a sample of the longest, for any line, or per line such as `{ 4: 'waits' }` so only those lines need room). Indentation is kept. The panel is as wide as its longest line and never narrower: a line that does not fit the stage, or a panel wider than the stage, is reported by `clipped()` (the kit does not shrink code below 12px / 11.5px) |
| `d.frames({ title, max, tone })` | A call stack: `push(text)` on top, `pop()` from the top (returns the text), `list()`, `top()` (the point of the next frame) |
| `d.queue({ title, max, tone })` | FIFO: `enqueue(text)` at the tail, `dequeue()` from the head, `list()`, `tail()`, `head()` |
| `d.console({ title, max })` | Output lines that accumulate: `log(text)`, `list()`, `last()`, `next()` |
| `d.vars({ title, names, sample })` | Named values: `set(name, value)`, `get(name)`, `slot(name)`; `sample` is the widest value, so the part fits every name with it. An unknown name stops the page with a `[plz] d.vars` error |
| `d.flow(items, { gap })` | Items left to right at their natural widths, wrapping to a new line when the next does not fit (like flex-wrap). A nested flow that does not fit beside the items before it wraps there when the rest of the line holds its widest item (the code beside a state on two lines); otherwise it starts a new line and wraps itself. The kit tries every wrapping (the code beside the state, beside a wrapped state, above it in one row, the state split over lines, a column), also for a flow inside a container, each with the caption rail beside or below, and keeps the one drawn largest; the block is centred on the stage |
| `await a.line(code, n, { ms = 320, step = true })` | Moves the marker to line n (`null`: past the end) and is a step boundary; `step: false` moves it inside the current step (the script's end in the same step as its last line). One line → one kind of change: change the state after it, then say what changed. Every step must end with a caption. When the run ends, the kit hides the marker by itself (no final `a.line(code, null)`) |
| `await a.carry(text, from, to, { tone, ms = 650 })` | Moves a value between two points as a token, then removes it; change the state right after |
| `await a.checkpoint()` | A step boundary that is not a line (the event loop taking the next task) |

- Items (`push`, `enqueue`, `log`) are parts of the state, kept in JS: reset puts back the items the scene was built with, the marker, the traces and the notes. A caption badge on an item (`frames.last()`, `queue.last()`) follows its slot and disappears when the item is taken out.
- **Step control** (`step: true`): a Step button beside the run button runs one authored step (from one `a.line` / `a.checkpoint` to the next) so the reader can predict before each step.
  - Step with no run in flight starts a run from the reset state and pauses at its next boundary; Step again goes on.
  - Step during a run (the tour, auto-play) lets that run pause at its next boundary.
  - Run during a stepped run continues it to the end (it does not restart); Run after the end restarts as usual.
  - Stepping is reader input: auto-play holds, and the chapter keeps its stepped state until the reader runs it or leaves it.
  - Speed, instant mode and reduced motion apply inside each step; a chapter change cancels a paused run.
- `__explainer.run(name)` still resolves at the end with the final caption (continuing a stepped run). `__explainer.step(name)` runs one step and resolves `{ done, caption }`: `done` is true when the run ended.

## Kits: `defineKit(name, kit)`

A page author does not write kits; this section is for engine changes. A kit is an object with these methods (only `load` and `build` are required):

| Member | Called |
|---|---|
| `rotatable` | `true` shows the drag hint and Reset view while this kit's scene is active |
| `load(host)` | Once, before the kit's first scene is built. `host = { layer, wrap, relayout, control }`; `layer` is the kit's own element inside the stage. A kit with reader controls calls `control(true)` when the reader takes a control (focus, press) and `control(false)` when they leave it; the shell stops a running action and holds auto-play in between. Import libraries here. Throw an error with `uiKey: 'fallback'` to show the "can't draw" notice instead of the load error |
| `build(def)` | Turns a `defineScene` definition into the kit's scene object, which must have `reset()` and `run(a, say)` |
| `show(scene, prev)` / `hide(scene)` | The scene became active / stopped being active (`hide` drops temporary objects) |
| `reset(scene)` | Restore what the engine owns (colors) before the scene's own `reset()` |
| `clear(scene)` | Drop temporary objects after a failed run |
| `animator(dir, scene)` | Returns the `a` passed to `run()`; without it, `a` is the director |
| `fit(rect, W, H, chrome)` | Fit the drawing into `rect` (px inside the layer of size W × H); the rest is under the caption rail. `chrome = { top, bottom }` is the band between the HUD and the legend |
| `place(geom)` | Optional, wide stages only: arrange the drawing and the caption column together. `geom = { W, H, top, bottom, railNeed }`; `railNeed(w)` is the height (px, scale 1) of the chapter's captions in a column `w` px wide, or `null` when none are known. Returns `{ rail, scale, model }` (the scale also sizes the captions) or `null` for the default |
| `minHeight()` | Optional: the smallest model height (px) for the stage-height handle on phones; re-applied on every chapter change |
| `settled()` | Optional: `false` while the drawing is still easing toward its end state (axo: labels decluttering, the camera gliding). `run()` waits for it |
| `overflowing()` | Optional: text wider than its own frame; `clipped()` reports it |
| `frame()` | Every animation frame while the kit's layer is shown |
| `labels()` | Label elements now visible, for `overlaps()` and `clipped()`. Labels must be DOM elements |
| `badge(anchor, n)` | Put step number `n` next to `anchor`; return a function that removes it |
| `resetView()`, `info()` | Reset view; `{ resources, azimuth }` for the hooks |
| `params(scene, values)`, `paramSpec(scene)` | Optional: a playground's parameters, behind `__explainer.params` and `paramSpec` |

## Stage states and verification hooks `window.__explainer`

The stage's `data-state` is `loading`, `ready`, or `failed`. Loading and failure notices are translated before any kit loads its libraries;
Run, Auto-play, and Reset view remain disabled until the first frame is drawn. If an import or renderer initialization fails, the notice offers
a Retry button that reloads the page. On small screens the failed stage becomes a compact, non-sticky notice above the text. The hooks exist after successful initialization.

| Method | Returns |
|---|---|
| `scenes()` | Array of scene names |
| `current()` | The scene name the stage is showing now. After scrolling, check that it matches the chapter being read on screen |
| `lang()` | The language used for screen text (`en`, `ko`, `ja`, `zh-CN`, or an override key) |
| `await run(name)` | Scrolls to that chapter, runs the action to the end, waits until the end state is drawn and the kit has settled (labels done moving apart), and returns the last caption. In the side-by-side layout it scrolls the chapter to the middle of the screen; on a portrait phone it scrolls the top of the chapter just below the stage |
| `overlaps(minArea=24)` | Pairs of currently visible labels (badges included) that overlap each other: `[text, text, overlap area px²]`. Labels hidden under the open caption sheet are skipped |
| `clipped()` | Text of labels outside the model area (the canvas cell minus the caption rail), text wider than its own frame (svg pills, chips, lane text), plus `'[legend]'` if the legend is not fully inside the stage and the window |
| `autorun(on?)` | Reads or sets auto-play (turning on runs the chapter being read right away and loops it; saved) |
| `speed(v?)` | Reads or sets the speed (0.5, 1, 1.5, 2; saved) |
| `instant(on?)` | Reads or sets instant mode (all durations 0; not saved) |
| `rail(open?)` | Reads or sets whether the caption sheet is open on a narrow stage |
| `resources()` | axo: counts of registered labels, decluttering state entries, and renderer geometries (`labels`, `labelStates`, `geometries`), step badges excluded. Compare after warming up the same scene and after repeated runs |
| `azimuth()` | axo: camera azimuth (radians). Use it to check whether the model rotated |
| `kitInfo()` | The active kit's state. svg: `{ scale, arrangement, row, W, H, box, block, candidates }`. `arrangement`: `right`, `below`, `fit`, or `phone`. `box`: the diagram's layout box in stage px; `block`: the diagram with its caption column (wide stages); `candidates`: every arrangement tried, `{ w, h, k, below, lines }` |
| `step(name)` | One authored step of that chapter, as the Step button does (stepping is reader input): `{ done, caption }` |
| `params(name, values?)` | A playground's parameters: reads them, or sets some (as the reader would, without stopping a run; the live line updates) and returns all. `null` for a scene without parameters |
| `paramSpec(name)` | `{ id: { min, max, value } }` of a playground's parameters (`min`/`max` are the first and last values of a list) |
| `timing()` | The latest run's own timeline: `{ base, scaled }` in ms. `base` is the time every wait and tween asked for at 1×, `scaled` the time they were scheduled for at the speeds in effect (0 in instant mode; parallel steps add up). Use it to check speed without depending on machine load |

## Speed menu

The speed segment (`button.speed-seg`) sits after each chapter's run button. It has `aria-haspopup="menu"` and `aria-expanded`, and its accessible name includes the current value. The menu (`role="menu"`) has four `menuitemradio` items. ArrowDown, ArrowUp, Enter, or Space on the segment opens the menu with focus on the current value; arrows, Home, and End move; Enter or Space chooses; Escape closes and returns focus to the segment; Tab or a click outside closes. The menu opens below the segment, or above it when there is no room. When the page scrolls, the menu follows its segment and closes when the segment leaves the viewport or the pinned stage covers it. On touch screens the items are at least 44px tall.

## Split

- Side by side: a vertical divider (`.split-v`, `role="separator"`) between text and stage. Drag it (pointer capture), use Left/Right (2% steps), Home/End, or double-click to reset. Saved in `plz-explain:split-x` when the drag ends.
  - The text column stays between 32% and 68% of the window.
  - In windows about 1083px wide or wider, the text column is also at least 360px and the stage at least 560px.
  - In narrower side-by-side windows (861–1082px, and landscape phones), those two minimums shrink in proportion until together they take 85% of the window, so the divider always has about 15% of the window to move in (for example text 293–425px and stage at least 455px in an 880px window). `aria-valuemin` is always below `aria-valuemax`.
  - A stage 600px or narrower uses the small phone label size, so labels still fit a narrow stage.
- Portrait phones: a handle at the bottom edge of the stage (`.split-h`) sets the stage height between 30svh (or the stage's minimum) and 75svh. Up/Down, Home/End, double-click to reset. Saved in `plz-explain:split-h`. The default is 44svh plus the caption bar.
- Dragging does not cancel a run, and the chapter being read stays on the reading line. The model refits live (once per frame).
- The saved position applies as soon as the page starts, before the kits load, and also when loading fails.

## Auto-play

The "Auto-play" switch (`button.autorun`, `role="switch"`, `aria-checked`) at the right of the stage title bar (HUD).

- Off by default. The on state is remembered in `localStorage` (`plz-explain:autorun`). If reading or writing is blocked, it stays for that visit only, without an error.
- When on, it replays the action of the chapter being read in a loop. One cycle goes in this order.
  1. After the chapter enters the reading line, wait `AUTORUN_DELAY` (600ms at 1×, time for the scene transition to finish and to see the initial state).
  2. Run the same action as pressing that chapter's `[data-run]` button, to the end.
  3. Show the end state and the captions for `AUTORUN_HOLD` (2800ms at 1×).
  4. Reset the scene with `reset()` and clear the captions. Show the initial state for `AUTORUN_DELAY`.
  5. Go back to step 2.
- Delay and hold scale with the speed, but never below half of their 1× values.
- The timer is set only through `armAuto`, so there is always at most one. Loops do not pile up and the same chapter never runs twice at once.
- When the reader moves to another chapter, the run is cancelled and the loop starts from the beginning in the new chapter. If the reader passes through several chapters in a short time, only the last chapter starts.
- If a chapter's button is pressed during the loop, the run restarts from the beginning right there, and the loop continues after that run ends.
- When the tab is hidden (`document.hidden`), the pending timer stops, and when it is visible again the loop continues from the reset state. If a run is still playing at that moment (for example one started with the button), it is not reset; the loop continues after it ends.
- Elements without a `[data-run]` button (intro, glossary) do not run. It does not run at the very top of the page either (scroll 40px or less, `TOP_HOLD`), because in the side-by-side layout chapter 1, just below the intro, sits on the reading line.
- Turning the switch on while a chapter is active runs that chapter right away (when not at the very top). Turning it off removes the pending loop; the action in progress goes to the end and does not repeat.

## Screen text and language

The intro notice, HUD buttons, hint, speed menu, caption toggle, split handles, fallback notice, glossary and sources headings, and error text come from the ENGINE's text dictionary (`UI_TEXT`) in the page language. The page author writes the body, chapter titles, captions, labels, legend, and scene `title` directly in that language.

### How the language is chosen

It is decided by the `<html lang>` value (case-insensitive). The engine picks once, at startup.

| `lang` | Dictionary used |
|---|---|
| `ko`, `ko*` such as `ko-KR` | `ko` |
| `ja`, `ja*` such as `ja-JP` | `ja` |
| `zh`, `zh*` such as `zh-CN`, `zh-Hans`, `zh-TW` | `zh-CN` |
| anything else (including `en`, `es`, `fr`, empty) | `en` |

English (`en`) is canonical. A key missing from the chosen language's dictionary comes out in English.

### Text keys

| Key | Where it is used | en | ko | ja | zh-CN |
|---|---|---|---|---|---|
| `noteWide` | Intro `.note .wide` (desktop) | Drag the model on the right to rotate it. The button in each chapter makes that event actually happen in the model. | 오른쪽 모형은 드래그하면 돌려 볼 수 있습니다. 장마다 있는 버튼을 누르면 모형에서 그 일이 실제로 일어납니다. | 右のモデルはドラッグして回転できます。各章のボタンを押すと、モデル上でその出来事が実際に起こります。 | 拖动右侧的模型即可旋转查看。点击每章中的按钮，模型上就会真实演示那件事。 |
| `noteNarrow` | Intro `.note .narrow` (phone) | Swipe the model left or right to rotate it. (the rest of the sentence is the same) | 모형은 좌우로 밀면 돌려 볼 수 있습니다. (뒤 문장은 같음) | モデルは左右にスワイプすると回転できます。(後ろは同じ) | 左右滑动模型即可旋转查看。(后句相同) |
| `noteSteps` | Intro note on a page whose kits are not rotatable (svg only), wide and narrow | The button in each chapter makes that event happen in the model, step by step. | 장마다 있는 버튼을 누르면 모형에서 그 일이 단계별로 일어납니다. | 各章のボタンを押すと、モデル上でその出来事が一つずつ順に起こります。 | 点击每章中的按钮，模型上就会一步步演示那件事。 |
| `noteMixedWide` | Intro `.note .wide` on a page with both kinds of kit | In 3D chapters, drag the model on the right to rotate it. (then as `noteSteps`) | 3D로 그린 장에서는 오른쪽 모형을 드래그해 돌려 볼 수 있습니다. (뒤는 `noteSteps`와 같음) | 3Dの章では、右のモデルをドラッグして回転できます。(後ろは `noteSteps` と同じ) | 在 3D 章节中，拖动右侧的模型即可旋转查看。(后句同 `noteSteps`) |
| `noteMixedNarrow` | Intro `.note .narrow` on a page with both kinds of kit | In 3D chapters, swipe the model left or right to rotate it. (then as `noteSteps`) | 3D로 그린 장에서는 모형을 좌우로 밀어 돌려 볼 수 있습니다. (뒤는 같음) | 3Dの章では、モデルを左右にスワイプすると回転できます。(後ろは同じ) | 在 3D 章节中，左右滑动模型即可旋转查看。(后句相同) |
| `step` | `.step-btn` beside the run button of a scene with `step: true` | Step | 한 단계씩 | 1ステップ | 单步 |
| `resetView` | `.reset-view` button | Reset view | 시점 되돌리기 | 視点をリセット | 重置视角 |
| `autorun` | Long text of the auto-play switch, `aria-label` | Auto-play | 자동 실행 | 自動再生 | 自动播放 |
| `autorunShort` | Short text of the same switch (width 430px and below) | Auto | 자동 | 自動 | 自动 |
| `hint` | `.hint` | Drag to rotate | 드래그해서 돌려 보기 | ドラッグで回転 | 拖动旋转 |
| `fallback` | `.fallback` (no WebGL) | This browser can't draw the 3D model. You can still follow the content from the text alone. | 이 브라우저에서는 3D 모형을 그릴 수 없습니다. 본문만으로도 내용을 따라갈 수 있습니다. | このブラウザでは3Dモデルを表示できません。本文だけでも内容を追えます。 | 此浏览器无法显示 3D 模型。只看正文也能理解内容。 |
| `loading` | `.fallback p` while initializing | Loading the model… You can read the text while you wait. | 모형을 불러오는 중입니다. 기다리는 동안 본문을 읽을 수 있습니다. | モデルを読み込んでいます。待っている間も本文を読めます。 | 正在加载模型…等待时可以先阅读正文。 |
| `loadError` | `.fallback p` after an import or initialization failure | Couldn't load the model. Check your connection and try again, or keep reading the text. | 모형을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도하거나 본문을 계속 읽어 주세요. | モデルを読み込めませんでした。接続を確認して再試行するか、本文を読み進めてください。 | 无法加载模型。请检查网络连接后重试，或继续阅读正文。 |
| `retry` | `.retry-load` button (reloads the page) | Retry | 다시 시도 | 再試行 | 重试 |
| `stageAria` | `aria-label` of `aside.stage` | Model | 모형 | モデル | 模型 |
| `terms` | "Glossary" heading | Glossary | 용어 정리 | 用語集 | 术语表 |
| `sources` | Sources heading. The `data-date` value goes in `{date}` | Sources (checked {date}) | 출처 ({date} 확인) | 出典（{date} 確認） | 来源（{date} 核对） |
| `runError` | Caption when a scene run fails | Couldn't play the animation. Reload the page and try again. | 애니메이션을 재생하지 못했습니다. 새로고침한 뒤 다시 눌러 보세요. | アニメーションを再生できませんでした。ページを再読み込みして、もう一度お試しください。 | 无法播放动画。请刷新页面后重试。 |
| `speed` | `aria-label` of the speed menu | Playback speed | 재생 속도 | 再生速度 | 播放速度 |
| `speedSeg` | `aria-label` of the speed segment; `{v}` is the value | Playback speed {v} | 재생 속도 {v} | 再生速度 {v} | 播放速度 {v} |
| `railAria` | `aria-label` of the caption rail | Step captions | 단계 설명 | 手順の説明 | 步骤说明 |
| `railShow` | `aria-label` of the caption toggle (closed) | Show all | 모두 보기 | すべて表示 | 全部 |
| `railHide` | `aria-label` of the caption toggle (open) | Hide | 접기 | 閉じる | 收起 |
| `splitX` | `aria-label` of the text/stage divider | Resize text and model | 본문과 모형 너비 조절 | 本文とモデルの幅を調整 | 调整正文与模型的宽度 |
| `splitH` | `aria-label` of the stage-height handle | Resize model height | 모형 높이 조절 | モデルの高さを調整 | 调整模型高度 |

### Markup attributes

- `data-ui="key"`: fills that element's text (`textContent`) with the dictionary value. If `data-date="YYYY-MM-DD"` is also present, `{date}` in the value is replaced with that date.
- `data-ui-aria="key"`: fills that element's `aria-label` with the dictionary value.
- The text written inside the element is the default text shown before JS runs. It is English in the template and the English demo, and Korean in the Korean demo. The inline module replaces it with the dictionary value before any kit loads its libraries, so CDN failures also use the page language.
- A key that is not in the dictionary leaves a `console.warn` and the element stays as it is.
- The auto-play switch holds both `<span class="long" data-ui="autorun">` and `<span class="short" data-ui="autorunShort">`. CSS shows only `.short` at 430px wide and below. The accessible name is `data-ui-aria="autorun"` (the long text).
- The speed segment, speed menu, caption rail, and split handles are created by the engine and take their text from the dictionary directly.
- The demo has no `data-ui-aria` on `aside.stage`; it writes a topic-specific `aria-label` directly, such as `aria-label="샌드박스 3D 모형"`.

### Overrides: `window.UI_OVERRIDES`

Set it in the plain `<script>` below the template body (before the module script). Do not edit the engine.

```html
<html lang="es">
<script>
window.UI_OVERRIDES = {
  es: {
    resetView: 'Restablecer vista',
    autorun: 'Reproducción automática',   // if autorunShort is not given, the short text is this too
    hint: 'Arrastra para girar',
    speed: 'Velocidad de reproducción',
    terms: 'Glosario',
    sources: 'Fuentes (verificadas el {date})',
  },
};
</script>
```

- Keys are matched in this order: the full `lang` (`es-MX`), its prefix (`es`), the built-in language name (`zh-CN`). You can also override a key of a built-in language (such as `ko`) to change just one string.
- Lookup order: `UI_OVERRIDES[language]` → built-in dictionary[language] → `en`. For a new language you may fill in only the keys you want and leave the rest in English, but these are strings the learner sees, so fill in `noteWide`, `noteNarrow`, `noteSteps`, `noteMixedWide`, `noteMixedNarrow` (the last three fall back to the page's `noteWide` / `noteNarrow` when left out, never to English), `fallback`, `loading`, `loadError`, `retry`, `runError`, `speed`, `speedSeg`, `railShow`, and `railHide` too.
- If you give only `autorun` and not `autorunShort`, the short text uses the `autorun` text too (so English "Auto" does not get mixed in).
- The `:lang(ja)` and `:lang(zh)` font rules do not apply to a page in a non-built-in language. For Latin-script languages (Spanish, French, and so on) the default fonts are enough. For scripts that need their own fonts, such as Arabic or Thai, this template does not cover them (the CSS must stay the same as the demo's, so do not change the engine side; ask the user to decide).

### Fonts

- Under `:lang(ja)` and `:lang(zh)`, `--serif`, `--title`, and `--sans` switch to system CJK fonts. Japanese uses the Hiragino Sans, Yu Gothic, and Noto Sans JP families (titles use the Hiragino Mincho and Yu Mincho families); Simplified Chinese uses the PingFang SC, Microsoft YaHei, and Noto Sans SC families (titles use the Songti SC and Noto Serif SC families). No CDN fonts are added.
- For ja and zh, `word-break: keep-all` is released and `line-break: strict` breaks lines per character.
