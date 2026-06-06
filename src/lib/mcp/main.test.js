import assert from 'node:assert/strict';
import { describe, it, mock, before, after } from 'node:test';

// ---------------------------------------------------------------------------
// Cycle 21 — main and docs are independent McpClient instances
// ---------------------------------------------------------------------------

const resolveServerMock = mock.fn(() => ({ command: 'ainj', args: ['mcp', 'main', 'stdio'] }));
const connectStdioMock = mock.fn(async () => ({
  connect: mock.fn(async () => {}),
  callTool: mock.fn(async () => ({ content: [] })),
  close: mock.fn(async () => {}),
}));
const connectHttpMock = mock.fn(async () => ({
  connect: mock.fn(async () => {}),
  callTool: mock.fn(async () => ({ content: [] })),
  close: mock.fn(async () => {}),
}));

let main;
let docs;
let McpClient;

before(async () => {
  mock.module('./spawn.js', { namedExports: { resolveServer: resolveServerMock } });
  mock.module('./connect.js', { namedExports: { connectStdio: connectStdioMock, connectHttp: connectHttpMock } });

  ({ McpClient } = await import('./client.js'));
  ({ main } = await import('./main.js'));
  ({ docs } = await import('./docs.js'));
});

after(() => {
  mock.restoreAll();
});

describe('main and docs singletons', () => {
  it('main and docs are both McpClient instances', () => {
    assert.ok(main instanceof McpClient);
    assert.ok(docs instanceof McpClient);
  });

  it('main and docs are different objects', () => {
    assert.notEqual(main, docs);
  });

  it('operating main does not affect docs state', async () => {
    assert.equal(main.state, 'INITIAL');
    assert.equal(docs.state, 'INITIAL');

    await main.start();

    assert.equal(main.state, 'MANAGED');
    assert.equal(docs.state, 'INITIAL');
  });
});
