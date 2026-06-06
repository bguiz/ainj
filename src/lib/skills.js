import { readState } from '../install/state.js';
import { execFileAsync } from './exec.js';

const DEFAULT_SKILL_TIMEOUT_MS = 60_000;
const DEFAULT_VERSION_TIMEOUT_MS = 5_000;

const HARNESS_BINS = {
  claude: 'claude',
  codex: 'codex',
};

function buildPrompt(skillName, params) {
  if (typeof params === 'undefined' || params === null) {
    return `/${skillName}`;
  }
  if (typeof params === 'string') {
    return `/${skillName} ${params}`;
  }
  return `/${skillName} ${JSON.stringify(params)}`;
}

async function runWithHarness(skillName, params, opts, harness) {
  const bin = HARNESS_BINS[harness];
  if (!bin) {
    throw new Error(
      `Unknown harness '${harness}'. Supported harnesses: ${Object.keys(HARNESS_BINS).join(', ')}`,
    );
  }

  const skillTimeout = opts?.timeout ?? DEFAULT_SKILL_TIMEOUT_MS;
  const startTimestamp = Date.now();

  let harnessVersion = 'unknown';
  try {
    const { stdout } = await execFileAsync(bin, ['--version'], { timeout: DEFAULT_VERSION_TIMEOUT_MS });
    harnessVersion = stdout.trim();
  } catch {
    // fallback to 'unknown'
  }

  const prompt = buildPrompt(skillName, params);
  let stdout = '';
  let stderr = '';
  let exitCode = 0;

  try {
    const result = await execFileAsync(bin, ['-p', prompt, '--output-format', 'text'], { timeout: skillTimeout });
    stdout = result.stdout ?? '';
    stderr = result.stderr ?? '';
  } catch (err) {
    if (err.killed) throw err;
    stdout = err.stdout ?? '';
    stderr = err.stderr ?? '';
    exitCode = typeof err.code === 'number' ? err.code : 1;
  }

  const endTimestamp = Date.now();

  return { stdout, stderr, exitCode, harness, harnessVersion, startTimestamp, endTimestamp };
}

async function run(skillName, params, opts) {
  const globalState = readState('global', opts);
  const localState = readState('local', opts);
  const harness = globalState.defaultHarness ?? localState.defaultHarness;
  if (!harness) {
    throw new Error(
      'No AI harness configured. Run `ainj install` to set one up.',
    );
  }
  return runWithHarness(skillName, params, opts, harness);
}

async function runWithClaude(skillName, params, opts) {
  return runWithHarness(skillName, params, opts, 'claude');
}

async function runWithCodex(skillName, params, opts) {
  return runWithHarness(skillName, params, opts, 'codex');
}

export const skills = { run, runWithClaude, runWithCodex };
export default skills;
