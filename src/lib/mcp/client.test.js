import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';

// ---------------------------------------------------------------------------
// Mock dependencies — mocked before client.js is imported
// ---------------------------------------------------------------------------

const mockClientInstance = {
  connect: mock.fn(async () => {}),
  callTool: mock.fn(async () => ({ content: [{ type: 'text', text: 'ok' }] })),
  listTools: mock.fn(async () => ({
    tools: [{ name: 'foo', description: 'bar', inputSchema: {} }],
  })),
  close: mock.fn(async () => {}),
};

const resolveServerMock = mock.fn(() => ({ command: 'ainj', args: ['mcp', 'main', 'stdio'] }));
const connectStdioMock = mock.fn(async () => mockClientInstance);
const connectHttpMock = mock.fn(async () => mockClientInstance);

let McpClient;

before(async () => {
  mock.module('./spawn.js', {
    namedExports: { resolveServer: resolveServerMock },
  });
  mock.module('./connect.js', {
    namedExports: { connectStdio: connectStdioMock, connectHttp: connectHttpMock },
  });

  ({ McpClient } = await import('./client.js'));
});

after(() => {
  mock.restoreAll();
});

// ---------------------------------------------------------------------------
// Cycle 1 — new McpClient has state === 'INITIAL'
// ---------------------------------------------------------------------------

describe('McpClient initial state', () => {
  it("state is 'INITIAL' on construction", () => {
    const client = new McpClient('main');
    assert.equal(client.state, 'INITIAL');
  });
});

// ---------------------------------------------------------------------------
// Cycle 2 — start() transitions INITIAL → MANAGED
// ---------------------------------------------------------------------------

describe('start()', () => {
  it('transitions INITIAL → MANAGED', async () => {
    resolveServerMock.mock.resetCalls();
    connectStdioMock.mock.resetCalls();
    const client = new McpClient('main');

    await client.start();

    assert.equal(client.state, 'MANAGED');
    assert.equal(resolveServerMock.mock.callCount(), 1);
    assert.equal(connectStdioMock.mock.callCount(), 1);
  });
});

// ---------------------------------------------------------------------------
// Cycle 3 — stop() transitions MANAGED → INITIAL and calls kill()
// ---------------------------------------------------------------------------

describe('stop()', () => {
  it('transitions MANAGED → INITIAL and closes the client', async () => {
    mockClientInstance.close.mock.resetCalls();
    const client = new McpClient('main');
    await client.start();

    await client.stop();

    assert.equal(client.state, 'INITIAL');
    assert.equal(mockClientInstance.close.mock.callCount(), 1);
  });
});

// ---------------------------------------------------------------------------
// Cycle 4 — connect(url) transitions INITIAL → CONNECTED
// ---------------------------------------------------------------------------

describe('connect(url)', () => {
  it('transitions INITIAL → CONNECTED', async () => {
    connectHttpMock.mock.resetCalls();
    const client = new McpClient('main');

    await client.connect('http://localhost:3001/mcp');

    assert.equal(client.state, 'CONNECTED');
    assert.equal(connectHttpMock.mock.callCount(), 1);
  });
});

// ---------------------------------------------------------------------------
// Cycle 5 — disconnect() transitions CONNECTED → INITIAL and calls close()
// ---------------------------------------------------------------------------

describe('disconnect()', () => {
  it('transitions CONNECTED → INITIAL and calls close() on the client', async () => {
    mockClientInstance.close.mock.resetCalls();
    const client = new McpClient('main');
    await client.connect('http://localhost:3001/mcp');

    await client.disconnect();

    assert.equal(client.state, 'INITIAL');
    assert.equal(mockClientInstance.close.mock.callCount(), 1);
  });
});

// ---------------------------------------------------------------------------
// Cycles 6–9 — toolCall() routing in MANAGED and CONNECTED states
// ---------------------------------------------------------------------------

describe("toolCall('tools/list') in MANAGED state", () => {
  it('calls listTools(), not callTool()', async () => {
    mockClientInstance.listTools.mock.resetCalls();
    mockClientInstance.callTool.mock.resetCalls();
    const client = new McpClient('main');
    await client.start();

    const result = await client.toolCall('tools/list', {});

    assert.equal(mockClientInstance.listTools.mock.callCount(), 1);
    assert.equal(mockClientInstance.callTool.mock.callCount(), 0);
    assert.ok(result.tools);
  });
});

describe('toolCall(toolName) in MANAGED state', () => {
  it('calls callTool() with name and arguments', async () => {
    mockClientInstance.callTool.mock.resetCalls();
    const client = new McpClient('main');
    await client.start();

    const result = await client.toolCall('inject_tokens', { amount: 1 });

    assert.equal(mockClientInstance.callTool.mock.callCount(), 1);
    const args = mockClientInstance.callTool.mock.calls[0].arguments[0];
    assert.equal(args.name, 'inject_tokens');
    assert.deepEqual(args.arguments, { amount: 1 });
    assert.ok(result.content);
  });
});

describe("toolCall('tools/list') in CONNECTED state", () => {
  it('calls listTools(), not callTool()', async () => {
    mockClientInstance.listTools.mock.resetCalls();
    mockClientInstance.callTool.mock.resetCalls();
    const client = new McpClient('main');
    await client.connect('http://localhost:3001/mcp');

    const result = await client.toolCall('tools/list', {});

    assert.equal(mockClientInstance.listTools.mock.callCount(), 1);
    assert.equal(mockClientInstance.callTool.mock.callCount(), 0);
    assert.ok(result.tools);
  });
});

// ---------------------------------------------------------------------------
// Cycles 8–12 — toolCall() guards
// ---------------------------------------------------------------------------

describe('toolCall() guards', () => {
  it("throws in INITIAL state with message containing 'INITIAL'", async () => {
    const client = new McpClient('main');
    await assert.rejects(
      () => client.toolCall('tools/list', {}),
      (err) => {
        assert.ok(err.message.includes('INITIAL'));
        return true;
      },
    );
  });

  it("throws TypeError mentioning 'string' for string params", async () => {
    const client = new McpClient('main');
    await client.start();
    await assert.rejects(
      () => client.toolCall('tools/list', 'bad'),
      (err) => {
        assert.ok(err instanceof TypeError);
        assert.ok(err.message.includes('string'));
        return true;
      },
    );
  });

  it("throws TypeError mentioning 'array' for array params", async () => {
    const client = new McpClient('main');
    await client.start();
    await assert.rejects(
      () => client.toolCall('tools/list', [1, 2]),
      (err) => {
        assert.ok(err instanceof TypeError);
        assert.ok(err.message.includes('array'));
        return true;
      },
    );
  });

  it('throws TypeError for null params', async () => {
    const client = new McpClient('main');
    await client.start();
    await assert.rejects(
      () => client.toolCall('tools/list', null),
      (err) => err instanceof TypeError,
    );
  });

  it('does not throw for undefined params (uses default {})', async () => {
    mockClientInstance.callTool.mock.resetCalls();
    const client = new McpClient('main');
    await client.start();
    await client.toolCall('inject_tokens', undefined);
    const args = mockClientInstance.callTool.mock.calls[0].arguments[0];
    assert.deepEqual(args.arguments, {});
  });
});

// ---------------------------------------------------------------------------
// Cycles 13–20 — all 8 invalid state transitions throw immediately
// ---------------------------------------------------------------------------

describe('invalid transitions', () => {
  it('start() from MANAGED throws', async () => {
    const client = new McpClient('main');
    await client.start();
    await assert.rejects(() => client.start());
  });

  it('start() from CONNECTED throws', async () => {
    const client = new McpClient('main');
    await client.connect('http://localhost:3001/mcp');
    await assert.rejects(() => client.start());
  });

  it('connect() from MANAGED throws', async () => {
    const client = new McpClient('main');
    await client.start();
    await assert.rejects(() => client.connect('http://localhost:3001/mcp'));
  });

  it('connect() from CONNECTED throws', async () => {
    const client = new McpClient('main');
    await client.connect('http://localhost:3001/mcp');
    await assert.rejects(() => client.connect('http://localhost:3001/mcp'));
  });

  it('stop() from INITIAL throws', async () => {
    const client = new McpClient('main');
    await assert.rejects(() => client.stop());
  });

  it('stop() from CONNECTED throws', async () => {
    const client = new McpClient('main');
    await client.connect('http://localhost:3001/mcp');
    await assert.rejects(() => client.stop());
  });

  it('disconnect() from INITIAL throws', async () => {
    const client = new McpClient('main');
    await assert.rejects(() => client.disconnect());
  });

  it('disconnect() from MANAGED throws', async () => {
    const client = new McpClient('main');
    await client.start();
    await assert.rejects(() => client.disconnect());
  });
});
