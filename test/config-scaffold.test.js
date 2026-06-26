import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

function readJson(file) {
  return JSON.parse(readFileSync(join(root, file), 'utf8'));
}

function readText(file) {
  return readFileSync(join(root, file), 'utf8');
}

describe('package.json', () => {
  it('name is "@bguiz/ainj"', () => {
    const pkg = readJson('package.json');
    assert.equal(pkg.name, 'ainj');
  });

  it('"type" is "module"', () => {
    const pkg = readJson('package.json');
    assert.equal(pkg.type, 'module');
  });

  it('"bin.ainj" is "src/cli/index.js"', () => {
    const pkg = readJson('package.json');
    assert.equal(pkg.bin?.ainj, 'src/cli/index.js');
  });

  it('"main" is "src/lib/ainj.js"', () => {
    const pkg = readJson('package.json');
    assert.equal(pkg.main, 'src/lib/ainj.js');
  });

  it('has required scripts: test, lint, sync:skills, postinstall', () => {
    const { scripts } = readJson('package.json');
    assert.ok(
      scripts.test.startsWith('node --test'),
      `test script should start with 'node --test', got: ${scripts.test}`,
    );
    assert.equal(scripts.lint, 'biome check .');
    assert.equal(scripts['sync:skills'], 'node scripts/sync-skills.js');
    assert.equal(scripts.postinstall, 'node src/install/index.js');
  });

  it('has @clack/prompts in dependencies', () => {
    const { dependencies } = readJson('package.json');
    assert.ok(dependencies?.['@clack/prompts'], '@clack/prompts missing from dependencies');
  });

  it('has @biomejs/biome and c8 in devDependencies', () => {
    const { devDependencies } = readJson('package.json');
    assert.ok(devDependencies?.['@biomejs/biome'], '@biomejs/biome missing from devDependencies');
    assert.ok(devDependencies?.c8, 'c8 missing from devDependencies');
  });
});

describe('ainj.config.json', () => {
  it('contains { skillsRef: "master" }', () => {
    const config = readJson('ainj.config.json');
    assert.equal(config.skillsRef, 'master');
  });
});

describe('biome.json', () => {
  it('has linter enabled', () => {
    const biome = readJson('biome.json');
    assert.equal(biome.linter?.enabled, true);
  });

  it('has formatter enabled', () => {
    const biome = readJson('biome.json');
    assert.equal(biome.formatter?.enabled, true);
  });

  it('has 2-space indent width', () => {
    const biome = readJson('biome.json');
    assert.equal(biome.formatter?.indentWidth, 2);
  });
});

describe('.env.sample', () => {
  it('documents AINJ_MCP_MAIN_PORT=3001', () => {
    const content = readText('.env.sample');
    assert.ok(content.includes('AINJ_MCP_MAIN_PORT=3001'), 'AINJ_MCP_MAIN_PORT=3001 not found');
  });

  it('documents AINJ_MCP_DOCS_PORT=3002', () => {
    const content = readText('.env.sample');
    assert.ok(content.includes('AINJ_MCP_DOCS_PORT=3002'), 'AINJ_MCP_DOCS_PORT=3002 not found');
  });
});

describe('.gitignore', () => {
  it('excludes node_modules/', () => {
    const lines = readText('.gitignore').split('\n');
    assert.ok(lines.includes('node_modules/'), 'node_modules/ not in .gitignore');
  });

  it('excludes .env', () => {
    const lines = readText('.gitignore').split('\n');
    assert.ok(lines.includes('.env'), '.env not in .gitignore');
  });

  it('excludes .ainj/', () => {
    const lines = readText('.gitignore').split('\n');
    assert.ok(lines.includes('.ainj/'), '.ainj/ not in .gitignore');
  });

  it('excludes coverage/', () => {
    const lines = readText('.gitignore').split('\n');
    assert.ok(lines.includes('coverage/'), 'coverage/ not in .gitignore');
  });
});
