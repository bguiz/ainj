import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

function resolveAinj() {
  const local = fileURLToPath(new URL('../../../node_modules/.bin/ainj', import.meta.url));
  if (existsSync(local)) return local;
  return 'ainj';
}

export function resolveServer(bin) {
  return { command: resolveAinj(), args: ['mcp', bin, 'stdio'] };
}
