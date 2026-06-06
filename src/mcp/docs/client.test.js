import assert from 'node:assert/strict';
import { after, before, describe, it, mock } from 'node:test';

// ---------------------------------------------------------------------------
// Mock factories — reset call counts between tests
// ---------------------------------------------------------------------------

const connectMock = mock.fn(async () => {});

let MockClient;
let MockTransport;

let createOutboundClient;

before(async () => {
  MockClient = mock.fn(function () {
    this.connect = connectMock;
  });

  MockTransport = mock.fn(function (url) {
    this._url = url;
  });

  mock.module('@modelcontextprotocol/sdk/client/index.js', {
    namedExports: { Client: MockClient },
  });
  mock.module('@modelcontextprotocol/sdk/client/streamableHttp.js', {
    namedExports: { StreamableHTTPClientTransport: MockTransport },
  });

  ({ createOutboundClient } = await import('./client.js'));
});

after(() => {
  mock.restoreAll();
});

// ---------------------------------------------------------------------------
// Cycle 1 — transport is constructed with the correct URL
// ---------------------------------------------------------------------------

describe('createOutboundClient() — transport URL', () => {
  it('constructs StreamableHTTPClientTransport with https://docs.injective.network/mcp', async () => {
    MockTransport.mock.resetCalls();

    await createOutboundClient();

    assert.equal(MockTransport.mock.calls.length, 1);
    const urlArg = MockTransport.mock.calls[0].arguments[0];
    assert.equal(urlArg.toString(), 'https://docs.injective.network/mcp');
  });
});

// ---------------------------------------------------------------------------
// Cycle 2 — client.connect() is called before returning
// ---------------------------------------------------------------------------

describe('createOutboundClient() — connect()', () => {
  it('calls client.connect() exactly once before returning', async () => {
    connectMock.mock.resetCalls();

    await createOutboundClient();

    assert.equal(connectMock.mock.callCount(), 1);
  });

  it('returns the connected client instance', async () => {
    const client = await createOutboundClient();

    assert.ok(client, 'should return a non-null value');
    assert.equal(typeof client.connect, 'function', 'returned value should have a connect method');
  });
});
