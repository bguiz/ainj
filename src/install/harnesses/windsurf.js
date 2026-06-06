import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function write(_scope, mainPort, docsPort, { homeDir = os.homedir() } = {}) {
  const filePath = path.join(homeDir, '.codeium', 'windsurf', 'mcp_config.json');

  let data = {};
  try {
    data = JSON.parse(readFileSync(filePath, 'utf8'));
  } catch {
    // file absent or unreadable — start fresh
  }

  if (!data.mcpServers) data.mcpServers = {};
  data.mcpServers['ainj-main'] = { command: 'ainj', args: ['mcp', 'main', 'stdio'] };
  data.mcpServers['ainj-docs'] = { command: 'ainj', args: ['mcp', 'docs', 'stdio'] };
  data.mcpServers['ainj-main-http'] = { url: `http://localhost:${mainPort}` };
  data.mcpServers['ainj-docs-http'] = { url: `http://localhost:${docsPort}` };

  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}
