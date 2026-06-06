import { write as claudeCode } from './claude-code.js';
import { write as codex } from './codex.js';
import { write as cursor } from './cursor.js';
import { write as windsurf } from './windsurf.js';

const writers = { claude: claudeCode, codex, cursor, windsurf };

export function writeHarnessConfigs(harnesses, scope, mainPort, docsPort, opts = {}) {
  for (const harness of harnesses) {
    const writer = writers[harness];
    if (writer) writer(scope, mainPort, docsPort, opts);
  }
}
