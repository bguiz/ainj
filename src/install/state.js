import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function stateFilePath(scope, { homeDir = os.homedir(), cwd = process.cwd() } = {}) {
  const base = scope === 'global' ? homeDir : cwd;
  return path.join(base, '.ainj', 'config.json');
}

export function readState(scope, opts = {}) {
  try {
    const content = readFileSync(stateFilePath(scope, opts), 'utf8');
    return JSON.parse(content);
  } catch {
    return {};
  }
}

export function writeState(scope, data, opts = {}) {
  const filePath = stateFilePath(scope, opts);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, JSON.stringify(data, null, 2));
}
