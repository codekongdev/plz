#!/usr/bin/env node
// Static checks for skills/*/assets/template.html. Page content is only read as text, never executed.
// ENGINE sections are compared character for character, banner lines included. Only banner detection ignores the text after the name.
// parseUiText reads plain `key: value` entries. Spread and computed keys are reported as errors; regex literals and comments inside ${} are unsupported.
import { realpathSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const defaultRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// Banner lines are matched after trimming. The text after the banner name may change language.
const BANNERS = [
  { label: 'ENGINE', pattern: /^ENGINE\b(?!\s*\()/ },
  { label: 'SCENES', pattern: /^SCENES\b/ },
  { label: 'ENGINE (...)', pattern: /^ENGINE \(/ },
];

export function extractEngineSections(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const hits = BANNERS.map(({ pattern }) => lines.flatMap((line, i) => (pattern.test(line.trim()) ? [i] : [])));
  const errors = hits.flatMap((found, n) => (found.length === 1 ? []
    : [`${BANNERS[n].label} banner ${found.length ? `ambiguous (lines ${found.map(i => i + 1).join(', ')})` : 'missing'}`]));
  const [first, scenes, second] = hits.map(found => found[0]);
  if (!errors.length && !(first < scenes && scenes < second)) errors.push('banners out of order');
  if (errors.length) return { sections: null, errors };
  const sections = [{ start: first + 1, lines: lines.slice(first, scenes) }, { start: second + 1, lines: lines.slice(second) }];
  return { sections, errors };
}

const show = line => (line === undefined ? '<end of section>' : JSON.stringify(line.length > 120 ? `${line.slice(0, 120)}...` : line));

export function compareEngineSections(templateSource, exampleSource, name) {
  const template = extractEngineSections(templateSource);
  const example = extractEngineSections(exampleSource);
  const errors = [...template.errors.map(e => `template: ${e}`), ...example.errors.map(e => `${name}: ${e}`)];
  if (errors.length) return errors;
  return template.sections.flatMap((a, n) => {
    const b = example.sections[n];
    const at = Array.from({ length: Math.max(a.lines.length, b.lines.length) }, (_, i) => i)
      .find(i => a.lines[i] !== b.lines[i]);
    if (at === undefined) return [];
    return [`ENGINE section ${n + 1} differs from ${name}: template line ${a.start + at} (${name} line ${b.start + at}): `
      + `template ${show(a.lines[at])} | ${name} ${show(b.lines[at])}`];
  });
}

// Skips a string or template literal, or a ${...} block when `end` is "}". Returns the index after it.
function skipLiteral(src, from, end = src[from]) {
  let i = from + 1;
  while (i < src.length && src[i] !== end) {
    const c = src[i];
    if (c === '\\') i += 2;
    else if (end === '}' && ('\'"`{'.includes(c))) i = skipLiteral(src, i, c === '{' ? '}' : c);
    else if (end === '`' && c === '$' && src[i + 1] === '{') i = skipLiteral(src, i + 1, '}');
    else i += 1;
  }
  return i + 1;
}

// One token after any whitespace and comments: 1 quote, 2 opener, 3 closer, 4 separator, 5 bare word.
const TOKEN = /(?:\s|\/\/[^\n]*|\/\*[\s\S]*?\*\/)*(?:(['"`])|([{[(])|([}\])])|([,:])|([^\s{}[\]():,'"`]+))/y;

export function parseUiText(source) {
  const start = /\bconst\s+UI_TEXT\s*=\s*\{/.exec(source);
  if (!start) return { error: 'const UI_TEXT object not found' };
  const languages = {};
  const stack = ['{'];
  let expectKey = true;
  let language = null;
  TOKEN.lastIndex = start.index + start[0].length;
  for (let m; (m = TOKEN.exec(source));) {
    const [, quote, open, close, separator, word] = m;
    if ((expectKey && open && open !== '{') || word?.startsWith('...')) return { error: 'UI_TEXT uses unsupported syntax (spread or computed key)' };
    let name = word;
    if (quote) {
      const end = skipLiteral(source, TOKEN.lastIndex - 1);
      name = source.slice(TOKEN.lastIndex, end - 1);
      TOKEN.lastIndex = end;
    }
    if (open) {
      if (open === '{' && stack.length === 1) languages[language] = [];
      stack.push(open);
    } else if (close) {
      stack.pop();
      if (!stack.length) return { languages };
    } else if (name !== undefined && expectKey && stack.length === 1) {
      language = name;
      languages[name] = null;
    } else if (name !== undefined && expectKey && stack.length === 2) languages[language].push(name);
    expectKey = open === '{' || (separator === ',' && stack.at(-1) === '{');
  }
  return { error: 'UI_TEXT could not be read up to its closing brace' };
}

export function compareUiText({ languages, error }) {
  if (error) return [error];
  if (!Array.isArray(languages.en)) return ['UI_TEXT: missing "en" dictionary used as the baseline'];
  return Object.entries(languages).filter(([name]) => name !== 'en').flatMap(([name, keys]) => {
    if (!Array.isArray(keys)) return [`UI_TEXT.${name}: expected an object of strings`];
    const missing = languages.en.filter(key => !keys.includes(key)).sort();
    const extra = keys.filter(key => !languages.en.includes(key)).sort();
    const parts = [['missing', missing], ['extra', extra]].filter(([, list]) => list.length).map(([label, list]) => `${label} ${JSON.stringify(list)}`);
    return parts.length ? [`UI_TEXT.${name}: ${parts.join('; ')}`] : [];
  });
}

const readDir = path => readdir(path, { withFileTypes: true }).catch(error => (error.code === 'ENOENT' ? [] : Promise.reject(error)));

async function inspectSkill(root, skill) {
  const assets = join(root, 'skills', skill, 'assets');
  const entries = (await readDir(assets)).filter(entry => entry.isFile());
  if (!entries.some(entry => entry.name === 'template.html')) return null;
  const template = await readFile(join(assets, 'template.html'), 'utf8');
  const names = entries.map(entry => entry.name).filter(name => /^example-.*\.html$/.test(name)).sort();
  const issues = [];
  for (const name of names) issues.push(...compareEngineSections(template, await readFile(join(assets, name), 'utf8'), name));
  issues.push(...compareUiText(parseUiText(template)));
  const label = relative(root, join(assets, 'template.html')).split(sep).join('/');
  return { examples: names.length, issues: [...new Set(issues)].map(issue => `${label}: ${issue}`) };
}

export async function inspectTemplates(root) {
  const skills = (await readDir(join(root, 'skills'))).filter(entry => entry.isDirectory()).map(entry => entry.name).sort();
  const results = (await Promise.all(skills.map(skill => inspectSkill(root, skill)))).filter(Boolean);
  return { issues: results.flatMap(r => r.issues), templates: results.length, examples: results.reduce((sum, r) => sum + r.examples, 0) };
}

async function main(argv) {
  if (argv.length !== 0 && !(argv.length === 2 && argv[0] === '--root')) throw new Error('Usage: node scripts/check-templates.mjs [--root <dir>]');
  const { issues, templates, examples } = await inspectTemplates(argv.length ? resolve(argv[1]) : defaultRoot);
  if (issues.length) {
    console.error(issues.join('\n'));
    console.error(`Template check failed: ${issues.length} issue(s).`);
    process.exitCode = 1;
  } else if (templates === 0) console.log('No skill templates found.');
  else console.log(`Template checks OK: ${templates} template${templates === 1 ? '' : 's'}, ${examples} example${examples === 1 ? '' : 's'}.`);
}

// Compare real paths so a symbolic link to this file still runs it. A missing or unresolvable argv[1] means it was imported.
function isMain() {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMain()) {
  main(process.argv.slice(2)).catch(error => {
    console.error(error.message.startsWith('Usage') ? error.message : `Template check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
