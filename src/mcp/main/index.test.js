// @integration — all tests require @injective-agent/core to be installed

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';

let coreAvailable = false;
try {
  import.meta.resolve('@injective-agent/core/mcp');
  coreAvailable = true;
} catch {
  // not installed — all tests will skip
}

describe('startHttp()', () => {
  test('startHttp(port) starts HTTP server on the given port', async (t) => {
    if (!coreAvailable) return t.skip('@injective-agent/core not installed');

    const { startHttp } = await import('./index.js');
    const server = await startHttp(19801);
    t.after(() => new Promise((r) => server.close(r)));

    assert.equal(server.address().port, 19801);
  });

  test('startHttp() reads port from AINJ_MCP_MAIN_PORT env var', async (t) => {
    if (!coreAvailable) return t.skip('@injective-agent/core not installed');

    const saved = process.env.AINJ_MCP_MAIN_PORT;
    process.env.AINJ_MCP_MAIN_PORT = '19802';
    t.after(() => {
      if (saved === undefined) delete process.env.AINJ_MCP_MAIN_PORT;
      else process.env.AINJ_MCP_MAIN_PORT = saved;
    });

    const { startHttp } = await import('./index.js');
    const server = await startHttp();
    t.after(() => new Promise((r) => server.close(r)));

    assert.equal(server.address().port, 19802);
  });

  test('startHttp() defaults to port 3001 when AINJ_MCP_MAIN_PORT is unset', async (t) => {
    if (!coreAvailable) return t.skip('@injective-agent/core not installed');

    const saved = process.env.AINJ_MCP_MAIN_PORT;
    delete process.env.AINJ_MCP_MAIN_PORT;
    t.after(() => {
      if (saved !== undefined) process.env.AINJ_MCP_MAIN_PORT = saved;
    });

    const { startHttp } = await import('./index.js');
    const server = await startHttp();
    t.after(() => new Promise((r) => server.close(r)));

    assert.equal(server.address().port, 3001);
  });
});

describe('startStdio()', () => {
  test('startStdio() spawns the upstream MCP server as a child process', async (t) => {
    if (!coreAvailable) return t.skip('@injective-agent/core not installed');

    const { startStdio } = await import('./index.js');
    const child = startStdio();
    t.after(() => child.kill());

    assert.ok(typeof child.pid === 'number', 'should return a process with a numeric pid');
  });

  test('startStdio() spawns with inherited stdio so the child owns file descriptors directly', async (t) => {
    if (!coreAvailable) return t.skip('@injective-agent/core not installed');

    const { startStdio } = await import('./index.js');
    const child = startStdio();
    t.after(() => child.kill());

    assert.equal(child.stdin, null, 'stdin should be null — inherited, not piped');
    assert.equal(child.stdout, null, 'stdout should be null — inherited, not piped');
  });
});
