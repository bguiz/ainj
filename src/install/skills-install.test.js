import assert from 'node:assert/strict';
import path from 'node:path';
import { describe, it } from 'node:test';

import { installSkills } from './skills-install.js';

describe('installSkills()', () => {
  it('calls spawnSync with correct args', async () => {
    let captured;
    await installSkills({
      _fs: {
        stat: async () => ({ isDirectory: () => true }),
      },
      _spawnSync: (...args) => {
        captured = args;
        return { status: 0 };
      },
    });
    captured[1][4] = 'placeholder1';
    captured[2].cwd = 'placeholder2';
    assert.deepEqual(captured, [
      'npx',
      ['-y', 'skills@1.5.13', 'add', '--global', 'placeholder1'],
      {
        stdio: 'inherit',
        cwd: 'placeholder2',
      },
    ]);
  });

  it('syncs skills when the skills directory is missing', async () => {
    let synced = false;
    await installSkills({
      _fs: {
        stat: async () => {
          const err = new Error('missing');
          err.code = 'ENOENT';
          throw err;
        },
      },
      _syncSkills: async () => {
        synced = true;
      },
      _spawnSync: () => ({ status: 0 }),
    });
    assert.equal(synced, true);
  });

  it('does not sync skills when the skills directory already exists', async () => {
    let synced = false;
    await installSkills({
      _fs: {
        stat: async () => ({ isDirectory: () => true }),
      },
      _syncSkills: async () => {
        synced = true;
      },
      _spawnSync: () => ({ status: 0 }),
    });
    assert.equal(synced, false);
  });

  it('does not throw when spawnSync returns non-zero status', async () => {
    let warned;
    await assert.doesNotReject(() => {
      return installSkills({
        _fs: {
          stat: async () => ({ isDirectory: () => true }),
        },
        _spawnSync: () => ({ status: 1 }),
        _warn: (msg) => {
          warned = msg;
        },
      });
    });
    assert.match(warned, /skills install failed/);
  });

  it('throws unexpected fs stat errors', async () => {
    await assert.rejects(
      () =>
        installSkills({
          _fs: {
            stat: async () => {
              const err = new Error('permission denied');
              err.code = 'EACCES';
              throw err;
            },
          },
          _spawnSync: () => ({ status: 0 }),
        }),
      /permission denied/,
    );
  });
});
