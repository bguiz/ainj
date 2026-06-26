import { spawnSync as _spawnSyncDefault } from 'node:child_process';
import path from 'node:path';

const thisDir = import.meta.dirname;

export function installSkills({ _spawnSync = _spawnSyncDefault, _warn = console.warn } = {}) {
  const skillsDir = path.join(thisDir, '../../.agents/skills/');
  console.log('skills directory:', skillsDir);
  const result = _spawnSync('npx', ['skills', 'add', './'], { stdio: 'inherit', cwd: skillsDir });
  if (result.status !== 0) {
    _warn(`skills install failed with status ${result.status} — skipping`);
  }
}
