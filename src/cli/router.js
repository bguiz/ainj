const SUBCOMMANDS = new Set([
  'mcp',
  'cli',
  'injectived',
  'install',
  'update',
  'status',
  'skills',
  'version',
]);

export function route(argv) {
  if (argv.length === 0) return { action: 'no-args' };
  const [first, ...rest] = argv;
  if (first === '--help' || first === '-h') return { action: 'help' };
  if (SUBCOMMANDS.has(first)) return { action: 'run', cmd: first, rest };
  return { action: 'unknown', cmd: first };
}
