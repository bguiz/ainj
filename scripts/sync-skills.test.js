import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { syncSkills } from './sync-skills.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function asyncNoop() {}

function makeMinimalDeps(skillsRef = 'main', token) {
  return {
    _readFile: async () => JSON.stringify({ skillsRef }),
    _spawn: () => ({ status: 0, stderr: Buffer.from('') }),
    _cp: asyncNoop,
    _rm: asyncNoop,
    _mkdir: asyncNoop,
    _mkdtemp: async () => '/tmp/ainj-skills-test',
    _env: token ? { GITHUB_TOKEN: token } : {},
    _cwd: () => '/project',
  };
}

// ---------------------------------------------------------------------------
// Cycle 1 — missing skillsRef throws
// ---------------------------------------------------------------------------

describe('syncSkills() — missing skillsRef', () => {
  it('throws with message referencing skillsRef when key is absent', async () => {
    await assert.rejects(
      () => syncSkills({ _readFile: async () => '{}' }),
      /skillsRef/,
    );
  });
});

// ---------------------------------------------------------------------------
// Cycle A — git clone called with correct args
// ---------------------------------------------------------------------------

describe('syncSkills() — git clone args', () => {
  it('calls _spawn with "git" as the command', async () => {
    let capturedCmd;
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: (cmd, ...rest) => { capturedCmd = cmd; return { status: 0, stderr: Buffer.from('') }; },
    };
    await syncSkills(deps);
    assert.equal(capturedCmd, 'git');
  });

  it('passes "clone" as the first git argument', async () => {
    let capturedArgs;
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: (cmd, args) => { capturedArgs = args; return { status: 0, stderr: Buffer.from('') }; },
    };
    await syncSkills(deps);
    assert.ok(capturedArgs.includes('clone'), `expected args to include "clone", got: ${JSON.stringify(capturedArgs)}`);
  });

  it('passes the skillsRef value to git clone', async () => {
    let capturedArgs;
    const deps = {
      ...makeMinimalDeps('abc123'),
      _spawn: (cmd, args) => { capturedArgs = args; return { status: 0, stderr: Buffer.from('') }; },
    };
    await syncSkills(deps);
    assert.ok(
      capturedArgs.includes('abc123'),
      `expected args to include "abc123", got: ${JSON.stringify(capturedArgs)}`,
    );
  });

  it('clones the InjectiveLabs/agent-skills repo', async () => {
    let capturedArgs;
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: (cmd, args) => { capturedArgs = args; return { status: 0, stderr: Buffer.from('') }; },
    };
    await syncSkills(deps);
    assert.ok(
      capturedArgs.some((a) => a.includes('InjectiveLabs/agent-skills')),
      `expected an arg containing "InjectiveLabs/agent-skills", got: ${JSON.stringify(capturedArgs)}`,
    );
  });

  it('passes --depth=1 to limit clone size', async () => {
    let capturedArgs;
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: (cmd, args) => { capturedArgs = args; return { status: 0, stderr: Buffer.from('') }; },
    };
    await syncSkills(deps);
    assert.ok(
      capturedArgs.includes('--depth=1'),
      `expected "--depth=1" in args, got: ${JSON.stringify(capturedArgs)}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Cycle B — git clone failure throws
// ---------------------------------------------------------------------------

describe('syncSkills() — git clone failure', () => {
  it('rejects when git clone returns a non-zero exit code', async () => {
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: () => ({ status: 128, stderr: Buffer.from('auth failed') }),
    };
    await assert.rejects(() => syncSkills(deps));
  });

  it('error message includes the exit code', async () => {
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: () => ({ status: 128, stderr: Buffer.from('') }),
    };
    await assert.rejects(() => syncSkills(deps), /128/);
  });

  it('error message includes stderr output', async () => {
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: () => ({ status: 1, stderr: Buffer.from('Repository not found') }),
    };
    await assert.rejects(() => syncSkills(deps), /Repository not found/);
  });
});

// ---------------------------------------------------------------------------
// Cycle C — GITHUB_TOKEN embedded in clone URL
// Cycle D — no token → plain URL
// ---------------------------------------------------------------------------

describe('syncSkills() — clone URL credentials', () => {
  it('embeds GITHUB_TOKEN in the clone URL when set', async () => {
    let cloneUrl;
    const deps = {
      ...makeMinimalDeps('main', 'ghp_secret'),
      _spawn: (cmd, args) => {
        cloneUrl = args.find((a) => a.startsWith('https://'));
        return { status: 0, stderr: Buffer.from('') };
      },
    };
    await syncSkills(deps);
    assert.ok(cloneUrl, 'no https URL found in spawn args');
    assert.ok(
      cloneUrl.includes('ghp_secret@github.com'),
      `expected token in URL, got: ${cloneUrl}`,
    );
  });

  it('uses plain https URL when GITHUB_TOKEN is absent', async () => {
    let cloneUrl;
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: (cmd, args) => {
        cloneUrl = args.find((a) => a.startsWith('https://'));
        return { status: 0, stderr: Buffer.from('') };
      },
    };
    await syncSkills(deps);
    assert.ok(cloneUrl, 'no https URL found in spawn args');
    assert.ok(
      !cloneUrl.includes('@github.com'),
      `expected plain URL without credentials, got: ${cloneUrl}`,
    );
    assert.ok(cloneUrl.includes('github.com/InjectiveLabs/agent-skills'));
  });
});

// ---------------------------------------------------------------------------
// Cycle E — cp called with correct src/dest paths
// ---------------------------------------------------------------------------

describe('syncSkills() — cp paths', () => {
  it('copies from <tmpDir>/skills into .agents/skills', async () => {
    const tmpPath = '/tmp/ainj-skills-xyz';
    let cpSrc, cpDest;
    const deps = {
      ...makeMinimalDeps('main'),
      _mkdtemp: async () => tmpPath,
      _cp: async (src, dest) => { cpSrc = src; cpDest = dest; },
    };
    await syncSkills(deps);
    assert.ok(cpSrc, '_cp was never called');
    assert.ok(
      cpSrc.endsWith(path.join(tmpPath, 'skills')),
      `expected src to be <tmpDir>/skills, got: ${cpSrc}`,
    );
    assert.ok(
      cpDest.endsWith(path.join('.agents', 'skills')),
      `expected dest to end with .agents/skills, got: ${cpDest}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Cycle F — rm .agents/skills/ called before cp
// ---------------------------------------------------------------------------

describe('syncSkills() — wipe before copy', () => {
  it('calls rm on .agents/skills before cp', async () => {
    const callOrder = [];
    const deps = {
      ...makeMinimalDeps('main'),
      _rm: async (p) => { if (p.endsWith(path.join('.agents', 'skills'))) callOrder.push('rm-skills'); },
      _cp: async () => { callOrder.push('cp'); },
    };
    await syncSkills(deps);
    const rmIdx = callOrder.indexOf('rm-skills');
    const cpIdx = callOrder.indexOf('cp');
    assert.ok(rmIdx !== -1, 'rm of .agents/skills was never called');
    assert.ok(cpIdx !== -1, 'cp was never called');
    assert.ok(rmIdx < cpIdx, `rm-skills (${rmIdx}) must precede cp (${cpIdx})`);
  });

  it('calls rm with recursive:true and force:true on .agents/skills', async () => {
    let rmArgs;
    const deps = {
      ...makeMinimalDeps('main'),
      _rm: async (...args) => {
        if (args[0].endsWith(path.join('.agents', 'skills'))) rmArgs = args;
      },
    };
    await syncSkills(deps);
    assert.ok(rmArgs, 'rm on .agents/skills was never called');
    assert.equal(rmArgs[1]?.recursive, true);
    assert.equal(rmArgs[1]?.force, true);
  });
});

// ---------------------------------------------------------------------------
// Cycle G — tmpdir removed after sync
// ---------------------------------------------------------------------------

describe('syncSkills() — tmpdir cleanup', () => {
  it('removes the tmpdir after a successful clone', async () => {
    const tmpPath = '/tmp/ainj-skills-cleanup';
    const rmPaths = [];
    const deps = {
      ...makeMinimalDeps('main'),
      _mkdtemp: async () => tmpPath,
      _rm: async (p) => { rmPaths.push(p); },
    };
    await syncSkills(deps);
    assert.ok(
      rmPaths.includes(tmpPath),
      `expected tmpPath "${tmpPath}" to be in rm calls, got: ${JSON.stringify(rmPaths)}`,
    );
  });

  it('removes the tmpdir even when clone fails', async () => {
    const tmpPath = '/tmp/ainj-skills-cleanup-fail';
    const rmPaths = [];
    const deps = {
      ...makeMinimalDeps('main'),
      _mkdtemp: async () => tmpPath,
      _spawn: () => ({ status: 1, stderr: Buffer.from('fail') }),
      _rm: async (p) => { rmPaths.push(p); },
    };
    await assert.rejects(() => syncSkills(deps));
    assert.ok(
      rmPaths.includes(tmpPath),
      `expected tmpPath "${tmpPath}" to be removed even on failure, got: ${JSON.stringify(rmPaths)}`,
    );
  });
});
