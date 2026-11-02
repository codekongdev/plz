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
- **If the model is clipped or too small, fix `fitW`, `fitH`, and `target`.** For a horizontally long scene, `fitW` decides. The stage is
  usually taller than wide, so leftover empty space above and below is normal.
- **On phones the model shrinks but label text does not, so labels overlap and get clipped.** Even when `overlaps()` is
  empty on desktop, labels can overlap at 390px wide. `declutter()` pulls labels in and shifts them apart when the stage is narrower than 700px,
  but overlaps beyond the cap (56px) remain. Write short labels and do not place two big labels close together.
- **Do not lay the HUD and legend on top of the model on phones.** Splitting the stage into a title bar, a canvas, and a legend bar
  prevents overlap by structure. `clipped()` measures against the canvas cell.
- **Wrapping a code block on a phone breaks URLs mid-word and makes indentation look like blank lines.** At widths of 860px and below the template sets
  `pre.code` to `white-space: pre` and scrolls horizontally inside the block only (desktop keeps `pre-wrap`). Shorter code lines help even more.
- **Stacking several layers of glass makes it cloudy.** Keep opacity at 0.08-0.13 and use `flash` for emphasis, only briefly.

## Behavior

- **A screenshot taken mid-run is misleading.** If you shoot while `flash` is at its peak, a slab looks deep blue or
  red, like a color bug. Do not wait a fixed time; use `await __explainer.run(name)`.
- **State you forgot in `reset()` shows up on the second run.** If you changed a label's text (`tag.element.textContent`),
  restore it, and hide again in reset anything that must start with `visible = false`. Run each chapter twice.
- **A CSS2D label stays even if you hide or detach its parent.** When a ball or slab carrying a label was detached with `temp.remove()` or `temp.clear()`,
  the label's DOM stayed at its last position and even showed up in the next scene. The engine's `syncTags` checks every frame the ancestors' visible and scale,
  and whether the object is attached to the scene, and hides the label. Do not delete a label's `element` yourself.
- **Turning on wheel zoom blocks page scrolling over the stage.** The template allows rotation only.
- **OrbitControls sets `touch-action: none`, so a swipe on the stage blocks page scrolling.** The template overrides it with
  `touch-action: pan-y` after construction. Do not delete that line.
- **Auto-play is blocked at the very top of the page (scroll 40px or less).** In the side-by-side layout, chapter 1 just below the intro sits on the reading line (45-50% of the screen height)
  even at the top, so without the block chapter 1 would start by itself as soon as the page opens. `IntersectionObserver` notifies only once, when a chapter enters the line,
  so a run left pending during the block is released by the `scroll` listener (`tryAutorun`) the moment scroll passes 40px.
- **Use `svh` instead of `dvh` for the stage height.** When the address bar collapses and expands, `dvh` changes and the stage keeps refitting.

## Body

- **A code block with long Korean comments overflows horizontally.** Hangul is wide in a monospace font. Break comments short,
  and on desktop keep `white-space: pre-wrap` on `pre.code` (for phones see the "Screen" section above).
- **Making `<li>` a grid splits the text and `<code>` into separate cells.** Attach the number with absolute positioning on `::before`
  (`ol.steps` in the template).
- Korean body text breaks lines mid-word without `word-break: keep-all`. The template has it.

## Verification environment

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
