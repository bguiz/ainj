import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, before, after } from 'node:test';
import { parse as parseToml } from 'smol-toml';

import { write } from './codex.js';

function useTmpDir() {
  let tmpDir;
  before(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ainj-test-')); });
  after(() => { fs.rmSync(tmpDir, { recursive: true }); });
  return { dir: () => tmpDir };
}

describe('codex write() — global scope', () => {
  const { dir } = useTmpDir();

  it('creates ~/.codex/config.json when it does not exist', () => {
    write('global', 3001, 3002, { homeDir: dir() });
    const filePath = path.join(dir(), '.codex', 'config.json');
    assert.ok(fs.existsSync(filePath), 'config file should exist');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.ok(data.mcpServers['ainj-main']);
    assert.ok(data.mcpServers['ainj-docs']);
    assert.ok(data.mcpServers['ainj-main-http']);
    assert.ok(data.mcpServers['ainj-docs-http']);
  });

  it('merges into existing config without removing unrelated keys', () => {
    const filePath = path.join(dir(), '.codex', 'config.json');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify({ mcpServers: { 'other-server': { command: 'bar' } }, model: 'gpt-4' }));
    write('global', 3001, 3002, { homeDir: dir() });
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.ok(data.mcpServers['other-server'], 'unrelated server should be preserved');
    assert.equal(data.model, 'gpt-4', 'unrelated top-level key should be preserved');
    assert.ok(data.mcpServers['ainj-main']);
  });

  it('ainj-main-http and ainj-docs-http use supplied port numbers', () => {
    write('global', 5001, 5002, { homeDir: dir() });
    const filePath = path.join(dir(), '.codex', 'config.json');
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    assert.equal(data.mcpServers['ainj-main-http'].url, 'http://localhost:5001');
    assert.equal(data.mcpServers['ainj-docs-http'].url, 'http://localhost:5002');
  });
});

describe('codex write() — local scope', () => {
  const { dir } = useTmpDir();

  it('creates .codex/config.toml in cwd for local scope', () => {
    write('local', 3001, 3002, { homeDir: dir(), cwd: dir() });
    const filePath = path.join(dir(), '.codex', 'config.toml');
    assert.ok(fs.existsSync(filePath), '.codex/config.toml should exist');
    const data = parseToml(fs.readFileSync(filePath, 'utf8'));
    assert.ok(data.mcpServers['ainj-main'], 'ainj-main entry should exist');
    assert.ok(data.mcpServers['ainj-docs'], 'ainj-docs entry should exist');
    assert.ok(data.mcpServers['ainj-main-http'], 'ainj-main-http entry should exist');
    assert.ok(data.mcpServers['ainj-docs-http'], 'ainj-docs-http entry should exist');
  });

  it('ainj-main-http and ainj-docs-http use supplied port numbers in TOML', () => {
    write('local', 6001, 6002, { homeDir: dir(), cwd: dir() });
    const filePath = path.join(dir(), '.codex', 'config.toml');
    const data = parseToml(fs.readFileSync(filePath, 'utf8'));
    assert.equal(data.mcpServers['ainj-main-http'].url, 'http://localhost:6001');
    assert.equal(data.mcpServers['ainj-docs-http'].url, 'http://localhost:6002');
  });

  it('merges into existing .codex/config.toml without removing unrelated keys', () => {
    const filePath = path.join(dir(), '.codex', 'config.toml');
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, '[settings]\nmodel = "o3"\n');
    write('local', 3001, 3002, { homeDir: dir(), cwd: dir() });
    const data = parseToml(fs.readFileSync(filePath, 'utf8'));
    assert.equal(data.settings.model, 'o3', 'unrelated key should be preserved');
    assert.ok(data.mcpServers['ainj-main']);
  });

  it('does not write to ~/.codex/config.json for local scope', () => {
    write('local', 3001, 3002, { homeDir: dir(), cwd: dir() });
    assert.ok(!fs.existsSync(path.join(dir(), '.codex', 'config.json')), 'global JSON must not be written');
  });
});
