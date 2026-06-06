import { McpClient } from './client.js';

export const main = new McpClient('main');
export const defaultHttpUrl = `http://localhost:${process.env.AINJ_MCP_MAIN_PORT ?? 3001}/mcp`;
