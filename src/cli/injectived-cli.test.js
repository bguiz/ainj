// @integration tests are marked below and skipped when injective-core is absent

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import EventEmitter from 'node:events';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { after, before, describe, it, mock } from 'node:test';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------------------
// mock.module() must be called inside the test runner context (before hook),
// not at module-evaluation time. Dynamic import of the module under test
// follows so it receives the mocked dependencies.
// ---------------------------------------------------------------------------

const FAKE_BIN = '/fake/injectived';

// Mutable box: tests set .code before calling run() to control the fake exit
const fakeExit = { code: 0 };

const spawnMock = mock.fn((_bin, _args, _opts) => {
  const code = fakeExit.code;
  const child = new EventEmitter();
  setImmediate(() => child.emit('close', code));
  return child;
});

// Check whether injective-core is installed (governs integration test skip)
let isInjectiveCoreInstalled = false;
try {
  createRequire(import.meta.url).resolve('injective-core/package.json');
  isInjectiveCoreInstalled = true;
} catch {
  // not installed — integration tests will be skipped
}

let run;

before(async () => {
  mock.module('node:child_process', {
    namedExports: { spawn: spawnMock },
  });

  mock.module('../lib/cli.js', {
    namedExports: {
      resolveBinary: () => FAKE_BIN,
      cli: async () => ({ stdout: '', stderr: '' }),
    },
  });

  // Load the module under test AFTER the mocks are registered
  ({ run } = await import('./injectived-cli.js'));
});

after(() => {
  mock.restoreAll();
});

// ---------------------------------------------------------------------------
// Cycle 1 — arg forwarding
// ---------------------------------------------------------------------------

describe('run() — arg forwarding', () => {
  it('forwards supplied args array to spawn', async (t) => {
    const savedExit = process.exit;
    process.exit = () => {};
    t.after(() => {
      process.exit = savedExit;
    });
    spawnMock.mock.resetCalls();
    fakeExit.code = 0;

    await run(['query', 'bank']);

    assert.equal(spawnMock.mock.callCount(), 1);
    const [binArg, argsArg] = spawnMock.mock.calls[0].arguments;
    assert.equal(binArg, FAKE_BIN);
    assert.deepEqual(argsArg, ['query', 'bank']);
  });

  // ---------------------------------------------------------------------------
  // Cycle 2 — empty args array
  // ---------------------------------------------------------------------------

  it('calls spawn with empty args array when run([]) is invoked', async (t) => {
    const savedExit = process.exit;
    let capturedCode;
    process.exit = (code) => {
      capturedCode = code;
    };
    t.after(() => {
      process.exit = savedExit;
    });
    spawnMock.mock.resetCalls();
    fakeExit.code = 0;

    await run([]);

    assert.equal(spawnMock.mock.callCount(), 1);
    const [, argsArg] = spawnMock.mock.calls[0].arguments;
    assert.deepEqual(argsArg, []);
    assert.equal(capturedCode, 0);
  });
});

// ---------------------------------------------------------------------------
// Cycle 3 — exit code forwarding
// ---------------------------------------------------------------------------

describe('run() — exit code forwarding', () => {
  it('forwards exit code 0 to process.exit', async (t) => {
    const savedExit = process.exit;
    let capturedCode;
    process.exit = (code) => {
      capturedCode = code;
    };
    t.after(() => {
      process.exit = savedExit;
    });
    fakeExit.code = 0;

    await run([]);

    assert.equal(capturedCode, 0);
  });

  it('forwards non-zero exit code to process.exit', async (t) => {
    const savedExit = process.exit;
    let capturedCode;
    process.exit = (code) => {
      capturedCode = code;
    };
    t.after(() => {
      process.exit = savedExit;
    });
    fakeExit.code = 2;

    await run(['anything']);

    assert.equal(capturedCode, 2);
  });
});

// ---------------------------------------------------------------------------
// Cycle 4 — @integration: spawns the real ainj CLI as a subprocess
// ---------------------------------------------------------------------------

describe('run() — integration', () => {
  it(
    'ainj cli version exits 0 (requires injective-core)',
    { skip: isInjectiveCoreInstalled ? false : 'injective-core not installed' },
    () => {
      const cliIndex = fileURLToPath(new URL('../cli/index.js', import.meta.url));
      const result = spawnSync(process.execPath, [cliIndex, 'cli', 'version'], {
        encoding: 'utf8',
      });

      assert.equal(result.status, 0);
      assert.ok(result.stdout.length > 0);
    },
  );

  it(
    'ainj injectived version exits 0 (requires injective-core)',
    { skip: isInjectiveCoreInstalled ? false : 'injective-core not installed' },
    () => {
      const cliIndex = fileURLToPath(new URL('../cli/index.js', import.meta.url));
      const result = spawnSync(process.execPath, [cliIndex, 'injectived', 'version'], {
        encoding: 'utf8',
      });

      assert.equal(result.status, 0);
      assert.ok(result.stdout.length > 0);
    },
  );
});
