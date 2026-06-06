export async function run(
  _args,
  { _isTTY = process.stdout.isTTY, _runDefaults = null, _runWizard = null } = {},
) {
  const { runDefaults, runWizard } = await import('../install/prompts.js');
  const rd = _runDefaults ?? runDefaults;
  const rw = _runWizard ?? runWizard;
  if (_isTTY) {
    await rw();
  } else {
    await rd();
  }
}
