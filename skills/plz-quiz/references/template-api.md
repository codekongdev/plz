# Offline quiz template data

Use this reference when adapting [quiz-template.html](../assets/quiz-template.html).
Read [the design guide](web-quiz-design.md) for layout and interaction requirements.
The template needs no build step, network service, or API key. It keeps responses
in memory while the page is open; it does not save them across reloads.

## Adapt the template

1. Read the user's material and selected scope before generating questions. The
   template does not read PDFs or other uploaded documents. Its bundled questions
   are an example based on this repository's `CONTRIBUTING.md`.
2. Copy the HTML to the user's requested output location. Replace the JSON inside
   `script#quiz-data[type="application/json"]` with the new material, questions,
   answer keys, explanations, source locators, and prepared retry variants.
3. Translate all visible content and UI labels, set the document language, and
   adapt CSS tokens as appropriate. Preserve a requested stack or product design
   system rather than forcing this HTML file into an existing application.
4. Keep the execution script unchanged during ordinary content customization.
   If a requested feature requires changing behavior, verify that change using
   the regression checks and browser QA below.

Do not render supplied material as executable HTML. When serializing the data for
the script element, escape **every literal `<`** as the JSON escape `\u003c`. JSON
encoding alone does not prevent a source passage containing `</script>` from
terminating an HTML script element. For example, in JavaScript:

```js
const embedded = JSON.stringify(quizData, null, 2).replace(/</g, '\\u003c');
```

Insert that serialized string into the data element, rather than concatenating
raw question or source text into HTML. Preserve JSON escaping for quotes, newlines,
and backslashes as well.

## Data contract

The root is one JSON object:

| Field | Contract |
| --- | --- |
| `title` | Required nonempty quiz title. |
| `description` | Optional introductory text. |
| `source` | Required object with nonempty `name` and `scope`. This is the overview; individual questions carry their own evidence. |
| `questions` | Required nonempty array of question objects. |
| `lang` | Optional document language tag. A tag whose primary subtag is `ko` (case-insensitive, such as `ko` or `ko-KR`) selects built-in Korean UI; otherwise the UI defaults to English. It does not translate question content or static HTML. |
| `labels` | Optional UI string overrides applied over the selected built-in UI. All values must be strings. Translate the complete set when another language is needed. |

Each question has these fields:

| Field | Contract |
| --- | --- |
| `id` | Required nonempty string, unique across all initial and retry questions. |
| `concept` | Required nonempty concept name used to group review needs. |
| `type` | Required: `choice`, `ox`, or `short`. |
| `prompt` | Required nonempty question text. State the expected response scope for short answers. |
| `options` | For `choice`, at least two objects with distinct nonempty `id` values and nonempty `text` values. Omit for `ox` and `short`. |
| `answer` | For `choice`, exactly one option's ID. For `ox`, the string `"true"` or `"false"`, not a JSON boolean. Omit for `short`. |
| `referenceAnswer` | Required nonempty reference answer for `short`; used for comparison, not semantic automatic grading. |
| `essentialPoints` | Optional array of nonempty strings for short-answer self-checking. |
| `explanation` | Required nonempty explanation grounded in the selected source. |
| `hint` | Optional assistance for this question. |
| `source` | Required object with nonempty `document` and `section`, optional `excerpt`, and optional `url`. Use only real locators. URLs must use HTTP(S); omit unavailable links rather than inventing them. |
| `retry` | Optional single follow-up question object, not an array. Its `prompt`, `explanation`, and type-specific answer fields are required. It inherits the original `type`, `concept`, and `source` unless supplied, and its ID defaults to the original ID plus `--retry`. Nested retries are not supported. |

Prepare retry variants when generating the initial artifact: the offline page
cannot invent new questions. Keep a retry on the same concept and within the
original source scope. A concept name or source inherited by the engine is not
proof that a newly written variant is actually grounded; review its content.

This minimal example uses the repository's actual language policy and demonstrates
a follow-up question of a different type:

```json
{
  "title": "Contributing to plz",
  "description": "Practice the repository's language policy.",
  "source": { "name": "CONTRIBUTING.md", "scope": "Language policy" },
  "lang": "en",
  "labels": {},
  "questions": [
    {
      "id": "skill-language",
      "concept": "Language of skill instructions",
      "type": "choice",
      "prompt": "Which language is required for SKILL.md and references?",
      "options": [
        { "id": "english", "text": "English" },
        { "id": "korean", "text": "Korean" }
      ],
      "answer": "english",
      "explanation": "The language policy specifies English for SKILL.md and references.",
      "source": {
        "document": "CONTRIBUTING.md",
        "section": "Language policy",
        "excerpt": "SKILL.md and everything in references/ are written in English."
      },
      "retry": {
        "type": "short",
        "prompt": "What language should a new reference guide use?",
        "referenceAnswer": "English.",
        "essentialPoints": ["English"],
        "explanation": "A reference guide follows the same English-language policy."
      }
    }
  ]
}
```

## Localization and scoring boundaries

Translate question content, source descriptions where appropriate, UI labels, and
the static `<html lang>` and `noscript` message. The engine sets the page title
from `title`, the meta description from `description` (or `title`), and the skip
link from the `skipLink` label; the static values only show before the script runs.
English and Korean UI labels are bundled; `labels` overrides the selected defaults.
For another language, use `DEFAULT_LABELS` in the template as the complete key
inventory. Preserve each label's existing interpolation tokens when translating
the surrounding text: `{count}`, `{number}`, `{answered}`, `{total}`, `{correct}`,
`{unanswered}`, `{assisted}`, `{short}`, `{incorrect}`, `{skipped}`, `{checked}`,
`{pending}`, `{status}`, and `{type}`. `listSeparator` joins lists such as the
type breakdown and answer-sheet cell names; translate it too (for example, "、" in
Japanese). Override keys that the template no longer uses are ignored, so older
`labels` objects keep working. Changing `lang` alone does not translate questions,
static text, or UI into an unbundled language.

The template runs learning mode one question at a time and check mode as a batch.
Check-mode inputs remain drafts until final submission. Feedback is withheld until
the appropriate stage; explicit assistance affects only the requested question.
The answer key is embedded in the local file, so this is a learning interaction,
not a secure examination system.

Choice and OX items use automatic scoring. Short answers use a labeled reference
comparison and learner self-check; keep them separate from the objective subtotal.
Do not replace this with keyword or exact-string matching and call it AI grading.
Assisted, skipped, unanswered, and self-assessed outcomes stay distinct. Follow-up
practice uses prepared variants and preserves the initial attempt's results.

For browser QA, `window.__quiz.snapshot()` returns copies of session state and
summaries without answer keys. It is read-only and does not replace observing the
rendered controls, feedback timing, or keyboard behavior.

## Verify an adapted artifact

From the repository root, run the browser regression suite against the bundled
template after changing its data or behavior:

```sh
node --test scripts/check-quiz-template.test.mjs
```

For a generated file that preserves the template's data and engine contract, point
the same suite at that file:

```sh
QUIZ_TEMPLATE_PATH=/absolute/path/to/quiz.html node --test scripts/check-quiz-template.test.mjs
```

These checks require the repository's existing Playwright development dependency
and Chromium. They validate startup using the file's actual data, then use a
controlled fixture for behavior regressions. They do not verify the factual
quality of every generated question or replace inspection of the finished UI.

Review every answer and source locator. Then follow the design guide's browser QA
for both modes, partial submission, honest short-answer self-checking, assistance,
separate retries, keyboard use, responsive layout, and console errors. Report
unexecuted checks; a passing fixture test does not prove that a customized artifact
has been visually or factually reviewed.
