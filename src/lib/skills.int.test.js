// @integration — requires a real 'claude' harness binary to be present

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { which } from '../install/which.js';
import { skills } from './skills.js';

const claudeAvailable = which('claude') !== null;
const skipReason = claudeAvailable ? false : 'claude binary not found on $PATH';

describe(
  'skills.run() — integration',
  { skip: skipReason },
  () => {
    it('run("injective-cli", "--help") returns exitCode 0 and non-empty stdout', async () => {
      const result = await skills.run('injective-cli', '--help');

      assert.equal(result.exitCode, 0);
      assert.ok(result.stdout.length > 0, 'expected non-empty stdout');
    });
  },
);
