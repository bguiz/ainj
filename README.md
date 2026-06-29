# AInj

AInj is an AI SDK for Injective that packages 3 functions into 1 interface:

- Injective CLI (`injectived`)
- Injective MCP servers for both Injective network and Injective docs
- Injective agent skills for use in harnesses, including Codex and Claude Code

It is designed for agentic development setups where tools, docs, and project skills should all be available through a single installation.

## Who This Is For

This project is for engineers who want to:

- use Injective tooling from a single Node.js package
- expose Injective capabilities to MCP-compatible clients
- wire Injective-focused skills into Codex or Claude Code
- have everything Injective-related in one package

## What AInj Provides

AInj ships with these top-level commands:

- `ainj install` wizard that configures local or global AInj state
- `ainj status` shows the current AInj configuration, installed skills, and configured ports
- `ainj skills` lists installed skills available in the current project
- `ainj cli ...` runs the bundled `injectived` CLI
  - alias: `ainj injectived ...`
  - try: `ainj cli version` or `ainj injectived version`
- `ainj mcp ...` starts MCP servers over stdio or HTTP
  - try: `ainj mcp docs http` ... then connect to it using an MCP client
- `ainj update` updates the installed package to the latest published version

At the library level, AInj exports:

- `cli` for running `injectived`
- `mcp.main` for the Injective tools MCP server
- `mcp.docs` for the Injective docs MCP server
- `skills` for invoking installed skills through an AI harness

## Requirements

- Node.js 24+
- npm 11+
- an AI harness, such as codex or claude code
  - connect to MCP servers, use agent skills, invoke CLI

## Installation

Install AInj globally if you want the `ainj` command available everywhere (recommended):

```bash
npm install -g @bguiz/ainj
```

Install it locally if you do not need the `ainj` command, and mainly intend to interact with it programmatically.

```bash
npm install @bguiz/ainj
```

After installation, run the setup flow:

```bash
ainj install
```

Interactive setup lets you choose:

- install scope: global or local
- the HTTP port for the main MCP server
- the HTTP port for the docs MCP server
- which harnesses should receive MCP configuration entries

By default the wizard uses:

- main MCP port: `3001`
- docs MCP port: `3002`

## What `ainj install` Writes

AInj stores its own state in:

- global scope: `${HOME}/.ainj/config.json`
- local scope: `./.ainj/config.json`

Depending on the harnesses you select, it also adds MCP server entries.
These include both stdio and HTTP variants.

During interactive setup, AInj also will prompt you to install agent skills.

## Quick Start

### 1. Check your configuration

```bash
ainj status
```

This prints the installed version, scope, configured ports, selected harnesses, default harness, and installed skills.

### 2. List installed skills

```bash
ainj skills
```

If no skills are installed yet, AInj will tell you to run:

```bash
npm run sync:skills
```

### 3. Run Injective CLI commands

```bash
ainj cli version
ainj injectived version
```

Both commands resolve the packaged `injectived` binary and pass through the remaining arguments.

### 4. Start MCP servers

Start just the main Injective tools server:

```bash
ainj mcp main stdio
ainj mcp main http
```

Start just the docs server:

```bash
ainj mcp docs stdio
ainj mcp docs http
```

Start both servers together:

```bash
ainj mcp stdio
ainj mcp http
```

The HTTP transports listen on:

- main: `http://localhost:3001/mcp`
- docs: `http://localhost:3002/mcp`

You can override the ports with environment variables:

- `AINJ_MCP_MAIN_PORT`
- `AINJ_MCP_DOCS_PORT`

### Inspecting MCP servers

If you would like to manually inspect/debug the MCP servers,
use the official MCP inspector.

```shell
DANGEROUSLY_OMIT_AUTH=true npx -y @modelcontextprotocol/inspector
```

This will open up a web app, by default at: `http://localhost:6274/`.
The easiest is for the `http` MCP servers.
Ensure that you already have the server running, then select the following options:

```text
Transport type: Streamable HTTP
URL: http://localhost:3001/mcp (for main MCP)
URL: http://localhost:3002/mcp (for docs MCP)
Connection Type: Via proxy
Authentication: (delete any entries)
```

For the `stdio` MCP servers, no need to run them first, the inspector run it for you.
Select the following options:

```text
Transport type: STDIO
Command: ainj
Arguments: mcp main stdio (for main MCP)
Arguments: mcp docs stdio (for docs MCP)
Authentication: (delete any entries)
```
- Press the "Connect" button
- Press the "List tools" button
- See all available MCP tools listed
- Select one of the tools
- Fill in the tool call arguments
- Press the "Run tool" button
- View tool call result

## Environment

The CLI loads a `.env` file from the current working directory before executing commands.

Useful variables:

```dotenv
AINJ_MCP_MAIN_PORT=3001
AINJ_MCP_DOCS_PORT=3002
```

Existing shell environment variables take precedence over `.env`.

## JavaScript API

### Run `injectived`

```js
import { cli } from '@bguiz/ainj';

const { stdout, stderr } = await cli('version');
console.log(stdout, stderr);
```

### Connect to MCP servers

Start and manage a local stdio-backed MCP session:

```js
import { mcp } from '@bguiz/ainj';

await mcp.main.start();
const tools = await mcp.main.toolCall('tools/list');
await mcp.main.stop();
```

Connect to an already-running HTTP MCP server:

```js
import { mcp } from '@bguiz/ainj';

await mcp.docs.connect('http://localhost:3002/mcp');
const tools = await mcp.docs.toolCall('tools/list');
await mcp.docs.disconnect();
```

### Run a skill through an AI harness

```js
import { skills } from '@bguiz/ainj';

const result = await skills.run('my-skill', { topic: 'perps' });
console.log(result.stdout);
```

`skills.run()` uses the configured default harness from AInj state.
If no default harness is configured, it will ask you to run `ainj install`.

You can force a specific supported harness:

```js
import { skills } from '@bguiz/ainj';

await skills.runWithClaude('my-skill');
await skills.runWithCodex('my-skill');
```

## How The MCP Servers Work

The two MCP services have different roles:

- `main` exposes Injective tooling from [`github.com/InjectiveFoundation/injective-core`](https://github.com/InjectiveFoundation/injective-core/)
- `docs` proxies the Injective documentation MCP endpoint, using content from [`docs.injective.network`](https://docs.injective.network/)

The HTTP mode wraps MCP sessions behind `/mcp`, while stdio mode is intended for direct tool-host integration.

## Local Development

Install dependencies:

```bash
npm install
```

Link (so that `ainj` is available on CLI equivalent to `npm install --global`):

```shell
npm link .
```

Run tests:

```bash
npm test
```

Run linting:

```bash
npm run lint
```

Refresh project skills:

```bash
npm run sync:skills
```

## License

MIT

## Author

[Brendan Graetz](https://blog.bguiz.com/)
