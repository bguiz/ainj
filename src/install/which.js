import { spawnSync } from 'node:child_process';

export function which(name) {
  const result = spawnSync('which', [name]);
  if (result.status === 0) return result.stdout.toString().trim();
  return null;
}
