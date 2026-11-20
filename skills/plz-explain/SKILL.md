---
name: plz-explain
description: |
  Builds a single-file HTML study page that teaches a technical concept, mechanism, or system structure
  with step-by-step animations: a 2D diagram or a 3D block model, chosen per chapter. Scrolling the text
  switches the stage chapter by chapter, and a button plays out cause and effect with numbered captions
  (rows moving through operators, actors racing on a timeline, code changing a call stack, sliders
  driving a chart, layers and boundaries in 3D). The page is written in the user's language; screen text
  is built in for en, ko, ja, zh-CN. Use when someone wants to learn a concept visually or wants
  interactive study material. Not for static diagrams (archify), data charts, Blender modeling, or
  landing pages and app UI.
  Triggers: "explain X visually", "interactive explainer", "animated explainer", "explain X in 3D",
  "3D explainer", "step-by-step animation of X"; "그림으로 움직이며 설명해줘", "단계별 애니메이션으로 보여줘",
  "3D로 공부하게 만들어줘", "원리를 모형으로 보여줘"; "仕組みをアニメーションで解説して", "3Dで解説して";
  "用动画讲解这个原理", "用3D讲解这个概念", "做成交互式讲解页面".
---

# Animated Concept Explainer Page

The goal is to let a first-time learner see where things get blocked, where they flow, and when
they appear and disappear. Show what text alone cannot convey (values moving between parts, the timing
of a few actors, hidden state, layers and boundaries) on a stage beside the text, and let the learner
trigger the events with a button. The stage is half of the explanation, not decoration. Motion carries
only the change being learned.

## Output

- One HTML file. Web fonts load from a CDN, and three.js r170 too when the page has a 3D chapter, so opening the page needs internet. There is no build step.
- Left: title, intro, numbered chapters, glossary, sources. Right: a fixed stage with the current chapter title, the auto-play switch, the reset-view button (3D chapters), the semantic color legend, and the caption rail.
- Scrolling switches the stage to the scene of the chapter crossing the reading line. Each chapter has one run button. Pressing it plays the steps on the stage, and each step's caption appears on the stage, next to the drawing, numbered like the steps in the text.
- The run button is a split button: `[Run][1× ▾]`. The segment opens a speed menu (0.5×, 1×, 1.5×, 2×). The speed is shared by every chapter and remembered. Code-and-state chapters can add a Step button.
- The divider between text and stage can be dragged (on portrait phones, a handle at the bottom of the stage changes its height). The position is remembered.
- The "Auto-play" switch at the top right of the stage repeats the action of the chapter being read (off by default; the on state is remembered).
- Finished examples in `assets/`, each with an English counterpart ending in `.en.html` (look at that one when building an English page):
  - `example-agent-sandbox.html`: how AI-agent code sandboxes isolate code, 10 chapters, all 3D.
  - `example-hash-join-sip.html`: hash join and SIP, 5 chapters: operator tree, step diagrams with a filter, side-by-side panels, node columns.
  - `example-lost-update.html`: two sessions writing one row, 5 chapters of lanes.
  - `example-bloom-filter.html`: Bloom filters, 5 chapters: a bit array step by step, then three parameter playgrounds.
  - `example-event-loop.html`: the JavaScript event loop, 5 chapters of code and state with a Step button.

  `references/forms.md` lists which chapter of which example shows each form. When you need a similar scene, look there first.

## Page structure: shell and kits

The page has two layers of engine code. Neither is edited when building a page.

- **The shell** owns the layout, chapter switching, HUD, caption rail, speed menu, split, auto-play, timing (the director), and verification hooks. It does not draw anything.
- **A kit** draws the stage. Each scene names its kit with `kit:` (default `'axo'`). There are two:
  - `axo`: the 3D block model, a three.js axonometric model of white blocks with ink outlines.
  - `svg`: every 2D form (step diagram, operator tree, node columns, side-by-side panels, lanes, parameter playground, code and state), with no library.
- The stage lists the kits the page uses in `data-kits` on `aside.stage`: the template has `axo svg`; use `svg` alone when there is no 3D chapter, so three.js is never downloaded.
- Each kit's code and styles sit in their own sections of the template, marked `KIT <kit> css` / `KIT <kit> js` … `END KIT <kit> …`. A page keeps only the sections of the kits it uses (see "Build from the template").

## Choosing a form per chapter

Answer these five questions for every chapter, in order, before you build anything, and write the answers down as a chapter spec (template at the end of this section). The catalog with every form's fit, limits, parts and examples is `references/forms.md`; the timing rules and their sources are `references/motion.md`.

### 1. Is there a change to learn?

Write one sentence: what changes, in what order, and why. This sentence is the chapter's `change`, and every motion in the chapter serves it; a movement that is not in the sentence is cut. If nothing changes (a definition, a static overview), it is not an animated chapter: put it in the intro or the body of a neighbouring chapter, or merge it with the chapter where the change starts. Every chapter on the page has a run button, so every chapter needs a change.

### 2. Where does the information live? Pick the form

Ask the rows in order and take the first "yes". The 3D row comes first because it is the narrowest: 2D is the default, and 3D is right only when removing the third axis would lose a fact the reader needs.

| # | Question | Form (kit) | Main parts | Copy from |
|---|---|---|---|---|
| 1 | Is depth, layering or containment itself the lesson (a process inside a sandbox inside a VM, rooms on a shared kernel)? | 3D block model (`axo`) | `block`, `glass`, `actorCube`, `packet`, `tube`, `tag` | `example-agent-sandbox.html` ch. 4, 6, 9 |
| 2 | Does the relative timing of 2–5 actors decide the outcome (a race, a lock wait, a retry, a handshake)? | Lanes (`svg`) | `d.lanes`, `L.event`, `L.message`, `L.span`, `a.play` | `example-lost-update.html` ch. 2–4 |
| 3 | Is the point how an outcome responds to a parameter the reader can vary (a size, a rate, a count)? | Parameter playground (`svg`) | `params`, `d.chart`, `d.meter`, `d.readout`, `a.set` | `example-bloom-filter.html` ch. 3–5 |
| 4 | Does code or a command change state the reader cannot see (a stack, queues, variables), and does the reader know the language? | Code and state (`svg`) | `d.code`, `d.frames`, `d.queue`, `d.console`, `d.vars` in `d.flow`; `a.line` | `example-event-loop.html` ch. 1–5 (ch. 4 for predicting) |
| 5 | Is it an overview of a plan, pipeline or topology with a number on each node? | Operator tree (`svg`) | `d.tree` | `example-hash-join-sip.html` ch. 1 |
| 6 | Are rows spread over several nodes, servers or partitions, and does which one owns a row matter? | Node columns (`svg`) | `d.columns` | `example-hash-join-sip.html` ch. 5 |
| 7 | Which value, row or key goes where, in what order, and what is matched or dropped? | Step diagram (`svg`) | `d.table`, `d.buckets`, `d.box`, `d.gate`, `d.bits`, `d.link`, `d.token` in `d.grid` | `example-hash-join-sip.html` ch. 2–3, `example-bloom-filter.html` ch. 1–2 |
| 8 | After picking a form above: does the chapter run the same input under two options or rules? | Side-by-side panels: the form above, built twice, in `d.panels` (3D: two stages along `SCREEN_RIGHT`) | `d.panels` | `example-hash-join-sip.html` ch. 4, `example-lost-update.html` ch. 5, `example-agent-sandbox.html` ch. 3 |

- No "yes" in rows 1–7: use the step diagram, the 2D default. If the concept needs a form the kits do not draw (a byte layout, a simulation of many actors, a realistic machine), use the nearest form from the table in "Forms the kits do not draw yet" in `references/forms.md` and tell the user what the page simplifies.
- Two rows fit: write the chapter's `change` sentence and pick the row that names its subject. "Which flag sets which setting" is row 7; "what these lines do to the stack, in order" is row 4. Row 4 is for code the reader follows line by line, not for any chapter that happens to contain a command.
- Layers that only pass values along (a protocol stack handing a packet down, a request through bridges and NAT, a path through mount points) are row 7, not row 1: the lesson is where the value goes and how it changes. The 3D request patterns in `scene-patterns.md` (intermediary, allowed exit, request path) are for chapters of a page whose rooms and floors are already the lesson, such as a sandbox page.
- Row 2 is for outcomes that depend on who acts when (a lost write, a wait, a retry, which signal arrives first, an ACK pacing a sender). When the outcome comes from a rule applied to a value over time (a window that grows and halves, two flows converging), use row 7 with a `d.chart` that the run draws point by point (`series.set`, `marker.at`); that is not a playground, because the reader does not vary a cause.
- A slider that would only move time forward is not a playground; use the run button.
- Several actors exchanging messages: lanes when the lesson is who acts when; code and state when the lesson is what the code does to the state.
- Row 8 compares options on the same question or workload; the inputs may differ when the options need it (say so). Teach each option before the comparison, in an earlier chapter or at the start of the comparison chapter's body. Two panels fit a stage; put a third option in the summary table in the body.
- Parts are not locked to a form: a step diagram may use `d.queue`, `d.vars`, `d.chart` or `d.readout` when they show the value best. The form decides the layout and the interaction, not the part list.
- Row 4 asks whether the reader knows the language. If the request does not say, assume the language the topic is usually written in (shell for containers, JavaScript for the browser event loop), keep the code to the lines that matter, and explain each line in the body.

### 3. What is the time structure? Pick the interaction

| Time structure | Interaction |
|---|---|
| A short sequence of discrete steps (up to about 10) | The run button, at the designed pace. Every chapter has it |
| The reader should predict each step before seeing it (code and state) | Add the Step button (`step: true`) and ask the question in the body before the run |
| A continuous or ordinal cause | 1–3 sliders and presets (playground); the run button plays a short tour first |
| A long sequence of events | Not a single chapter: split it into chapters, or show fewer steps |

Auto-play is the reader's switch, off by default; do not build loops yourself. Predicting first teaches more than watching (`references/motion.md`, "Predict before watching").

### 4. What kind of motion is each step?

Number the steps (`say('2. …')`, matching `ol.steps` in the body) and give each step exactly one kind:

- **causes**: A makes B happen. B starts as A arrives, with no visible gap; the caption states the effect.
- **follows**: B only comes after A. Leave a short pause, keep A from touching B, and write "then", not "so".
- **appears**: a part or value enters (a fade or a growth).
- **leaves**: something is dropped or removed, in its own step, with a count, leaving a trace (a struck-through row).
- **highlight**: attention moves to a part without changing state (one outline or flash).

A step is one numbered caption. When one engine call reveals several things (a lanes step shows events, then messages, then the values they cause), give the step the kind of its main change: the one the caption states. In side-by-side panels, one step plays on both sides; if the sides do different kinds of things, give each its own step ("Left: …", "Right: …"), and count moving objects per panel.

One kind of change per step; about 1 s per tracked move; at most 3–4 things moving at once (1–2 when the reader must tell them apart); the caption after the motion; the result stays visible at the end. The numbers, the engine defaults and their sources are in `references/motion.md`.

### 5. How do the chapters connect?

- One form per chapter. A page may mix forms and kits across chapters; the stage cuts between them at the chapter boundary, with no transition to build.
- Keep the three semantic colors and the same label for the same thing in every chapter and both kits, so the reader recognises an object when the form changes.
- Order the chapters from small to large: author-led step chapters first, a comparison only after the reader knows each side, playgrounds (free exploration) after the chapters they build on. Use the last one or two chapters to apply the idea to the user's actual situation, in whatever form fits; if the request gives no situation (an issue, a draft, a product), use a common real one (a typical command, a common network) and say in the body that it is an example.

### Chapter spec

Write one block per chapter before building, and keep them in your working notes (not in the page):

```text
Chapter 3: <title>
change:      <one sentence: what changes, in what order, and why>
form:        <form> (<kit>), because <the row in step 2 that said yes, or "no row: the 2D default"; what another form would lose>
copy from:   <example page and chapter>
parts:       <the parts and their labels, colors by meaning>
interaction: run | run + step | sliders (tour stops: …)
steps:                          (moving: objects that travel or that the reader must track; flashes and counters are 0)
  1. [causes]  <caption>        moving: 1   anchor: <part>
  2. [leaves]  <caption>        moving: 2   anchor: <counter>
  3. [follows] <caption>        moving: 0
gist:        <the chapter in one sentence>
```

A chapter whose spec has no `change` or no step goes back to question 1.

## Page language

Decide the page language in this order. If an earlier item exists, ignore the later ones.

1. The language the user named ("make it in Japanese")
2. The language of the request
3. The language mainly used in the conversation

- Set `<html lang>` to that language (`ko`, `en`, `ja`, `zh-CN`, etc.). The template default is `en`.
- Write the body, chapter titles, step captions (`say`), labels, legend, and scene `title` directly in that language. Do not write them in another language and translate. The language of this document does not decide the language of the page you build.
- Screen text (buttons, the speed menu, the caption toggle, notices, the "Glossary" and "Sources" headings, error text) comes out automatically in the `<html lang>` language from the ENGINE's text dictionary. Built-in languages are English (`en`, canonical), Korean (`ko`), Japanese (`ja`), and Simplified Chinese (`zh-CN`). `ko*` maps to `ko`, `ja*` to `ja`, `zh*` to `zh-CN`, and anything else to `en`.
- For a language not in the dictionary (for example Spanish), fill in that language's strings in the template's `window.UI_OVERRIDES`. Keys you leave out come out in English. Do not edit the engine. The key list and usage are in "Screen text and language" in `references/engine-api.md`.
- Put the date in the sources heading in the `data-date` of `<h3 data-ui="sources" data-date="YYYY-MM-DD">`. The engine generates the heading text ("Sources (checked …)").
- On Japanese and Chinese pages, fonts fall back to system CJK fonts and line breaks switch to per-character (both are in the template CSS). Check with `__explainer.lang()`.

## Workflow

If `references/preferences.md` exists, read it first. Where items overlap, follow preferences over this document's defaults. If it does not exist, use the defaults.

### 1. Decide the content first

**Fact-check.** If the topic depends on repository code or current product information, check it first (read the code, official docs, web search). Leave the sources you checked and the date at the end of the page, and write "not checked" for anything you could not verify. Learners trust this page as fact and memorize it.

**Chapter design.** Split into 5-10 chapters. Go from easy to hard, and use the last one or two chapters to apply the idea to the user's actual situation (an issue in progress, a design draft, a product comparison). Then follow "Choosing a form per chapter" above for every chapter and write the chapter specs. Ask the user only when the topic scope is ambiguous.

### 2. Visual and motion rules

The style is an architectural model: white massing and paper, ink outlines, light shadows. It is chosen so that learners read structure, so keep it when the topic changes.

- 3D chapters: an orthographic (axonometric) camera, white model, ink outlines, light shadows. They are in the axo kit.
- 2D chapters use the same paper: white tables and boxes with hairline borders, keys in the mono font, the active element marked by an ink outline or halo (never an extra color).
- Use a light background. A white model reads well against a light ground, with clear outlines and shadows.
- There are only three semantic colors. actor (the protagonist that moves and causes things, red), bound (boundary, rule, intermediary, blue), matter (data, resource, material, brass). Give each color exactly one meaning, and draw everything else in white and ink. Write what each means on this page in the legend.
- Motion happens only when the reader presses a button or turns on auto-play, and when the chapter changes. Follow the motion kinds of step 4 above and the rules in `references/motion.md`.
- Write labels as short noun phrases (about 15 characters) and keep them from overlapping.
- Fonts: the headline (h1) uses Pretendard Variable (2.2rem, 1.7rem on phones, weight 700); chapter titles (h2) and the stage title use Hahmlet; body text uses IBM Plex Sans KR; only code identifiers use IBM Plex Mono. If you want other fonts, change them in preferences. Japanese and Chinese pages (`:lang(ja)`, `:lang(zh)`) fall back to system fonts such as Hiragino Sans, Yu Gothic, PingFang SC, and Noto Sans CJK, because these web fonts lack enough kana and Simplified Chinese glyphs (this is in the template CSS). Do not add CDN fonts.

### 3. Build from the template

Copy `assets/template.html` to the output location and fill in only the HTML marked `TEXT` and the `SCENES` section. Do not edit the `ENGINE` sections, which hold the shell, the director, and the kits (renderer, camera fitting, label handling, animator). They already contain fixes for bugs we hit.

- Decide which kits the page uses: the kits of the forms in your chapter specs (3D block model: `axo`; every other form: `svg`). For every kit the page does not use, delete everything that belongs to it:
  - in the `<style>` block, from the `/* KIT <kit> css — … */` line through `/* END KIT <kit> css */`;
  - in the script, from `/* KIT <kit> js — … */` through `/* END KIT <kit> js */` (delete those lines exactly; change nothing else in `ENGINE`);
  - in `SCENES`, that kit's code. Without axo: the `setupKit('axo', …)` block (the shared floor), the `FLOOR` constant, and the scenes `s1` and `s2`. Without svg: the scene `s3`.
- Set `data-kits` on `aside.stage` to exactly the kits that remain (`axo`, `svg`, or `axo svg`). `data-kits` is the page's list of kits: every listed kit must be used by a scene, and every kit a scene uses must be listed.
- In `SCENES`, code that uses a kit outside a scene (the axo shared floor, for example) goes inside `setupKit('<kit>', () => { … })`.
- If something is left over or missing (a scene or `setupKit` for a deleted kit, a kit name used at the top level of `SCENES`, a listed kit no scene uses), the page stops and the stage shows a `[plz]` message that says what to fix.

- Make one scene with `defineScene(name, { title, base, target, fitW, fitH, build })` (`kit: 'axo'` is the default). The `data-scene` in the body and the `data-run` on the button must equal `name`.
- An svg scene is `defineScene(name, { kit: 'svg', title, build(d) })`: build parts with `d`, arrange them with `d.grid` / `d.panels` / `d.stack`, and return `{ diagram, run }`. The kit sizes the diagram for every stage and restores every part on reset. The template's `s3` is a short example.
- `build()` returns `{ group, reset, run }`. `reset()` restores everything `run()` changed (position, size, visibility, label text). The engine restores colors and clears the captions.
- `run(a, say)`: `a` is the animator, `say(text, { anchor })` adds a step caption to the rail. Start a step's caption with its number, a period, and a space (`say('2. The broker checked the request.')`) to match `ol.steps` in the body. A caption with the same number as the newest one updates that step in place (useful for "trying…" followed by "blocked"). `anchor` puts the same number in a badge next to that object; use it when it is not obvious which object a step is about.
- The action row holds only the button: `<div class="act"><button type="button" disabled data-run="name">…</button></div>`. The engine adds the speed segment. There is no result line in the text column.
- The ENGINE handles auto-play. Only chapters with a `data-run` button inside the chapter body's `.act` loop; elements without a button (intro, glossary) do not run. It also does not run at the very top of the page (scroll 40px or less). To loop, the scene's `reset()` must restore everything `run()` changed (including label text).
- Screen text elements (the intro `.note`'s `.wide` and `.narrow`, HUD buttons, `.hint`, `.fallback`, the glossary and sources headings) carry `data-ui="key"` or `data-ui-aria="key"`, and the engine fills them in the page language. Do not edit this text directly in TEXT. To change it, override it with `UI_OVERRIDES`. The stage's `aria-label` (`data-ui-aria="stageAria"`) has the generic text "Model"; to put the topic in it, delete that attribute and write `aria-label` yourself.
- API: `references/engine-api.md`
- Forms (what each fits, its parts, the example chapter to copy): `references/forms.md`
- Code patterns per form (layers, boundaries, flows, lifetimes, comparisons, filters, lanes, playgrounds, code and state): `references/scene-patterns.md`
- Motion rules and their sources: `references/motion.md`

### 4. Writing

- Write in the user's language, in plain sentences. Explain each technical term in one line when it first appears and add it to the glossary.
- When you use an analogy, say so ("as an analogy"). Do not let the analogy replace the concept; follow it with the real name.
- Write 2-3 paragraphs per chapter body, 2-4 sentences per paragraph. Write the step captions (`say`) in the past tense, about what just happened, one sentence each where possible. On phones the closed caption bar shows three lines of the newest caption.
- Put one concrete example in each chapter. Show input, code, or a command that could really come in, and its result. With only abstract explanation, learners find it hard to carry the concept into their own situation. Put code in `pre.code` and quotations such as hidden input in `blockquote.planted`, and match the step captions to the example's step numbers.
- Contrast sentences like "A is one way to do this and B is another way" are where learners get stuck most often.
  Do not leave such sentences as they are. Make a separate chapter that sends the same question to both sides and shows who answers
  ("Same question, different answer" in scene-patterns). End that chapter with a table that sums up the difference once more.
- If a chapter holds a design draft or an estimate, say so in the body. Do not add meta notes or disclaimers about the page itself.

### 5. Verify (do not skip)

Read `references/gotchas.md` first. Overlapping labels and clipped models cannot be found by reading the code.

1. Start a local server in the background:
   `python3 -m http.server <port> --bind 127.0.0.1 --directory <folder>`
2. Open the page at 1440×900 with a browser automation tool (for example Playwright). Check the console for errors (ignore a favicon 404).
3. Run every chapter in one pass for the machine check. Instant mode makes every duration 0, so the pass is quick and the end state is deterministic:
   ```js
   async () => { window.__explainer.instant(true); const out = {}; for (const n of window.__explainer.scenes()) {
     const text = await window.__explainer.run(n);
     out[n] = { text, overlaps: window.__explainer.overlaps(), clipped: window.__explainer.clipped() };
   } return out; }
   ```
   `overlaps` and `clipped` must be empty arrays. `run` waits until the action finishes and the end state is drawn, so
   no intermediate state is captured. `clipped()` also reports `[legend]` when the legend is not fully visible.
4. Repeat step 3 with the split at its minimum and maximum (focus `.split-v` and press Home, then End; double-click it to reset).
5. Turn instant mode off (`__explainer.instant(false)`), take a screenshot right after `__explainer.run(name)` for each chapter, and look at it. Check that the end state matches the captions, that the caption rail is readable beside the model, and that the empty space is not excessive (adjust with `fitW` and `fitH`). Give the save path as an absolute path inside a folder the tool allows (see gotchas).
6. Check auto-play. Turn it on with `__explainer.autorun(true)` and scroll to a chapter. In one chapter, confirm that the loop runs three or more times, that each time the captions reach the last step and are cleared by reset, and that `overlaps()` and `clipped()` are empty at each final state. With it off, scrolling must run nothing; when you move to the next chapter during a run, the previous chapter's loop must stop and the new chapter's loop must start. `__explainer.speed(2)` makes this faster.
7. Check on phones too. At 390×844 and 360×800 (deviceScaleFactor 3, isMobile, hasTouch), confirm that `overlaps()` and `clipped()` are empty arrays for every chapter, with the caption sheet closed and open (`__explainer.rail(true)`), that there is no horizontal scroll (`document.documentElement.scrollWidth === innerWidth`), and that the layout does not break in landscape at 844×390. While scrolling, confirm that `__explainer.current()` matches the chapter being read on screen. Confirm that a vertical swipe on the stage scrolls the page and a horizontal swipe rotates the model.
8. If you built a page that is not Korean (`en`, `ja`, `zh-CN`, an override language), confirm that `__explainer.lang()` is that language and that the screen text (HUD, hint, speed menu, glossary and sources headings) appears in that language. At 390×844 and 360×800, confirm that the HUD's chapter title, switch, and reset-view button do not overlap.
9. Confirm that no placeholder remains and that no Hangul is left in a non-Korean page. Grep the finished page for placeholders of the form `__…__` (for example `grep -nE '__[^_ ][^_]*__' <page>.html | grep -v -e __explainer -e "label = '__actor__'"`; the two filters skip the verification hook and the engine's own default label argument), and expect no output. If the page language is not Korean, confirm that the visible text (excluding script and style, for example `document.body.innerText` and `document.title`) contains no Hangul (`/[가-힣]/`).
10. Pages with controls (playgrounds): for every playground chapter, set each parameter to its minimum and maximum with `__explainer.params(name, { id: value })` (`__explainer.paramSpec(name)` gives the range) and check that `overlaps()` and `clipped()` stay empty at every size above, including 844×390 (where the controls may move into the chapter text). Check that the sliders work with the arrow keys, that the numbers the page shows match the formula in the body, and that with auto-play on, pressing a control stops the loop, a value you changed stays until you run the chapter or leave it, and a press without a change lets the loop come back after a few seconds.
11. After fixing, rerun 3, 4, 6, 7, 8, 9, and 10.

The phone layout is built into the template.

- Portrait phone (width 860px or less): the stage is pinned on top and the text scrolls below it. The stage is split into a title bar, the model, the caption bar, and a legend bar, so nothing sits on the model. Its default height is 44svh plus the caption bar; the handle at its bottom edge changes it.
- Landscape phone (height 520px or less): laid out as on desktop, text on the left and the stage on the right (full screen height), with the caption bar under the model.
- Wide stages (720px and wider, side by side) show every caption in a column beside the model; the camera fits the model into the rest. Narrower stages show one caption bar: the newest caption, "k / n", and a toggle that opens all captions as a sheet inside the stage.
- One line of the stage title bar holds the chapter title, the auto-play switch, and the reset-view button (the chapter title takes up to two lines and is truncated with an ellipsis if longer). At 430px wide and below, the switch text shrinks to a short per-language phrase (English "Auto"; the accessible name stays the long phrase "Auto-play"), and tap targets are 44px or more. Code blocks do not wrap; they scroll horizontally inside the block only.
- Touch: on the stage, a vertical swipe scrolls the page and a horizontal drag rotates the model. Tilting up and down is not supported.
- svg chapters: on wide stages the diagram is scaled up to 1.6× with the captions beside or below it (a code-and-state chapter also tries each wrapping of its `d.flow`, code beside or above the state, and keeps the one drawn largest); on narrow stages and phones the columns compress and the rows adapt (text stays at least 12px on desktop, 11px on phones).
- The intro note follows `data-kits`: an axo-only page says the model can be rotated, an svg-only page says the button plays the event step by step, and a mixed page limits the rotate hint to 3D chapters. For a language outside the built-in ones, write `noteWide`, `noteNarrow`, `noteSteps`, `noteMixedWide`, and `noteMixedNarrow` in `UI_OVERRIDES` (or at least `noteWide` and `noteNarrow`, which the other three fall back to).
- A stage 600px or narrower (phones, or a narrow stage beside the text) uses smaller labels. When the model area is narrower than 700px, the axo kit also pulls labels toward the inside of the model area and shifts them apart when they overlap. Overlaps beyond the cap (56px) remain.
- When you build a page, write short labels and do not place two long labels close together.

### 6. Deliver

- Where to save: when working inside a repository, put it in a working-notes folder that is not committed (check with `git check-ignore`). This keeps study documents from getting mixed into the repository and committed. If there is no such folder, or you are outside a repository, put it in the location set in preferences. If there is none, ask the user, and with no answer put it in the current directory.
- What to report: the full absolute path, the `open <path>` command, the chapter list, and the verification scope (resolutions, whether there were errors and overlaps). Tell the user that the temporary server address closes when the session ends.
