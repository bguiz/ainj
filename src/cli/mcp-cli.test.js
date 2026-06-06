import assert from 'node:assert/strict';
import EventEmitter from 'node:events';
import { spawn } from 'node:child_process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { after, before, describe, it, mock } from 'node:test';

let coreAvailable = false;
try {
  import.meta.resolve('@injective-agent/core/mcp');
  coreAvailable = true;
} catch {
  // not installed — integration tests will skip
}

// ---------------------------------------------------------------------------
// Module-level mock functions — reset call counts between tests
// ---------------------------------------------------------------------------

const startHttpMock = mock.fn(async () => {});

const startStdioMock = mock.fn(() => {
  const child = new EventEmitter();
  child.stdin = null;
  child.stdout = null;
  child.stderr = null;
  setImmediate(() => child.emit('close', 0));
  return child;
});

let run;

before(async () => {
  mock.module('../mcp/main/index.js', {
    namedExports: {
      startHttp: startHttpMock,
      startStdio: startStdioMock,
    },
  });

  ({ run } = await import('./mcp-cli.js'));
});

after(() => {
  mock.restoreAll();
});

// ---------------------------------------------------------------------------
// Cycle 1 — run(['main', 'http']) calls startHttp exactly once
// ---------------------------------------------------------------------------

describe("run(['main', 'http'])", () => {
  it('calls startHttp exactly once', async () => {
    startHttpMock.mock.resetCalls();

    await run(['main', 'http']);

    assert.equal(startHttpMock.mock.callCount(), 1);
  });
});

// ---------------------------------------------------------------------------
// Cycle 2 — run(['main', 'stdio']) calls startStdio exactly once
// ---------------------------------------------------------------------------

describe("run(['main', 'stdio'])", () => {
  it('calls startStdio exactly once', async () => {
    startStdioMock.mock.resetCalls();

    await run(['main', 'stdio']);

    assert.equal(startStdioMock.mock.callCount(), 1);
  });
});

// ---------------------------------------------------------------------------
// Cycle 3 — run(['main']) with no transport calls process.exit(1)
// ---------------------------------------------------------------------------

describe("run(['main'])", () => {
  it('calls process.exit(1) when transport is missing', async (t) => {
    const savedExit = process.exit;
    let capturedCode;
    process.exit = (code) => { capturedCode = code; };
    t.after(() => { process.exit = savedExit; });

    await run(['main']);

    assert.equal(capturedCode, 1);
  });
});

// ---------------------------------------------------------------------------
// Cycle 4 — run(['unknown']) calls process.exit(1)
// ---------------------------------------------------------------------------

describe("run(['unknown'])", () => {
  it('calls process.exit(1) for an unrecognised server', async (t) => {
    const savedExit = process.exit;
    let capturedCode;
    process.exit = (code) => { capturedCode = code; };
    t.after(() => { process.exit = savedExit; });

    await run(['unknown']);

    assert.equal(capturedCode, 1);
  });
});

// ---------------------------------------------------------------------------
// Cycle 5 — @integration: CLI wiring through ainj mcp main http
// ---------------------------------------------------------------------------

/** Try TCP connect with retries; resolves true when port accepts, false on timeout. */
function waitForPort(port, { retries = 20, delayMs = 100 } = {}) {
  return new Promise((resolve) => {
    let attempts = 0;
    function attempt() {
      const socket = net.connect(port, '127.0.0.1');
      socket.on('connect', () => { socket.destroy(); resolve(true); });
      socket.on('error', () => {
        socket.destroy();
        if (++attempts < retries) setTimeout(attempt, delayMs);
        else resolve(false);
      });
    }
    attempt();
  });
}

const cliIndex = fileURLToPath(new URL('../cli/index.js', import.meta.url));

describe('ainj mcp main http — integration', () => {
  it(
    'starts HTTP server on default port 3001',
    { skip: coreAvailable ? false : '@injective-agent/core not installed' },
    async (t) => {
      const child = spawn(process.execPath, [cliIndex, 'mcp', 'main', 'http'], {
        stdio: 'pipe',
        env: { ...process.env, AINJ_MCP_MAIN_PORT: undefined },
      });
      t.after(() => child.kill());

      const ready = await waitForPort(3001);
      assert.ok(ready, 'port 3001 should accept connections');
    },
  );

  it(
    'starts HTTP server on port from AINJ_MCP_MAIN_PORT=4100',
    { skip: coreAvailable ? false : '@injective-agent/core not installed' },
    async (t) => {
      const child = spawn(process.execPath, [cliIndex, 'mcp', 'main', 'http'], {
        stdio: 'pipe',
        env: { ...process.env, AINJ_MCP_MAIN_PORT: '4100' },
      });
      t.after(() => child.kill());

      const ready = await waitForPort(4100);
      assert.ok(ready, 'port 4100 should accept connections');
    },
  );
});
