import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const bin = join(__dirname, 'index.js');

function ainj(...args) {
  return spawnSync(process.execPath, [bin, ...args], { encoding: 'utf8' });
}

describe('ainj CLI integration', () => {
  it('--help exits 0 and lists all subcommands', () => {
    const result = ainj('--help');
    assert.equal(result.status, 0, `expected exit 0, got ${result.status}\n${result.stderr}`);
    for (const cmd of ['mcp', 'cli', 'injectived', 'install', 'update', 'status', 'skills']) {
      assert.ok(result.stdout.includes(cmd), `stdout missing "${cmd}"`);
    }
  });

  it('-h produces identical output to --help', () => {
    const help = ainj('--help');
    const h = ainj('-h');
    assert.equal(h.status, 0);
    assert.equal(h.stdout, help.stdout);
  });

  it('unknown-command exits 1', () => {
    const result = ainj('unknown-command');
    assert.equal(result.status, 1);
  });

  it('no args exits 0', () => {
    const result = ainj();
    assert.equal(result.status, 0);
  });
});
