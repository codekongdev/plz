# plz-quiz
English | [한국어](README.ko.md) | [日本語](README.ja.md) | [简体中文](README.zh-CN.md)

Study with quizzes based on your documents, or check what you have learned before seeing the answers. Works with Claude Code and Codex. Part of [plz](../../README.md).

## Install

The commands below require this skill to be published in the repository. To try a local draft, ask your agent to read `skills/plz-quiz/SKILL.md` directly.

Install globally:

```sh
npx skills add codekongdev/plz --skill plz-quiz -g
```

For Codex, add `-a codex`. This installs into the current project's `.agents/skills/` directory:

```sh
npx skills add codekongdev/plz --skill plz-quiz -a codex
```

## Usage

Provide a document or paste your notes, then ask for a quiz in your language.

Claude Code:

```text
/plz-quiz Quiz me on these notes, one question at a time.
```

Codex:

```text
$plz-quiz Quiz me on these notes, one question at a time.
```

Example requests:

- “Make ten multiple-choice questions from chapter 2 of this PDF.”
- “Check whether I understand this document. Hide the answers until I finish.”
- “Ask questions about applying the concepts, rather than just recalling terms.”
- “Give me new questions about the concepts I got wrong.”

## Study and check modes

- **Study:** answer one question at a time, then see the result, a short explanation, and the source passage. Ask for a hint if you need one.
- **Check:** submit your answers before seeing scores, correct answers, or explanations. Missing answers are collected before grading; “I don't know” is an explicit response.

Unless you specify otherwise, a session uses study mode, five questions, a mix of multiple-choice, true/false, and short-answer questions, and medium difficulty. A short source may support fewer questions; the agent explains any reduction. You can change the scope, number, difficulty, types, mode, or requested format.

Short answers are assessed by meaning, rather than exact wording. At the end, you receive a question-by-question result and a review of concepts to revisit. You can continue with new questions focused on those concepts.

## Web quiz template

Conversation remains the default. For a web quiz, the [HTML template](assets/quiz-template.html) runs offline without a build step. The agent reads your material first, then replaces the embedded questions and UI labels; the browser has no PDF upload parser. The shipped example is based on this repository's [contribution guide](../../CONTRIBUTING.md). See the [template data guide](references/template-api.md) for customization and the [web quiz design guide](references/web-quiz-design.md) for visual, interaction, and accessibility criteria drawn from `frontend-design` and `ui-ux-pro-max`. Neither skill needs to be installed separately.

The template supports both modes, automatically scores multiple-choice and true/false questions, and lets learners compare short answers with reference answers and check them themselves. Short answers are not AI-graded. Follow-up questions revisit missed concepts while preserving the initial result. Data stays in memory for the open page; there is no persistent storage or external service.

## Sources and limits

- Uses readable documents, PDFs, Markdown, web pages, notes, and pasted text within your chosen scope. Explanations cite real document names, sections, pages, or other available locations.
- Questions and grading stay grounded in the material. The agent does not invent source locations or silently fill gaps with outside facts.
- Source reading depends on the tools available to your agent. Scanned PDFs may need OCR. If material cannot be read, the agent asks for a readable source or text.
- Conversation is the default format. Persistent progress tracking and exam certification are not included. No dedicated API key or runtime is required by the skill.

See [SKILL.md](SKILL.md) for the workflow.
