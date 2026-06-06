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

let docsNetworkAvailable = false;
try {
  const probe = await fetch('https://docs.injective.network/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'probe', version: '0.0.1' } } }),
    signal: AbortSignal.timeout(3000),
  });
  docsNetworkAvailable = probe.ok || probe.status === 400;
} catch {
  // network unavailable or timeout
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

const docsHttpMock = mock.fn(async () => {});
const docsStdioMock = mock.fn(async () => {});

let run;

before(async () => {
  mock.module('../mcp/main/index.js', {
    namedExports: {
      startHttp: startHttpMock,
      startStdio: startStdioMock,
    },
  });
  mock.module('../mcp/docs/index.js', {
    namedExports: {
      startHttp: docsHttpMock,
      startStdio: docsStdioMock,
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
// Cycle 7 — run(['docs']) with no transport calls process.exit(1)
// ---------------------------------------------------------------------------

describe("run(['docs'])", () => {
  it('calls process.exit(1) when transport is missing', async (t) => {
    const savedExit = process.exit;
    let capturedCode;
    process.exit = (code) => { capturedCode = code; };
    t.after(() => { process.exit = savedExit; });

    await run(['docs']);

    assert.equal(capturedCode, 1);
  });
});

// ---------------------------------------------------------------------------
// Cycle 5 — run(['docs', 'http']) calls docsHttp exactly once
// ---------------------------------------------------------------------------

describe("run(['docs', 'http'])", () => {
  it('calls docsHttp exactly once', async () => {
    docsHttpMock.mock.resetCalls();

    await run(['docs', 'http']);

    assert.equal(docsHttpMock.mock.callCount(), 1);
  });
});

// ---------------------------------------------------------------------------
// Cycle 6 — run(['docs', 'stdio']) calls docsStdio exactly once
// ---------------------------------------------------------------------------

describe("run(['docs', 'stdio'])", () => {
  it('calls docsStdio exactly once', async () => {
    docsStdioMock.mock.resetCalls();

    await run(['docs', 'stdio']);

    assert.equal(docsStdioMock.mock.callCount(), 1);
  });
});

// ---------------------------------------------------------------------------
// Cycle 8 — run(['http']) calls both mainHttp and docsHttp
// ---------------------------------------------------------------------------

describe("run(['http'])", () => {
  it('calls both mainHttp and docsHttp', async () => {
    startHttpMock.mock.resetCalls();
    docsHttpMock.mock.resetCalls();

    await run(['http']);

    assert.equal(startHttpMock.mock.callCount(), 1);
    assert.equal(docsHttpMock.mock.callCount(), 1);
  });
});

// ---------------------------------------------------------------------------
// Cycle 9 — run(['stdio']) calls both mainStdio and docsStdio
// ---------------------------------------------------------------------------

describe("run(['stdio'])", () => {
  it('calls both mainStdio and docsStdio', async () => {
    startStdioMock.mock.resetCalls();
    docsStdioMock.mock.resetCalls();

    await run(['stdio']);

    assert.equal(startStdioMock.mock.callCount(), 1);
    assert.equal(docsStdioMock.mock.callCount(), 1);
  });
});

// ---------------------------------------------------------------------------
// Cycle 10 — @integration: CLI wiring through ainj mcp main http
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

describe('ainj mcp docs http — integration', () => {
  it(
    'starts docs HTTP proxy on default port 3002',
    { skip: docsNetworkAvailable ? false : 'docs.injective.network unreachable' },
    async (t) => {
      const child = spawn(process.execPath, [cliIndex, 'mcp', 'docs', 'http'], {
        stdio: 'pipe',
        env: { ...process.env, AINJ_MCP_DOCS_PORT: undefined },
      });
      t.after(() => child.kill());

      const ready = await waitForPort(3002);
      assert.ok(ready, 'port 3002 should accept connections');
    },
  );
});

describe('ainj mcp http (convenience) — integration', () => {
  it(
    'starts both main (3001) and docs (3002) HTTP servers simultaneously',
    { skip: (coreAvailable && docsNetworkAvailable) ? false : 'requires @injective-agent/core and docs.injective.network' },
    async (t) => {
      const child = spawn(process.execPath, [cliIndex, 'mcp', 'http'], {
        stdio: 'pipe',
        env: { ...process.env, AINJ_MCP_MAIN_PORT: undefined, AINJ_MCP_DOCS_PORT: undefined },
      });
      t.after(() => child.kill());

      const [mainReady, docsReady] = await Promise.all([
        waitForPort(3001),
        waitForPort(3002),
      ]);
      assert.ok(mainReady, 'port 3001 should accept connections');
      assert.ok(docsReady, 'port 3002 should accept connections');
    },
  );
});
