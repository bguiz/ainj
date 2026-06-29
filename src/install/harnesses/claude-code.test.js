import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, it } from 'node:test';

import { write } from './claude-code.js';

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

describe('claude-code write(): global scope', () => {
  const { dir } = useTmpDir();

  it('creates ~/.claude.json when it does not exist', () => {
    write('global', 3001, 3002, { homeDir: dir() });
    const filePath = path.join(dir(), '.claude.json');
    assert.ok(fs.existsSync(filePath), 'config file should exist');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.ok(data.mcpServers['ainj-main'], 'ainj-main entry should exist');
    assert.ok(data.mcpServers['ainj-docs'], 'ainj-docs entry should exist');
    assert.ok(data.mcpServers['ainj-main-http'], 'ainj-main-http entry should exist');
    assert.ok(data.mcpServers['ainj-docs-http'], 'ainj-docs-http entry should exist');
  });

  it('merges into existing config without removing unrelated keys', () => {
    const filePath = path.join(dir(), '.claude.json');
    fs.writeFileSync(
      filePath,
      JSON.stringify({ mcpServers: { 'other-server': { command: 'foo' } }, theme: 'dark' }),
    );
    write('global', 3001, 3002, { homeDir: dir() });
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.ok(data.mcpServers['other-server'], 'unrelated server should be preserved');
    assert.equal(data.theme, 'dark', 'unrelated top-level key should be preserved');
    assert.ok(data.mcpServers['ainj-main'], 'ainj-main entry should exist');
  });

  it('ainj-main-http and ainj-docs-http use supplied port numbers', () => {
    write('global', 4001, 4002, { homeDir: dir() });
    const filePath = path.join(dir(), '.claude.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(data.mcpServers['ainj-main-http'].url, 'http://localhost:4001/mcp');
    assert.equal(data.mcpServers['ainj-docs-http'].url, 'http://localhost:4002/mcp');
  });
});

describe('claude-code write(): local scope', () => {
  const { dir } = useTmpDir();

  it('creates .claude/settings.json in cwd for local scope', () => {
    write('local', 3001, 3002, { homeDir: dir(), cwd: dir() });
    const filePath = path.join(dir(), '.claude', 'settings.json');
    assert.ok(fs.existsSync(filePath), '.claude/settings.json should exist');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.ok(data.mcpServers['ainj-main']);
    assert.ok(data.mcpServers['ainj-docs']);
    assert.ok(data.mcpServers['ainj-main-http']);
    assert.ok(data.mcpServers['ainj-docs-http']);
  });

  it('does not write to .mcp.json for local scope', () => {
    write('local', 3001, 3002, { homeDir: dir(), cwd: dir() });
    assert.ok(!fs.existsSync(path.join(dir(), '.mcp.json')), '.mcp.json must not be written');
  });

  it('does not write to ~/.claude.json for local scope', () => {
    write('local', 3001, 3002, { homeDir: dir(), cwd: dir() });
    assert.ok(
      !fs.existsSync(path.join(dir(), '.claude.json')),
      '~/.claude.json should not be written',
    );
  });
});
