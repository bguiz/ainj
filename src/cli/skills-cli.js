import { readdir } from 'node:fs/promises';
import path from 'node:path';

export async function run(
  _args,
  { _readdir = readdir, _log = console.log } = {},
) {
  const skillsDir = path.join(process.cwd(), '.agents', 'skills');

  let entries;
  try {
    entries = await _readdir(skillsDir, { withFileTypes: true });
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
    _log('No skills installed. Run `npm run sync:skills` to install them.');
    return;
  }

  const skillNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);

  if (skillNames.length === 0) {
    _log('No skills installed. Run `npm run sync:skills` to install them.');
    return;
  }

  for (const name of skillNames) {
    _log(name);
  }
}
