import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { installSkills } from './skills-install.js';

describe('installSkills()', () => {
  it('calls spawnSync with correct args', () => {
    let captured;
    installSkills({
      _spawnSync: (...args) => {
        captured = args;
        return { status: 0 };
      },
    });
    assert.deepEqual(captured, [
      'npx',
      ['skills', 'add', './'],
      { stdio: 'inherit', cwd: process.cwd() },
    ]);
  });

  it('does not throw when spawnSync returns non-zero status', () => {
    assert.doesNotThrow(() =>
      installSkills({ _spawnSync: () => ({ status: 1 }), _warn: () => {} }),
    );
  });

  it('warns to stderr when spawnSync returns non-zero status', () => {
    let warned;
    installSkills({
      _spawnSync: () => ({ status: 1 }),
      _warn: (msg) => { warned = msg; },
    });
    assert.match(warned, /skills install/);
  });
});
