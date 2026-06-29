import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';

// ---------------------------------------------------------------------------
// Mutable delegates — each test swaps these to control behaviour
// ---------------------------------------------------------------------------

let readStateImpl = (_scope, _opts) => ({});
let execFileImpl = async (_bin, _args, _opts) => ({ stdout: '', stderr: '' });

const readStateMock = mock.fn((scope, opts) => readStateImpl(scope, opts));
const execFileAsyncMock = mock.fn(async (bin, args, opts) => execFileImpl(bin, args, opts));

let skills;

before(async () => {
  mock.module('../install/state.js', { namedExports: { readState: readStateMock } });
  mock.module('./exec.js', { namedExports: { execFileAsync: execFileAsyncMock } });
  ({ skills } = await import('./skills.js'));
});

after(() => {
  mock.restoreAll();
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withHarness(harness, extraGlobal = {}) {
  readStateImpl = (scope) =>
    scope === 'global' ? { defaultHarness: harness, ...extraGlobal } : {};
}

function captureExec(harness = 'claude') {
  withHarness(harness);
  const calls = [];
  execFileImpl = async (_bin, args) => {
    calls.push([...args]);
    if (args[0] === '--version') return { stdout: 'v1.0.0\n', stderr: '' };
    return { stdout: 'skill output', stderr: '' };
  };
  return calls;
}

function promptArgFrom(calls) {
  const skillCall = calls.find((a) => a[0] === '-p');
  assert.ok(skillCall, 'No -p call found in exec calls');
  return skillCall[1];
}

// ---------------------------------------------------------------------------
// Cycle 1 — tracer bullet: run with no params, SkillResult shape
// ---------------------------------------------------------------------------

describe('run() — SkillResult shape', () => {
  it('returns an object with all seven required fields', async () => {
    withHarness('claude');
    execFileImpl = async (_bin, args) => {
      if (args[0] === '--version') return { stdout: 'v1.0.0\n', stderr: '' };
      return { stdout: 'hello', stderr: '' };
    };

    const result = await skills.run('skill-x');

    assert.equal(typeof result.stdout, 'string');
    assert.equal(typeof result.stderr, 'string');
    assert.equal(typeof result.exitCode, 'number');
    assert.equal(typeof result.harness, 'string');
    assert.equal(typeof result.harnessVersion, 'string');
    assert.equal(typeof result.startTimestamp, 'number');
    assert.equal(typeof result.endTimestamp, 'number');
  });
});

// ---------------------------------------------------------------------------
// Cycle 2-3 — prompt construction
// ---------------------------------------------------------------------------

describe('prompt construction', () => {
  it('run("skill-x") passes prompt "/skill-x" — slash prefix, no trailing space', async () => {
    const calls = captureExec();

    await skills.run('skill-x');

    assert.equal(promptArgFrom(calls), '/skill-x');
  });

  it('run("skill-x", "a b c") passes prompt "/skill-x a b c"', async () => {
    const calls = captureExec();

    await skills.run('skill-x', 'a b c');

    assert.equal(promptArgFrom(calls), '/skill-x a b c');
  });

  it('run("skill-x", { key: "val" }) passes prompt \'/skill-x {"key":"val"}\'', async () => {
    const calls = captureExec();

    await skills.run('skill-x', { key: 'val' });

    assert.equal(promptArgFrom(calls), '/skill-x {"key":"val"}');
  });

  it('run("skill-x", null) passes prompt "/skill-x" — null treated same as no params', async () => {
    const calls = captureExec();

    await skills.run('skill-x', null);

    assert.equal(promptArgFrom(calls), '/skill-x');
  });
});

// ---------------------------------------------------------------------------
// Cycle 4 — no harness configured
// ---------------------------------------------------------------------------

describe('harness resolution — no harness', () => {
  it('throws with "ainj install" in the message when no harness is configured', async () => {
    readStateImpl = () => ({});

    await assert.rejects(
      () => skills.run('skill-x'),
      (err) => {
        assert.ok(
          err.message.includes('ainj install'),
          `Expected "ainj install" in error message, got: ${err.message}`,
        );
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// Cycle 5 — global-first, local fallback
// ---------------------------------------------------------------------------

describe('harness resolution — state priority', () => {
  it('uses defaultHarness from global state when present', async () => {
    readStateImpl = (scope) =>
      scope === 'global' ? { defaultHarness: 'claude' } : { defaultHarness: 'codex' };
    let invokedBin;
    execFileImpl = async (bin, args) => {
      if (args[0] === '--version') {
        invokedBin = bin;
        return { stdout: 'v1\n', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    };

    await skills.run('skill-x');

    assert.equal(invokedBin, 'claude');
  });

  it('falls back to local defaultHarness when global has none', async () => {
    readStateImpl = (scope) => (scope === 'global' ? {} : { defaultHarness: 'codex' });
    let invokedBin;
    execFileImpl = async (bin, args) => {
      if (args[0] === '--version') {
        invokedBin = bin;
        return { stdout: 'v1\n', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    };

    await skills.run('skill-x');

    assert.equal(invokedBin, 'codex');
  });
});

// ---------------------------------------------------------------------------
// Cycle 6 — non-zero exit captured as exitCode, does not reject
// ---------------------------------------------------------------------------

describe('non-zero harness exit', () => {
  it('captures exit code without rejecting', async () => {
    withHarness('claude');
    execFileImpl = async (_bin, args) => {
      if (args[0] === '--version') return { stdout: 'v1\n', stderr: '' };
      const err = Object.assign(new Error('exit 2'), {
        stdout: 'partial out',
        stderr: 'err text',
        code: 2,
      });
      throw err;
    };

    const result = await skills.run('skill-x');

    assert.equal(result.exitCode, 2);
    assert.equal(result.stdout, 'partial out');
    assert.equal(result.stderr, 'err text');
  });

  it('exitCode is 0 on success', async () => {
    withHarness('claude');
    execFileImpl = async (_bin, args) => {
      if (args[0] === '--version') return { stdout: 'v1\n', stderr: '' };
      return { stdout: 'out', stderr: '' };
    };

    const result = await skills.run('skill-x');

    assert.equal(result.exitCode, 0);
  });
});

// ---------------------------------------------------------------------------
// Cycle 7 — timestamps
// ---------------------------------------------------------------------------

describe('timestamps', () => {
  it('startTimestamp <= endTimestamp', async () => {
    withHarness('claude');
    execFileImpl = async (_bin, args) => {
      if (args[0] === '--version') return { stdout: 'v1\n', stderr: '' };
      return { stdout: '', stderr: '' };
    };

    const result = await skills.run('skill-x');

    assert.ok(
      result.startTimestamp <= result.endTimestamp,
      `startTimestamp (${result.startTimestamp}) should be <= endTimestamp (${result.endTimestamp})`,
    );
  });
});

// ---------------------------------------------------------------------------
// Cycle 8 — runWithClaude / runWithCodex explicit binary
// ---------------------------------------------------------------------------

describe('runWithClaude()', () => {
  it('invokes the claude binary regardless of state', async () => {
    readStateImpl = () => ({});
    let invokedBin;
    execFileImpl = async (bin, args) => {
      if (args[0] === '--version') {
        invokedBin = bin;
        return { stdout: 'v1\n', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    };

    await skills.runWithClaude('skill-x');

    assert.equal(invokedBin, 'claude');
  });

  it('returns a SkillResult with harness "claude"', async () => {
    readStateImpl = () => ({});
    execFileImpl = async (_bin, args) => {
      if (args[0] === '--version') return { stdout: 'v1\n', stderr: '' };
      return { stdout: '', stderr: '' };
    };

    const result = await skills.runWithClaude('skill-x');

    assert.equal(result.harness, 'claude');
  });
});

describe('runWithCodex()', () => {
  it('invokes the codex binary regardless of state', async () => {
    readStateImpl = () => ({});
    let invokedBin;
    execFileImpl = async (bin, args) => {
      if (args[0] === '--version') {
        invokedBin = bin;
        return { stdout: 'v1\n', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    };

    await skills.runWithCodex('skill-x');

    assert.equal(invokedBin, 'codex');
  });

  it('returns a SkillResult with harness "codex"', async () => {
    readStateImpl = () => ({});
    execFileImpl = async (_bin, args) => {
      if (args[0] === '--version') return { stdout: 'v1\n', stderr: '' };
      return { stdout: '', stderr: '' };
    };

    const result = await skills.runWithCodex('skill-x');

    assert.equal(result.harness, 'codex');
  });
});

// ---------------------------------------------------------------------------
// Cycle 9 — unknown harness name
// ---------------------------------------------------------------------------

describe('unknown harness', () => {
  it('throws a descriptive error for an unknown harness name', async () => {
    readStateImpl = (scope) => (scope === 'global' ? { defaultHarness: 'unknownbot' } : {});

    await assert.rejects(
      () => skills.run('skill-x'),
      (err) => {
        assert.ok(
          err.message.includes('unknownbot'),
          `Expected harness name in error message, got: ${err.message}`,
        );
        return true;
      },
    );
  });
});

// ---------------------------------------------------------------------------
// harnessVersion fallback
// ---------------------------------------------------------------------------

describe('harnessVersion', () => {
  it('falls back to "unknown" when --version call fails', async () => {
    withHarness('claude');
    execFileImpl = async (_bin, args) => {
      if (args[0] === '--version') throw new Error('version command failed');
      return { stdout: 'out', stderr: '' };
    };

    const result = await skills.run('skill-x');

    assert.equal(result.harnessVersion, 'unknown');
  });

  it('returns trimmed version string on success', async () => {
    withHarness('claude');
    execFileImpl = async (_bin, args) => {
      if (args[0] === '--version') return { stdout: '1.2.3\n', stderr: '' };
      return { stdout: '', stderr: '' };
    };

    const result = await skills.run('skill-x');

    assert.equal(result.harnessVersion, '1.2.3');
  });
});

// ---------------------------------------------------------------------------
// Timeout forwarding
// ---------------------------------------------------------------------------

describe('timeout — opts.timeout forwarded to skill call', () => {
  it('passes opts.timeout as the timeout option to the skill execFileAsync call', async () => {
    withHarness('claude');
    let skillCallOpts;
    execFileImpl = async (_bin, args, opts) => {
      if (args[0] === '--version') return { stdout: 'v1\n', stderr: '' };
      skillCallOpts = opts;
      return { stdout: '', stderr: '' };
    };

    await skills.run('skill-x', undefined, { timeout: 1234 });

    assert.equal(skillCallOpts?.timeout, 1234);
  });

  it('uses 60_000 ms as the default timeout when opts.timeout is not provided', async () => {
    withHarness('claude');
    let skillCallOpts;
    execFileImpl = async (_bin, args, opts) => {
      if (args[0] === '--version') return { stdout: 'v1\n', stderr: '' };
      skillCallOpts = opts;
      return { stdout: '', stderr: '' };
    };

    await skills.run('skill-x');

    assert.equal(skillCallOpts?.timeout, 60_000);
  });
});

// ---------------------------------------------------------------------------
// Version probe timeout
// ---------------------------------------------------------------------------

describe('timeout — --version probe uses fixed 5_000 ms', () => {
  it('passes 5_000 as timeout to the --version call regardless of opts.timeout', async () => {
    withHarness('claude');
    let versionCallOpts;
    execFileImpl = async (_bin, args, opts) => {
      if (args[0] === '--version') {
        versionCallOpts = opts;
        return { stdout: 'v1\n', stderr: '' };
      }
      return { stdout: '', stderr: '' };
    };

    await skills.run('skill-x', undefined, { timeout: 99_999 });

    assert.equal(versionCallOpts?.timeout, 5_000);
  });
});

// ---------------------------------------------------------------------------
// Timeout propagation
// ---------------------------------------------------------------------------

describe('timeout — propagates when skill call times out', () => {
  it('rejects with the original error when err.killed is true', async () => {
    withHarness('claude');
    execFileImpl = async (_bin, args) => {
      if (args[0] === '--version') return { stdout: 'v1\n', stderr: '' };
      const err = Object.assign(new Error('SIGTERM'), { killed: true, code: null });
      throw err;
    };

    await assert.rejects(
      () => skills.run('skill-x'),
      (err) => {
        assert.ok(err.killed, 'expected err.killed to be true on the propagated error');
        return true;
      },
    );
  });
});
