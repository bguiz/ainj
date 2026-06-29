import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { syncSkills } from './sync-skills.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function asyncNoop() {}

function makeMinimalDeps(skillsRef, token) {
  return {
    _readFile: async () => JSON.stringify({ skillsRef: skillsRef ?? 'main' }),
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
// Cycle 1: missing skillsRef throws
// ---------------------------------------------------------------------------

describe('syncSkills(): missing skillsRef', () => {
  it('throws with message referencing skillsRef when key is absent', async () => {
    await assert.rejects(() => syncSkills({ _readFile: async () => '{}' }), /skillsRef/);
  });
});

// ---------------------------------------------------------------------------
// Cycle A: git fetch called with correct args
// ---------------------------------------------------------------------------

describe('syncSkills(): git fetch args', () => {
  it('calls _spawn with "git" as the command', async () => {
    let capturedCmd;
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: (cmd, ...rest) => {
        capturedCmd = cmd;
        return { status: 0, stderr: Buffer.from('') };
      },
    };
    await syncSkills(deps);
    assert.equal(capturedCmd, 'git');
  });

  it('initializes the temporary git repository', async () => {
    const calls = [];
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: (cmd, args) => {
        calls.push(args);
        return { status: 0, stderr: Buffer.from('') };
      },
    };
    await syncSkills(deps);
    assert.deepEqual(calls[0], ['init', '/tmp/ainj-skills-test']);
  });

  it('fetches the skillsRef value', async () => {
    const calls = [];
    const deps = {
      ...makeMinimalDeps('abc123'),
      _spawn: (cmd, args) => {
        calls.push(args);
        return { status: 0, stderr: Buffer.from('') };
      },
    };
    await syncSkills(deps);
    const fetchArgs = calls.find((args) => args.includes('fetch'));
    assert.ok(
      fetchArgs?.includes('abc123'),
      `expected fetch args to include "abc123", got: ${JSON.stringify(calls)}`,
    );
  });

  it('adds the InjectiveLabs/agent-skills remote', async () => {
    const calls = [];
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: (cmd, args) => {
        calls.push(args);
        return { status: 0, stderr: Buffer.from('') };
      },
    };
    await syncSkills(deps);
    const remoteArgs = calls.find((args) => args.includes('remote'));
    assert.ok(
      remoteArgs?.some((a) => a.includes('InjectiveLabs/agent-skills')),
      `expected a remote arg containing "InjectiveLabs/agent-skills", got: ${JSON.stringify(calls)}`,
    );
  });

  it('passes --depth=1 to limit fetch size', async () => {
    const calls = [];
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: (cmd, args) => {
        calls.push(args);
        return { status: 0, stderr: Buffer.from('') };
      },
    };
    await syncSkills(deps);
    const fetchArgs = calls.find((args) => args.includes('fetch'));
    assert.ok(
      fetchArgs?.includes('--depth=1'),
      `expected "--depth=1" in fetch args, got: ${JSON.stringify(calls)}`,
    );
  });
});

// ---------------------------------------------------------------------------
// Cycle B: git fetch failure throws
// ---------------------------------------------------------------------------

describe('syncSkills(): git fetch failure', () => {
  it('rejects when git fetch returns a non-zero exit code', async () => {
    let callCount = 0;
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: () => {
        callCount += 1;
        return callCount === 3
          ? { status: 128, stderr: Buffer.from('auth failed') }
          : { status: 0, stderr: Buffer.from('') };
      },
    };
    await assert.rejects(() => syncSkills(deps));
  });

  it('error message includes the exit code', async () => {
    let callCount = 0;
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: () => {
        callCount += 1;
        return callCount === 3
          ? { status: 128, stderr: Buffer.from('') }
          : { status: 0, stderr: Buffer.from('') };
      },
    };
    await assert.rejects(() => syncSkills(deps), /128/);
  });

  it('error message includes stderr output', async () => {
    let callCount = 0;
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: () => {
        callCount += 1;
        return callCount === 3
          ? { status: 1, stderr: Buffer.from('Repository not found') }
          : { status: 0, stderr: Buffer.from('') };
      },
    };
    await assert.rejects(() => syncSkills(deps), /Repository not found/);
  });
});

// ---------------------------------------------------------------------------
// Cycle C: GITHUB_TOKEN embedded in remote URL
// Cycle D: no token means plain URL
// ---------------------------------------------------------------------------

describe('syncSkills(): remote URL credentials', () => {
  it('embeds GITHUB_TOKEN in the remote URL when set', async () => {
    let remoteUrl;
    const deps = {
      ...makeMinimalDeps('main', 'ghp_secret'),
      _spawn: (cmd, args) => {
        remoteUrl = args.find((a) => a.startsWith('https://')) ?? remoteUrl;
        return { status: 0, stderr: Buffer.from('') };
      },
    };
    await syncSkills(deps);
    assert.ok(remoteUrl, 'no https URL found in spawn args');
    assert.ok(
      remoteUrl.includes('ghp_secret@github.com'),
      `expected token in URL, got: ${remoteUrl}`,
    );
  });

  it('uses plain https URL when GITHUB_TOKEN is absent', async () => {
    let remoteUrl;
    const deps = {
      ...makeMinimalDeps('main'),
      _spawn: (cmd, args) => {
        remoteUrl = args.find((a) => a.startsWith('https://')) ?? remoteUrl;
        return { status: 0, stderr: Buffer.from('') };
      },
    };
    await syncSkills(deps);
    assert.ok(remoteUrl, 'no https URL found in spawn args');
    assert.ok(
      !remoteUrl.includes('@github.com'),
      `expected plain URL without credentials, got: ${remoteUrl}`,
    );
    assert.ok(remoteUrl.includes('github.com/InjectiveLabs/agent-skills'));
  });
});

// ---------------------------------------------------------------------------
// Cycle E: cp called with correct src/dest paths
// ---------------------------------------------------------------------------

describe('syncSkills(): cp paths', () => {
  it('copies from <tmpDir>/skills into .agents/skills', async () => {
    const tmpPath = '/tmp/ainj-skills-xyz';
    let cpSrc;
    let cpDest;
    const deps = {
      ...makeMinimalDeps('main'),
      _mkdtemp: async () => tmpPath,
      _cp: async (src, dest) => {
        cpSrc = src;
        cpDest = dest;
      },
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
// Cycle F: rm .agents/skills/ called before cp
// ---------------------------------------------------------------------------

describe('syncSkills(): wipe before copy', () => {
  it('calls rm on .agents/skills before cp', async () => {
    const callOrder = [];
    const deps = {
      ...makeMinimalDeps('main'),
      _rm: async (p) => {
        if (p.endsWith(path.join('.agents', 'skills'))) callOrder.push('rm-skills');
      },
      _cp: async () => {
        callOrder.push('cp');
      },
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
// Cycle G: tmpdir removed after sync
// ---------------------------------------------------------------------------

describe('syncSkills(): tmpdir cleanup', () => {
  it('removes the tmpdir after a successful clone', async () => {
    const tmpPath = '/tmp/ainj-skills-cleanup';
    const rmPaths = [];
    const deps = {
      ...makeMinimalDeps('main'),
      _mkdtemp: async () => tmpPath,
      _rm: async (p) => {
        rmPaths.push(p);
      },
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
      _rm: async (p) => {
        rmPaths.push(p);
      },
    };
    await assert.rejects(() => syncSkills(deps));
    assert.ok(
      rmPaths.includes(tmpPath),
      `expected tmpPath "${tmpPath}" to be removed even on failure, got: ${JSON.stringify(rmPaths)}`,
    );
  });
});
