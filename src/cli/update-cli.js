import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

import { readState } from '../install/state.js';

const { name: packageName } = createRequire(import.meta.url)('../../package.json');

export async function run(_args, { _readState = readState, _spawnSync = spawnSync } = {}) {
  const state = _readState('global');

  if (state.scope === 'local') {
    _spawnSync('npm', ['install', `${packageName}@latest`], { stdio: 'inherit' });
  } else {
    _spawnSync('npm', ['install', '-g', `${packageName}@latest`], { stdio: 'inherit' });
  }
}
