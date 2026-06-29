// @integration — tests marked with the skip guard require network access to docs.injective.network

import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';

let docsNetworkAvailable = false;
try {
  const probe = await fetch('https://docs.injective.network/mcp', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'probe', version: '0.0.1' },
      },
    }),
    signal: AbortSignal.timeout(3000),
  });
  docsNetworkAvailable = probe.ok || probe.status === 400;
} catch {
  // network unavailable or timeout
}

// ---------------------------------------------------------------------------
// Shared mock remote returned by createOutboundClient
// ---------------------------------------------------------------------------

const FAKE_TOOLS = [
  {
    name: 'docs-search',
    description: 'Search Injective docs',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        language: { type: 'string', description: 'Language filter' },
      },
      required: ['query'],
    },
  },
  {
    name: 'docs-get',
    description: 'Fetch a specific doc page',
    inputSchema: { type: 'object', properties: {} },
  },
];

const listToolsMock = mock.fn(async () => ({ tools: FAKE_TOOLS }));
const callToolMock = mock.fn(async ({ name }) => ({
  content: [{ type: 'text', text: `result-for-${name}` }],
}));
const closeMock = mock.fn(async () => {});

const fakeRemote = {
  listTools: listToolsMock,
  callTool: callToolMock,
  close: closeMock,
};

// createOutboundClient resolves to fakeRemote by default; tests can override per-test.
let createOutboundClientImpl = async () => fakeRemote;
const createOutboundClientMock = mock.fn((...args) => createOutboundClientImpl(...args));

let buildProxyServer;
let startHttp;
let startStdio;

before(async () => {
  mock.module('./client.js', {
    namedExports: { createOutboundClient: createOutboundClientMock },
  });

  ({ buildProxyServer, startHttp, startStdio } = await import('./index.js'));
});

after(() => {
  mock.restoreAll();
});

// ---------------------------------------------------------------------------
// Cycle 3 — buildProxyServer() propagates rejection from createOutboundClient
// ---------------------------------------------------------------------------

describe('buildProxyServer() — error propagation', () => {
  it('rejects when createOutboundClient rejects', async () => {
    const boom = new Error('network failure');
    const savedImpl = createOutboundClientImpl;
    createOutboundClientImpl = async () => {
      throw boom;
    };
    createOutboundClientMock.mock.resetCalls();

    try {
      await assert.rejects(
        () => buildProxyServer(),
        (err) => {
          assert.equal(err, boom);
          return true;
        },
      );
    } finally {
      createOutboundClientImpl = savedImpl;
    }
  });
});

// ---------------------------------------------------------------------------
// Cycle 4 — proxy tools/list returns the tool list discovered from the remote
// ---------------------------------------------------------------------------

describe('buildProxyServer() — tools/list via InMemoryTransport', () => {
  it('proxy server lists the tools returned by the remote', async (t) => {
    listToolsMock.mock.resetCalls();
    createOutboundClientMock.mock.resetCalls();

    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');

    const { makeServer } = await buildProxyServer();
    const proxyServer = makeServer();

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await proxyServer.connect(serverTransport);

    const testClient = new Client({ name: 'test-client', version: '0.0.1' });
    await testClient.connect(clientTransport);
    t.after(() => testClient.close());

    const { tools } = await testClient.listTools();

    assert.equal(tools.length, FAKE_TOOLS.length);
    assert.equal(tools[0].name, FAKE_TOOLS[0].name);
    assert.equal(tools[1].name, FAKE_TOOLS[1].name);
  });
});

// ---------------------------------------------------------------------------
// Cycle 5 — proxy tools/call forwards name+arguments to remote.callTool unchanged
// ---------------------------------------------------------------------------

describe('buildProxyServer() — tools/call forwarding via InMemoryTransport', () => {
  it('forwards tool name and arguments to remote.callTool unchanged', async (t) => {
    callToolMock.mock.resetCalls();
    createOutboundClientMock.mock.resetCalls();

    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');

    const { makeServer } = await buildProxyServer();
    const proxyServer = makeServer();

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await proxyServer.connect(serverTransport);

    const testClient = new Client({ name: 'test-client', version: '0.0.1' });
    await testClient.connect(clientTransport);
    t.after(() => testClient.close());

    await testClient.callTool({ name: 'docs-search', arguments: {} });

    assert.equal(callToolMock.mock.callCount(), 1);
    const callArgs = callToolMock.mock.calls[0].arguments[0];
    assert.equal(callArgs.name, 'docs-search');
    assert.deepEqual(callArgs.arguments, {});
  });
});

// ---------------------------------------------------------------------------
// Cycle 6 — tools/list preserves inputSchema from remote tool
// ---------------------------------------------------------------------------

describe('buildProxyServer() — tools/list preserves inputSchema', () => {
  it('passes inputSchema from remote tool through to list response unchanged', async (t) => {
    listToolsMock.mock.resetCalls();
    createOutboundClientMock.mock.resetCalls();

    const { InMemoryTransport } = await import('@modelcontextprotocol/sdk/inMemory.js');
    const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');

    const { makeServer } = await buildProxyServer();
    const proxyServer = makeServer();

    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await proxyServer.connect(serverTransport);

    const testClient = new Client({ name: 'test-client', version: '0.0.1' });
    await testClient.connect(clientTransport);
    t.after(() => testClient.close());

    const { tools } = await testClient.listTools();

    assert.deepEqual(tools[0].inputSchema, FAKE_TOOLS[0].inputSchema);
  });
});

// ---------------------------------------------------------------------------
// Cycle 7 — startHttp() port selection
// ---------------------------------------------------------------------------

describe('startHttp() — port selection', () => {
  it('listens on the explicitly-passed port', async (t) => {
    const server = await startHttp(19901);
    t.after(() => new Promise((r) => server.close(r)));

    assert.equal(server.address().port, 19901);
  });

  it('reads port from AINJ_MCP_DOCS_PORT env var when no port argument given', async (t) => {
    const saved = process.env.AINJ_MCP_DOCS_PORT;
    process.env.AINJ_MCP_DOCS_PORT = '19902';
    t.after(() => {
      if (saved === undefined) Reflect.deleteProperty(process.env, 'AINJ_MCP_DOCS_PORT');
      else process.env.AINJ_MCP_DOCS_PORT = saved;
    });

    const server = await startHttp();
    t.after(() => new Promise((r) => server.close(r)));

    assert.equal(server.address().port, 19902);
  });

  it('defaults to port 3002 when AINJ_MCP_DOCS_PORT is unset and no port given', async (t) => {
    const saved = process.env.AINJ_MCP_DOCS_PORT;
    Reflect.deleteProperty(process.env, 'AINJ_MCP_DOCS_PORT');
    t.after(() => {
      if (saved !== undefined) process.env.AINJ_MCP_DOCS_PORT = saved;
    });

    const server = await startHttp();
    t.after(() => new Promise((r) => server.close(r)));

    assert.equal(server.address().port, 3002);
  });
});

// ---------------------------------------------------------------------------
// @integration — require live network to docs.injective.network
// ---------------------------------------------------------------------------

describe('startHttp() — integration', () => {
  it(
    'responds to MCP initialize over HTTP and tools/list matches remote',
    { skip: docsNetworkAvailable ? false : 'docs.injective.network unreachable' },
    async (t) => {
      const { startHttp: realStartHttp } = await import('./index.js?integration=http');
      const server = await realStartHttp(19903);
      t.after(() => new Promise((r) => server.close(r)));

      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StreamableHTTPClientTransport } = await import(
        '@modelcontextprotocol/sdk/client/streamableHttp.js'
      );
      const transport = new StreamableHTTPClientTransport(new URL('http://127.0.0.1:19903/mcp'));
      const client = new Client({ name: 'integration-test', version: '0.0.1' });
      await client.connect(transport);
      t.after(() => client.close());

      const { tools } = await client.listTools();
      assert.ok(Array.isArray(tools), 'tools should be an array');
      assert.ok(tools.length > 0, 'at least one tool should be returned from the remote');
    },
  );
});
