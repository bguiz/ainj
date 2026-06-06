import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const workflowPath = join(root, '.github', 'workflows', 'publish.yml');

function readWorkflow() {
  return readFileSync(workflowPath, 'utf8');
}

// ---------------------------------------------------------------------------
// Cycle 1 — file exists
// ---------------------------------------------------------------------------

describe('publish.yml — file exists', () => {
  it('exists at .github/workflows/publish.yml', () => {
    assert.doesNotThrow(() => readWorkflow(), 'publish.yml should exist and be readable');
  });
});

// ---------------------------------------------------------------------------
// Cycle 2 — release/published trigger
// ---------------------------------------------------------------------------

describe('publish.yml — trigger', () => {
  it('triggers on release event', () => {
    const content = readWorkflow();
    assert.ok(content.includes('release:'), 'must have release: trigger');
  });

  it('triggers only on published type', () => {
    const content = readWorkflow();
    assert.ok(content.includes('published'), 'must include published in types');
  });
});

// ---------------------------------------------------------------------------
// Cycle 3 — setup-node@v4 with registry-url
// ---------------------------------------------------------------------------

describe('publish.yml — Node setup', () => {
  it('uses actions/setup-node@v4', () => {
    const content = readWorkflow();
    assert.ok(content.includes('actions/setup-node@v4'), 'must use actions/setup-node@v4');
  });

  it('sets registry-url to https://registry.npmjs.org', () => {
    const content = readWorkflow();
    assert.ok(
      content.includes('registry-url:') && content.includes('https://registry.npmjs.org'),
      'must set registry-url to https://registry.npmjs.org',
    );
  });
});

// ---------------------------------------------------------------------------
// Cycle 4 — npm ci
// ---------------------------------------------------------------------------

describe('publish.yml — npm ci', () => {
  it('runs npm ci', () => {
    const content = readWorkflow();
    assert.ok(content.includes('npm ci'), 'must run npm ci');
  });

  it('runs npm ci before npm publish', () => {
    const content = readWorkflow();
    const ciIndex = content.indexOf('npm ci');
    const publishIndex = content.indexOf('npm publish');
    assert.ok(ciIndex !== -1, 'npm ci not found');
    assert.ok(publishIndex !== -1, 'npm publish not found');
    assert.ok(ciIndex < publishIndex, 'npm ci must appear before npm publish');
  });
});

// ---------------------------------------------------------------------------
// Cycle 5 — npm publish with NODE_AUTH_TOKEN
// ---------------------------------------------------------------------------

describe('publish.yml — npm publish', () => {
  it('calls npm publish --access public', () => {
    const content = readWorkflow();
    assert.ok(content.includes('npm publish --access public'), 'must call npm publish --access public');
  });

  it('sets NODE_AUTH_TOKEN from secrets.NPM_TOKEN', () => {
    const content = readWorkflow();
    assert.ok(
      content.includes('NODE_AUTH_TOKEN') && content.includes('secrets.NPM_TOKEN'),
      'must set NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}',
    );
  });
});
