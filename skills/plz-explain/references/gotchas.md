# Gotchas

Things we ran into while building real pages. Read this before verifying.

## Screen

- **Overlapping labels are the most common defect.** In an axonometric view, two objects far apart in the world overlap on screen.
  Objects lined up along +x and along -z in particular land on the same line on screen. Leave a gap of at least 2 between objects,
  and give the labels different heights. Judge by `__explainer.overlaps()`, not by eye.
- **When the actor moves onto the target, three labels pile up in one spot.** Put the final position beside the target
  (about 0.4 from the target's corner), not directly above it.
- **Spreading things along world x to compare them side by side on screen puts them on a diagonal, so they look like they overlap front to back.**
  Place them by multiplying `SCREEN_RIGHT` by an offset.
- **If the model is clipped or too small, fix `fitW`, `fitH`, and `target`.** For a horizontally long scene, `fitW` decides. The model area is
  usually taller than wide, so leftover empty space above and below is normal.
- **The caption rail takes part of the stage.** On wide stages it is a column on the right, so the model area is about 30% narrower than the stage;
  on narrow stages it is a bar under the model. `clipped()` measures labels against the model area, not the whole stage. A label that sits
  under the rail is reported, even if the stage itself has room.
- **On phones the model shrinks but label text does not, so labels overlap and get clipped.** Even when `overlaps()` is
  empty on desktop, labels can overlap at 390px wide. `declutter()` pulls labels in and shifts them apart when the model area is narrower than 700px,
  but overlaps beyond the cap (56px) remain. Write short labels and do not place two big labels close together.
- **Do not lay the HUD and legend on top of the model on phones.** Splitting the stage into a title bar, the model, the caption bar, and a legend bar
  prevents overlap by structure. `clipped()` measures against the model area.
- **Check the split extremes.** At the maximum split (stage 560px on a 1440px window, about 455px in an 880px window) the rail becomes a bar and the model area is at its smallest.
  Run the machine check with the divider at Home and End, not only at the default, and also in a window just above the phone breakpoint (for example 880×800).
- **Check the caption sheet open on phones.** `__explainer.rail(true)` opens it; labels fully under it are skipped by the checks, and it must stay inside the stage.
- **Wrapping a code block on a phone breaks URLs mid-word and makes indentation look like blank lines.** At widths of 860px and below the template sets
  `pre.code` to `white-space: pre` and scrolls horizontally inside the block only (desktop keeps `pre-wrap`). Shorter code lines help even more.
- **Stacking several layers of glass makes it cloudy.** Keep opacity at 0.08-0.13 and use `flash` for emphasis, only briefly.

## Behavior

- **A screenshot taken mid-run is misleading.** If you shoot while `flash` is at its peak, a slab looks deep blue or
  red, like a color bug. Do not wait a fixed time; use `await __explainer.run(name)`.
- **Check speed on the director's timeline, not the wall clock.** `__explainer.timing()` gives the time a run asked for and the time it was scheduled for; under machine load the wall clock stretches both runs and the 1×/2× ratio drifts.
- **Use instant mode, not reduced motion, to make checks fast.** `__explainer.instant(true)` makes every duration 0 and gives the same end state.
  Reduced motion keeps every step's time on purpose (movement becomes a cut, the dwell stays), so a check run under `prefers-reduced-motion`
  takes as long as a normal run.
- **Two different steps with the same number merge.** A caption with the same number as the newest one replaces it. Number each step once,
  and reuse a number only for the outcome of the step just announced.
- **Clicking a run button from an automation tool can change the chapter.** The tool scrolls the button into view first, and on phones the
  stage is tall, so the reading line may cross the next chapter. Use `__explainer.run(name)`, or `dispatchEvent('click')` when the scroll matters.
- **State you forgot in `reset()` shows up on the second run.** If you changed a label's text (`tag.element.textContent`),
  restore it, and hide again in reset anything that must start with `visible = false`. Run each chapter twice. The engine clears the captions and badges itself.
- **Detaching a temporary object does not release its labels or GPU resources.** Put one-shot objects in `temporaryGroup()`,
  remove a finished object with `disposeObject()`, and use `clearGroup(temp)` in reset. These helpers unregister labels, remove their
  DOM/state, and dispose owned geometry/materials. The engine clears temporary groups on chapter changes too. List borrowed geometry
  and materials in the temporary group's shared-resource argument so cleanup leaves their external owner in control.
  `syncTags` still hides persistent labels when an ancestor is hidden or scaled down; do not delete their elements yourself.
- **Turning on wheel zoom blocks page scrolling over the stage.** The template allows rotation only.
- **OrbitControls sets `touch-action: none`, so a swipe on the stage blocks page scrolling.** The template overrides it with
  `touch-action: pan-y` after construction. Do not delete that line.
- **Auto-play is blocked at the very top of the page (scroll 40px or less).** In the side-by-side layout, chapter 1 just below the intro sits on the reading line (45-50% of the screen height)
  even at the top, so without the block chapter 1 would start by itself as soon as the page opens. `IntersectionObserver` notifies only once, when a chapter enters the line,
  so a run left pending during the block is released by the `scroll` listener (`tryAutorun`) the moment scroll passes 40px.
- **Use `svh` instead of `dvh` for the stage height.** When the address bar collapses and expands, `dvh` changes and the stage keeps refitting.
  `svh` also keeps the legend at the bottom of the stage inside the visible window; `clipped()` reports `[legend]` otherwise.

## svg kit

- **Do not place parts in pixels.** Arrange them with `d.grid`, `d.panels`, and `d.stack`, and connect them through their points (`out(i)`, `in(i)`, `slot(b)`, …).
  Fixed coordinates break when the kit compresses columns on narrow stages or switches to phone sizes.
- **Create tokens inside the group that moves them.** Tokens created up front sit in their rows from the start, so the next group is visible before its turn.
- **A badge anchored to a part sits at its top-right corner.** On a gate the badge is beside the top post. If two numbered steps anchor parts that share a corner,
  anchor one of them to a point instead (for example `join.right(0.65)`), and check `overlaps()`, which counts badges as labels.
- **Long lane text overflows on phones.** Give `laneText` a `short` form; phones show it.
- **A gate needs a gutter.** Put its table in a `d.grid` cell with another column to its right; the page fails to start otherwise, with an error naming `d.gate`.
- **Long labels on a link can hit a title.** The link label sits above the link's last point; with long text, set `labelAt` or shorten it, and check `overlaps()`.
- **Panels need width.** Two panels side by side need about 1100px of stage at natural size; below that they stack, which makes the stage tall. Keep each panel's diagram small (one table and one operator).
- **The svg kit hides table headers on small phone rows.** At row heights of 17px and below there is no header row; do not put information only in the header.

## Body

- **A code block with long Korean comments overflows horizontally.** Hangul is wide in a monospace font. Break comments short,
  and on desktop keep `white-space: pre-wrap` on `pre.code` (for phones see the "Screen" section above).
- **Making `<li>` a grid splits the text and `<code>` into separate cells.** Attach the number with absolute positioning on `::before`
  (`ol.steps` in the template).
- Korean body text breaks lines mid-word without `word-break: keep-all`. The template has it.

## Verification environment

- **Verify with the page's web fonts loaded.** Text widths differ a lot between fonts (a Linux fallback such as DejaVu Sans is far wider than the macOS system font), and the kit measures what renders. A page checked with the CDN fonts blocked is checked against the wrong fonts; wait for `document.fonts.ready` before the checks.

- **Playwright MCP screenshots are saved only inside allowed folders.** `/tmp` is refused. A relative path lands in the
  working directory root (the repository root) and makes a mess. Give an absolute path inside an allowed folder (usually the working directory, or its
  `.playwright-mcp/`), and if it is inside a repository, check that the folder is gitignored.
- **An `http.server` started in the background gets killed by the session's background time limit.** Tell the user the absolute path of the
  file before the server address.
- Ignore a favicon 404.
- To simulate phone touch with playwright-core, use CDP `Input.synthesizeScrollGesture` (`gestureSourceType: 'touch'`).
  This is how you can confirm that `touch-action` is actually applied.
- macOS has no `timeout` command.
- The page sets `scroll-behavior: smooth`, so during verification, calling `scrollBy` right after `scrollIntoView` interrupts
  the earlier scroll. When scrolling by hand, use `window.scrollTo({ top, behavior: 'instant' })`.
- A project's design-system check hook may flag "colors not in DESIGN.md". This page is a study document, not
  product UI, so do not conform it to that project's tokens.
