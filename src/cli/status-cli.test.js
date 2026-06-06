import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { run } from './status-cli.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mkDeps(state = {}, skillEntries = [], { throwEnoent = false } = {}) {
  const lines = [];
  return {
    _readState: () => state,
    _readdir: async () => {
      if (throwEnoent) {
        const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
        throw err;
      }
      return skillEntries;
    },
    _log: (l) => lines.push(l),
    lines,
  };
}

function fakeDir(name) {
  return { name, isDirectory: () => true };
}

// ---------------------------------------------------------------------------
// Cycle 1 — readState called once with 'global'
// ---------------------------------------------------------------------------

describe('status-cli run() — readState', () => {
  it('calls readState exactly once with "global"', async () => {
    let callCount = 0;
    let calledWith;
    const deps = mkDeps();
    deps._readState = (scope) => { callCount++; calledWith = scope; return {}; };

    await run([], deps);

    assert.equal(callCount, 1);
    assert.equal(calledWith, 'global');
  });
});

// ---------------------------------------------------------------------------
// Cycle 2 — output: version line
// ---------------------------------------------------------------------------

describe('status-cli run() — version line', () => {
  it('prints a line starting with "version:"', async () => {
    const deps = mkDeps();
    await run([], deps);
    assert.ok(deps.lines.some((l) => l.startsWith('version:')));
  });
});

// ---------------------------------------------------------------------------
// Cycle 3 — output: scope line
// ---------------------------------------------------------------------------

describe('status-cli run() — scope line', () => {
  it('prints scope from state', async () => {
    const deps = mkDeps({ scope: 'global' });
    await run([], deps);
    assert.ok(deps.lines.includes('scope: global'));
  });
});

// ---------------------------------------------------------------------------
// Cycle 4 — output: ports line
// ---------------------------------------------------------------------------

describe('status-cli run() — ports line', () => {
  it('prints main and docs ports', async () => {
    const deps = mkDeps({ ports: { main: 3001, docs: 3002 } });
    await run([], deps);
    assert.ok(deps.lines.includes('ports: main=3001, docs=3002'));
  });
});

// ---------------------------------------------------------------------------
// Cycle 5 — output: harnesses line
// ---------------------------------------------------------------------------

describe('status-cli run() — harnesses line', () => {
  it('prints comma-separated harnesses', async () => {
    const deps = mkDeps({ harnesses: ['claude', 'codex'] });
    await run([], deps);
    assert.ok(deps.lines.includes('harnesses: claude, codex'));
  });

  it('prints (none) for empty harnesses array', async () => {
    const deps = mkDeps({ harnesses: [] });
    await run([], deps);
    assert.ok(deps.lines.includes('harnesses: (none)'));
  });

  it('prints (none) when harnesses key is absent', async () => {
    const deps = mkDeps({});
    await run([], deps);
    assert.ok(deps.lines.includes('harnesses: (none)'));
  });
});

// ---------------------------------------------------------------------------
// Cycle 6 — output: default harness line
// ---------------------------------------------------------------------------

describe('status-cli run() — default harness line', () => {
  it('prints default harness from state', async () => {
    const deps = mkDeps({ defaultHarness: 'claude' });
    await run([], deps);
    assert.ok(deps.lines.includes('default harness: claude'));
  });
});

// ---------------------------------------------------------------------------
// Cycle 7 — output: skills line
// ---------------------------------------------------------------------------

describe('status-cli run() — skills line', () => {
  it('prints comma-separated skill names', async () => {
    const deps = mkDeps({}, [fakeDir('foo'), fakeDir('bar')]);
    await run([], deps);
    assert.ok(deps.lines.includes('skills: foo, bar'));
  });

  it('prints (none) when skills dir is empty', async () => {
    const deps = mkDeps({}, []);
    await run([], deps);
    assert.ok(deps.lines.includes('skills: (none)'));
  });

  it('prints (none) when skills dir is missing (ENOENT) — does not throw', async () => {
    const deps = mkDeps({}, [], { throwEnoent: true });
    await assert.doesNotReject(() => run([], deps));
    // run separately to capture lines
    const deps2 = mkDeps({}, [], { throwEnoent: true });
    await run([], deps2);
    assert.ok(deps2.lines.includes('skills: (none)'));
  });

  it('ignores non-directory entries in skills dir', async () => {
    const entries = [
      fakeDir('my-skill'),
      { name: 'README.md', isDirectory: () => false },
    ];
    const deps = mkDeps({}, entries);
    await run([], deps);
    assert.ok(deps.lines.includes('skills: my-skill'));
  });
});
