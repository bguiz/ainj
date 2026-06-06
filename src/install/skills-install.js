import { spawnSync as _spawnSyncDefault } from 'node:child_process';

export function installSkills({ _spawnSync = _spawnSyncDefault, _warn = console.warn } = {}) {
  const result = _spawnSync('npx', ['skills', 'add', './'], { stdio: 'inherit', cwd: process.cwd() });
  if (result.status !== 0) {
    _warn(`skills install failed with status ${result.status} — skipping`);
  }
}
