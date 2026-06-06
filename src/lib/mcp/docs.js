import { McpClient } from './client.js';

export const docs = new McpClient('docs');
export const defaultHttpUrl = `http://localhost:${process.env.AINJ_MCP_DOCS_PORT ?? 3002}/mcp`;
