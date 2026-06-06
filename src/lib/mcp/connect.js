import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

export async function connectStdio(command, args) {
  const transport = new StdioClientTransport({ command, args });
  const client = new Client({ name: 'ainj', version: '0.1.0' });
  await client.connect(transport);
  return client;
}

export async function connectHttp(url) {
  const transport = new StreamableHTTPClientTransport(new URL(url));
  const client = new Client({ name: 'ainj', version: '0.1.0' });
  await client.connect(transport);
  return client;
}
