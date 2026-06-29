import { randomUUID } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { createOutboundClient } from './client.js';

export async function buildProxyServer() {
  const remote = await createOutboundClient();
  const { tools } = await remote.listTools();

  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
  const { ListToolsRequestSchema, CallToolRequestSchema } = await import(
    '@modelcontextprotocol/sdk/types.js'
  );

  function makeServer() {
    const server = new Server(
      { name: 'ainj-docs', version: '0.1.0' },
      { capabilities: { tools: {} } },
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
      return remote.callTool({ name: req.params.name, arguments: req.params.arguments ?? {} });
    });
    return server;
  }

  return { makeServer, remote };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve(undefined);
      }
    });
    req.on('error', reject);
  });
}

export async function startHttp(port) {
  const effectivePort = port ?? Number(process.env.AINJ_MCP_DOCS_PORT ?? 3002);
  const { makeServer, remote } = await buildProxyServer();

  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  );

  const sessions = new Map();

  const httpServer = createHttpServer(async (req, res) => {
    try {
      const path = req.url?.split('?')[0];

      if (path !== '/mcp') {
        res.writeHead(404).end();
        return;
      }

      const sessionId = req.headers['mcp-session-id'];

      if (sessionId) {
        const session = sessions.get(sessionId);
        if (!session) {
          res.writeHead(404).end('Session not found');
          return;
        }
        await session.transport.handleRequest(req, res);
      } else if (req.method === 'POST') {
        const parsedBody = await readJsonBody(req);
        const newSessionId = randomUUID();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
        });
        const server = makeServer();

        transport.onclose = () => sessions.delete(newSessionId);

        await server.connect(transport);
        sessions.set(newSessionId, { transport, server });

        await transport.handleRequest(req, res, parsedBody);
      } else {
        res.writeHead(405).end('Method not allowed');
      }
    } catch (err) {
      if (!res.headersSent) res.writeHead(500).end(String(err));
    }
  });

  await new Promise((resolve, reject) => {
    httpServer.listen(effectivePort, '127.0.0.1', resolve);
    httpServer.on('error', reject);
  });

  const _close = httpServer.close.bind(httpServer);
  httpServer.close = (cb) => {
    _close((err) => {
      remote
        .close?.()
        .catch(() => {})
        .then(() => cb?.(err));
    });
    return httpServer;
  };

  return httpServer;
}

export async function startStdio() {
  const { makeServer } = await buildProxyServer();
  const server = makeServer();
  const { StdioServerTransport } = await import('@modelcontextprotocol/sdk/server/stdio.js');
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
