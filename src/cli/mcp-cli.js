import { startHttp, startStdio } from '../mcp/main/index.js';

export async function run([server, transport] = []) {
  if (server === 'main') {
    if (transport === 'http') {
      await startHttp();
      return;
    }
    if (transport === 'stdio') {
      const child = startStdio();
      await new Promise((resolve) => child.on('close', resolve));
      return;
    }
    process.stderr.write('ainj mcp main: transport must be "http" or "stdio"\n');
    process.exit(1);
    return;
  }
  if (server === 'docs' || server === 'http' || server === 'stdio') {
    console.log('not yet implemented');
    return;
  }
  process.stderr.write(`ainj mcp: unknown server "${server}"\n`);
  process.exit(1);
}
