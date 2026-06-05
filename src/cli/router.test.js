import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { route } from './router.js';

describe('route()', () => {
  it('--help returns { action: "help" }', () => {
    assert.deepEqual(route(['--help']), { action: 'help' });
  });

  it('-h returns { action: "help" }', () => {
    assert.deepEqual(route(['-h']), { action: 'help' });
  });

  it('no args returns { action: "no-args" }', () => {
    assert.deepEqual(route([]), { action: 'no-args' });
  });

  it('mcp returns { action: "run", cmd: "mcp", rest: [] }', () => {
    assert.deepEqual(route(['mcp']), { action: 'run', cmd: 'mcp', rest: [] });
  });

  it('skills with extra args captures rest', () => {
    assert.deepEqual(route(['skills', 'add', '.']), {
      action: 'run',
      cmd: 'skills',
      rest: ['add', '.'],
    });
  });

  it('unknown-cmd returns { action: "unknown", cmd: "unknown-cmd" }', () => {
    assert.deepEqual(route(['unknown-cmd']), { action: 'unknown', cmd: 'unknown-cmd' });
  });

  for (const cmd of ['mcp', 'cli', 'injectived', 'install', 'update', 'status', 'skills']) {
    it(`${cmd} returns action "run"`, () => {
      assert.equal(route([cmd]).action, 'run');
    });
  }
});
