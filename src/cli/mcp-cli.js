import { startHttp as mainHttp, startStdio as mainStdio } from '../mcp/main/index.js';
import { startHttp as docsHttp, startStdio as docsStdio } from '../mcp/docs/index.js';

export async function run([server, transport] = []) {
  if (server === 'main') {
    if (transport === 'http') {
      await mainHttp();
      return;
    }
    if (transport === 'stdio') {
      const child = mainStdio();
      await new Promise((resolve) => child.on('close', resolve));
      return;
    }
    process.stderr.write('ainj mcp main: transport must be "http" or "stdio"\n');
    process.exit(1);
    return;
  }
  if (server === 'docs') {
    if (transport === 'http') {
      await docsHttp();
      return;
    }
    if (transport === 'stdio') {
      await docsStdio();
      return;
    }
    process.stderr.write('ainj mcp docs: transport must be "http" or "stdio"\n');
    process.exit(1);
    return;
  }
  if (server === 'http') {
    await Promise.all([mainHttp(), docsHttp()]);
    return;
  }
  if (server === 'stdio') {
    const mainChild = mainStdio();
    const mainDone = new Promise((resolve) => mainChild.on('close', resolve));
    await Promise.all([mainDone, docsStdio()]);
    return;
  }
  process.stderr.write(`ainj mcp: unknown server "${server}"\n`);
  process.exit(1);
}
