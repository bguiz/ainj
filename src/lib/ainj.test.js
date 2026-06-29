import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { cli, mcp, skills } from './ainj.js';
import { McpClient } from './mcp/client.js';

// ---------------------------------------------------------------------------
// Cycle 1 — tracer bullet: cli is a function
// ---------------------------------------------------------------------------

describe('ainj API surface — cli', () => {
  it('cli is a function', () => {
    assert.equal(typeof cli, 'function');
  });
});

// ---------------------------------------------------------------------------
// Cycle 2 — mcp is a non-null object with main and docs
// ---------------------------------------------------------------------------

describe('ainj API surface — mcp', () => {
  it('mcp is a non-null object', () => {
    assert.ok(mcp !== null && typeof mcp === 'object');
  });

  it('mcp has main and docs properties', () => {
    assert.ok('main' in mcp);
    assert.ok('docs' in mcp);
  });

  it('mcp.main is a McpClient instance', () => {
    assert.ok(mcp.main instanceof McpClient);
  });

  it('mcp.docs is a McpClient instance', () => {
    assert.ok(mcp.docs instanceof McpClient);
  });

  it('mcp.main and mcp.docs are independent objects', () => {
    assert.notEqual(mcp.main, mcp.docs);
  });

  it('mutating mcp.main does not affect mcp.docs', () => {
    mcp.main.__testMarker = true;
    assert.equal(mcp.docs.__testMarker, undefined);
    Reflect.deleteProperty(mcp.main, '__testMarker');
  });
});

// ---------------------------------------------------------------------------
// Cycles 3-6 — skills object and its three methods
// ---------------------------------------------------------------------------

describe('ainj API surface — skills', () => {
  it('skills is a non-null object', () => {
    assert.ok(skills !== null && typeof skills === 'object');
  });

  it('skills.run is a function', () => {
    assert.equal(typeof skills.run, 'function');
  });

  it('skills.runWithClaude is a function', () => {
    assert.equal(typeof skills.runWithClaude, 'function');
  });

  it('skills.runWithCodex is a function', () => {
    assert.equal(typeof skills.runWithCodex, 'function');
  });
});
