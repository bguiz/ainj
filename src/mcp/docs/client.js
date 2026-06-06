import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const DOCS_MCP_URL = 'https://docs.injective.network/mcp';

export async function createOutboundClient() {
  const transport = new StreamableHTTPClientTransport(new URL(DOCS_MCP_URL));
  const client = new Client({ name: 'ainj-docs', version: '0.1.0' });
  await client.connect(transport);
  return client;
}
