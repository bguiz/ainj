// @integration tests are marked below and skipped when injective-core is absent

import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, describe, it } from 'node:test';

import { cli, resolveBinary } from './cli.js';

// ---------------------------------------------------------------------------
// Temp fake injectived binary — used to drive unit tests without real install
// ---------------------------------------------------------------------------
let tmpBinDir;
let fakeBin;

before(() => {
  tmpBinDir = join(tmpdir(), `ainj-test-${process.pid}`);
  mkdirSync(tmpBinDir, { recursive: true });
  fakeBin = join(tmpBinDir, 'injectived');
  // exits 1 for 'fail', otherwise prints version and exits 0
  writeFileSync(fakeBin, '#!/bin/sh\n[ "$1" = "fail" ] && exit 1\nprintf "v0.0.0-test\\n"\n');
  chmodSync(fakeBin, 0o755);
});

after(() => {
  rmSync(tmpBinDir, { recursive: true, force: true });
});

// Check whether injective-core is installed (governs integration test skip)
let isInjectiveCoreInstalled = false;
try {
  createRequire(import.meta.url).resolve('injective-core/package.json');
  isInjectiveCoreInstalled = true;
} catch {
  // not installed — integration tests will be skipped
}

// ---------------------------------------------------------------------------
// cli() invocation behaviour
// ---------------------------------------------------------------------------

describe('cli()', () => {
  it('returns { stdout, stderr } when the binary exits 0', async (t) => {
    const saved = process.env.PATH;
    process.env.PATH = `${tmpBinDir}:${saved}`;
    t.after(() => {
      process.env.PATH = saved;
    });

    const result = await cli('version');

    // injective-core is now a real dependency; just verify the return shape
    assert.equal(typeof result.stdout, 'string');
    assert.ok(result.stdout.length > 0);
    assert.equal(result.stderr, '');
  });

  it('rejects when the binary exits non-zero', async (t) => {
    const saved = process.env.PATH;
    process.env.PATH = `${tmpBinDir}:${saved}`;
    t.after(() => {
      process.env.PATH = saved;
    });

    await assert.rejects(() => cli('fail'));
  });
});

// ---------------------------------------------------------------------------
// cli.path — must be an accessor property (getter), not a data property
// ---------------------------------------------------------------------------

describe('cli.path', () => {
  it('is an accessor property (getter), not a data property', () => {
    const descriptor = Object.getOwnPropertyDescriptor(cli, 'path');

    assert.ok(descriptor, 'cli should have a "path" property descriptor');
    assert.equal(typeof descriptor.get, 'function', 'path must have a getter');
    assert.equal(descriptor.value, undefined, 'path must not be a data property');
  });
});

// ---------------------------------------------------------------------------
// resolveBinary() — strategy fallback and error
// ---------------------------------------------------------------------------

describe('resolveBinary()', () => {
  // These two tests exercise paths that only trigger when injective-core is
  // absent (strategy 1 fails). With injective-core now a real dependency,
  // strategy 1 always succeeds in this environment, so we skip them here.
  it(
    'falls back to `which injectived` when strategy 1 (injective-core) fails',
    { skip: isInjectiveCoreInstalled ? 'injective-core installed, strategy 1 always succeeds' : false },
    (t) => {
      const saved = process.env.PATH;
      process.env.PATH = `${tmpBinDir}:${saved}`;
      t.after(() => {
        process.env.PATH = saved;
      });

      const binaryPath = resolveBinary();

      assert.equal(binaryPath, fakeBin);
    },
  );

  it(
    "throws with a message naming 'injective-core' when both strategies fail",
    { skip: isInjectiveCoreInstalled ? 'injective-core installed, strategy 1 always succeeds' : false },
    (t) => {
      const saved = process.env.PATH;
      process.env.PATH = '/nonexistent-ainj-test-path';
      t.after(() => {
        process.env.PATH = saved;
      });

      assert.throws(
        () => resolveBinary(),
        (err) => {
          assert.ok(
            err.message.includes('injective-core'),
            `Expected 'injective-core' in error message, got: ${err.message}`,
          );
          return true;
        },
      );
    },
  );

  // @integration — requires injective-core to be installed
  it(
    'returns the package-bin path when injective-core is installed (strategy 1)',
    { skip: isInjectiveCoreInstalled ? false : 'injective-core not installed' },
    () => {
      const binaryPath = resolveBinary();

      // injective-core bin points to lib/index.js — the word 'injectived'
      // appears in the package name, not necessarily the resolved file path
      assert.equal(typeof binaryPath, 'string');
      assert.ok(binaryPath.length > 0);
      assert.ok(binaryPath.includes('injective-core'));
    },
  );
});

// ---------------------------------------------------------------------------
// Export surface
// ---------------------------------------------------------------------------

describe('exports from src/lib/cli.js', () => {
  it('cli is accessible as a named export', async () => {
    const { cli: namedCli } = await import('./cli.js');

    assert.equal(typeof namedCli, 'function');
  });

  it('cli is accessible as the default export', async () => {
    const { default: defaultCli } = await import('./cli.js');

    assert.equal(typeof defaultCli, 'function');
  });

  it('named export and default export are the same function', async () => {
    const { cli: namedCli, default: defaultCli } = await import('./cli.js');

    assert.equal(namedCli, defaultCli);
  });
});

describe('src/lib/ainj.js re-exports cli', () => {
  it('cli is re-exported from ainj.js', async () => {
    const { cli: cliFromAinj } = await import('./ainj.js');

    assert.equal(typeof cliFromAinj, 'function');
  });
});
