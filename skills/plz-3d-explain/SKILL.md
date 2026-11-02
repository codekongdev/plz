---
name: plz-3d-explain
description: |
  Builds a single-file HTML study page that teaches a technical concept, mechanism, or system structure
  with a 3D model. Scrolling the text on the left switches a three.js axonometric model on the right,
  chapter by chapter, and a button in each chapter plays out cause and effect on the model (where code is
  blocked, how a request flows, when a resource is created and destroyed). The page is written in the
  user's language; screen text is built in for en, ko, ja, zh-CN. Use when someone wants to learn or
  understand a concept visually, or knows nothing about a topic and wants interactive study material.
  Not for static architecture or sequence diagrams (archify), data charts, Blender modeling, or product
  landing pages and app UI.
  Triggers: "explain X in 3D", "3D explainer", "show how X works as a 3D model";
  "3D로 공부하게 만들어줘", "개념을 3D로 보여줘", "원리를 모형으로 보여줘", "3D 그래픽으로 설명해줘";
  "3Dで解説して", "仕組みを3Dモデルで見せて"; "用3D讲解这个概念", "做成3D模型演示原理".
---

# 3D Concept Explainer Page

The goal is to let a first-time learner see where things get blocked, where they flow, and when
they appear and disappear. Show structure that text alone cannot convey (layers, boundaries, flows,
lifetimes) with a model, and let the learner trigger the events with a button. The model is half
of the explanation, not decoration.

## Output

- One HTML file. three.js r170 and the web fonts load from a CDN, so opening the page needs internet. There is no build step.
- Left: title, intro, numbered chapters, glossary, sources. Right: a fixed 3D stage (current chapter title, reset-view button, auto-play switch, semantic color legend).
- Scrolling switches the stage to the scene of the chapter crossing the middle of the screen. Each chapter has one button and a result sentence.
  The "Auto-play" switch at the top right of the stage repeats the action of the chapter being read (off by default; the on state is remembered in the browser).
- Finished example: `assets/example-agent-sandbox.html` (how AI-agent code sandboxes isolate code, 10 chapters). When you need a similar scene, look in this file first.

## Page language

Decide the page language in this order. If an earlier item exists, ignore the later ones.

1. The language the user named ("make it in Japanese")
2. The language of the request
3. The language mainly used in the conversation

- Set `<html lang>` to that language (`ko`, `en`, `ja`, `zh-CN`, etc.). The template default is `en`.
- Write the body, chapter titles, result sentences (`say`), labels, legend, and scene `title` directly in that language. Do not write them in another language and translate. The language of this document does not decide the language of the page you build.
- Screen text (buttons, notices, the "Glossary" and "Sources" headings, error text) comes out automatically in the `<html lang>` language from the ENGINE's text dictionary. Built-in languages are English (`en`, canonical), Korean (`ko`), Japanese (`ja`), and Simplified Chinese (`zh-CN`). `ko*` maps to `ko`, `ja*` to `ja`, `zh*` to `zh-CN`, and anything else to `en`.
- For a language not in the dictionary (for example Spanish), fill in that language's strings in the template's `window.UI_OVERRIDES`. Keys you leave out come out in English. Do not edit the engine. The key list and usage are in "Screen text and language" in `references/engine-api.md`.
- Put the date in the sources heading in the `data-date` of `<h3 data-ui="sources" data-date="YYYY-MM-DD">`. The engine generates the heading text ("Sources (checked …)").
- On Japanese and Chinese pages, fonts fall back to system CJK fonts and line breaks switch to per-character (both are in the template CSS). Check with `__explainer.lang()`.

## Workflow

If `references/preferences.md` exists, read it first. Where items overlap, follow preferences over this document's defaults. If it does not exist, use the defaults.

### 1. Decide the content first

**Fact-check.** If the topic depends on repository code or current product information, check it first (read the code, official docs, web search). Leave the sources you checked and the date at the end of the page, and write "not checked" for anything you could not verify. Learners trust this page as fact and memorize it.

**Chapter design.** Split into 5-10 chapters. Go from easy to hard, and use the last one or two chapters to apply the idea to the user's actual situation (an issue in progress, a design draft, a product comparison). Decide three things for each chapter:

- Scene: what is placed there (layers, rooms, blocks, passages)
- Action: what happens when the button is pressed. Cause and effect must be visible. Do not use animation that just spins.
- Gist: the chapter reduced to one sentence

A chapter with no action in mind is either well served by text alone or should be merged into another chapter. Write a short chapter list, then build. Ask the user only when the topic scope is ambiguous.

### 2. Visual rules

This style is an architectural model (white massing model + ink outlines) seen in axonometric view. It is chosen so that learners read "structure", so keep it when the topic changes.

- Orthographic (axonometric) camera, white model, ink outlines, light shadows. They are in the template.
- Use a light background. A white model reads well against a light ground, with clear outlines and shadows.
- There are only three semantic colors. actor (the protagonist that moves and causes things, red), bound (boundary, rule, intermediary, blue), matter (data, resource, material, brass). Give each color exactly one meaning, and draw everything else in white and ink. Write what each means on this page in the legend.
- Motion happens only when a button is pressed and when the chapter changes, by default. If the user turns on "Auto-play", the action of the current chapter replays in a loop (run, show the result, reset, show the initial state, in that order). When auto-play is off, use no autoplay or looping animation.
- Write labels as short noun phrases (about 15 characters) and keep them from overlapping.
- Fonts: the headline (h1) uses Pretendard Variable (2.2rem, 1.7rem on phones, weight 700); chapter titles (h2) and the stage title use Hahmlet; body text uses IBM Plex Sans KR; only code identifiers use IBM Plex Mono. If you want other fonts, change them in preferences. Japanese and Chinese pages (`:lang(ja)`, `:lang(zh)`) fall back to system fonts such as Hiragino Sans, Yu Gothic, PingFang SC, and Noto Sans CJK, because these web fonts lack enough kana and Simplified Chinese glyphs (this is in the template CSS). Do not add CDN fonts.

### 3. Build from the template

Copy `assets/template.html` to the output location and fill in only the HTML marked `TEXT` and the `SCENES` section. Do not edit the `ENGINE` sections, which hold the renderer, camera fitting, label handling, animator, chapter switching, and verification hooks. They already contain fixes for bugs we hit.

- Make one scene with `defineScene(name, { title, base, target, fitW, fitH, build })`. The `data-scene` in the body and the `data-run` on the button must equal `name`.
- `build()` returns `{ group, reset, run }`. `reset()` restores everything `run()` changed (position, size, visibility, label text). The engine restores colors with `resetLook`.
- The ENGINE handles auto-play. Only chapters with a `data-run` button inside the chapter body's `.act` loop; elements without a button (intro, glossary) do not run. It also does not run at the very top of the page (scroll 40px or less). To loop, the scene's `reset()` must restore everything `run()` changed (including the result sentence and label text).
- Screen text elements (the intro `.note`'s `.wide` and `.narrow`, HUD buttons, `.hint`, `.fallback`, the glossary and sources headings) carry `data-ui="key"` or `data-ui-aria="key"`, and the engine fills them in the page language. Do not edit this text directly in TEXT. To change it, override it with `UI_OVERRIDES`. The stage's `aria-label` (`data-ui-aria="stageAria"`) has the generic text "3D model"; to put the topic in it, delete that attribute and write `aria-label` yourself.
- API: `references/engine-api.md`
- Scene patterns by kind of concept (layers, boundaries, flows, lifetimes, comparisons, and so on): `references/scene-patterns.md`

### 4. Writing

- Write in the user's language, in plain sentences. Explain each technical term in one line when it first appears and add it to the glossary.
- When you use an analogy, say so ("as an analogy"). Do not let the analogy replace the concept; follow it with the real name.
- Write 2-3 paragraphs per chapter body, 2-4 sentences per paragraph. Write the result sentence (`say`) in the past tense, about what just happened.
- Put one concrete example in each chapter. Show input, code, or a command that could really come in, and its result. With only abstract explanation, learners find it hard to carry the concept into their own situation. Put code in `pre.code` and quotations such as hidden input in `blockquote.planted`, and match the button's result sentences to the example's step numbers.
- Contrast sentences like "A is one way to do this and B is another way" are where learners get stuck most often.
  Do not leave such sentences as they are. Make a separate chapter that sends the same question to both sides and shows who answers
  ("Same question, different answer" in scene-patterns). End that chapter with a table that sums up the difference once more.
- If a chapter holds a design draft or an estimate, say so in the body.

### 5. Verify (do not skip)

Read `references/gotchas.md` first. Overlapping labels and clipped models cannot be found by reading the code.

1. Start a local server in the background:
   `python3 -m http.server <port> --bind 127.0.0.1 --directory <folder>`
2. Open the page at 1440×900 with a browser automation tool (for example Playwright). Check the console for errors (ignore a favicon 404).
3. Run every chapter in one pass for the machine check:
   ```js
   async () => { const out = {}; for (const n of window.__explainer.scenes()) {
     const text = await window.__explainer.run(n);
     out[n] = { text, overlaps: window.__explainer.overlaps(), clipped: window.__explainer.clipped() };
   } return out; }
   ```
   `overlaps` and `clipped` must be empty arrays. `run` waits until the action finishes, so
   no intermediate state is captured.
4. Take a screenshot right after `__explainer.run(name)` for each chapter and look at it. Check that the end state matches the result sentence and that the empty space is not excessive (adjust with `fitW` and `fitH`). Give the save path as an absolute path inside a folder the tool allows (see gotchas).
5. Check auto-play. Turn it on with `__explainer.autorun(true)` and scroll to a chapter. In one chapter, confirm that the loop runs three or more times, that each time the result sentence reaches the last step's sentence and is cleared by reset, and that `overlaps()` and `clipped()` are empty at each final state. With it off, scrolling must run nothing; when you move to the next chapter during a run, the previous chapter's loop must stop and the new chapter's loop must start.
6. Check on phones too. At 390×844 and 360×800 (deviceScaleFactor 3, isMobile, hasTouch), confirm that `overlaps()` and `clipped()` are empty arrays for every chapter, that there is no horizontal scroll (`document.documentElement.scrollWidth === innerWidth`), and that the layout does not break in landscape at 844×390. While scrolling, confirm that `__explainer.current()` matches the chapter being read on screen. Confirm that a vertical swipe on the stage scrolls the page and a horizontal swipe rotates the model.
7. If you built a page that is not Korean (`en`, `ja`, `zh-CN`, an override language), confirm that `__explainer.lang()` is that language and that the screen text (HUD, hint, glossary and sources headings) appears in that language. At 390×844 and 360×800, confirm that the HUD's chapter title, switch, and reset-view button do not overlap.
8. Confirm that no placeholder remains and that no Hangul is left in a non-Korean page. Grep the finished page for placeholders of the form `__…__` (for example `grep -nE '__[^_ ][^_]*__' <page>.html | grep -v -e __explainer -e "label = '__actor__'"`; the two filters skip the verification hook and the engine's own default label argument), and expect no output. If the page language is not Korean, confirm that the visible text (excluding script and style, for example `document.body.innerText` and `document.title`) contains no Hangul (`/[\uAC00-\uD7A3]/`).
9. After fixing, rerun 3, 5, 6, 7, and 8.

The phone layout is built into the template.

- Portrait phone (width 860px or less): the stage is pinned on top (44svh high) and the text scrolls below it. The stage is split into a title bar, the 3D canvas, and a legend bar, so the title bar and legend never sit on the model.
- Landscape phone (height 520px or less): laid out as on desktop, text on the left and the stage on the right (full screen height).
- One line of the stage title bar holds the chapter title, the auto-play switch, and the reset-view button (the chapter title takes up to two lines and is truncated with an ellipsis if longer). At 430px wide and below, the switch text shrinks to a short per-language phrase (English "Auto"; the accessible name stays the long phrase "Auto-play"), and tap targets are 44px or more. Code blocks do not wrap; they scroll horizontally inside the block only.
- Touch: on the stage, a vertical swipe scrolls the page and a horizontal drag rotates the model. Tilting up and down is not supported.
- When the stage is narrower than 700px, the engine pulls labels toward the inside of the canvas and shifts them apart when they overlap. Overlaps beyond the cap (56px) remain.
- When you build a page, write short labels and do not place two long labels close together.

### 6. Deliver

- Where to save: when working inside a repository, put it in a working-notes folder that is not committed (check with `git check-ignore`). This keeps study documents from getting mixed into the repository and committed. If there is no such folder, or you are outside a repository, put it in the location set in preferences. If there is none, ask the user, and with no answer put it in the current directory.
- What to report: the full absolute path, the `open <path>` command, the chapter list, and the verification scope (resolutions, whether there were errors and overlaps). Tell the user that the temporary server address closes when the session ends.
