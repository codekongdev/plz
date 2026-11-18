# Engine API

What the `ENGINE` sections of `assets/template.html` provide. Build scenes in the `SCENES` section with only these functions.

The engine has two parts:

- **The shell**: layout, chapter switching, HUD, caption rail, speed menu, split, auto-play, the director (timing), and the verification hooks. It draws nothing.
- **Kits**: each kit draws the stage for the scenes that name it. The only kit today is `axo` (three.js axonometric block model). Sections marked "axo kit" below apply to axo scenes.

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
- The page lists its kits in `data-kits` on `aside.stage` (`data-kits="axo"`; a missing attribute means `axo`). Listed kits load before `SCENES` runs, so `SCENES` can use their parts at the top level (for example `base.add(block(...))`). A page that lists no axo scene never downloads three.js.

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

Every duration and wait in a run goes through the director, whatever the kit.

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

## Kits: `defineKit(name, kit)`

A page author does not write kits; this section is for engine changes. A kit is an object with these methods (only `load` and `build` are required):

| Member | Called |
|---|---|
| `rotatable` | `true` shows the drag hint and Reset view while this kit's scene is active |
| `load(host)` | Once, before the kit's first scene is built. `host = { layer, wrap, relayout }`; `layer` is the kit's own element inside the stage. Import libraries here. Throw an error with `uiKey: 'fallback'` to show the "can't draw" notice instead of the load error |
| `build(def)` | Turns a `defineScene` definition into the kit's scene object, which must have `reset()` and `run(a, say)` |
| `show(scene, prev)` / `hide(scene)` | The scene became active / stopped being active (`hide` drops temporary objects) |
| `reset(scene)` | Restore what the engine owns (colors) before the scene's own `reset()` |
| `clear(scene)` | Drop temporary objects after a failed run |
| `animator(dir, scene)` | Returns the `a` passed to `run()`; without it, `a` is the director |
| `fit(rect, W, H)` | Fit the drawing into `rect` (px inside the layer of size W × H); the rest is under the caption rail |
| `frame()` | Every animation frame while the kit's layer is shown |
| `labels()` | Label elements now visible, for `overlaps()` and `clipped()`. Labels must be DOM elements |
| `badge(anchor, n)` | Put step number `n` next to `anchor`; return a function that removes it |
| `resetView()`, `info()` | Reset view; `{ resources, azimuth }` for the hooks |

## Stage states and verification hooks `window.__explainer`

The stage's `data-state` is `loading`, `ready`, or `failed`. Loading and failure notices are translated before any kit loads its libraries;
Run, Auto-play, and Reset view remain disabled until the first frame is drawn. If an import or renderer initialization fails, the notice offers
a Retry button that reloads the page. On small screens the failed stage becomes a compact, non-sticky notice above the text. The hooks exist after successful initialization.

| Method | Returns |
|---|---|
| `scenes()` | Array of scene names |
| `current()` | The scene name the stage is showing now. After scrolling, check that it matches the chapter being read on screen |
| `lang()` | The language used for screen text (`en`, `ko`, `ja`, `zh-CN`, or an override key) |
| `await run(name)` | Scrolls to that chapter, runs the action to the end, waits until the end state is drawn, and returns the last caption. In the side-by-side layout it scrolls the chapter to the middle of the screen; on a portrait phone it scrolls the top of the chapter just below the stage |
| `overlaps(minArea=24)` | Pairs of currently visible labels (badges included) that overlap each other: `[text, text, overlap area px²]`. Labels hidden under the open caption sheet are skipped |
| `clipped()` | Text of labels outside the model area (the canvas cell minus the caption rail), plus `'[legend]'` if the legend is not fully inside the stage and the window |
| `autorun(on?)` | Reads or sets auto-play (turning on runs the chapter being read right away and loops it; saved) |
| `speed(v?)` | Reads or sets the speed (0.5, 1, 1.5, 2; saved) |
| `instant(on?)` | Reads or sets instant mode (all durations 0; not saved) |
| `rail(open?)` | Reads or sets whether the caption sheet is open on a narrow stage |
| `resources()` | axo: counts of registered labels, decluttering state entries, and renderer geometries (`labels`, `labelStates`, `geometries`), step badges excluded. Compare after warming up the same scene and after repeated runs |
| `azimuth()` | axo: camera azimuth (radians). Use it to check whether the model rotated |

## Speed menu

The speed segment (`button.speed-seg`) sits after each chapter's run button. It has `aria-haspopup="menu"` and `aria-expanded`, and its accessible name includes the current value. The menu (`role="menu"`) has four `menuitemradio` items. ArrowDown, ArrowUp, Enter, or Space on the segment opens the menu with focus on the current value; arrows, Home, and End move; Enter or Space chooses; Escape closes and returns focus to the segment; Tab or a click outside closes. The menu opens below the segment, or above it when there is no room. On touch screens the items are at least 44px tall.

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
- Lookup order: `UI_OVERRIDES[language]` → built-in dictionary[language] → `en`. For a new language you may fill in only the keys you want and leave the rest in English, but these are strings the learner sees, so fill in `noteWide`, `noteNarrow`, `fallback`, `loading`, `loadError`, `retry`, `runError`, `speed`, `speedSeg`, `railShow`, and `railHide` too.
- If you give only `autorun` and not `autorunShort`, the short text uses the `autorun` text too (so English "Auto" does not get mixed in).
- The `:lang(ja)` and `:lang(zh)` font rules do not apply to a page in a non-built-in language. For Latin-script languages (Spanish, French, and so on) the default fonts are enough. For scripts that need their own fonts, such as Arabic or Thai, this template does not cover them (the CSS must stay the same as the demo's, so do not change the engine side; ask the user to decide).

### Fonts

- Under `:lang(ja)` and `:lang(zh)`, `--serif`, `--title`, and `--sans` switch to system CJK fonts. Japanese uses the Hiragino Sans, Yu Gothic, and Noto Sans JP families (titles use the Hiragino Mincho and Yu Mincho families); Simplified Chinese uses the PingFang SC, Microsoft YaHei, and Noto Sans SC families (titles use the Songti SC and Noto Serif SC families). No CDN fonts are added.
- For ja and zh, `word-break: keep-all` is released and `line-break: strict` breaks lines per character.
