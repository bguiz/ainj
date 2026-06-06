import { spawnSync } from 'node:child_process';

import { readState } from '../install/state.js';

export async function run(
  _args,
  { _readState = readState, _spawnSync = spawnSync } = {},
) {
  const state = _readState('global');

  if (state.scope === 'local') {
    _spawnSync('npm', ['install', 'ainj@latest'], { stdio: 'inherit' });
  } else {
    _spawnSync('npm', ['install', '-g', 'ainj@latest'], { stdio: 'inherit' });
  }
}
