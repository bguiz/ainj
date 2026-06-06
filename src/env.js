import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export function loadEnv(cwd = process.cwd()) {
  let content;
  try {
    content = readFileSync(join(cwd, '.env'), 'utf8');
  } catch {
    return;
  }
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx);
    const value = trimmed.slice(eqIdx + 1);
    if (key && !(key in process.env)) {
      process.env[key] = value;
    }
  }
}
