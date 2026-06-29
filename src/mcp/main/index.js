import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createServer as createHttpServer } from 'node:http';
import { fileURLToPath } from 'node:url';

function resolveServerScript() {
  return fileURLToPath(import.meta.resolve('@injective-agent/core/mcp'));
}

// Returns a child process with piped stdin/stdout.
// The caller (mcp-cli.js) is responsible for connecting process stdio to the child's pipes.
export function startStdio() {
  const script = resolveServerScript();
  return spawn(process.execPath, [script], { stdio: 'inherit' });
}

export async function startHttp(port) {
  const effectivePort = port ?? Number(process.env.AINJ_MCP_MAIN_PORT ?? 3001);
  const script = resolveServerScript();

  // Dynamic imports, transitively available when @injective-agent/core is installed
  const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
  const { StdioClientTransport } = await import('@modelcontextprotocol/sdk/client/stdio.js');
  const { Server } = await import('@modelcontextprotocol/sdk/server/index.js');
  const { StreamableHTTPServerTransport } = await import(
    '@modelcontextprotocol/sdk/server/streamableHttp.js'
  );
  const { ListToolsRequestSchema, CallToolRequestSchema } = await import(
    '@modelcontextprotocol/sdk/types.js'
  );

  // Connect once to the upstream stdio server (shared across all HTTP sessions)
  const upstreamClient = new Client({ name: 'ainj-main', version: '0.1.0' });
  const upstreamTransport = new StdioClientTransport({
    command: process.execPath,
    args: [script],
    env: { ...process.env },
  });
  await upstreamClient.connect(upstreamTransport);
  const { tools } = await upstreamClient.listTools();

  function makeMcpServer() {
    const server = new Server(
      { name: 'injective-agent', version: '0.1.0' },
      { capabilities: { tools: {} } },
    );
    server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools }));
    server.setRequestHandler(CallToolRequestSchema, async (req) => {
      return upstreamClient.callTool({
        name: req.params.name,
        arguments: req.params.arguments ?? {},
      });
    });
    return server;
  }

  // Read and JSON-parse the request body from a Node.js IncomingMessage.
  // Needed because StreamableHTTPServerTransport expects the body pre-parsed
  // when we construct the web Request from an already-read stream.
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

  // sessionId → { transport: StreamableHTTPServerTransport, server: McpServer }
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
        // Existing session handles subsequent POST, GET (SSE), and DELETE requests.
        const session = sessions.get(sessionId);
        if (!session) {
          res.writeHead(404).end('Session not found');
          return;
        }
        await session.transport.handleRequest(req, res);
      } else if (req.method === 'POST') {
        // New session: the first request must be an MCP initialize.
        const parsedBody = await readJsonBody(req);
        const newSessionId = randomUUID();
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => newSessionId,
        });
        const server = makeMcpServer();

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

  // Wrap close() so the upstream subprocess is killed when the HTTP server shuts down.
  const _close = httpServer.close.bind(httpServer);
  httpServer.close = (cb) => {
    _close((err) => {
      upstreamClient
        .close()
        .catch(() => {})
        .then(() => cb?.(err));
    });
    return httpServer;
  };

  return httpServer;
}
