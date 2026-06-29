import { readdir } from 'node:fs/promises';
import path from 'node:path';

const thisDir = import.meta.dirname;

export async function run(_args, { _readdir = readdir, _log = console.log } = {}) {
  const agentsSkillsDir = path.join(thisDir, '../../.agents/skills');

  let entries;
  try {
    entries = await _readdir(agentsSkillsDir, { withFileTypes: true });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    _log('No skills available. Run `ainj install` to install them.');
    return;
  }

  const skillNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (skillNames.length === 0) {
    _log('No skills available. Run `ainj install` to install them.');
    return;
  }

  for (const name of skillNames) {
    _log(name);
  }
}
