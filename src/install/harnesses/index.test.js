import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { writeHarnessConfigs } from './index.js';

function useTmpDir() {
  let tmpDir;
  before(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ainj-test-'));
  });
  after(() => {
    fs.rmSync(tmpDir, { recursive: true });
  });
  return { dir: () => tmpDir };
}

describe('writeHarnessConfigs()', () => {
  const { dir } = useTmpDir();

  it('completes without error for empty harness list', () => {
    assert.doesNotThrow(() =>
      writeHarnessConfigs([], 'global', 3001, 3002, { homeDir: dir(), cwd: dir() }),
    );
  });

  it('writes both config files when two harnesses are selected', () => {
    writeHarnessConfigs(['claude', 'codex'], 'global', 3001, 3002, { homeDir: dir(), cwd: dir() });
    assert.ok(fs.existsSync(path.join(dir(), '.claude.json')), 'claude config should exist');
    assert.ok(
      fs.existsSync(path.join(dir(), '.codex', 'config.json')),
      'codex config should exist',
    );
  });

  it('completes without error for unknown harness name', () => {
    assert.doesNotThrow(() =>
      writeHarnessConfigs(['unknown-harness'], 'global', 3001, 3002, {
        homeDir: dir(),
        cwd: dir(),
      }),
    );
  });

  it('writes all four harness configs when all are selected', () => {
    writeHarnessConfigs(['claude', 'codex', 'cursor', 'windsurf'], 'global', 3001, 3002, {
      homeDir: dir(),
      cwd: dir(),
    });
    assert.ok(fs.existsSync(path.join(dir(), '.claude.json')));
    assert.ok(fs.existsSync(path.join(dir(), '.codex', 'config.json')));
    assert.ok(fs.existsSync(path.join(dir(), '.cursor', 'mcp.json')));
    assert.ok(fs.existsSync(path.join(dir(), '.codeium', 'windsurf', 'mcp_config.json')));
  });
});
