import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { loadEnv } from './env.js';

test('loadEnv sets env var from .env file in given directory', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ainj-env-'));
  t.after(() => rmSync(dir, { recursive: true }));
  delete process.env.AINJ_ENV_TEST_A;

  writeFileSync(join(dir, '.env'), 'AINJ_ENV_TEST_A=hello\n');
  loadEnv(dir);

  assert.equal(process.env.AINJ_ENV_TEST_A, 'hello');
  delete process.env.AINJ_ENV_TEST_A;
});

test('loadEnv sets AINJ_MCP_MAIN_PORT from .env file', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ainj-env-'));
  t.after(() => rmSync(dir, { recursive: true }));
  delete process.env.AINJ_MCP_MAIN_PORT;

  writeFileSync(join(dir, '.env'), 'AINJ_MCP_MAIN_PORT=4200\n');
  loadEnv(dir);

  assert.equal(process.env.AINJ_MCP_MAIN_PORT, '4200');
  delete process.env.AINJ_MCP_MAIN_PORT;
});

test('loadEnv does not overwrite an already-set env var', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ainj-env-'));
  t.after(() => rmSync(dir, { recursive: true }));

  process.env.AINJ_ENV_TEST_B = 'original';
  writeFileSync(join(dir, '.env'), 'AINJ_ENV_TEST_B=overwritten\n');
  loadEnv(dir);

  assert.equal(process.env.AINJ_ENV_TEST_B, 'original');
  delete process.env.AINJ_ENV_TEST_B;
});

test('loadEnv does not throw when .env file does not exist', () => {
  assert.doesNotThrow(() => loadEnv('/nonexistent-dir-ainj-env-test'));
});

test('loadEnv skips blank lines and # comment lines', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'ainj-env-'));
  t.after(() => rmSync(dir, { recursive: true }));
  delete process.env.AINJ_ENV_TEST_C;

  writeFileSync(
    join(dir, '.env'),
    ['# comment line', '', 'AINJ_ENV_TEST_C=value', '  '].join('\n'),
  );
  loadEnv(dir);

  assert.equal(process.env.AINJ_ENV_TEST_C, 'value');
  delete process.env.AINJ_ENV_TEST_C;
});

test('loadEnv does not throw when called with no arguments', () => {
  assert.doesNotThrow(() => loadEnv());
});
