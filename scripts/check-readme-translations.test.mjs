import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const script = join(dirname(fileURLToPath(import.meta.url)), 'check-readme-translations.mjs');

// Only checks that the script runs at all, so the result does not depend on the current README state.
test('running through a symbolic link still runs the check and prints a result', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'check-readme-link-'));
  try {
    const link = join(dir, 'linked-check-readme-translations.mjs');
    await symlink(script, link);
    const run = spawnSync(process.execPath, [link], { encoding: 'utf8' });
    assert.match(`${run.stdout}${run.stderr}`, /README translations (OK|check failed)/);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
