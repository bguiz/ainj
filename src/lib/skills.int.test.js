// @integration: requires a configured AI harness binary to be present.

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { readState } from '../install/state.js';
import { which } from '../install/which.js';
import { skills } from './skills.js';

const configuredHarness = readState('global').defaultHarness ?? readState('local').defaultHarness;
const harnessAvailable = configuredHarness ? which(configuredHarness) !== null : false;
const skipReason = harnessAvailable ? false : 'AI harness not configured on $PATH';

describe('skills.run(): integration', { skip: skipReason }, () => {
  it('run("injective-cli", "--help") returns exitCode 0 and non-empty stdout', async () => {
    const result = await skills.run('injective-cli', '--help');

    assert.equal(result.exitCode, 0);
    assert.ok(result.stdout.length > 0, 'expected non-empty stdout');
  });
});
