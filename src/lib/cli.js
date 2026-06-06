import { execFile as execFileCb, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFile = promisify(execFileCb);
const _require = createRequire(import.meta.url);

export function resolveBinary() {
  // Strategy 1: resolve via injective-core package bin field
  try {
    const pkgPath = _require.resolve('injective-core/package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
    if (pkg.bin?.injectived) {
      return resolve(dirname(pkgPath), pkg.bin.injectived);
    }
  } catch {
    // fall through to strategy 2
  }

  // Strategy 2: which injectived
  const result = spawnSync('which', ['injectived'], { encoding: 'utf8' });
  if (result.status === 0) {
    return result.stdout.trim();
  }

  throw new Error(
    'injectived not found: injective-core not installed and injectived not on $PATH',
  );
}

async function cli(...args) {
  const bin = resolveBinary();
  const { stdout, stderr } = await execFile(bin, args);
  return { stdout, stderr };
}

Object.defineProperty(cli, 'path', {
  get: resolveBinary,
  enumerable: true,
  configurable: false,
});

export { cli };
export default cli;
