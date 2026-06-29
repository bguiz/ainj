import { readdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

import { readState } from '../install/state.js';

const { version } = createRequire(import.meta.url)('../../package.json');
const thisDir = import.meta.dirname;

export async function run(
  _args,
  { _readState = readState, _readdir = readdir, _log = console.log } = {},
) {
  const state = _readState('global');

  const scope = state.scope ?? '(none)';
  const mainPort = state.ports?.main ?? '(none)';
  const docsPort = state.ports?.docs ?? '(none)';
  const harnesses = state.harnesses?.length ? state.harnesses.join(', ') : '(none)';
  const defaultHarness = state.defaultHarness ?? '(none)';

  const agentsSkillsDir = path.join(thisDir, '../../.agents/skills');
  let skillNames = [];
  try {
    const entries = await _readdir(agentsSkillsDir, { withFileTypes: true });
    skillNames = entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
  let skillsStr;
  if (skillNames.length > 0) {
    skillsStr = `${skillNames.length} available.`;
  } else {
    skillsStr = '(none)';
  }

  _log(`version: ${version}`);
  _log(`scope: ${scope}`);
  _log(`ports: main=${mainPort}, docs=${docsPort}`);
  _log(`harnesses: ${harnesses}`);
  _log(`default harness: ${defaultHarness}`);
  _log(`skills: ${skillsStr}`);
}
