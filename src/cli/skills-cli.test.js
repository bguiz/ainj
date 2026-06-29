import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { run } from './skills-cli.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fakeDir(name) {
  return { name, isDirectory: () => true };
}

function mkDeps(entries, { throwEnoent = false } = {}) {
  const lines = [];
  return {
    _readdir: async () => {
      if (throwEnoent) {
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        throw err;
      }
      return entries;
    },
    _log: (l) => lines.push(l),
    lines,
  };
}

// ---------------------------------------------------------------------------
// Cycle 1 — lists skill names
// ---------------------------------------------------------------------------

describe('skills-cli run() — skill names', () => {
  it('prints each skill name on its own line', async () => {
    const deps = mkDeps([fakeDir('my-skill'), fakeDir('another-skill')]);
    await run([], deps);
    assert.deepEqual(deps.lines, ['my-skill', 'another-skill']);
  });

  it('ignores non-directory entries', async () => {
    const entries = [fakeDir('my-skill'), { name: 'README.md', isDirectory: () => false }];
    const deps = mkDeps(entries);
    await run([], deps);
    assert.deepEqual(deps.lines, ['my-skill']);
  });
});

// ---------------------------------------------------------------------------
// Cycle 2 — empty / missing directory prints sync:skills message
// ---------------------------------------------------------------------------

describe('skills-cli run() — empty or missing dir', () => {
  it('prints no skills found message when dir is empty', async () => {
    const deps = mkDeps([]);
    await run([], deps);
    assert.ok(deps.lines.some((l) => l.includes('No skills available.')));
  });

  it('prints no skills found message when dir is missing (ENOENT) — does not throw', async () => {
    const deps = mkDeps([], { throwEnoent: true });
    await assert.doesNotReject(() => run([], deps));
    const deps2 = mkDeps([], { throwEnoent: true });
    await run([], deps2);
    assert.ok(deps2.lines.some((l) => l.includes('No skills available.')));
  });
});
