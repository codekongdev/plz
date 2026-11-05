# Web quiz design guide

Read this guide when the user requests a web quiz, a quiz interface, or an HTML
study artifact. Conversation remains the default. This guide defines the design
contract for generated interfaces. Start from
[the offline HTML template](../assets/quiz-template.html) when no other stack is
requested, and read [the template data guide](template-api.md) before adapting it.
Use this guide alongside the question, source, and session rules in `../SKILL.md`.
The shipped example is based on this repository's contribution guide. Read the
user's sources first and embed replacement questions; the browser has no document
upload parser. The template uses no external services or persistent storage.

The visual approach follows `frontend-design`: ground the interface in studying
real material and make deliberate choices. Interaction and accessibility follow
`ui-ux-pro-max`: predictable states, readable contrast, visible focus, and usable
touch targets. The rules below are self-contained; those skills are optional tools
for the agent, not installation requirements for the learner.

## Design direction: a workbook you grade yourself

Ground the interface in studying your own material with pens. The learner marks
answers in blue ballpoint, the grader marks them with a red pen, and the source
evidence is highlighted. Each ink has exactly one role; everything else is quiet
graphite on paper. Make the question the dominant element and keep the submitted
answer visible when feedback appears, so the learner reads the verdict on the
options themselves rather than in a separate box that repeats them.

The signature element is the **answer sheet**: one cell per question, numbered in a
figure font, in the top bar and again, larger, as the results summary. It shows
unanswered, answered, and skipped items while answering, and grading marks only
when grading is allowed. Progress counts represent actual questions, not
decorative numbering.

Avoid cards, shadows, gradients, all-caps labels, emoji, a marketing hero,
leaderboard chrome, or timers unless they serve a requested learning goal. Do not
join metadata with " · " or " — ", and do not put arrows in button labels. Do not
use check or cross glyphs for verdicts: a check mark means "wrong" in Japan. Use a
drawn circle for correct and a slash for incorrect, always with a text label. Apply
an existing product's design system when provided, mapping these semantic roles
to its tokens.

Before coding, record the material, audience, primary task, chosen tokens, and
screen arrangement briefly. Review whether each visible element helps answer,
understand, or revisit a question. Revise generic decoration before implementation.

### Colors and surfaces

Use named tokens rather than scattering raw colors through components. This is the
default palette, not a requirement to override established branding:

```css
:root {
  --quiz-paper: #F3F5F6;          /* the whole page; no sheet card */
  --quiz-surface: #FFFFFF;        /* option rows, inputs */
  --quiz-ink: #1E2429;            /* graphite text */
  --quiz-muted: #596169;
  --quiz-rule: #D6DBDF;           /* hairlines */
  --quiz-control-edge: #7A838B;   /* unselected control boundary */
  --quiz-pen: #2546B0;            /* learner ink */
  --quiz-pen-strong: #1C3891;     /* primary hover */
  --quiz-on-pen: #FFFFFF;
  --quiz-pen-wash: #E8EDFB;       /* selected option surface */
  --quiz-grade: #B42F28;          /* grader red pen */
  --quiz-highlight: #FFE36A;      /* highlighter behind the evidence excerpt */
}
@media (prefers-color-scheme: dark) {
  :root {
    --quiz-paper: #1C2125; --quiz-surface: #242A2F; --quiz-ink: #E7EAEC;
    --quiz-muted: #A9B1B8; --quiz-rule: #384047; --quiz-control-edge: #7F8992;
    --quiz-pen: #9DB4FF; --quiz-pen-strong: #BCCBFF; --quiz-on-pen: #111A33;
    --quiz-pen-wash: #263150; --quiz-grade: #FF8F82;
    --quiz-highlight: rgba(255, 216, 74, .3);
  }
}
```

Keep each ink to its role:

- **Pen blue** is the learner: selection, primary buttons, quiet text buttons,
  links, the focus ring, the learner's own short answer in feedback, and the marks
  on a short answer the learner checked themselves.
- **Grade red** is the grader: circle and slash marks, the verdict mark, and the
  score numeral. Do not use it for errors, validation, or decoration.
- **Highlight** sits only behind the evidence excerpt.

A self-checked short answer gets the same circle or slash in pen blue, not red.
This shows honestly that the learner marked it and the page did not grade it.
Use the rule for hairlines; use the stronger control edge when an unselected
control needs a visible boundary. Selection is pen blue and means only "your
choice"; it must not look like a verdict.

The page is open paper; separate groups with spacing and hairlines, not cards or
shadows. Give option rows and inputs a 10px radius and buttons an 8px radius. Marks
are drawn shapes. With the palette above, every text pair is at least 4.5:1 and
every control boundary and focus ring at least 3:1 in both schemes, including ink
on the translucent dark highlight. Recheck contrast for actual text sizes, hover,
focus, disabled, and any adapted theme; token names are not proof of contrast.

### Typography and spacing

Use three roles, each with an offline-safe stack that covers the user's language:

```css
--quiz-font-ui: "Pretendard Variable", "Pretendard", "SUIT Variable", "SUIT",
  "Apple SD Gothic Neo", "Malgun Gothic", "Noto Sans KR", system-ui, sans-serif;
--quiz-font-serif: "Noto Serif KR", "Nanum Myeongjo", "AppleMyungjo", "Batang", serif;
--quiz-font-figure: "Iowan Old Style", "Palatino Linotype", "Palatino",
  "Book Antiqua", Georgia, serif;
```

- The sans UI and body face uses weights 400 and 600 only.
- The exam-paper serif is for question prompts and the quiz title, at weight 400
  only, with `font-synthesis: none`. Some Korean serifs, such as AppleMyungjo, have
  a single weight.
- The figure face is for question numbers, answer-sheet numbers, and the score,
  with `font-variant-numeric: lining-nums tabular-nums`.

Override the stacks with `:lang()` rather than relying on fallback. Under
`:lang(ja)`, use Hiragino Mincho ProN, Yu Mincho, or Noto Serif JP for prompts and
Hiragino Sans or Yu Gothic UI for the UI. Under `:lang(zh)`, put the Chinese stack
first (Songti SC, Noto Serif SC, SimSun; PingFang SC, Microsoft YaHei). With a
Korean stack first, simplified Chinese text mixes fonts. Do not fetch a font merely
to make the example look finished. A supplied or bundled font may be used.

| Role | Desktop | Below 720px |
| --- | --- | --- |
| Metadata, type labels, tags, locator | 14px sans | 14px |
| Body, options, explanation | 17px / 1.65 sans | 17px |
| Lede and verdict | 21px; verdict weight 600 | 19–21px |
| Question prompt | 24px / 1.7 serif | 21px |
| Quiz and results title | 36px serif | 28px |
| Question numeral | 48px figure | 36px |
| Score numeral | 72px figure | 56px |

Use `word-break: keep-all` for Korean so words never break mid-word, together with
`overflow-wrap: anywhere` so long tokens such as file paths still wrap instead of
overflowing. Do not apply `keep-all` to Chinese or Japanese. Use start-aligned text
and a measure of about 680px for prompts and explanations; do not justify. Use
spacing from 4, 8, 12, 16, 24, 32, 48, and 64px. Keep at least 8px between touch
targets and at least 24px between the question, choices, and action groups.

## Screens and responsive structure

Use a centered page column of about 880px. While answering and on results, a sticky
top bar holds the quiz title (serif, 17px), the mode name, and, during the quiz, the
answer sheet. It has a hairline below and no shadow. Give question headings and
other focus targets a `scroll-margin-top` equal to the bar height, so the bar never
covers a focused element. The start screen has no bar: the source name and scope
appear as two muted lines above the title, without a dash between them.

```text
plz contribution guide            Grade as you go   (1)(2) 3  4  5   <- sticky bar
--------------------------------------------------------------------
  2    references/ guidance must use the language of the    (serif 24)
 OX    generated study page.

       ( O  True )   ( X  False )

       [Check answer]  Show hint  I don't know      Answer later
       ---- after grading, inline below; options stay visible and graded ----
       (red circle) Correct
       explanation...
       Source  CONTRIBUTING.md › Language policy
       [highlighted excerpt]
       [Next question]  Previous question
```

At 720px and wider, an 88px left gutter holds the question numeral with the type
label below it. The content column is at most 680px. Below 720px the gutter
collapses into one line above the prompt, and the answer sheet moves onto its own
full-width row in the bar. That row stays a single strip that scrolls horizontally
inside its own container, so a long set never stacks rows of sticky chrome or makes
the page overflow. Keep the primary action in normal flow directly under
its controls so it cannot cover an answer or keyboard focus. Put quiet actions on
the same row; "Answer later" and "Previous question" go at the row end on desktop.

### Answer sheet

Render one cell per question, each at least 44×44px with at least 8px between
cells. On wide screens the bar's sheet wraps for long sets; on narrow screens it
scrolls horizontally, and the current cell is scrolled into view by moving only the
strip (instantly, or smoothly unless reduced motion is requested). Do not use
`scrollIntoView` for this: it can also scroll the page under a sticky bar. The
results sheet is not sticky and wraps. Each cell has an accessible name built from
labels, such as "Question 3, Answered".

| Cell state | Mark |
| --- | --- |
| Unanswered | Muted number over a 2px rule underline |
| Answered (saved draft in check mode) | Filled pen-blue oval with a light number |
| Skipped | Muted number over a short dash |
| Current | `aria-current="step"` and an ink outline around the cell |
| Correct / incorrect | Red drawn circle around the number / red diagonal slash |
| Self-checked short answer | The same circle or slash in pen blue |
| Assisted | Dotted underline plus the assisted word in the name |

In check mode the cells are buttons that jump to and focus a question. Before final
submission they show only unanswered, answered, and skipped states, never a verdict.
In learning mode the sheet is a status list, and marks appear as each item is graded.
On results the same component at a larger size is the summary, and each cell opens
its item's explanation.

Draw marks with SVG strokes, slightly imperfect, about 2.5px wide. The page's single
orchestrated motion is the results sheet drawing its marks once in sequence (about
60ms apart, each about 360ms). A grading mark in learning feedback also draws once.
Otherwise use only 120ms color and border transitions, and make everything instant
under `prefers-reduced-motion`.

### Screens

| Screen | Required content | Primary action |
| --- | --- | --- |
| Start | Source name and scope, title, lede, a definition list with question count and type breakdown and the grading policy, mode choice as two radio rows | Start quiz |
| Learning question | Gutter numeral and type, prompt, answer controls, quiet actions (hint, I don't know, answer later) | Check answer |
| Learning feedback | The graded options in place, verdict row, explanation, source block | Next question; secondary Previous question |
| Check sheet | One instruction line, every question in order separated by hairlines and 48–64px of space, per-question quiet actions, an answered count | Submit and grade |
| Incomplete prompt | Inline above the submit button: how many are missing, the missing numbers as jump buttons | Keep answering; secondary Submit as is |
| Results | Score, what it counts, short-answer line, counts, large answer sheet, concepts to revisit, per-question rows | Retry missed concepts when eligible, otherwise Practice the whole set again (a practice round; the first score stays) |
| Retry | New questions on missed concepts, a "practice round" label, the first score kept visible | Same action as the chosen mode |

Results details:

- Show the score in the figure face, with the numerator in grade red.
- Under it, add one caption that says what the score counts (objective items) and a
  separate line for self-checked and pending short answers.
- Show counts as a compact definition list in two or three columns: correct,
  incorrect, skipped, unanswered, assisted, and, when short answers exist,
  self-checked and self-check needed. Assisted is its own bucket, so the counts sum
  to the number of questions.
- List concepts to revisit with their question numbers.
- Give each question an accordion row: a heading button with the numeral and its
  mark, the prompt in serif, and the outcome word. Open incorrect, skipped,
  assisted, unanswered, and needs-review rows by default; collapse correct ones.
  Remember toggles while the results screen updates.

Use the user's language for all visible labels. Name each mode by when grading
happens: "Grade as you go" and "Grade at the end" (Korean "풀 때마다 채점",
"다 풀고 채점"). Make each action label say exactly what happens. Korean examples
are "채점하기", "다음 문제", "제출하고 채점하기", "계속 풀기", and "이대로
제출하기". Do not add a file-upload control unless the implementation can actually
read that format. An artifact generated from material the agent already read can
simply show the source metadata and start the quiz. Do not simulate uploading or
AI processing.

## Answer controls and state contract

For objective questions, use a native `fieldset` named by the prompt heading and
labeled radio controls for single choice and OX. Make the whole choice row
clickable. Keep the native radio so keyboard and arrow keys work. It can be
visually replaced by a numbered bubble (choice) or a large O/X glyph (OX). Use checkboxes
only for a question explicitly asking for several answers. Selecting a choice does
not submit it; keep the final check/save action separate so a stray tap is reversible.

Short-answer fields need exactly one visible label and helper text stating the
expected response length or number of points to cover. Keep typed text when navigating backward. Put validation
next to the control and explain how to resolve it.

| State or action | Learning mode | Check mode |
| --- | --- | --- |
| Unanswered | Neutral choices; no verdict or evidence | Same; count as pending |
| Chosen / drafted | Show the learner's selection; allow changes | Same; no correctness styling |
| Check / save | Commit the response, then reveal allowed feedback | Save response and continue neutrally |
| Explicit "I don't know" | Record a skip; reveal this item's explanation | Record a skip; withhold the explanation |
| Leave for later | Keep the item unanswered | Keep the item unanswered |
| Ask for a hint / answer | Reveal only requested assistance; mark assisted | Same; do not spoil other items |
| Partial final submission | Preserve unanswered items separately | Identify missing items; allow continuing or explicit early submission |
| Complete submission | Show results under the stated policy | Reveal verdicts, explanations, and evidence together |
| Retry after feedback | Preserve the first result; start separate practice | Same |

Do not preselect answers. Keep selected, saved, skipped, unanswered, assisted, and
graded outcomes distinct in the session data. A count such as "answered 3 of 5"
must reflect recorded responses and explain skips if included; it is not a score.
After a learning-mode response is marked, keep its initial result stable and make
any further attempt visibly separate practice.

In check mode, answer-bearing evidence, correctness icons, explanations, and scores
must be absent from the rendered interface and accessibility tree until permitted.
Do not place spoilers in visually hidden text, option descriptions, `title`
attributes, or pre-submission progress labels. Source metadata can remain visible.
For a local HTML artifact the answer key may exist in its JavaScript; withholding
feedback is a learning interaction, not a claim that the key is confidential.

### Short-answer grading in a standalone page

Preserve the skill's meaning-based grading contract. A standalone page without a
semantic evaluator must not claim that keyword inclusion, substring comparison,
or exact string equality checks understanding.

Use a clearly labeled **compare with the reference answer** flow instead: record
the response, reveal the reference answer and essential points only at the mode's
feedback stage, and let the learner mark it as demonstrated or needing review.
Keep self-assessed outcomes separate from automatically scored objective items.
Report an objective subtotal and pending/self-assessed short answers rather than
inventing a combined automatic score. If agent-assisted grading is requested,
define the real handoff and show a pending state until a verdict is returned.
Do not add an API key requirement or pretend a missing service exists.

## Explanation, evidence, and results

Present feedback inline after the answer controls, in reading order. Start with a
verdict row: a 28px mark and the verdict in words, never color alone. For choice
and OX, label the options themselves: "Your answer" on the learner's pick and
"Correct answer" on the key, with a red circle around the key and a red slash
through a wrong pick. For short answers, show the learner's text in pen blue next
to the reference answer, then the essential points and the self-check. Follow with
a brief explanation and the source block: a locator line (document › section,
linked only when a real URL exists) and the excerpt with the highlighter behind it.
Move focus to the verdict heading and announce the verdict once. Never auto-advance.
Include a short supporting passage only when useful and permitted; never fabricate
page numbers or a source hyperlink the artifact cannot actually open.

For an unavailable source destination, show the document name and locator as text
rather than a broken link. A source opener should retain the quiz's answers and
place in the session. Do not expose an answer by opening its passage too early.

Results should distinguish correct, partial credit if declared, incorrect, skipped,
unanswered, assisted, self-assessed, and pending-evaluation items as applicable.
Show the score denominator and explain exclusions. For early submission, separate
attempted performance from coverage of the set. Offer new questions on weak
concepts without overwriting the first score. A perfect result can offer a fresh
set or finish; do not display a dead "retry mistakes" button with no eligible items.

## Interaction, accessibility, and delivery checks

Use native controls before custom widgets. Every control needs a visible label or
an accessible name, a visible keyboard-focus indicator, and a minimum 44×44px touch
target. Keep native Tab, arrow-key, Space, and Enter behavior. Do not install
single-letter shortcuts that interfere with typing an answer.

When moving to a new question, move focus to its heading using `tabindex="-1"` or
an equivalent predictable target. Announce saved responses and feedback politely
without reading a future answer early. Announce validation errors near the field;
do not re-render the whole form or move focus on each keystroke. If a drawer or
modal is necessary, support Escape, correct focus management, and focus restoration.

Use text contrast of at least 4.5:1, or 3:1 for large text, and at least 3:1 for
required control boundaries and focus indicators against adjacent colors. Status
meaning needs text as well as color. Use simple SVG icons with decorative ones
hidden from assistive technology. Respect `prefers-reduced-motion`; short color
transitions and the one-time drawing of grading marks may acknowledge an action,
with no automatic confetti or unrequested countdown.

For a new local study artifact, copy the bundled self-contained HTML template,
replace its question data and labels, and adapt its CSS tokens. Preserve an
explicitly chosen stack and existing components.
Do not add remote storage, analytics, browser persistence, or external font/script
requests by default. Render source text as text, not executable HTML. The user
should not encounter implementation jargon in the study flow.

When an actual interface is generated, verify its observed behavior, not only its
appearance:

- At 375, 768, 1024, and 1440px, check wrapping, readable content, touch targets,
  keyboard focus, and no horizontal overflow. Also check zoom to 200%.
- Complete a learning attempt and a check attempt with correct, incorrect, skipped,
  and unanswered items. Verify that check mode reveals no early feedback and that
  backward navigation preserves answers.
- Submit a partial set explicitly and verify denominator and coverage reporting.
  Try a hint and verify assisted status; retry mistakes and preserve the first score.
- If short answers exist, verify honest grading/self-check labels and separate
  subtotals. Test long source names and answers, missing source links, and a set
  with no retryable items.
- Check keyboard-only operation, screen-reader labels and announcements, reduced
  motion, actual contrast pairs, and browser console errors. Report checks that
  could not be run. Bundling a template does not prove that an adapted artifact
  passes these checks.
