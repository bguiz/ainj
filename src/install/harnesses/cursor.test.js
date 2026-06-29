import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { write } from './cursor.js';

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

describe('cursor write()', () => {
  const { dir } = useTmpDir();

  it('creates ~/.cursor/mcp.json when it does not exist', () => {
    write('global', 3001, 3002, { homeDir: dir() });
    const filePath = path.join(dir(), '.cursor', 'mcp.json');
    assert.ok(fs.existsSync(filePath), 'config file should exist');
    assert.ok(filePath.endsWith('.cursor/mcp.json'), 'path should end with .cursor/mcp.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.ok(data.mcpServers['ainj-main']);
    assert.ok(data.mcpServers['ainj-docs']);
    assert.ok(data.mcpServers['ainj-main-http']);
    assert.ok(data.mcpServers['ainj-docs-http']);
  });

  it('merges into existing config without removing unrelated keys', () => {
    const filePath = path.join(dir(), '.cursor', 'mcp.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(
      filePath,
      JSON.stringify({ mcpServers: { 'other-server': { command: 'baz' } }, theme: 'light' }),
    );
    write('global', 3001, 3002, { homeDir: dir() });
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.ok(data.mcpServers['other-server'], 'unrelated server should be preserved');
    assert.equal(data.theme, 'light', 'unrelated top-level key should be preserved');
    assert.ok(data.mcpServers['ainj-main']);
  });

  it('ainj-main-http and ainj-docs-http use supplied port numbers', () => {
    write('global', 6001, 6002, { homeDir: dir() });
    const filePath = path.join(dir(), '.cursor', 'mcp.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(data.mcpServers['ainj-main-http'].url, 'http://localhost:6001/mcp');
    assert.equal(data.mcpServers['ainj-docs-http'].url, 'http://localhost:6002/mcp');
  });
});
