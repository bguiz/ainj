import assert from 'node:assert/strict';
import { describe, it, mock, before, after } from 'node:test';

// ---------------------------------------------------------------------------
// Mock SDK — captured before connect.js is imported
// ---------------------------------------------------------------------------

const mockTransport = {};
const MockStdioClientTransport = mock.fn(function () { return mockTransport; });
const MockStreamableHTTPClientTransport = mock.fn(function () { return mockTransport; });

const mockClientInstance = { connect: mock.fn(async () => {}) };
const MockClient = mock.fn(function () { return mockClientInstance; });

let connectStdio;

before(async () => {
  mock.module('@modelcontextprotocol/sdk/client/stdio.js', {
    namedExports: { StdioClientTransport: MockStdioClientTransport },
  });
  mock.module('@modelcontextprotocol/sdk/client/streamableHttp.js', {
    namedExports: { StreamableHTTPClientTransport: MockStreamableHTTPClientTransport },
  });
  mock.module('@modelcontextprotocol/sdk/client/index.js', {
    namedExports: { Client: MockClient },
  });
  ({ connectStdio } = await import('./connect.js'));
});

after(() => mock.restoreAll());

// ---------------------------------------------------------------------------
// connectStdio(command, args) — passes spawn params to transport, not streams
// ---------------------------------------------------------------------------

describe('connectStdio(command, args)', () => {
  it('passes { command, args } to StdioClientTransport', async () => {
    MockStdioClientTransport.mock.resetCalls();

    await connectStdio('ainj', ['mcp', 'main', 'stdio']);

    assert.equal(MockStdioClientTransport.mock.callCount(), 1);
    const params = MockStdioClientTransport.mock.calls[0].arguments[0];
    assert.equal(params.command, 'ainj');
    assert.deepEqual(params.args, ['mcp', 'main', 'stdio']);
  });

  it('does not pass stdin or stdout to StdioClientTransport', async () => {
    MockStdioClientTransport.mock.resetCalls();

    await connectStdio('ainj', ['mcp', 'main', 'stdio']);

    const params = MockStdioClientTransport.mock.calls[0].arguments[0];
    assert.equal(params.stdin, undefined);
    assert.equal(params.stdout, undefined);
  });
});
