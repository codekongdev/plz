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

// Kit sections: `/* KIT <kit> <part> — … */` up to `/* END KIT <kit> <part> */`, part css or js (the text after the part may
// change language). A page carries the shell plus the sections of the kits it lists in data-kits; without the attribute, axo.
// The kit rules apply only when the template has kit sections (plz-3d-explain's template has none).
const KIT_START = /^\/\*\s*KIT\s+([\w-]+)\s+([\w-]+)/;
const KIT_END = /^\/\*\s*END KIT\s+([\w-]+)\s+([\w-]+)/;

export function extractKitSections(source) {
  const lines = source.replace(/\r\n?/g, '\n').split('\n');
  const sections = new Map(), errors = [], inside = new Set();
  let open = null;
  lines.forEach((line, i) => {
    const t = line.trim();
    let m = KIT_END.exec(t);
    if (m) {
      const key = `${m[1]} ${m[2]}`;
      if (!open || open.key !== key) { errors.push(`END KIT ${key} without a start (line ${i + 1})`); return; }
      open.lines.push(line); inside.add(i);
      if (sections.has(key)) errors.push(`KIT ${key} is duplicated (lines ${sections.get(key).start} and ${open.start})`);
      else sections.set(key, { kit: open.kit, part: open.part, start: open.start, end: i + 1, lines: open.lines });
      open = null;
      return;
    }
    m = KIT_START.exec(t);
    if (m) {
      if (open) errors.push(`KIT ${open.key} is not closed before line ${i + 1}`);
      if (!['css', 'js'].includes(m[2])) errors.push(`KIT ${m[1]} ${m[2]}: the part must be css or js (line ${i + 1})`);
      open = { key: `${m[1]} ${m[2]}`, kit: m[1], part: m[2], start: i + 1, lines: [line] };
      inside.add(i);
      return;
    }
    if (open) { open.lines.push(line); inside.add(i); }
  });
  if (open) errors.push(`KIT ${open.key} is not closed`);
  // Where each section sits: the nearest shell (non-kit) line before and after it.
  const shellLine = (from, step) => { for (let i = from; i >= 0 && i < lines.length; i += step) if (!inside.has(i)) return lines[i]; return null; };
  for (const sec of sections.values()) sec.anchor = { before: shellLine(sec.start - 2, -1), after: shellLine(sec.end, 1) };
  return { sections, errors, inside };
}

// data-kits, read from the <aside class="stage"> start tag only. Double, single or no quotes; no attribute means axo.
const KIT_NAME = /^[a-z][\w-]*$/i;
export function readStageKits(source) {
  const stages = [...source.matchAll(/<aside\b[^>]*>/gi)].map(m => m[0])
    .filter(tag => /\sclass\s*=\s*(?:"[^"]*\bstage\b[^"]*"|'[^']*\bstage\b[^']*'|stage(?=[\s>]))/i.test(tag));
  if (stages.length !== 1) return { kits: null, error: stages.length ? `${stages.length} <aside class="stage"> start tags; expected one` : 'no <aside class="stage"> start tag' };
  const tag = stages[0];
  if (!/\sdata-kits\b/i.test(tag)) return { kits: ['axo'], error: null };
  const m = /\sdata-kits\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))(?=[\s/>])/i.exec(tag);
  const kits = m ? (m[1] ?? m[2] ?? m[3]).split(/[\s,]+/).filter(Boolean) : [];
  if (!kits.length || !kits.every(k => KIT_NAME.test(k))) return { kits: null, error: `data-kits on the stage is malformed: ${tag}` };
  return { kits, error: null };
}

// data-kits and the kit sections a page carries must agree. A listed kit the template defines needs every part the template
// has; a listed kit the template does not define is the page's own (defined in SCENES) and has no sections.
function checkKitListing(stage, pageKits, templateKits, prefix) {
  const templateKitNames = new Set([...templateKits.sections.values()].map(sec => sec.kit));
  const listed = new Set(stage.kits);
  const present = new Set([...pageKits.sections.values()].map(sec => sec.kit));
  const issues = [];
  for (const kit of listed) {
    if (!templateKitNames.has(kit)) continue;
    if (!present.has(kit)) { issues.push(`${prefix}data-kits lists "${kit}" but the page has no KIT ${kit} sections`); continue; }
    for (const sec of templateKits.sections.values()) {
      if (sec.kit === kit && !pageKits.sections.has(`${kit} ${sec.part}`)) issues.push(`${prefix}missing KIT ${kit} ${sec.part} section`);
    }
  }
  for (const kit of present) if (!listed.has(kit)) issues.push(`${prefix}KIT ${kit} sections are present but "${kit}" is not in data-kits`);
  return issues;
}

// The template, parsed once. errors are the template's own problems, without a file prefix.
export function parseTemplate(source) {
  const engine = extractEngineSections(source), kits = extractKitSections(source);
  const useKits = kits.sections.size > 0 || kits.errors.length > 0;
  const stage = useKits ? readStageKits(source) : null;
  const errors = [...kits.errors, ...(stage?.error ? [stage.error] : [])]; // ENGINE banner errors are in engine.errors
  if (useKits && !kits.errors.length && !stage.error) errors.push(...checkKitListing(stage, kits, kits, ''));
  return { engine, kits, stage, useKits, ok: !engine.errors.length && !kits.errors.length, errors };
}

// Lines of a section with their line numbers, without the lines that belong to kit sections.
const numbered = (section, inside) => section.lines.map((text, i) => ({ text, n: section.start + i })).filter(l => !inside.has(l.n - 1));

function compareShell(t, example, eKits, name) {
  return t.engine.sections.flatMap((section, n) => {
    const a = numbered(section, t.useKits ? t.kits.inside : new Set()), b = numbered(example.sections[n], t.useKits ? eKits.inside : new Set());
    const at = Array.from({ length: Math.max(a.length, b.length) }, (_, i) => i).find(i => a[i]?.text !== b[i]?.text);
    if (at === undefined) return [];
    const lineA = a[at]?.n ?? (a.at(-1)?.n ?? section.start) + 1, lineB = b[at]?.n ?? (b.at(-1)?.n ?? example.sections[n].start) + 1;
    return [`ENGINE section ${n + 1} differs from ${name}: template line ${lineA} (${name} line ${lineB}): `
      + `template ${show(a[at]?.text)} | ${name} ${show(b[at]?.text)}`];
  });
}

// Each kit section of the example: a kit the template has, the same lines, at the same place (same shell lines around it).
// The place is checked only when the shell matches (a shell difference changes the lines around a section too).
function compareKitSections(t, eKits, name, checkPlace) {
  const templateKitNames = new Set([...t.kits.sections.values()].map(sec => sec.kit));
  const issues = [];
  for (const [key, sec] of eKits.sections) {
    if (!templateKitNames.has(sec.kit)) { issues.push(`${name}: unknown kit "${sec.kit}" (KIT ${key}, line ${sec.start}); the template has ${[...templateKitNames].join(', ')}`); continue; }
    const ts = t.kits.sections.get(key);
    if (!ts) { issues.push(`${name}: KIT ${key} is not in the template`); continue; }
    const at = Array.from({ length: Math.max(ts.lines.length, sec.lines.length) }, (_, i) => i).find(i => ts.lines[i] !== sec.lines[i]);
    if (at !== undefined) {
      issues.push(`KIT ${key} differs from ${name}: template line ${ts.start + at} (${name} line ${sec.start + at}): template ${show(ts.lines[at])} | ${name} ${show(sec.lines[at])}`);
    }
    for (const side of checkPlace ? ['before', 'after'] : []) {
      if (ts.anchor[side] === sec.anchor[side]) continue;
      issues.push(`${name}: KIT ${key} is not where the template has it (line ${sec.start}): the shell line ${side} it is ${show(sec.anchor[side] ?? undefined)}, in the template ${show(ts.anchor[side] ?? undefined)}`);
      break;
    }
  }
  return issues;
}

// Compares an example with the template: the shell verbatim, each kit section verbatim and in place, and data-kits.
// `template` is a source (its own errors are then reported with a "template:" prefix) or parseTemplate()'s result
// (its errors are the caller's to report, once). What can still be checked is checked when one side has errors.
export function compareEngineSections(template, exampleSource, name) {
  const standalone = typeof template === 'string';
  const t = standalone ? parseTemplate(template) : template;
  const example = extractEngineSections(exampleSource), eKits = extractKitSections(exampleSource);
  const issues = [...(standalone ? [...t.engine.errors, ...t.errors].map(e => `template: ${e}`) : []), ...example.errors.map(e => `${name}: ${e}`)];
  if (t.useKits) issues.push(...eKits.errors.map(e => `${name}: ${e}`));
  const kitsOk = !t.useKits || (t.ok && !eKits.errors.length);
  const shell = t.ok && !example.errors.length && kitsOk ? compareShell(t, example, eKits, name) : null;
  if (shell) issues.push(...shell);
  if (!t.useKits) return issues;
  const stage = readStageKits(exampleSource);
  if (stage.error) issues.push(`${name}: ${stage.error}`);
  if (kitsOk) {
    issues.push(...compareKitSections(t, eKits, name, shell?.length === 0));
    if (!stage.error) issues.push(...checkKitListing(stage, eKits, t.kits, `${name}: `));
  }
  return issues;
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
  const parsed = parseTemplate(template);
  // The template's own problems, once. Its ENGINE banners matter only when there are examples to compare.
  const issues = [...(names.length ? parsed.engine.errors : []), ...parsed.errors];
  for (const name of names) issues.push(...compareEngineSections(parsed, await readFile(join(assets, name), 'utf8'), name));
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
