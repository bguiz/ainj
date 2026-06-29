import { spawnSync as _spawnSyncDefault } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { syncSkills } from '../../scripts/sync-skills.js';

const thisDir = import.meta.dirname;
const SKILLS_PACKAGE = 'skills@1.5.13';

export async function installSkills({
  _spawnSync = _spawnSyncDefault,
  _warn = console.warn,
  _fs = fs,
  _syncSkills = syncSkills,
} = {}) {
  const skillsDir = path.join(thisDir, '../../.agents/skills/');

  // Check if skills directory already exists, otherwise sync from upstream.
  let skillsDirExists = false;
  try {
    const skillsDirStat = await _fs.stat(skillsDir);
    skillsDirExists = skillsDirStat.isDirectory();
  } catch (ex) {
    if (ex.code !== 'ENOENT') throw ex;
  }
  if (!skillsDirExists) {
    await _syncSkills();
  }

  console.log('skills directory:', skillsDir);
  const result = _spawnSync('npx', ['-y', SKILLS_PACKAGE, 'add', '--global', skillsDir], {
    stdio: 'inherit',
    cwd: skillsDir,
  });
  if (result.status !== 0) {
    _warn(`skills install failed with status ${result.status}, skipping`);
  }
}
