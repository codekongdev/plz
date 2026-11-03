import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const assets = join(dirname(fileURLToPath(import.meta.url)), '..', 'skills', 'plz-3d-explain', 'assets');
const pages = ['template.html', 'example-agent-sandbox.html', 'example-agent-sandbox.en.html'];
const stackedQuery = '@media (max-width: 860px) and (orientation: portrait)';

// Remove CSS comments so a rule quoted inside a comment cannot satisfy a check.
const stripComments = (css) => css.replace(/\/\*[\s\S]*?\*\//g, '');

// Return the text inside the braces of the first at-rule whose prelude starts with `prelude`.
function blockBody(css, prelude) {
  const start = css.indexOf(prelude);
  if (start === -1) return null;
  const open = css.indexOf('{', start);
  let depth = 0;
  for (let i = open; i < css.length; i++) {
    if (css[i] === '{') depth++;
    if (css[i] === '}' && --depth === 0) return css.slice(open + 1, i);
  }
  return null;
}

for (const page of pages) {
  test(`stacked stage reserves scroll padding and code blocks show focus in ${page}`, async () => {
    const css = stripComments(await readFile(join(assets, page), 'utf8'));
    const stacked = blockBody(css, stackedQuery);
    assert.ok(stacked, `missing ${stackedQuery} block in ${page}`);
    assert.match(
      stacked,
      /(?:^|[\s,}])html\s*\{[^}]*scroll-padding-top:\s*var\(--stage-h\)/,
      `missing html scroll-padding-top: var(--stage-h) inside the stacked media query in ${page}`,
    );
    assert.match(
      css,
      /(?:^|[\s,}])pre\.code:focus-visible\s*\{[^}]*outline:/,
      `missing pre.code:focus-visible outline in ${page}`,
    );
    if (page !== 'template.html') {
      const markup = await readFile(join(assets, page), 'utf8');
      const codeBlocks = [...markup.matchAll(/<pre class="code"([^>]*)>/g)];
      assert.ok(codeBlocks.length > 0, `missing code blocks in ${page}`);
      const labels = [];
      for (const [, attributes] of codeBlocks) {
        assert.match(attributes, /\btabindex="0"/, `code block is not keyboard-focusable in ${page}`);
        assert.match(attributes, /\brole="region"/, `code block is missing region semantics in ${page}`);
        const label = attributes.match(/\baria-label="([^"]+)"/);
        assert.ok(label, `code block is missing an accessible name in ${page}`);
        labels.push(label[1]);
      }
      assert.equal(new Set(labels).size, labels.length, `code block names must be distinct in ${page}`);
    }
  });
}
