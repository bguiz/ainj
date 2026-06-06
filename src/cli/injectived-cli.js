import { spawn } from 'node:child_process';
import { resolveBinary } from '../lib/cli.js';

export async function run(args) {
  const bin = resolveBinary();
  const child = spawn(bin, args, { stdio: 'inherit' });
  const code = await new Promise((resolve) => {
    child.on('close', resolve);
  });
  process.exit(code ?? 0);
}
