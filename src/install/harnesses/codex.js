import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { parse as parseToml, stringify as stringifyToml } from 'smol-toml';

export function write(
  scope,
  mainPort,
  docsPort,
  { homeDir = os.homedir(), cwd = process.cwd() } = {},
) {
  if (scope === 'local') {
    _writeLocal(cwd, mainPort, docsPort);
  } else {
    _writeGlobal(homeDir, mainPort, docsPort);
  }
}

function _writeGlobal(homeDir, mainPort, docsPort) {
  const filePath = path.join(homeDir, '.codex', 'config.json');
  let data = {};
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    // File absent or unreadable: start fresh.
  }
  _mergeEntries(data, mainPort, docsPort);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function _writeLocal(cwd, mainPort, docsPort) {
  const filePath = path.join(cwd, '.codex', 'config.toml');
  let data = {};
  try {
    data = parseToml(readFileSync(filePath, 'utf8'));
  } catch {
    // File absent or unreadable: start fresh.
  }
  _mergeEntries(data, mainPort, docsPort);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, stringifyToml(data));
}

function _mergeEntries(data, mainPort, docsPort) {
  if (!data.mcpServers) data.mcpServers = {};
  data.mcpServers['ainj-main'] = { command: 'ainj', args: ['mcp', 'main', 'stdio'] };
  data.mcpServers['ainj-docs'] = { command: 'ainj', args: ['mcp', 'docs', 'stdio'] };
  data.mcpServers['ainj-main-http'] = { url: `http://localhost:${mainPort}/mcp` };
  data.mcpServers['ainj-docs-http'] = { url: `http://localhost:${docsPort}/mcp` };
}
