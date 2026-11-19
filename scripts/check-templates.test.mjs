import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdir, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  compareEngineSections, compareUiText, extractEngineSections, extractKitSections, inspectTemplates, parseUiText,
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

// ---- Kit sections: a page carries the shell plus the KIT sections of the kits it lists in data-kits.
function kitPage({ kits = ['axo', 'svg'], listed = kits.join(' '), body = {}, shell = 'shell engine', banners = null } = {}) {
  const section = (k, part) => [`/* KIT ${k} ${part} — ${part === 'css' ? 'styles' : 'code'} */`, body[`${k} ${part}`] ?? `${part} of ${k}`, `/* END KIT ${k} ${part} */`];
  const css = kits.flatMap(k => section(k, 'css')), js = kits.flatMap(k => section(k, 'js'));
  const stage = listed === null ? '<aside class="stage">' : `<aside class="stage" data-kits="${listed}">`;
  return ['<style>', '.shell {}', ...css, '</style>', stage, '/* ====', '   ENGINE - core', '   ==== */', shell, ...(banners ?? js), 'more shell',
    '/* ====', '   SCENES - yours', '   ==== */', 'scene body', '/* ====', '   ENGINE (continued) - loop', '   ==== */', 'loop', ''].join('\n');
}
const fullTemplate = kitPage();

test('kit sections: banners are read with their kit and part', () => {
  const { sections, errors } = extractKitSections(fullTemplate);
  assert.deepEqual(errors, []);
  assert.deepEqual([...sections.keys()], ['axo css', 'svg css', 'axo js', 'svg js']);
  assert.deepEqual(sections.get('svg js').lines, ['/* KIT svg js — code */', 'js of svg', '/* END KIT svg js */']);
});

test('kit sections: an example that carries only the kits it lists passes', () => {
  assert.deepEqual(compareEngineSections(fullTemplate, kitPage({ kits: ['svg'] }), 'example-svg.html'), []);
  assert.deepEqual(compareEngineSections(fullTemplate, kitPage({ kits: ['axo'] }), 'example-axo.html'), []);
  assert.deepEqual(compareEngineSections(fullTemplate, fullTemplate, 'example-both.html'), []);
});

test('kit sections: a kit section that differs from the template is reported with its kit, part and line', () => {
  const issues = compareEngineSections(fullTemplate, kitPage({ kits: ['svg'], body: { 'svg js': 'js of svg, edited' } }), 'example-svg.html');
  assert.equal(issues.length, 1);
  assert.match(issues[0], /KIT svg js differs from example-svg\.html/);
  assert.match(issues[0], /js of svg, edited/);
});

test('kit sections: the shell is still compared verbatim, around the kit sections, with the original line numbers', () => {
  const issues = compareEngineSections(fullTemplate, kitPage({ kits: ['svg'], shell: 'shell engine B' }), 'example-svg.html');
  assert.equal(issues.length, 1);
  assert.match(issues[0], /ENGINE section 1 differs/);
  assert.match(issues[0], /shell engine B/);
  const line = fullTemplate.split('\n').indexOf('shell engine') + 1;
  assert.match(issues[0], new RegExp(`template line ${line}\\b`));
});

test('kit sections: data-kits and the kit sections present must agree', () => {
  const listedMissing = compareEngineSections(fullTemplate, kitPage({ kits: ['axo'], listed: 'axo svg' }), 'example-a.html').join('\n');
  assert.match(listedMissing, /data-kits lists "svg" but the page has no KIT svg sections/);
  const presentUnlisted = compareEngineSections(fullTemplate, kitPage({ kits: ['axo', 'svg'], listed: 'axo' }), 'example-b.html').join('\n');
  assert.match(presentUnlisted, /KIT svg sections are present but "svg" is not in data-kits/);
  // No data-kits attribute means axo.
  assert.deepEqual(compareEngineSections(fullTemplate, kitPage({ kits: ['axo'], listed: null }), 'example-c.html'), []);
});

test('kit sections: a listed kit needs every part the template has', () => {
  const page = kitPage({ kits: ['svg'], banners: ['/* KIT svg js — code */', 'js of svg', '/* END KIT svg js */'] }).replace(/\/\* KIT svg css[\s\S]*?END KIT svg css \*\/\n/, '');
  assert.match(compareEngineSections(fullTemplate, page, 'example-svg.html').join('\n'), /missing KIT svg css/);
});

test('kit sections: unknown, duplicated, unclosed and stray banners are errors', () => {
  const unknown = kitPage({ kits: ['svg', 'foo'], listed: 'svg foo' });
  assert.match(compareEngineSections(fullTemplate, unknown, 'example-u.html').join('\n'), /unknown kit "foo"/);
  const dup = kitPage({ kits: ['svg'], banners: ['/* KIT svg js — code */', 'js of svg', '/* END KIT svg js */', '/* KIT svg js — again */', 'x', '/* END KIT svg js */'] });
  assert.match(extractKitSections(dup).errors.join('\n'), /KIT svg js is duplicated/);
  const unclosed = kitPage({ kits: ['svg'], banners: ['/* KIT svg js — code */', 'js of svg'] });
  assert.match(extractKitSections(unclosed).errors.join('\n'), /KIT svg js is not closed/);
  const stray = kitPage({ kits: ['svg'], banners: ['js of svg', '/* END KIT svg js */'] });
  assert.match(extractKitSections(stray).errors.join('\n'), /END KIT svg js without a start/);
  const badPart = kitPage({ kits: ['svg'], banners: ['/* KIT svg html — x */', 'x', '/* END KIT svg html */'] });
  assert.match(extractKitSections(badPart).errors.join('\n'), /part must be css or js/);
});

test('end to end: a template with kits and examples that carry different kits passes; the template itself must be consistent', async () => {
  const files = {
    'skills/k/assets/template.html': fullTemplate + dictionary,
    'skills/k/assets/example-a.html': kitPage({ kits: ['axo'] }) + dictionary,
    'skills/k/assets/example-b.html': kitPage({ kits: ['svg'] }) + dictionary,
  };
  await withFixture(files, async root => {
    assert.deepEqual(await inspectTemplates(root), { issues: [], templates: 1, examples: 2 });
  });
  await withFixture({ 'skills/k/assets/template.html': kitPage({ listed: 'axo' }) + dictionary }, async root => {
    const { issues } = await inspectTemplates(root);
    assert.match(issues.join('\n'), /template\.html: KIT svg sections are present but "svg" is not in data-kits/);
  });
});

test('kit sections: only kits the template defines need sections (a kit defined in SCENES may be listed)', () => {
  assert.deepEqual(compareEngineSections(fullTemplate, kitPage({ kits: ['svg'], listed: 'svg dom' }), 'example-dom.html'), []);
});

test('kit sections: data-kits is read from the stage tag only, in either quote style, and a malformed value is reported', () => {
  const svgOnly = kitPage({ kits: ['svg'] });
  const decoy = svgOnly.replace('<style>', '<!-- data-kits="axo" in a comment -->\n<style>');
  assert.deepEqual(compareEngineSections(fullTemplate, decoy.replace('data-kits="svg"', 'data-kits="svg"'), 'example-decoy.html'), []);
  assert.deepEqual(compareEngineSections(fullTemplate, svgOnly.replace('data-kits="svg"', "data-kits='svg'"), 'example-single.html'), []);
  for (const bad of ['data-kits=', 'data-kits="svg', 'data-kits="svg!"', 'data-kits=""']) {
    const issues = compareEngineSections(fullTemplate, svgOnly.replace('data-kits="svg"', bad), 'example-bad.html').join('\n');
    assert.match(issues, /example-bad\.html: data-kits on the stage is malformed/, bad);
  }
  const noStage = svgOnly.replace('<aside class="stage" data-kits="svg">', '<aside class="side">');
  assert.match(compareEngineSections(fullTemplate, noStage, 'example-nostage.html').join('\n'), /no <aside class="stage"> start tag/);
});

test('kit sections: a kit section must sit where the template has it', () => {
  const svgOnly = kitPage({ kits: ['svg'] });
  const js = ['/* KIT svg js — code */', 'js of svg', '/* END KIT svg js */'].join('\n');
  const inScenes = svgOnly.replace(`${js}\n`, '').replace('scene body', `scene body\n${js}`);
  assert.match(compareEngineSections(fullTemplate, inScenes, 'example-moved.html').join('\n'), /example-moved\.html: KIT svg js is not where the template has it/);
  const css = ['/* KIT svg css — styles */', 'css of svg', '/* END KIT svg css */'].join('\n');
  const outsideStyle = svgOnly.replace(`${css}\n`, '').replace('</style>', `</style>\n${css}`);
  assert.match(compareEngineSections(fullTemplate, outsideStyle, 'example-css.html').join('\n'), /example-css\.html: KIT svg css is not where the template has it/);
});

test('end to end: a template banner error is reported once, and examples are still checked', async () => {
  const brokenTemplate = fullTemplate.replace('/* END KIT svg js */\n', '') + dictionary;
  const strayExample = kitPage({ kits: ['svg'], banners: ['js of svg', '/* END KIT svg js */'] }) + dictionary;
  const files = {
    'skills/k/assets/template.html': brokenTemplate,
    'skills/k/assets/example-a.html': kitPage({ kits: ['axo'] }) + dictionary,
    'skills/k/assets/example-b.html': strayExample,
  };
  await withFixture(files, async root => {
    const { issues } = await inspectTemplates(root);
    assert.equal(issues.filter(i => /KIT svg js is not closed/.test(i)).length, 1, issues.join('\n'));
    assert.ok(issues.some(i => /example-b\.html: END KIT svg js without a start/.test(i)), issues.join('\n'));
  });
});
