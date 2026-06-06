import { fileURLToPath } from 'node:url';
import { runDefaults, runWizard } from './prompts.js';

export async function main(
  isTTY = process.stdout.isTTY,
  { _runDefaults = runDefaults, _runWizard = runWizard } = {},
) {
  if (isTTY) {
    await _runWizard();
  } else {
    await _runDefaults();
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main();
}
