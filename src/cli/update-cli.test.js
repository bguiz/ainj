import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { run } from './update-cli.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkDeps(state = {}) {
  const calls = [];
  return {
    _readState: () => state,
    _spawnSync: (cmd, args, _opts) => calls.push([cmd, ...args]),
    calls,
  };
}

// ---------------------------------------------------------------------------
// Cycle 1 — global scope installs with -g flag
// ---------------------------------------------------------------------------

describe('update-cli run() — global scope', () => {
  it('runs npm install -g ainj@latest', async () => {
    const deps = mkDeps({ scope: 'global' });
    await run([], deps);
    assert.equal(deps.calls.length, 1);
    assert.deepEqual(deps.calls[0], ['npm', 'install', '-g', 'ainj@latest']);
  });
});

// ---------------------------------------------------------------------------
// Cycle 2 — local scope installs without -g flag
// ---------------------------------------------------------------------------

describe('update-cli run() — local scope', () => {
  it('runs npm install ainj@latest (no -g)', async () => {
    const deps = mkDeps({ scope: 'local' });
    await run([], deps);
    assert.equal(deps.calls.length, 1);
    assert.deepEqual(deps.calls[0], ['npm', 'install', 'ainj@latest']);
  });
});

// ---------------------------------------------------------------------------
// Cycle 3 — empty state defaults to global
// ---------------------------------------------------------------------------

describe('update-cli run() — empty state defaults to global', () => {
  it('runs npm install -g ainj@latest when scope is absent', async () => {
    const deps = mkDeps({});
    await run([], deps);
    assert.ok(deps.calls[0].includes('-g'));
  });
});
