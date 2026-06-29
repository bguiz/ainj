import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function write(
  scope,
  mainPort,
  docsPort,
  { homeDir = os.homedir(), cwd = process.cwd() } = {},
) {
  const filePath =
    scope === 'global'
      ? path.join(homeDir, '.claude.json')
      : path.join(cwd, '.claude', 'settings.json');

  let data = {};
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    // File absent or unreadable: start fresh.
  }

  if (!data.mcpServers) data.mcpServers = {};
  data.mcpServers['ainj-main'] = { command: 'ainj', args: ['mcp', 'main', 'stdio'] };
  data.mcpServers['ainj-docs'] = { command: 'ainj', args: ['mcp', 'docs', 'stdio'] };
  data.mcpServers['ainj-main-http'] = { url: `http://localhost:${mainPort}/mcp` };
  data.mcpServers['ainj-docs-http'] = { url: `http://localhost:${docsPort}/mcp` };

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}
