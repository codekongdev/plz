import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  compareEngineSections, compareUiText, extractEngineSections, inspectTemplates, parseUiText,
} from './check-templates.mjs';

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-templates.mjs');

function page({ first = 'ENGINE - core', second = 'ENGINE (continued) - loop', engine = 'engine A', loop = 'loop A', dict = '' } = {}) {
  return [
    'const header = 1;',
    '/* ====',
    `   ${first}`,
    '   ==== */',
    engine,
    '/* ====',
    '   SCENES - yours',
    '   ==== */',
    'scene body',
    '/* ====',
    `   ${second}`,
    '   ==== */',
    loop,
    dict,
    '',
  ].join('\n');
}

const dictionary = `const UI_TEXT = {
  en: { a: 'A', b: "B" },
  ko: { a: 'ka', b: 'kb' },
  'zh-CN': { a: 'za', b: 'zb' },
};`;

test('extracts both ENGINE sections with an English continuation banner', () => {
  const { sections, errors } = extractEngineSections(page());
  assert.deepEqual(errors, []);
  assert.equal(sections[0].start, 3);
  assert.equal(sections[0].lines[0].trim(), 'ENGINE - core');
  assert.equal(sections[0].lines.at(-1), '/* ====');
  assert.equal(sections[1].start, 11);
  assert.equal(sections[1].lines[0].trim(), 'ENGINE (continued) - loop');
});

test('extracts both ENGINE sections with a Korean continuation banner', () => {
  const { sections, errors } = extractEngineSections(page({ first: 'ENGINE - 엔진', second: 'ENGINE (계속) - 루프' }));
  assert.deepEqual(errors, []);
  assert.equal(sections[1].lines[0].trim(), 'ENGINE (계속) - 루프');
});

test('the first-section pattern does not match the continuation banner', () => {
  const { errors } = extractEngineSections(page({ first: 'ENGINE (continued) - oops' }));
  assert.ok(errors.length > 0);
});

test('reports missing banners', () => {
  const noContinued = page({ second: 'something else' });
  assert.match(extractEngineSections(noContinued).errors.join('\n'), /ENGINE \(.*missing/);
  const noFirst = page({ first: 'nothing' });
  assert.match(extractEngineSections(noFirst).errors.join('\n'), /ENGINE banner.*missing/);
  const noScenes = page().replace('SCENES - yours', 'other');
  assert.match(extractEngineSections(noScenes).errors.join('\n'), /SCENES banner.*missing/);
});

test('reports ambiguous banners that appear twice', () => {
  const twice = `${page()}\n   ENGINE (again)\n`;
  assert.match(extractEngineSections(twice).errors.join('\n'), /ENGINE \(.*ambiguous/);
  const twiceFirst = `ENGINE - extra\n${page()}`;
  assert.match(extractEngineSections(twiceFirst).errors.join('\n'), /ENGINE banner.*ambiguous/);
});

test('identical sections produce no issues', () => {
  assert.deepEqual(compareEngineSections(page(), page(), 'example-a.html'), []);
});

test('reports the first differing line in section one', () => {
  const issues = compareEngineSections(page(), page({ engine: 'engine B' }), 'example-a.html');
  assert.equal(issues.length, 1);
  assert.match(issues[0], /section 1/);
  assert.match(issues[0], /template line 5/);
  assert.match(issues[0], /engine A/);
  assert.match(issues[0], /engine B/);
});

test('reports a difference in section two with its own line number', () => {
  const issues = compareEngineSections(page(), page({ loop: 'loop B' }), 'example-a.html');
  assert.match(issues.join('\n'), /section 2.*template line 13/);
});

test('reports a length difference at the end of a section', () => {
  const issues = compareEngineSections(page(), `${page()}\nextra`, 'e.html');
  assert.match(issues[0], /section 2/);
  assert.match(issues[0], /end of section/);
});

test('truncates long lines in the report', () => {
  const long = 'x'.repeat(300);
  const issues = compareEngineSections(page({ engine: `${long}a` }), page({ engine: `${long}b` }), 'e.html');
  assert.ok(issues[0].length < 450);
  assert.ok(!issues[0].includes('x'.repeat(121)));
});

test('parses language and key names, including quoted languages', () => {
  const result = parseUiText(page({ dict: dictionary }));
  assert.equal(result.error, undefined);
  assert.deepEqual(result.languages, { en: ['a', 'b'], ko: ['a', 'b'], 'zh-CN': ['a', 'b'] });
});

test('string values with braces, colons, escaped quotes, and backticks do not confuse parsing', () => {
  const dict = [
    'const UI_TEXT = {',
    '  en: {',
    "    a: 'x } { : y',",
    '    b: "say \\"}\\" here: {",',
    "    c: 'it\\'s a: {',",
    '    d: `tpl } ${ {nested: 1}.nested } : {`,',
    '    e: "end",',
    '  },',
    "  'zh-CN': { a: 'z', b: \"{\", c: '}', d: ':', e: `}` }, // trailing comment {",
    '};',
  ].join('\n');
  const result = parseUiText(dict);
  assert.equal(result.error, undefined);
  assert.deepEqual(result.languages.en, ['a', 'b', 'c', 'd', 'e']);
  assert.deepEqual(result.languages['zh-CN'], ['a', 'b', 'c', 'd', 'e']);
});

test('nested templates and comments inside the dictionary are skipped', () => {
  const dict = "const UI_TEXT = { /* c: { */ en: { a: `x ${ `y } ${'}'}` } z`, // b: 1\n b: 'q' } };";
  assert.deepEqual(parseUiText(dict).languages, { en: ['a', 'b'] });
});

test('reports a missing UI_TEXT and malformed dictionaries', () => {
  assert.match(parseUiText('const x = 1;').error, /UI_TEXT.*not found/);
  assert.match(parseUiText('const UI_TEXT = { en: { a: \'x\' ').error, /UI_TEXT/);
  assert.match(compareUiText(parseUiText('const x = 1;')).join('\n'), /not found/);
});

test('spread and computed keys are reported as unsupported', () => {
  assert.match(parseUiText("const UI_TEXT = { en: { a: '1', ...more } };").error, /unsupported/);
  assert.match(parseUiText("const UI_TEXT = { en: { [k]: '1' } };").error, /unsupported/);
  assert.match(compareUiText(parseUiText("const UI_TEXT = { ...base, en: {} };")).join(), /unsupported/);
});

test('reports missing and extra keys against en', () => {
  const dict = "const UI_TEXT = { en: { a: '1', b: '2' }, ja: { a: '1', c: '3' }, ko: { a: '1', b: '2' } };";
  const issues = compareUiText(parseUiText(dict));
  assert.equal(issues.length, 1);
  assert.match(issues[0], /ja/);
  assert.match(issues[0], /missing \["b"\]/);
  assert.match(issues[0], /extra \["c"\]/);
});

test('requires an en dictionary', () => {
  assert.match(compareUiText(parseUiText("const UI_TEXT = { ko: { a: '1' } };")).join('\n'), /"en"/);
});

async function withFixture(files, run) {
  const dir = await mkdtemp(join(tmpdir(), 'check-templates-'));
  try {
    for (const [path, content] of Object.entries(files)) {
      await mkdir(dirname(join(dir, path)), { recursive: true });
      await writeFile(join(dir, path), content);
    }
    return await run(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

const good = page({ dict: dictionary });

test('end to end: a consistent fake skill passes', async () => {
  const files = { 'skills/x/assets/template.html': good, 'skills/x/assets/example-demo.html': good };
  await withFixture(files, async root => {
    const result = await inspectTemplates(root);
    assert.deepEqual(result, { issues: [], templates: 1, examples: 1 });
    const run = spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });
    assert.equal(run.status, 0);
    assert.match(run.stdout, /Template checks OK: 1 template, 1 example\./);
  });
});

test('end to end: a drifting example and a missing key fail with path-prefixed messages', async () => {
  const badDict = dictionary.replace("ko: { a: 'ka', b: 'kb' }", "ko: { a: 'ka' }");
  const files = {
    'skills/x/assets/template.html': page({ dict: badDict }),
    'skills/x/assets/example-demo.html': page({ dict: badDict, engine: 'engine B' }),
  };
  await withFixture(files, async root => {
    const { issues } = await inspectTemplates(root);
    assert.equal(issues.length, 2);
    assert.ok(issues.every(issue => issue.startsWith('skills/x/assets/template.html: ')));
    const run = spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /template line 5/);
    assert.match(run.stderr, /missing \["b"\]/);
  });
});

test('end to end: a template without an example skips the ENGINE comparison', async () => {
  await withFixture({ 'skills/x/assets/template.html': 'no banners\n' + dictionary }, async root => {
    assert.deepEqual(await inspectTemplates(root), { issues: [], templates: 1, examples: 0 });
  });
});

test('end to end: no templates is a success with a notice', async () => {
  await withFixture({ 'skills/x/SKILL.md': 'x' }, async root => {
    const run = spawnSync(process.execPath, [script, '--root', root], { encoding: 'utf8' });
    assert.equal(run.status, 0);
    assert.match(run.stdout, /No skill templates found\./);
  });
});

test('CLI rejects unknown arguments', () => {
  const run = spawnSync(process.execPath, [script, '--bogus'], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /Usage/);
});

async function viaSymlink(args) {
  const dir = await mkdtemp(join(tmpdir(), 'check-templates-link-'));
  try {
    const link = join(dir, 'linked-check-templates.mjs');
    await symlink(script, link);
    return spawnSync(process.execPath, [link, ...args], { encoding: 'utf8' });
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

test('running through a symbolic link still runs the check and prints the summary', async () => {
  await withFixture({ 'skills/x/assets/template.html': good, 'skills/x/assets/example-demo.html': good }, async root => {
    const run = await viaSymlink(['--root', root]);
    assert.equal(run.status, 0);
    assert.match(run.stdout, /Template checks OK: 1 template, 1 example\./);
  });
});

test('running through a symbolic link still fails on a bad fixture', async () => {
  const files = { 'skills/x/assets/template.html': good, 'skills/x/assets/example-demo.html': page({ dict: dictionary, engine: 'engine B' }) };
  await withFixture(files, async root => {
    const run = await viaSymlink(['--root', root]);
    assert.equal(run.status, 1);
    assert.match(run.stderr, /template line 5/);
  });
});
