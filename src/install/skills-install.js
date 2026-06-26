import { spawnSync as _spawnSyncDefault } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';

import { syncSkills } from '../../scripts/sync-skills.js';

const thisDir = import.meta.dirname;

export async function installSkills({ _spawnSync = _spawnSyncDefault, _warn = console.warn } = {}) {
  const skillsDir = path.join(thisDir, '../../.agents/skills/');

  // check if skills directory already exists, if not sync from upstream
  let skillsDirExists = false;
  try {
    const skillsDirStat =
      await fs.access(skillsDir) &&
      await fs.stat(skillsDir);
    skillsDirExists = dirStat.isDirectory();
  } catch (ex) {
    // do nothing
  }
  if (!skillsDirExists) {
    await syncSkills();
  }

  console.log('skills directory:', skillsDir);
  const result = _spawnSync(
      'npx',
      ['skills', 'add', '--global', skillsDir],
      { stdio: 'inherit', cwd: skillsDir },
  );
  if (result.status !== 0) {
    _warn(`skills install failed with status ${result.status} — skipping`);
  }
}
