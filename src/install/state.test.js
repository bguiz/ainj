import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, it, before, after } from 'node:test';

import { stateFilePath, readState, writeState } from './state.js';
import { which } from './which.js';

function useTmpDir() {
  let tmpDir;
  before(async () => { tmpDir = await mkdtemp(path.join(os.tmpdir(), 'ainj-test-')); });
  after(async () => { await rm(tmpDir, { recursive: true, force: true }); });
  return { dir: () => tmpDir };
}

describe('stateFilePath()', () => {
  it('global path starts with os.homedir()', () => {
    assert.ok(stateFilePath('global').startsWith(os.homedir()));
  });

  it('local path starts with process.cwd()', () => {
    assert.ok(stateFilePath('local').startsWith(process.cwd()));
  });
});

describe('readState()', () => {
  const { dir } = useTmpDir();

  it('returns {} when state file does not exist', () => {
    assert.deepEqual(readState('global', { homeDir: dir() }), {});
  });
});

describe('writeState()', () => {
  const { dir } = useTmpDir();

  it('creates parent directory and writes valid JSON', async () => {
    const data = { scope: 'global', ports: { main: 3001, docs: 3002 } };
    writeState('global', data, { homeDir: dir() });
    const raw = await readFile(path.join(dir(), '.ainj', 'config.json'), 'utf8');
    assert.deepEqual(JSON.parse(raw), data);
  });

  it('round-trip: readState returns what writeState wrote', () => {
    const data = { scope: 'local', harnesses: ['claude-code'], defaultHarness: 'claude' };
    writeState('global', data, { homeDir: dir() });
    assert.deepEqual(readState('global', { homeDir: dir() }), data);
  });
});

describe('which()', () => {
  it('returns a path string when binary is on $PATH', () => {
    const result = which('node');
    assert.equal(typeof result, 'string');
    assert.ok(result.length > 0);
  });

  it('returns null for a nonexistent binary', () => {
    assert.equal(which('nonexistent-binary-ainj-test'), null);
  });
});
