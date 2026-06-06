import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

function resolveAinj() {
  const local = fileURLToPath(new URL('../../../node_modules/.bin/ainj', import.meta.url));
  if (existsSync(local)) return local;
  return 'ainj';
}

export function spawnServer(bin) {
  return spawn(resolveAinj(), ['mcp', bin, 'stdio'], { stdio: 'pipe' });
}
