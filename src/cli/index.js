#!/usr/bin/env node
import { loadEnv } from '../env.js';
import { route } from './router.js';

loadEnv();

const USAGE = `Usage: ainj <command> [args...]

Commands:
  cli          Run injectived CLI
  injectived   cli (alias)
  install      Configure AInj harnesses
  mcp          Start MCP server(s)
  status       Show current configuration
  skills       List available skills
  update       Update AInj to the latest version
  version      status (alias)
`;

const { action, cmd, rest } = route(process.argv.slice(2));

switch (action) {
  case 'help':
    process.stdout.write(USAGE);
    process.exit(0);
    break;

  case 'no-args':
    process.stdout.write(USAGE);
    process.exit(0);
    break;

  case 'run': {
    const handlers = {
      mcp: './mcp-cli.js',
      cli: './injectived-cli.js',
      injectived: './injectived-cli.js',
      install: './install-cli.js',
      update: './update-cli.js',
      status: './status-cli.js',
      skills: './skills-cli.js',
      version: './status-cli.js',
    };
    const { run } = await import(handlers[cmd]);
    await run(rest);
    break;
  }

  case 'unknown':
    process.stderr.write(`ainj: unknown command "${cmd}"\n${USAGE}`);
    process.exit(1);
    break;
}
