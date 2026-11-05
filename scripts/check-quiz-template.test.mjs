import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from 'playwright';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const templatePath = process.env.QUIZ_TEMPLATE_PATH
  ? resolve(process.env.QUIZ_TEMPLATE_PATH)
  : resolve(root, 'skills/plz-quiz/assets/quiz-template.html');
let template, browser;

before(async () => {
  template = await readFile(templatePath, 'utf8');
  browser = await chromium.launch({ chromiumSandbox: true });
}, { timeout: 30_000 });
after(async () => { await browser?.close(); });

function fixture() {
  const source = { document: 'Study notes', section: 'Reservation rules', excerpt: 'EVIDENCE: the confirmed source passage.' };
  return {
    title: 'Reservation practice', description: 'Apply the supplied notes.',
    source: { name: 'Study notes', scope: 'Reservations' }, lang: 'en', labels: {},
    questions: [
      { id: 'q1', concept: 'Booking', type: 'choice', prompt: 'Which booking is allowed?',
        options: [{ id: 'a', text: 'A three-hour booking' }, { id: 'b', text: 'A two-hour booking' }],
        answer: 'b', explanation: 'EXPLANATION: the maximum is two hours.', hint: 'Think about the maximum duration.', source,
        retry: { prompt: 'Which duration stays within the limit?', type: 'choice',
          options: [{ id: 'a', text: 'Ninety minutes' }, { id: 'b', text: 'Three hours' }], answer: 'a', explanation: 'Ninety minutes is less than two hours.' } },
      { id: 'q2', concept: 'Check-in', type: 'ox', prompt: 'Only the named organizer can check in.',
        answer: 'false', explanation: 'A teammate can also check in.', source,
        retry: { prompt: 'A teammate is allowed to check in.', answer: 'true', explanation: 'Teammates are allowed.' } },
      { id: 'q3', concept: 'Waiting', type: 'choice', prompt: 'Who receives a released room?',
        options: [{ id: 'a', text: 'The first person waiting' }, { id: 'b', text: 'The last person waiting' }],
        answer: 'a', explanation: 'The waiting list is processed in order.', source,
        retry: { prompt: 'The first person declines. Who is next?',
          options: [{ id: 'a', text: 'The next person waiting' }, { id: 'b', text: 'A random person' }], answer: 'a', explanation: 'The next waiting person receives the offer.' } },
      { id: 'q4', concept: 'Cancellation', type: 'short', prompt: 'Explain the cancellation deadline.',
        referenceAnswer: 'REFERENCE: cancel at least thirty minutes before the start.',
        essentialPoints: ['Thirty minutes', 'Before the start'], explanation: 'The notes define a thirty-minute lead time.', source,
        retry: { prompt: 'When should a 14:00 booking be cancelled?', referenceAnswer: 'By 13:30.',
          essentialPoints: ['13:30'], explanation: '13:30 is thirty minutes before 14:00.' } },
    ],
  };
}

async function openPage(t, data, options = {}) {
  const context = await browser.newContext({ viewport: { width: 1200, height: 900 }, reducedMotion: 'reduce', ...options });
  t.after(() => context.close());
  const externalRequests = [];
  await context.route('**/*', route => {
    const url = route.request().url();
    if (url.startsWith('file:')) return route.continue();
    externalRequests.push(url);
    return route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(8_000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  if (data) {
    const json = JSON.stringify(data).replace(/</g, '\\u003c');
    const html = template.replace(/(<script\b[^>]*\bid=["']quiz-data["'][^>]*>)[\s\S]*?(<\/script>)/i, (_, start, end) => `${start}${json}${end}`);
    assert.notEqual(html, template, 'fixture must replace the actual editable data block');
    await page.setContent(html);
  } else await page.goto(pathToFileURL(templatePath).href);
  return { page, errors, externalRequests };
}

const question = (page, id) => page.locator(`[data-question-id="${id}"]`);
const action = (page, name) => page.locator(`[data-action="${name}"]`);
const choose = (page, id, value) => question(page, id).locator(`input[type="radio"][value="${value}"]`).check();
const snapshot = page => page.evaluate(() => window.__quiz.snapshot());
async function start(page, mode = 'learning') {
  await page.locator(`input[name="quiz-mode"][value="${mode}"]`).check();
  await action(page, 'start').click();
}
async function noSpoilers(page) {
  assert.equal(await page.locator('[data-feedback]').count(), 0);
  assert.equal(await page.locator('.quiz-source-quote').count(), 0);
  const rendered = await page.locator('#quiz-app').innerText();
  assert.doesNotMatch(rendered, /EVIDENCE:|EXPLANATION:|REFERENCE:/);
}

test('quiz template opens from a local file with its actual data and no external requests', async t => {
  const { page, errors, externalRequests } = await openPage(t);
  assert.equal(await page.locator('#quiz-app').getAttribute('data-screen'), 'start');
  assert.ok((await page.locator('#quiz-header h1').innerText()).length > 0);
  await action(page, 'start').click();
  assert.ok(await page.locator('.quiz-question').count() > 0);
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
});

test('learning reveals feedback only after commitment and preserves the first result on back navigation', async t => {
  const { page, errors } = await openPage(t, fixture());
  await start(page);
  await noSpoilers(page);
  await choose(page, 'q1', 'a');
  await noSpoilers(page);
  await action(page, 'check-answer').click();
  assert.equal(await question(page, 'q1').locator('[data-verdict]').getAttribute('data-verdict'), 'incorrect');
  assert.equal(await page.locator('.quiz-source-quote').count(), 1);
  assert.ok(await question(page, 'q1').locator('input[value="a"]').isDisabled());
  await action(page, 'next').click();
  await choose(page, 'q2', 'false');
  await action(page, 'check-answer').click();
  await action(page, 'previous').click();
  assert.ok(await question(page, 'q1').locator('input[value="a"]').isChecked());
  assert.equal((await snapshot(page)).attempt.summary.incorrect, 1);
  assert.equal(await action(page, 'check-answer').count(), 0);
  assert.deepEqual(errors, []);
});

test('check mode keeps a partial set private, preserves edits and distinguishes skipped from unanswered', async t => {
  const { page, errors } = await openPage(t, fixture());
  await start(page, 'check');
  assert.equal(await page.locator('.quiz-question').count(), 4);
  await choose(page, 'q1', 'a');
  await choose(page, 'q1', 'b');
  await question(page, 'q3').locator('[data-action="skip"]').click();
  await noSpoilers(page);
  await action(page, 'finish').click();
  assert.ok(await page.locator('.quiz-incomplete').isVisible());
  await noSpoilers(page);
  await action(page, 'continue').click();
  assert.ok(await question(page, 'q1').locator('input[value="b"]').isChecked());
  assert.ok(await question(page, 'q3').locator('[data-action="undo-skip"]').isVisible());
  await action(page, 'finish').click();
  await action(page, 'submit-early').click();
  const result = (await snapshot(page)).attempt.summary;
  assert.equal(result.correct, 1);
  assert.equal(result.denominator, 2);
  assert.equal(result.skipped, 1);
  assert.equal(result.unanswered, 2);
  assert.equal(result.answered, 2);
  assert.equal(await page.locator('[data-score]').innerText(), '1 / 2 points');
  assert.equal(await page.locator('.quiz-source-quote').count(), 4);
  assert.deepEqual(errors, []);
});

test('assistance and short-answer self-check stay separate from automatic points', async t => {
  const { page, errors } = await openPage(t, fixture());
  await start(page, 'check');
  await question(page, 'q1').locator('[data-action="hint"]').click();
  await choose(page, 'q1', 'b');
  await choose(page, 'q2', 'true');
  await choose(page, 'q3', 'a');
  await question(page, 'q4').locator('textarea').fill('My wording has no exact reference keywords.');
  await noSpoilers(page);
  await action(page, 'finish').click();
  let result = (await snapshot(page)).attempt.summary;
  assert.equal(result.denominator, 2);
  assert.equal(result.correct, 1);
  assert.equal(result.assisted, 1);
  assert.equal(result.pending, 1);
  assert.equal(result.short, 1);
  assert.equal(await question(page, 'q4').locator('[data-verdict]').getAttribute('data-verdict'), 'selfPending');
  await question(page, 'q4').locator('[data-self-check="understood"]').check();
  result = (await snapshot(page)).attempt.summary;
  assert.equal(result.checked, 1);
  assert.equal(result.pending, 0);
  assert.equal(result.denominator, 2);
  assert.equal(result.correct, 1);
  assert.deepEqual(errors, []);
});

test('completing the last missing response clears the early-submit prompt without a stale continue action', async t => {
  for (const fillLast of ['skip', 'answer']) {
    const data = fixture();
    data.questions = data.questions.slice(0, 2);
    const { page, errors } = await openPage(t, data);
    await start(page, 'check');
    await choose(page, 'q1', 'b');
    await action(page, 'finish').click();
    assert.ok(await page.locator('.quiz-incomplete').isVisible());
    if (fillLast === 'skip') await question(page, 'q2').locator('[data-action="skip"]').click();
    else await choose(page, 'q2', 'false');
    assert.equal(await page.locator('.quiz-incomplete').count(), 0);
    assert.equal(await action(page, 'continue').count(), 0);
    await noSpoilers(page);
    await action(page, 'finish').click();
    assert.equal((await snapshot(page)).attempt.summary.answered, 2);
    assert.deepEqual(errors, []);
  }
});

test('result self-check radios preserve native arrow-key navigation after summary updates', async t => {
  const data = fixture();
  data.questions = data.questions.slice(3);
  const { page, errors } = await openPage(t, data);
  await start(page, 'check');
  await question(page, 'q4').locator('textarea').fill('A response to compare.');
  await action(page, 'finish').click();
  const understood = question(page, 'q4').locator('[data-self-check="understood"]');
  await understood.focus();
  await page.keyboard.press('Space');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-self-check')), 'understood');
  await page.keyboard.press('ArrowRight');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-self-check')), 'review');
  assert.ok(await question(page, 'q4').locator('[data-self-check="review"]').isChecked());
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.evaluate(() => document.activeElement?.getAttribute('data-self-check')), 'understood');
  assert.ok(await understood.isChecked());
  assert.deepEqual(errors, []);
});

test('fresh retries keep the initial objective score immutable', async t => {
  const { page, errors } = await openPage(t, fixture());
  await start(page, 'check');
  await choose(page, 'q1', 'a');
  await choose(page, 'q2', 'false');
  await question(page, 'q3').locator('[data-action="skip"]').click();
  await question(page, 'q4').locator('textarea').fill('Needs review.');
  await action(page, 'finish').click();
  await question(page, 'q4').locator('[data-self-check="review"]').check();
  const original = (await snapshot(page)).original.summary;
  assert.equal(original.correct, 1);
  assert.equal(original.denominator, 3);
  await action(page, 'retry').click();
  assert.equal(await page.locator('.quiz-question').count(), 3);
  await choose(page, 'q1--retry', 'a');
  await choose(page, 'q3--retry', 'a');
  await question(page, 'q4--retry').locator('textarea').fill('13:30');
  await action(page, 'finish').click();
  const current = await snapshot(page);
  assert.equal(current.attempt.summary.correct, 2);
  assert.equal(current.attempt.summary.denominator, 2);
  assert.deepEqual(current.original.summary, original);
  assert.equal(await page.locator('[data-original-score] p').first().innerText(), '1 / 3 points');
  assert.equal(await action(page, 'retry').count(), 0);
  await action(page, 'original-results').click();
  assert.equal(await page.locator('[data-score]').innerText(), '1 / 3 points');
  assert.deepEqual(errors, []);
});

test('all-correct results remain usable without an empty retry action', async t => {
  const data = fixture();
  data.questions = data.questions.slice(0, 2);
  const { page } = await openPage(t, data);
  await start(page, 'check');
  await choose(page, 'q1', 'b');
  await choose(page, 'q2', 'false');
  await action(page, 'finish').click();
  assert.equal(await page.locator('[data-score]').innerText(), '2 / 2 points');
  assert.equal(await action(page, 'retry').count(), 0);
  await action(page, 'new-practice').click();
  assert.ok(await action(page, 'start').isEnabled());
});

test('malformed data fails visibly before a quiz can start', async t => {
  for (const mutate of [
    data => { data.questions[1].id = data.questions[0].id; },
    data => { data.questions[0].answer = 'missing-option'; },
    data => { data.questions[0].source.url = 'javascript:alert(1)'; },
  ]) {
    const data = fixture();
    mutate(data);
    const { page, errors } = await openPage(t, data);
    assert.equal(await page.locator('#quiz-app').getAttribute('data-screen'), 'error');
    assert.ok(await page.getByRole('alert').isVisible());
    assert.equal(await action(page, 'start').count(), 0);
    assert.deepEqual(errors, []);
  }
});

test('study text is rendered as text rather than executing markup', async t => {
  const data = fixture();
  const attack = '<img src="https://invalid.example/attack" onerror="window.quizAttack=true">';
  data.title = attack;
  data.questions = data.questions.slice(0, 1);
  data.questions[0].prompt = attack;
  data.questions[0].source.excerpt = attack;
  const { page, errors, externalRequests } = await openPage(t, data);
  assert.equal(await page.locator('#quiz-header h1').innerText(), attack);
  await start(page, 'check');
  await choose(page, 'q1', 'b');
  await action(page, 'finish').click();
  assert.equal(await page.locator('.quiz-source-quote').innerText(), attack);
  assert.equal(await page.locator('#quiz-app img').count(), 0);
  assert.equal(await page.evaluate(() => window.quizAttack), undefined);
  assert.deepEqual(errors, []);
  assert.deepEqual(externalRequests, []);
});

const sheetCells = page => page.locator('[data-sheet-cell]');
const cellNames = page => sheetCells(page).evaluateAll(nodes => nodes.map(node => node.getAttribute('aria-label')));

test('check-mode answer sheet reports progress only, then verdicts after submission', async t => {
  const { page, errors } = await openPage(t, fixture());
  await start(page, 'check');
  assert.deepEqual(await cellNames(page), ['Question 1, Unanswered', 'Question 2, Unanswered', 'Question 3, Unanswered', 'Question 4, Unanswered']);
  await choose(page, 'q1', 'a');
  await choose(page, 'q2', 'false');
  await question(page, 'q3').locator('[data-action="skip"]').click();
  assert.deepEqual(await cellNames(page), ['Question 1, Answered', 'Question 2, Answered', 'Question 3, Skipped', 'Question 4, Unanswered']);
  assert.equal(await page.locator('.quiz-mark').count(), 0, 'no grading marks before submission');
  await sheetCells(page).nth(3).click();
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'question-q4');
  await noSpoilers(page);
  await action(page, 'finish').click();
  await action(page, 'submit-early').click();
  assert.deepEqual(await cellNames(page), ['Question 1, Incorrect', 'Question 2, Correct', 'Question 3, Skipped', 'Question 4, Unanswered']);
  assert.equal(await page.locator('[data-sheet-cell] .quiz-mark').count(), 2);
  assert.deepEqual(errors, []);
});

test('learning feedback labels the submitted choice and the correct answer on the options', async t => {
  const { page, errors } = await openPage(t, fixture());
  await start(page);
  await choose(page, 'q1', 'a');
  assert.equal(await page.locator('[data-tag]').count(), 0);
  await action(page, 'check-answer').click();
  const row = (id, value) => question(page, id).locator(`label:has(input[value="${value}"]) [data-tag]`);
  assert.deepEqual(await row('q1', 'a').allInnerTexts(), ['Your answer']);
  assert.deepEqual(await row('q1', 'b').allInnerTexts(), ['Correct answer']);
  assert.ok(await question(page, 'q1').locator('input[value="a"]').isChecked(), 'the submitted choice stays visible');
  await action(page, 'next').click();
  await choose(page, 'q2', 'false');
  await action(page, 'check-answer').click();
  assert.deepEqual(await row('q2', 'false').allInnerTexts(), ['Your answer', 'Correct answer']);
  assert.equal(await row('q2', 'true').count(), 0);
  assert.deepEqual(errors, []);
});

test('no screen overflows horizontally at 375px', async t => {
  const viewport = { viewport: { width: 375, height: 812 } };
  const overflow = page => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const learning = await openPage(t, null, viewport);
  assert.equal(await overflow(learning.page), 0, 'start');
  await start(learning.page);
  assert.equal(await overflow(learning.page), 0, 'learning question');
  const firstRadio = learning.page.locator('.quiz-question input[type="radio"]').first();
  if (await firstRadio.count()) await firstRadio.check();
  else await learning.page.locator('.quiz-question textarea').first().fill('A short answer to compare.');
  await action(learning.page, 'check-answer').click();
  assert.equal(await overflow(learning.page), 0, 'learning feedback');
  const check = await openPage(t, null, viewport);
  await start(check.page, 'check');
  assert.equal(await overflow(check.page), 0, 'check sheet');
  await action(check.page, 'finish').click();
  assert.equal(await overflow(check.page), 0, 'incomplete prompt');
  await action(check.page, 'submit-early').click();
  assert.equal(await overflow(check.page), 0, 'results');
  assert.deepEqual([...learning.errors, ...check.errors], []);
});

test('the short-answer field has exactly one visible label', async t => {
  for (const mode of ['learning', 'check']) {
    const data = fixture();
    data.questions = data.questions.slice(3);
    const { page, errors } = await openPage(t, data);
    await start(page, mode);
    const item = question(page, 'q4');
    assert.equal(await item.getByText('Your answer', { exact: true }).count(), 1, mode);
    assert.equal(await item.getByRole('textbox', { name: 'Your answer' }).count(), 1, mode);
    assert.equal(await item.locator('legend').count(), 0, mode);
    assert.deepEqual(errors, []);
  }
});

test('practicing the whole set again is a separate practice round that keeps the first score', async t => {
  const data = fixture();
  data.questions = data.questions.slice(0, 2);
  const { page, errors } = await openPage(t, data);
  await start(page, 'check');
  await choose(page, 'q1', 'b');
  await choose(page, 'q2', 'true');
  await action(page, 'finish').click();
  assert.equal(await page.locator('[data-score]').innerText(), '1 / 2 points');
  assert.equal(await action(page, 'new-practice').innerText(), 'Practice the whole set again');
  await action(page, 'new-practice').click();
  await start(page, 'check');
  await choose(page, 'q1', 'b');
  await choose(page, 'q2', 'false');
  await action(page, 'finish').click();
  const current = await snapshot(page);
  assert.equal(current.attempt.practice, true);
  assert.equal(current.original.summary.correct, 1);
  assert.equal(await page.locator('[data-score]').innerText(), '2 / 2 points');
  assert.equal(await page.locator('[data-original-score] p').first().innerText(), '1 / 2 points');
  assert.equal(await page.locator('.quiz-results-title').innerText(), 'Practice results');
  await action(page, 'original-results').click();
  assert.equal(await page.locator('[data-score]').innerText(), '1 / 2 points');
  assert.equal((await snapshot(page)).attempt.practice, false);
  assert.deepEqual(errors, []);
});

test('assisted items form their own bucket and displayed counts sum to the total', async t => {
  const { page, errors } = await openPage(t, fixture());
  await start(page, 'check');
  await question(page, 'q1').locator('[data-action="hint"]').click();
  await question(page, 'q1').locator('[data-action="skip"]').click();
  await choose(page, 'q2', 'false');
  await question(page, 'q4').locator('textarea').fill('A response to compare.');
  await action(page, 'finish').click();
  await action(page, 'submit-early').click();
  const result = (await snapshot(page)).attempt.summary;
  assert.equal(result.skipped, 0);
  assert.equal(result.assisted, 1);
  assert.equal(result.unanswered, 1);
  const buckets = result.correct + result.incorrect + result.skipped + result.unanswered + result.assisted + result.checked + result.pending;
  assert.equal(buckets, result.total);
  const shown = (await page.locator('.quiz-counts dd').allInnerTexts()).map(Number);
  assert.equal(shown.reduce((sum, value) => sum + value, 0), result.total);
  assert.deepEqual(errors, []);
});

test('skipping keeps a typed draft unsubmitted and undo restores it', async t => {
  const { page, errors } = await openPage(t, fixture());
  await start(page, 'check');
  const field = question(page, 'q4').locator('textarea');
  await field.fill('Draft I want to keep.');
  await question(page, 'q4').locator('[data-action="skip"]').click();
  let response = (await snapshot(page)).attempt.responses.q4;
  assert.equal(response.skipped, true);
  assert.equal(response.submitted, true);
  assert.equal(response.draft, 'Draft I want to keep.');
  assert.equal((await cellNames(page))[3], 'Question 4, Skipped');
  await noSpoilers(page);
  await question(page, 'q4').locator('[data-action="undo-skip"]').click();
  assert.equal(await question(page, 'q4').locator('textarea').inputValue(), 'Draft I want to keep.');
  assert.equal((await cellNames(page))[3], 'Question 4, Answered');
  await question(page, 'q4').locator('[data-action="skip"]').click();
  await action(page, 'finish').click();
  await action(page, 'submit-early').click();
  const summary = (await snapshot(page)).attempt.summary;
  assert.equal(summary.skipped, 1);
  assert.equal(summary.pending, 0);
  assert.equal(await question(page, 'q4').locator('[data-verdict]').getAttribute('data-verdict'), 'skipped');
  assert.deepEqual(errors, []);
});

test('Korean UI is selected by a case-insensitive language tag', async t => {
  const data = fixture();
  data.lang = 'KO-kr';
  const { page, errors } = await openPage(t, data);
  assert.equal(await action(page, 'start').innerText(), '퀴즈 시작하기');
  assert.equal(await page.locator('.skip-link').textContent(), '퀴즈로 이동');
  const english = await openPage(t, fixture());
  assert.equal(await english.page.locator('.skip-link').textContent(), 'Skip to the quiz');
  assert.equal(await english.page.locator('meta[name="description"]').getAttribute('content'), 'Apply the supplied notes.');
  assert.deepEqual([...errors, ...english.errors], []);
});

test('author question IDs cannot collide in generated element IDs', async t => {
  const data = fixture();
  data.questions = data.questions.slice(0, 2);
  data.questions[0].id = 'x';
  data.questions[1].id = 'body-x';
  const { page, errors } = await openPage(t, data);
  await start(page, 'check');
  await choose(page, 'x', 'a');
  await choose(page, 'body-x', 'false');
  await action(page, 'finish').click();
  const ids = await page.evaluate(() => [...document.querySelectorAll('[id]')].map(node => node.id));
  assert.equal(new Set(ids).size, ids.length, `duplicate ids: ${ids}`);
  for (const id of ['x', 'body-x']) {
    const ok = await question(page, id).evaluate(item => {
      const toggle = item.querySelector('[aria-controls]');
      const panel = document.getElementById(toggle.getAttribute('aria-controls'));
      return panel?.closest('[data-question-id]') === item;
    });
    assert.ok(ok, id);
  }
  const toggle = question(page, 'body-x').locator('[aria-controls]');
  await toggle.click();
  assert.equal(await toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(await question(page, 'x').locator('[aria-controls]').getAttribute('aria-expanded'), 'true');
  assert.deepEqual(errors, []);
});

test('typing updates the affected answer-sheet cell in place and the open prompt only when the missing set changes', async t => {
  const { page, errors } = await openPage(t, fixture());
  await start(page, 'check');
  await action(page, 'finish').click();
  const field = question(page, 'q4').locator('textarea');
  await field.pressSequentially('a');
  await page.evaluate(() => {
    window.__cells = [...document.querySelectorAll('[data-sheet-cell]')];
    window.__prompt = document.querySelector('.quiz-incomplete');
  });
  await field.pressSequentially('bc');
  const stable = await page.evaluate(() => window.__cells.every(cell => cell.isConnected) && window.__prompt.isConnected);
  assert.ok(stable, 'cells and prompt are reused while their state is unchanged');
  await choose(page, 'q1', 'b');
  assert.equal(await page.evaluate(() => window.__cells[0].isConnected), true, 'a state change updates the cell in place');
  assert.equal((await cellNames(page))[0], 'Question 1, Answered');
  assert.equal(await page.evaluate(() => window.__prompt.isConnected), false, 'a changed missing set rebuilds the prompt');
  assert.deepEqual(errors, []);
});

test('while the incomplete prompt is open its actions are the only submit choice', async t => {
  const { page, errors } = await openPage(t, fixture());
  await start(page, 'check');
  await action(page, 'finish').click();
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'incomplete-heading');
  assert.equal(await action(page, 'finish').isVisible(), false);
  assert.equal(await page.locator('.button-primary:visible').count(), 1);
  await action(page, 'continue').click();
  assert.equal(await page.evaluate(() => document.activeElement?.id), 'question-q1');
  assert.ok(await action(page, 'finish').isVisible());
  assert.deepEqual(errors, []);
});

function manyQuestions(count) {
  const data = fixture();
  const [base] = data.questions;
  data.questions = Array.from({ length: count }, (_, index) => ({ ...base, id: `m${index + 1}`, retry: undefined }));
  return data;
}
const cellBoxes = page => page.locator('[data-sheet-cell]').evaluateAll(nodes => nodes.map(node => {
  const box = node.getBoundingClientRect();
  return { left: box.left, right: box.right, top: box.top, width: box.width, height: box.height };
}));
function assertTargets(boxes, label) {
  for (const box of boxes) assert.ok(box.width >= 44 && box.height >= 44, `${label}: cell ${box.width}x${box.height}`);
  for (let index = 1; index < boxes.length; index++) {
    if (Math.abs(boxes[index].top - boxes[index - 1].top) > 1) continue;
    assert.ok(boxes[index].left - boxes[index - 1].right >= 8 - 0.01, `${label}: gap ${boxes[index].left - boxes[index - 1].right}`);
  }
}

test('answer-sheet cells are at least 44px square with 8px between them', async t => {
  for (const width of [1440, 390]) {
    const { page, errors } = await openPage(t, fixture(), { viewport: { width, height: 900 } });
    await start(page, 'check');
    assertTargets(await cellBoxes(page), `bar ${width}`);
    await action(page, 'finish').click();
    await action(page, 'submit-early').click();
    assertTargets(await cellBoxes(page), `results ${width}`);
    assert.deepEqual(errors, []);
  }
});

test('a long set keeps the narrow top bar to one scrolling strip and the current cell in view', async t => {
  const { page, errors } = await openPage(t, manyQuestions(20), { viewport: { width: 390, height: 844 } });
  await start(page, 'check');
  const boxes = await cellBoxes(page);
  assert.equal(boxes.length, 20);
  assert.equal(new Set(boxes.map(box => Math.round(box.top))).size, 1, 'all cells share one row');
  const barHeight = await page.locator('#quiz-header').evaluate(node => node.getBoundingClientRect().height);
  assert.ok(barHeight <= 130, `bar height ${barHeight}`);
  const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  assert.equal(await overflow(), 0);
  await question(page, 'm17').locator('input[value="b"]').focus();
  const visible = await page.evaluate(() => {
    const cell = document.querySelector('[data-sheet-cell][aria-current="step"]');
    const strip = cell.closest('.quiz-sheet').getBoundingClientRect();
    const box = cell.getBoundingClientRect();
    return { label: cell.getAttribute('aria-label'), inside: box.left >= strip.left - 0.5 && box.right <= strip.right + 0.5 };
  });
  assert.equal(visible.label, 'Question 17, Unanswered');
  assert.ok(visible.inside, 'the current cell is scrolled into the strip');
  assert.equal(await overflow(), 0);
  assert.deepEqual(errors, []);
});

test('English counts read correctly for one and for many', async t => {
  const { page, errors } = await openPage(t, fixture());
  await start(page, 'check');
  await choose(page, 'q1', 'b');
  await choose(page, 'q2', 'false');
  await choose(page, 'q3', 'a');
  await action(page, 'finish').click();
  const prompt = await page.locator('.quiz-incomplete').innerText();
  assert.doesNotMatch(prompt, /\b1 questions\b/);
  assert.match(prompt, /\b1\b/);
  await action(page, 'submit-early').click();
  assert.doesNotMatch(await page.locator('#quiz-app').innerText(), /\b1 questions\b/);
  const data = fixture();
  data.questions = data.questions.slice(0, 1);
  const single = await openPage(t, data);
  const startText = await single.page.locator('#quiz-app').innerText();
  assert.doesNotMatch(startText, /\b1 questions\b/);
  assert.match(startText, /\b1\b/);
  await start(single.page, 'check');
  assert.doesNotMatch(await single.page.locator('#quiz-app').innerText(), /\b1 questions\b|\b0 of 1 questions\b/);
  assert.deepEqual([...errors, ...single.errors], []);
});
