#!/usr/bin/env node
import { realpathSync } from 'node:fs';
import { readdir, readFile, stat } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const languages = [
  { label: 'English', file: 'README.md' },
  { label: '한국어', file: 'README.ko.md' },
  { label: '日本語', file: 'README.ja.md' },
  { label: '简体中文', file: 'README.zh-CN.md' },
];

async function findReadmes(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    // Git internals and installed dependencies are not repository documentation.
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await findReadmes(path));
    else if (entry.isFile() && entry.name === 'README.md') files.push(path);
  }
  return files.sort();
}

function decodeTarget(value) {
  return value.replace(/&amp;/g, '&').replace(/\\([\\()[\] ])/g, '$1');
}

function trimUrl(value) {
  let url = value;
  // Stop at unmatched Markdown delimiters, including those followed by CJK text.
  // Balanced parentheses and brackets inside a URL remain part of the URL.
  for (const [open, close] of [['(', ')'], ['[', ']']]) {
    let depth = 0;
    for (let index = 0; index < url.length; index += 1) {
      if (url[index] === open) depth += 1;
      else if (url[index] === close) {
        if (depth === 0) {
          url = url.slice(0, index);
          break;
        }
        depth -= 1;
      }
    }
  }
  return decodeTarget(url.replace(/[.,;:!?。、「」]+$/u, ''));
}

function tableCells(line) {
  const text = line.trim().replace(/`+[^`]*`+/g, 'code').replace(/\\\|/g, 'escaped-pipe');
  if (!text.includes('|')) return null;
  return text.replace(/^\|/, '').replace(/\|$/, '').split('|').map(cell => cell.trim());
}

export function inspectReadme(source) {
  const text = source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
  const lines = text.split('\n');
  const prose = [...lines];
  const blocks = [];
  const issues = [];
  let fence = null;
  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if (!fence && match) {
      fence = { marker: match[1], info: match[2].trim(), body: [], line: index + 1 };
      prose[index] = '';
    } else if (fence) {
      prose[index] = '';
      if (match && match[1][0] === fence.marker[0]
          && match[1].length >= fence.marker.length && !match[2].trim()) {
        blocks.push({ info: fence.info, content: fence.body.join('\n') });
        fence = null;
      } else {
        fence.body.push(lines[index]);
      }
    }
  }
  if (fence) issues.push(`code blocks: unclosed fence at line ${fence.line}`);

  const tableRows = [];
  for (let index = 1; index < prose.length; index += 1) {
    const separator = tableCells(prose[index]);
    const header = tableCells(prose[index - 1]);
    if (!separator || !header || separator.length !== header.length
        || !separator.every(cell => /^:?-{3,}:?$/.test(cell))) continue;
    let rows = 1; // Count the header and body, excluding the separator.
    while (index + 1 < prose.length && tableCells(prose[index + 1])) {
      rows += 1;
      index += 1;
    }
    tableRows.push(rows);
  }

  // Ignore code examples when extracting actual Markdown/HTML links.
  const body = prose.join('\n').replace(/(`+)[\s\S]*?\1/g, '');
  const links = new Set();
  const images = new Set();
  // Starting at ]( also finds the outer link of a linked badge image.
  const destinations = /\]\(\s*(?:<([^>\n]+)>|((?:\\.|[^\s\\()]|\([^()\n]*\))+))(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^\n)]*\)))?\s*\)/g;
  for (const match of body.matchAll(destinations)) links.add(decodeTarget(match[1] ?? match[2]));
  const imageLinks = /!\[(?:\\.|[^\]\\])*\]\(\s*(?:<([^>\n]+)>|((?:\\.|[^\s\\()]|\([^()\n]*\))+))(?:[ \t]+(?:"[^"\n]*"|'[^'\n]*'|\([^\n)]*\)))?\s*\)/g;
  for (const match of body.matchAll(imageLinks)) images.add(decodeTarget(match[1] ?? match[2]));

  // Support reference-style links/images as well as inline destinations.
  const definitions = new Map();
  const referenceId = value => value.trim().replace(/\s+/g, ' ').toLowerCase();
  const definitionPattern = /^ {0,3}\[([^\]\n]+)\]:\s*(?:<([^>\n]+)>|(\S+))/gm;
  for (const match of body.matchAll(definitionPattern)) {
    const target = decodeTarget(match[2] ?? match[3]);
    definitions.set(referenceId(match[1]), target);
    links.add(target);
  }
  const references = /(!?)\[([^\]\n]+)\](?:\[([^\]\n]*)\])?/g;
  for (const match of body.matchAll(references)) {
    const id = referenceId(match[3] || match[2]);
    if (!definitions.has(id)) continue;
    const target = definitions.get(id);
    links.add(target);
    if (match[1]) images.add(target);
  }
  for (const tag of body.matchAll(/<(?:a|img)\b[^>]*>/gi)) {
    const image = /^<img\b/i.test(tag[0]);
    const attribute = image ? /\bsrc\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i
      : /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
    const match = tag[0].match(attribute);
    if (!match) continue;
    const target = decodeTarget(match[1] ?? match[2] ?? match[3]);
    links.add(target);
    if (image) images.add(target);
  }

  // Include bare URLs and URLs in code blocks, such as git clone commands.
  const urls = new Set([...text.matchAll(/https?:\/\/[^\s<>"'`]+/g)].map(match => trimUrl(match[0])));
  for (const target of links) if (/^https?:\/\//i.test(target)) urls.add(target);
  return { lines, blocks, tableRows, urls, images, links, issues };
}

export function checkLanguageSwitch(readme, currentFile) {
  const expected = languages.map(({ label, file }) => file === currentFile
    ? label : `[${label}](${file})`).join(' | ');
  if (!/^#\s+\S/.test(readme.lines[0])) return ['language switch: expected H1 on the first line'];
  // Allow up to two blank lines between the H1 and the language switch.
  const index = readme.lines.findIndex((line, number) => number >= 1 && number <= 3 && line.trim() === expected);
  if (index < 0 || readme.lines.slice(1, index).some(line => line.trim())) {
    return [`language switch: expected near line 2: ${expected}`];
  }
  return [];
}

function compareSets(label, english, translation) {
  const missing = [...english].filter(value => !translation.has(value)).sort();
  const extra = [...translation].filter(value => !english.has(value)).sort();
  if (!missing.length && !extra.length) return [];
  const details = [];
  if (missing.length) details.push(`missing ${JSON.stringify(missing)}`);
  if (extra.length) details.push(`extra ${JSON.stringify(extra)}`);
  return [`${label}: ${details.join('; ')}`];
}

export function compareReadmes(english, translation) {
  const issues = [];
  if (english.blocks.length !== translation.blocks.length) {
    issues.push(`code blocks: expected ${english.blocks.length}, found ${translation.blocks.length}`);
  }
  for (let index = 0; index < Math.min(english.blocks.length, translation.blocks.length); index += 1) {
    if (JSON.stringify(english.blocks[index]) !== JSON.stringify(translation.blocks[index])) {
      issues.push(`code blocks: block ${index + 1} differs from English (content or language tag)`);
    }
  }
  issues.push(...compareSets('HTTP(S) URLs', english.urls, translation.urls));
  issues.push(...compareSets('image paths', english.images, translation.images));
  if (JSON.stringify(english.tableRows) !== JSON.stringify(translation.tableRows)) {
    issues.push(`table rows: expected ${JSON.stringify(english.tableRows)}, found ${JSON.stringify(translation.tableRows)}`);
  }
  return issues;
}

async function checkRelativeLinks(path, links) {
  const issues = [];
  let checked = 0;
  for (const link of links) {
    if (!link || link.startsWith('#') || link.startsWith('//') || /^[a-z][a-z\d+.-]*:/i.test(link)) continue;
    const pathname = link.split(/[?#]/)[0];
    if (!pathname) continue;
    try {
      const target = pathname.startsWith('/')
        ? resolve(root, decodeURIComponent(pathname.slice(1)))
        : resolve(dirname(path), decodeURIComponent(pathname));
      if (!(await stat(target)).isFile()) throw new Error('target is not a file');
      checked += 1;
    } catch (error) {
      issues.push(`relative links: ${link} (${error.code ?? error.message})`);
    }
  }
  return { issues, checked };
}

async function main() {
  const canonicalFiles = await findReadmes(root);
  if (!canonicalFiles.length) throw new Error('No README.md files found');
  const issues = [];
  let translations = 0;
  let checkedLinks = 0;
  let checkedFiles = 0;
  for (const canonical of canonicalFiles) {
    let english;
    for (const { file } of languages) {
      const path = resolve(dirname(canonical), file);
      const display = relative(root, path);
      let source;
      try {
        source = await readFile(path, 'utf8');
      } catch (error) {
        issues.push(`${display}: file: ${error.code ?? error.message}`);
        continue;
      }
      const readme = inspectReadme(source);
      const fileIssues = [...readme.issues, ...checkLanguageSwitch(readme, file)];
      if (file === 'README.md') english = readme;
      else {
        translations += 1;
        if (english) fileIssues.push(...compareReadmes(english, readme));
      }
      const relativeLinks = await checkRelativeLinks(path, readme.links);
      checkedLinks += relativeLinks.checked;
      checkedFiles += 1;
      fileIssues.push(...relativeLinks.issues);
      issues.push(...fileIssues.map(issue => `${display}: ${issue}`));
    }
  }
  if (issues.length) {
    console.error(issues.join('\n'));
    console.error(`README translation check failed: ${issues.length} issue(s).`);
    process.exitCode = 1;
    return;
  }
  console.log(`README translations OK: ${canonicalFiles.length} English READMEs, ${translations} translations.`);
  console.log('Checks passed: code blocks, HTTP(S) URLs, image paths, table rows, language switches.');
  console.log(`Relative links OK: ${checkedLinks} targets across ${checkedFiles} READMEs.`);
}

// Compare real paths so a symbolic link to this file still runs it. A missing or unresolvable argv[1] means it was imported.
function isMain() {
  try { return realpathSync(process.argv[1]) === realpathSync(fileURLToPath(import.meta.url)); } catch { return false; }
}

if (isMain()) {
  main().catch(error => {
    console.error(`README translation check failed: ${error.message}`);
    process.exitCode = 1;
  });
}
