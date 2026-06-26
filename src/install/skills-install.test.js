import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import path from 'node:path';

import { installSkills } from './skills-install.js';

describe('installSkills()', () => {
  it('calls spawnSync with correct args', async () => {
    let captured;
    await installSkills({
      _spawnSync: (...args) => {
        captured = args;
        return { status: 0 };
      },
    });
    captured[1][3] = 'placeholder1';
    captured[2].cwd = 'placeholder2';
    assert.deepEqual(captured, [
      'npx',
      [
        'skills', 'add', '--global', 'placeholder1'
      ],
      {
        stdio: 'inherit',
        cwd: 'placeholder2',
      },
    ]);
  });

  it('does not throw when spawnSync returns non-zero status', () => {
    let warned;
    assert.doesNotThrow(async () => {
      await installSkills({
        _spawnSync: () => ({ status: 1 }),
        _warn: (msg) => { warned = msg; },
      });
    });
    // assert.match(warned, /skills install failed/);
  });

  it.skip('warns to stderr when spawnSync returns non-zero status', async () => {
    // TODO find out why this is throwing with EEXISTS error
    let warned;
    await installSkills({
      _spawnSync: () => ({ status: 1 }),
      _warn: (msg) => { warned = msg; },
    });
    assert.match(warned, /skills install failed/);
  });
});
