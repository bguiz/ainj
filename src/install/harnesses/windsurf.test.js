import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, before, after } from 'node:test';

import { write } from './windsurf.js';

function useTmpDir() {
  let tmpDir;
  before(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ainj-test-')); });
  after(() => { fs.rmSync(tmpDir, { recursive: true }); });
  return { dir: () => tmpDir };
}

describe('windsurf write()', () => {
  const { dir } = useTmpDir();

  it('creates ~/.codeium/windsurf/mcp_config.json when it does not exist', () => {
    write('global', 3001, 3002, { homeDir: dir() });
    const filePath = path.join(dir(), '.codeium', 'windsurf', 'mcp_config.json');
    assert.ok(fs.existsSync(filePath), 'config file should exist');
    assert.ok(filePath.endsWith('.codeium/windsurf/mcp_config.json'), 'path should end with .codeium/windsurf/mcp_config.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.ok(data.mcpServers['ainj-main']);
    assert.ok(data.mcpServers['ainj-docs']);
    assert.ok(data.mcpServers['ainj-main-http']);
    assert.ok(data.mcpServers['ainj-docs-http']);
  });

  it('merges into existing config without removing unrelated keys', () => {
    const filePath = path.join(dir(), '.codeium', 'windsurf', 'mcp_config.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ mcpServers: { 'other-server': { command: 'qux' } }, version: 2 }));
    write('global', 3001, 3002, { homeDir: dir() });
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.ok(data.mcpServers['other-server'], 'unrelated server should be preserved');
    assert.equal(data.version, 2, 'unrelated top-level key should be preserved');
    assert.ok(data.mcpServers['ainj-main']);
  });

  it('ainj-main-http and ainj-docs-http use supplied port numbers', () => {
    write('global', 7001, 7002, { homeDir: dir() });
    const filePath = path.join(dir(), '.codeium', 'windsurf', 'mcp_config.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(data.mcpServers['ainj-main-http'].url, 'http://localhost:7001');
    assert.equal(data.mcpServers['ainj-docs-http'].url, 'http://localhost:7002');
  });
});
