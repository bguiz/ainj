import * as p from '@clack/prompts';
import { readState, writeState } from './state.js';
import { writeHarnessConfigs as writeHarnessConfigsDefault } from './harnesses/index.js';
import { installSkills as installSkillsDefault } from './skills-install.js';
import { which as whichDefault } from './which.js';

export async function runDefaults({
  _which = whichDefault,
  _writeState = writeState,
  ...stateOpts
} = {}) {
  const defaultHarness = _which('claude') ? 'claude' : _which('codex') ? 'codex' : null;
  _writeState(
    'global',
    {
      scope: 'global',
      ports: { main: 3001, docs: 3002 },
      harnesses: [],
      defaultHarness,
      nonInteractive: true,
    },
    stateOpts,
  );
}

export async function runWizard({
  _which = whichDefault,
  _readState = readState,
  _writeState = writeState,
  _writeHarnessConfigs = writeHarnessConfigsDefault,
  _installSkills = installSkillsDefault,
  _p = p,
  ...stateOpts
} = {}) {
  const localState = _readState('local', stateOpts);
  const existing = Object.keys(localState).length > 0 ? localState : _readState('global', stateOpts);

  _p.intro('AInj setup');

  const scope = await _p.select({
    message: 'Install scope',
    options: [
      { value: 'global', label: 'global (recommended)' },
      { value: 'local', label: 'local (this project only)' },
    ],
    initialValue: existing.scope ?? 'global',
  });
  if (_p.isCancel(scope)) {
    _p.cancel('Setup cancelled.');
    process.exit(0);
    return;
  }

  const mainPort = await _p.text({
    message: 'Main MCP port',
    initialValue: String(existing.ports?.main ?? 3001),
  });
  if (_p.isCancel(mainPort)) {
    _p.cancel('Setup cancelled.');
    process.exit(0);
    return;
  }

  const docsPort = await _p.text({
    message: 'Docs MCP port',
    initialValue: String(existing.ports?.docs ?? 3002),
  });
  if (_p.isCancel(docsPort)) {
    _p.cancel('Setup cancelled.');
    process.exit(0);
    return;
  }

  const harnesses = await _p.multiselect({
    message: 'Select harnesses to configure',
    options: [
      { value: 'claude', label: 'Claude Code' },
      { value: 'codex', label: 'Codex' },
      { value: 'cursor', label: 'Cursor' },
      { value: 'windsurf', label: 'Windsurf' },
    ],
    required: false,
    initialValues: existing.harnesses ?? [],
  });
  if (_p.isCancel(harnesses)) {
    _p.cancel('Setup cancelled.');
    process.exit(0);
    return;
  }

  _writeHarnessConfigs(harnesses, scope, Number(mainPort), Number(docsPort));
  _installSkills();

  const defaultHarness = _which('claude') ? 'claude' : _which('codex') ? 'codex' : null;

  _writeState(
    scope,
    {
      scope,
      ports: { main: Number(mainPort), docs: Number(docsPort) },
      harnesses,
      defaultHarness,
    },
    stateOpts,
  );

  _p.outro('AInj configured.');
}
