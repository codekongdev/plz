# Forms

The catalog of chapter forms the kits can draw. SKILL.md ("Choosing a form per chapter") says which question picks which form; this file says what each form is, what it fits and does not fit, which parts build it, how the reader drives it, and which shipped chapter to copy from. The build details (parts, options, points) are in `engine-api.md`, and code patterns per form are in `scene-patterns.md`. Timing rules for every form are in `motion.md`.

Example pages are in `assets/`. Every example has an English counterpart beside it with the same name ending in `.en.html`; open that one when you build an English page.

| Form | Kit | Main parts | Interaction | Copy from |
|---|---|---|---|---|
| 3D block model | axo | `block`, `glass`, `actorCube`, `matterBlock`, `packet`, `tube`, `tag` | Run button; drag to rotate | `example-agent-sandbox.html` ch. 4, 6, 9 |
| Step diagram | svg | `d.table`, `d.buckets`, `d.box`, `d.gate`, `d.bits`, `d.link`, `d.token` in `d.grid` / `d.stack` | Run button | `example-hash-join-sip.html` ch. 2–3, `example-bloom-filter.html` ch. 1–2 |
| Operator tree | svg | `d.tree` | Run button | `example-hash-join-sip.html` ch. 1 |
| Node columns | svg | `d.columns` (often in `d.stack` with a table or tree) | Run button | `example-hash-join-sip.html` ch. 5 |
| Side-by-side panels | svg | `d.panels` around two copies of another form | Run button feeding both sides | `example-hash-join-sip.html` ch. 4, `example-lost-update.html` ch. 5 |
| Lanes | svg | `d.lanes` (`event`, `message`, `span`), `a.play` | Run button | `example-lost-update.html` ch. 1–4 |
| Parameter playground | svg | `params`, `presets`, `update`, `d.chart`, `d.meter`, `d.readout` | Run plays a tour; then sliders and presets | `example-bloom-filter.html` ch. 3–5 |
| Code and state | svg | `d.code`, `d.frames`, `d.queue`, `d.console`, `d.vars` in `d.flow`; `a.line`, `a.carry`, `a.checkpoint` | Run button and Step button (`step: true`) | `example-event-loop.html` ch. 1–5 (ch. 4 for predicting) |

## Why 2D is the default

People read positions on the screen plane quickly and depth slowly. A third axis adds occlusion, tilted or distorted text and the cost of turning the view ([Munzner, VAD rules](https://cs.ubc.ca/~tmm/talks/vad/VAD-rules.pdf)). In experiments, 3D displays helped shape understanding, while 2D displays were faster and more accurate for judging relative position ([St. John et al. 2001](https://apps.dtic.mil/sti/pdfs/ADA374709.pdf)). Almost every well-regarded system explainer is 2D: cells, rows, slots, lanes and nodes on a plane, with the key values written on everything that moves, and colour kept for state.

So the test for the 3D block model is: **if you remove the third axis, does the reader lose a fact they need?** If not, draw the chapter in 2D.

## 3D block model

- **What it is.** A three.js axonometric model of white blocks with ink outlines: layers as slabs, boundaries as glass rooms, the actor as a red cube, requests as small balls that travel.
- **Fits.** Depth, layering or containment is the concept: a process inside a sandbox inside a VM, a kernel shared under several rooms, storage or cache tiers, tenant boundaries, what sits under what. Also the lifetime of rooms on a shared floor (created, paused, resumed).
- **Not for.** Comparing values, row-level operations, graphs and plans, long text on the model. Heights that stand for quantities (a 3D bar chart) are hard to compare; draw them in 2D.
- **Kit and parts.** `kit: 'axo'` (the default). `block`, `glass`, `actorCube`, `matterBlock`, `packet`, `tube`, `arrow`, `line`, `tag`; `temporaryGroup()` for one-shot objects. Patterns 1–9 in `scene-patterns.md`.
- **Interaction.** The run button plays the steps; the reader can drag the model sideways to rotate it. The camera moves only on chapter changes.
- **Copy from.** `example-agent-sandbox.html`: chapter 4 (glass rooms on a shared floor and an escape attempt), chapter 6 (two layers of boundary), chapter 3 (same question, different answer: two stages side by side), chapter 9 (a lifetime).
- **Exemplars.** [Edge DevTools 3D View](https://learn.microsoft.com/microsoft-edge/devtools/3d-view) lifts nesting depth onto the Z axis. Realistic machines where the shape and motion of the parts are the cause ([Ciechanowski, Mechanical Watch](https://ciechanow.ski/mechanical-watch/)) are a different form that the kit does not draw.

## Step diagram

- **What it is.** Tables of rows with keys, hash buckets, operator boxes with one lane per row, filters (gates), bit arrays and connectors. Tokens carry the key values from one part to another, a few at a time.
- **Fits.** Exact values, identifiers and order: which row or key goes where, in what order, and what is matched, dropped or written. Joins, filters, hashing, a bit array being set and probed, queues of requests.
- **Not for.** Continuous relationships (use a playground), many anonymous actors, depth and containment (use the 3D block model), the relative timing of a few actors (use lanes).
- **Kit and parts.** `kit: 'svg'`. `d.table`, `d.buckets`, `d.box`, `d.gate`, `d.bits`, `d.link`, `d.token`, arranged with `d.grid` (rows of cells with gutters for connectors and gates) or `d.stack`. Parts of other forms are fine when they show the value best: `d.queue` for a FIFO, `d.vars` for a few named values, `d.chart` for a value the run plots step by step (a window growing and halving). Patterns 10–11.
- **Interaction.** The run button. Rows move in groups of at most three (`a.groups`); a dropped row leaves in its own step and is counted on a tally.
- **Copy from.** `example-hash-join-sip.html` chapter 2 (build and probe), chapter 3 (a filter passed sideways); `example-bloom-filter.html` chapters 1–2 (a bit array: adding and looking up keys).
- **Exemplars.** [PlanetScale, Database Transactions](https://planetscale.com/blog/database-transactions) (row versions next to the sessions' statements), [samwho, Memory Allocation](https://samwho.dev/memory-allocation). For joins, row-level diagrams beat Venn diagrams ([jOOQ](https://blog.jooq.org/say-no-to-venn-diagrams-when-explaining-joins/)).

## Operator tree

- **What it is.** A tree of operator nodes with a metric on each (rows, time); data flows up the edges to the parent.
- **Fits.** An overview of a plan, a pipeline or a topology where each node carries a number: a query plan, a build graph, a cluster overview. Often the first chapter, before the chapters that zoom into one operator.
- **Not for.** The movement of individual rows (use a step diagram inside the operator), long node labels (keep them to about 14 characters).
- **Kit and parts.** `kit: 'svg'`. `d.tree(spec)`; `node(id).mark`, `node(id).metric`, `edge(id)` for a count chip travelling to the parent. Pattern 13.
- **Interaction.** The run button walks the plan one node at a time.
- **Copy from.** `example-hash-join-sip.html` chapter 1 (the plan at a glance).
- **Exemplars.** [explain.dalibo.com](https://explain.dalibo.com/) (a plan viewer with a metric per node).

## Node columns

- **What it is.** Several nodes, servers or partitions side by side, each a column with slots for rows; rows move to the column that owns them.
- **Fits.** Data spread over machines: partitioning, redistribution before a join, sharding, which node can see which rows.
- **Not for.** A single machine's internals, or more columns than fit a phone (keep to three or four).
- **Kit and parts.** `kit: 'svg'`. `d.columns(names, { slots })`, usually in `d.stack` with a table or a tree. Pattern 14.
- **Interaction.** The run button moves a few representative rows (three or four) one by one and shows the rest as a count.
- **Copy from.** `example-hash-join-sip.html` chapter 5 (where the filter cannot cross between nodes).
- **Exemplars.** [PlanetScale, Database Sharding](https://planetscale.com/blog/database-sharding) (an interactive post on sharding; its widgets were not studied in detail).

## Side-by-side panels

- **What it is.** The same diagram twice, side by side, each with a title, fed by one trigger: one input, two rules or options. Panels wrap another svg form (a step diagram or lanes); they stack on phones and narrow stages.
- **Fits.** A contrast between two strategies or settings on the same input: a filter off and on, a row lock against a version check. This is the 2D form of "Same question, different answer" in SKILL.md; end the chapter with a summary table in the body.
- **Not for.** A variant the reader has not met yet (teach each side first, then compare), or three or more options (three panels do not fit a stage; compare the third in the summary table).
- **Kit and parts.** `kit: 'svg'`. `d.panels([{ title, body }, …])` around two copies of a form built by one function; play both with `Promise.all`. Pattern 12, and "Same schedule under two rules" in pattern 15. In 3D, use two stages along `SCREEN_RIGHT` instead (pattern 9).
- **Interaction.** One run button plays both sides at the same time.
- **Copy from.** `example-hash-join-sip.html` chapter 4 (same query, filter off and on), `example-lost-update.html` chapter 5 (same order, two fixes: two lanes diagrams).
- **Exemplars.** [Encore, Queueing](https://encore.dev/blog/queueing) runs several queue strategies on the same requests.

## Lanes

- **What it is.** Time-axis swimlanes: one column per actor, time running down in steps, a shared resource (a row, a lock) as a lane between them, messages as arrows, waits and locks as bars. A playhead marks "now"; every passed step stays as a trace.
- **Fits.** Two to five actors whose relative timing decides the outcome: races, isolation anomalies, lock waits, retries, handshakes, leader election.
- **Not for.** One actor (use a step diagram), hundreds of identical actors (a simulation, which the kit does not draw), or when the topology itself is the subject (use node columns or a tree).
- **Kit and parts.** `kit: 'svg'`. `d.lanes(list, { steps })` with `L.event`, `L.message`, `L.span`; `a.play(L, step)`. Pattern 15.
- **Interaction.** The run button advances the playhead a few steps per caption.
- **Copy from.** `example-lost-update.html` chapter 2 (the lost update), chapter 3 (a lock wait), chapter 4 (a version check that retries).
- **Exemplars.** [RaftScope](https://raft.github.io/raftscope/index.html) (servers and messages over time), [An interactive intro to CRDTs](https://jakelazaroff.com/words/an-interactive-intro-to-crdts/).

## Parameter playground

- **What it is.** One to three sliders (and optional presets) drive a chart, meters and readouts computed from a formula. The run button plays a short tour through chosen values; then the reader explores.
- **Fits.** How an outcome responds to a continuous or ordinal parameter: bits per key against the false positive rate, load against latency, cache size against hit rate, node size against tree height.
- **Not for.** A fixed procedure, where a slider would only replay time (use a step diagram with the run button), or a parameter the reader cannot connect to a cause.
- **Kit and parts.** `kit: 'svg'`. `params` and `presets` on the scene, `update(p)` that draws for the values; `d.chart` (`line`, `marker`, `ref`), `d.meter`, `d.readout`; `a.set` for the tour. Pattern 16.
- **Interaction.** Run plays the tour; afterwards the sliders, presets and arrow keys. The reader's input stops a running tour and holds auto-play.
- **Copy from.** `example-bloom-filter.html` chapter 3 (more bits), chapter 4 (how many hash functions: a U-shaped curve with a preset near its minimum), chapter 5 (sizing with three readouts).
- **Exemplars.** [samwho, Load Balancing](https://samwho.dev/load-balancing), [Latency numbers by year](https://colin-scott.github.io/personal_website/research/interactive_latency.html), [Jason Davies, Bloom Filters](https://www.jasondavies.com/bloomfilter/).

## Code and state

- **What it is.** A short program beside the hidden state it changes (a call stack, queues, a console, named variables). A marker moves line by line, and each line changes one part of the state.
- **Fits.** What code or commands do to state the reader cannot see: the event loop, recursion and the call stack, a cache, a protocol state machine, interleaved threads. The reader already knows the language.
- **Not for.** Readers who have not met the code yet, or chapters where the code is incidental to the concept. Programs longer than about 10 lines of about 40 characters.
- **Kit and parts.** `kit: 'svg'`. `d.code`, `d.frames`, `d.queue`, `d.console`, `d.vars`, arranged with `d.flow` (the kit picks the wrapping that draws largest); `a.line`, `a.carry`, `a.checkpoint`. Pattern 17.
- **Interaction.** The run button, and a Step button (`step: true`) where the reader should predict what happens next.
- **Copy from.** `example-event-loop.html` chapter 1 (the call stack), chapter 2 (a timer callback in the task queue), chapter 4 (predict the order, with stepping), chapter 5 (a microtask that queues a microtask).
- **Exemplars.** [Python Tutor](https://pythontutor.com/), [Aquascope](https://cel.cs.brown.edu/aquascope/), [Loupe](http://latentflip.com/loupe/) for the JavaScript event loop.

## Forms the kits do not draw yet

The research found more forms than the kits draw. When a chapter needs one of them, use the nearest form below and tell the user what the page simplifies; do not write a new kit inside a page.

| Form | Nearest form in the kits | Exemplar |
|---|---|---|
| Byte and bit layout (packet fields, page layout) | Step diagram: `d.bits` for bits, a key-only `d.table` for fields | [The Illustrated TLS 1.3 Connection](https://tls13.xargs.org/) |
| Agent or particle simulation (tail latency, queue build-up) | Parameter playground with a chart of the aggregate | [Encore, Queueing](https://encore.dev/blog/queueing) |
| Algorithm visualizer with the reader's own input | Step diagram with a fixed, chosen input | [VisuAlgo, Hash Table](https://visualgo.net/en/hashtable) |
| Realistic 3D mechanism | Not covered; say so to the user | [Ciechanowski, Internal Combustion Engine](https://ciechanow.ski/internal-combustion-engine/) |
| A message lost in transit, drawn in lanes | Lanes: put the loss on the sender's event (`mark('lost')` on a value, or a short text such as "seg 5 ✕") | [RaftScope](https://raft.github.io/raftscope/index.html) |
| Static step comic (a first mental model with no state to change) | Body text with a figure, or merge into the next chapter | [How DNS works](https://dnsimple.com/comics/how-dns-works/) |
