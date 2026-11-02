# Engine API

What the `ENGINE` section of `assets/template.html` provides. Build scenes in the `SCENES` section with only these functions.

## Coordinates and size

- Units are arbitrary world units. The shared floor is 13×8, blocks are usually 2-3 in size, and the actor cube is 0.6.
- y is up. The camera looks down at the origin from the direction `HOME_DIR = (1, 1.15, 1.22)`. So on screen,
  +x goes to the lower right, -z to the upper right, and +z to the lower left.
- `SCREEN_RIGHT` is the world vector for the screen's horizontal direction. Use it to place two things side by side on screen (the comparison pattern in scene-patterns).
- **The `pos` y of `block`, `glass`, `actorCube`, and `matterBlock` is the floor height.** After creation, `group.position` is the
  center. So when you move something with `a.move`, give center coordinates. To put an object of height h on a slab whose top surface is Y,
  give y = Y + h/2.

## Color

```js
COLOR.model, COLOR.ink, COLOR.outside, COLOR.muted          // neutral: white model, ink, outside system, stopped things
COLOR.actor, COLOR.actorEdge                                // actor (red)
COLOR.bound, COLOR.boundSoft, COLOR.boundMid                // bound (blue), light slab, mid slab
COLOR.matter, COLOR.matterEdge                              // matter (brass)
```

To tell layers apart, use `boundSoft` (a base layer such as a kernel) and `boundMid` (a thin intermediary layer on top of it).
If you change a CSS variable (such as `--actor`), change `COLOR` with it.

## Parts

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

Every Group has `userData.mesh` (the mesh whose color changes) and `userData.h` (height).

## Scene definition

```js
defineScene('name', {
  title: '3  Container',    // title shown at the top left of the stage. "number, two spaces, title"
  base: true,               // whether to show the shared floor (the base group)
  target: [0.3, 1.1, 0],    // the point the camera looks at
  fitW: 17, fitH: 11.5,     // world width and height that must fit in the stage
  build() {
    const g = new THREE.Group();
    const temp = new THREE.Group(); g.add(temp);   // things that appear and disappear during a run
    // ... add parts to g
    return {
      group: g,
      reset() { /* restore the position, size, visible, and label text that run changed. temp.clear() */ },
      async run(a, say) { /* a: animator, say(text): result sentence */ },
    };
  },
});
```

- Fill the shared floor into the `base` group once, at the very start of the `SCENES` section. When several chapters share the same server and the same floor,
  chapter transitions get smoother. For a chapter that needs a completely different stage, set `base: false` and build its own floor.
- A scene may make objects on the shared floor flash. The engine restores the colors when the chapter changes or the scene runs again.
- Chapter order does not depend on the order you call `defineScene`. The `data-scene` in the body sets the order.

## Animator `a`

| Method | Description |
|---|---|
| `await a.move(obj, to, ms=700, lift=0)` | Moves the center to `to` ([x,y,z] or Vector3). With `lift`, it goes over in an arc |
| `await a.flash(obj, color, ms=700, hold=false)` | The color changes and comes back. Transparent glass also darkens briefly. Use it to show "blocked", "checked", "breached". With `hold`, it stays changed |
| `await a.scaleTo(obj, s, ms=500)` | Changes the size. To create: `obj.scale.setScalar(0.001)` then `scaleTo(obj, 1)`. To remove: `scaleTo(obj, 0.001)` then `obj.visible = false` |
| `await a.wait(ms)` | Gives reading time before the next step. 1000-1300ms per result sentence is about right |
| `await a.tween(ms, t => ...)` | Any other value interpolation (0→1, eased) |
| `a.live()` | Whether this run is still valid |

- Wrap things that happen at the same time in `await Promise.all([...])`.
- When the user moves to another chapter, the run in progress is cut off (CANCEL). You do not need to handle it.
- With reduced motion (`prefers-reduced-motion`), every interpolation finishes immediately.

## Verification hooks `window.__explainer`

These hooks exist after successful initialization. The stage's `data-state` is `loading`,
`ready`, or `failed`. Loading and failure notices are translated before any CDN imports;
Run, Auto-play, and Reset view remain disabled until the first render succeeds.
If an import or renderer initialization fails, the notice offers a Retry button that reloads
the page. On small screens the failed stage becomes a compact, non-sticky notice above the text.

| Method | Returns |
|---|---|
| `scenes()` | Array of scene names |
| `current()` | The scene name the stage is showing now. After scrolling, check that it matches the chapter being read on screen |
| `autorun(on?)` | Returns the auto-play state (true/false). Given a boolean, it changes to that value (turning on runs the chapter being read right away and loops it; saved in `localStorage`) and returns the new state |
| `azimuth()` | Camera azimuth (radians). Use it to check whether the model rotated |
| `await run(name)` | Scrolls to that chapter, runs the action to the end, and returns the last result sentence. In the side-by-side layout it scrolls the chapter to the middle of the screen; on a portrait phone it scrolls the top of the chapter just below the stage |
| `overlaps(minArea=24)` | Pairs of currently visible labels that overlap each other: `[text, text, overlap area px²]` |
| `clipped()` | List of the text of labels that went outside the canvas cell (`wrap`). On desktop the canvas cell equals the whole stage; on phones it is the cell without the title bar and legend bar |

- When the stage is narrower than 700px, the engine's `declutter()` pulls labels toward the inside of the canvas and shifts them apart when they overlap (cap 56px).
  Overlaps beyond the cap remain and are caught by `overlaps()`.

## Auto-play

The "Auto-play" switch (`button.autorun`, `role="switch"`, `aria-checked`) at the right of the stage title bar (HUD).

- Off by default. The on state is remembered in `localStorage` (`plz-3d-explain:autorun`). If reading or writing is blocked, it stays for that visit only, without an error.
- When on, it replays the action of the chapter being read in a loop. One cycle goes in this order.
  1. After the chapter enters the reading line, wait `AUTORUN_DELAY` (600ms, time for the scene transition to finish and to see the initial state).
  2. Run the same action as pressing that chapter's `[data-run]` button, to the end.
  3. Show the end state and the last result sentence for `AUTORUN_HOLD` (2800ms).
  4. Reset the scene with `reset()` and clear the result sentence (`.result`) too. Show the initial state for `AUTORUN_DELAY` (600ms).
  5. Go back to step 2. One cycle is the action time + about 3.4 seconds (about 9.9 seconds for a 6.5-second action).
- The two time constants are `AUTORUN_DELAY` and `AUTORUN_HOLD` in the `ENGINE`. The scene author only needs to make `reset()` restore everything `run()` changed (position, size, visibility, label text).
- The timer is set only through `armAuto`, so there is always at most one. Loops do not pile up and the same chapter never runs twice at once.
- When the reader moves to another chapter, the existing CANCEL cuts it off and the loop starts from the beginning in the new chapter. If the reader passes through several chapters in a short time, only the last chapter starts. While the reader stays on the same chapter, the start is not scheduled again and only the loop continues.
- If a chapter's button is pressed during the loop, the run restarts from the beginning right there, and the loop continues after that run ends.
- When the tab is hidden (`document.hidden`), the pending timer stops, and when it is visible again the loop continues from the reset state. It does not reset after an action that ended while hidden.
- Elements without a `[data-run]` button (intro, glossary) do not run. It does not run at the very top of the page either (scroll 40px or less, `TOP_HOLD`), because in the side-by-side layout chapter 1, just below the intro, sits on the reading line.
- Turning the switch on while a chapter is active runs that chapter right away (when not at the very top). Turning it off removes the pending loop; the action in progress goes to the end and does not repeat.
- The button in each chapter always works regardless of the switch. So does `__explainer.run(name)`.

## Screen text and language

The intro notice, HUD buttons, hint, fallback notice, glossary and sources headings, and error text come from the ENGINE's text dictionary (`UI_TEXT`) in the page language. The page author writes the body, chapter titles, labels, legend, and scene `title` directly in that language.

### How the language is chosen

It is decided by the `<html lang>` value (case-insensitive). The engine picks once, at startup.

| `lang` | Dictionary used |
|---|---|
| `ko`, `ko*` such as `ko-KR` | `ko` |
| `ja`, `ja*` such as `ja-JP` | `ja` |
| `zh`, `zh*` such as `zh-CN`, `zh-Hans`, `zh-TW` | `zh-CN` |
| anything else (including `en`, `es`, `fr`, empty) | `en` |

English (`en`) is canonical. A key missing from the chosen language's dictionary comes out in English. Read the chosen language with `__explainer.lang()` (`en`, `ko`, `ja`, `zh-CN`, or an override key).

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
| `loading` | `.fallback p` while initializing | Loading the 3D model… You can read the text while you wait. | 3D 모형을 불러오는 중입니다. 기다리는 동안 본문을 읽을 수 있습니다. | 3Dモデルを読み込んでいます。待っている間も本文を読めます。 | 正在加载 3D 模型…等待时可以先阅读正文。 |
| `loadError` | `.fallback p` after an import or initialization failure | Couldn't load the 3D model. Check your connection and try again, or keep reading the text. | 3D 모형을 불러오지 못했습니다. 인터넷 연결을 확인하고 다시 시도하거나 본문을 계속 읽어 주세요. | 3Dモデルを読み込めませんでした。接続を確認して再試行するか、本文を読み進めてください。 | 无法加载 3D 模型。请检查网络连接后重试，或继续阅读正文。 |
| `retry` | `.retry-load` button (reloads the page) | Retry | 다시 시도 | 再試行 | 重试 |
| `stageAria` | `aria-label` of `aside.stage` | 3D model | 3D 모형 | 3Dモデル | 3D 模型 |
| `terms` | "Glossary" heading | Glossary | 용어 정리 | 用語集 | 术语表 |
| `sources` | Sources heading. The `data-date` value goes in `{date}` | Sources (checked {date}) | 출처 ({date} 확인) | 出典（{date} 確認） | 来源（{date} 核对） |
| `runError` | Result sentence when a scene run fails | Couldn't play the animation. Reload the page and try again. | 애니메이션을 재생하지 못했습니다. 새로고침한 뒤 다시 눌러 보세요. | アニメーションを再生できませんでした。ページを再読み込みして、もう一度お試しください。 | 无法播放动画。请刷新页面后重试。 |

### Markup attributes

- `data-ui="key"`: fills that element's text (`textContent`) with the dictionary value. If `data-date="YYYY-MM-DD"` is also present, `{date}` in the value is replaced with that date.
- `data-ui-aria="key"`: fills that element's `aria-label` with the dictionary value.
- The text written inside the element is the default text shown before JS runs. It is English in the template and the English demo, and Korean in the Korean demo. The inline module replaces it with the dictionary value before loading three.js, so CDN failures also use the page language.
- A key that is not in the dictionary leaves a `console.warn` and the element stays as it is.
- The auto-play switch holds both `<span class="long" data-ui="autorun">` and `<span class="short" data-ui="autorunShort">`. CSS shows only `.short` at 430px wide and below. The accessible name is `data-ui-aria="autorun"` (the long text).
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
    terms: 'Glosario',
    sources: 'Fuentes (verificadas el {date})',
  },
};
</script>
```

- Keys are matched in this order: the full `lang` (`es-MX`), its prefix (`es`), the built-in language name (`zh-CN`). You can also override a key of a built-in language (such as `ko`) to change just one string.
- Lookup order: `UI_OVERRIDES[language]` → built-in dictionary[language] → `en`. For a new language you may fill in only the keys you want and leave the rest in English, but these are strings the learner sees, so fill in `noteWide`, `noteNarrow`, `fallback`, `loading`, `loadError`, `retry`, and `runError` too.
- If you give only `autorun` and not `autorunShort`, the short text uses the `autorun` text too (so English "Auto" does not get mixed in).
- The `:lang(ja)` and `:lang(zh)` font rules do not apply to a page in a non-built-in language. For Latin-script languages (Spanish, French, and so on) the default fonts are enough. For scripts that need their own fonts, such as Arabic or Thai, this template does not cover them (the CSS must stay the same as the demo's, so do not change the engine side; ask the user to decide).

### Fonts

- Under `:lang(ja)` and `:lang(zh)`, `--serif`, `--title`, and `--sans` switch to system CJK fonts. Japanese uses the Hiragino Sans, Yu Gothic, and Noto Sans JP families (titles use the Hiragino Mincho and Yu Mincho families); Simplified Chinese uses the PingFang SC, Microsoft YaHei, and Noto Sans SC families (titles use the Songti SC and Noto Serif SC families). No CDN fonts are added.
- For ja and zh, `word-break: keep-all` is released and `line-break: strict` breaks lines per character.
