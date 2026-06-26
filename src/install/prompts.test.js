import assert from 'node:assert/strict';
import { afterEach, describe, it, mock } from 'node:test';

import { main } from './index.js';
import { runDefaults, runWizard } from './prompts.js';

// ─── runDefaults() ────────────────────────────────────────────────────────────

describe('runDefaults()', () => {
  it('no harness found: writes nonInteractive state with null defaultHarness', async () => {
    let written;
    await runDefaults({
      _which: () => null,
      _writeState: (_scope, data) => {
        written = data;
      },
    });
    assert.equal(written.nonInteractive, true);
    assert.equal(written.defaultHarness, null);
    assert.equal(written.scope, 'global');
    assert.deepEqual(written.ports, { main: 3001, docs: 3002 });
    assert.deepEqual(written.harnesses, []);
  });

  it('claude found: defaultHarness is "claude"', async () => {
    let written;
    await runDefaults({
      _which: (name) => (name === 'claude' ? '/usr/bin/claude' : null),
      _writeState: (_scope, data) => {
        written = data;
      },
    });
    assert.equal(written.defaultHarness, 'claude');
  });

  it('only codex found: defaultHarness is "codex"', async () => {
    let written;
    await runDefaults({
      _which: (name) => (name === 'codex' ? '/usr/bin/codex' : null),
      _writeState: (_scope, data) => {
        written = data;
      },
    });
    assert.equal(written.defaultHarness, 'codex');
  });
});

// ─── runWizard() ─────────────────────────────────────────────────────────────

function makePromptMocks({
  selectValue = 'global',
  textValues = ['3001', '3002'],
  multiselectValue = [],
} = {}) {
  let textCallCount = 0;
  return {
    intro: () => {},
    select: async () => selectValue,
    text: async () => textValues[textCallCount++],
    multiselect: async () => multiselectValue,
    outro: () => {},
    cancel: () => {},
    isCancel: () => false,
  };
}

describe('runWizard()', () => {
  afterEach(() => mock.restoreAll());

  it('happy path: writes state with collected values as correct types', async () => {
    let writtenScope;
    let written;
    const mockP = makePromptMocks({
      selectValue: 'local',
      textValues: ['4001', '4002'],
      multiselectValue: ['claude'],
    });
    await runWizard({
      _p: mockP,
      _which: () => null,
      _readState: () => ({}),
      _writeState: (scope, data) => {
        writtenScope = scope;
        written = data;
      },
      _writeHarnessConfigs: () => {},
      _installSkills: () => {},
    });
    assert.equal(writtenScope, 'local');
    assert.equal(written.scope, 'local');
    assert.deepEqual(written.ports, { main: 4001, docs: 4002 });
    assert.deepEqual(written.harnesses, ['claude']);
    assert.equal(written.defaultHarness, null);
  });

  it('uses existing state as prompt defaults', async () => {
    const existingState = {
      scope: 'global',
      ports: { main: 9001, docs: 9002 },
      harnesses: ['codex'],
    };
    const selectCalls = [];
    const textCalls = [];
    const mockP = {
      intro: () => {},
      select: async (opts) => {
        selectCalls.push(opts);
        return opts.initialValue;
      },
      text: async (opts) => {
        textCalls.push(opts);
        return String(opts.initialValue);
      },
      multiselect: async (opts) => opts.initialValues ?? [],
      outro: () => {},
      cancel: () => {},
      isCancel: () => false,
    };
    await runWizard({
      _p: mockP,
      _which: () => null,
      _readState: () => existingState,
      _writeState: () => {},
      _writeHarnessConfigs: () => {},
      _installSkills: () => {},
    });
    assert.equal(selectCalls[0].initialValue, 'global');
    assert.equal(textCalls[0].initialValue, '9001');
    assert.equal(textCalls[1].initialValue, '9002');
  });

  it('prefers local scope state over global for pre-population', async () => {
    const localState = { scope: 'local', ports: { main: 8001, docs: 8002 }, harnesses: ['cursor'] };
    const selectCalls = [];
    const mockP = {
      intro: () => {},
      select: async (opts) => {
        selectCalls.push(opts);
        return opts.initialValue;
      },
      text: async (opts) => String(opts.initialValue),
      multiselect: async (opts) => opts.initialValues ?? [],
      outro: () => {},
      cancel: () => {},
      isCancel: () => false,
    };
    await runWizard({
      _p: mockP,
      _which: () => null,
      _readState: (scope) => (scope === 'local' ? localState : {}),
      _writeState: () => {},
      _writeHarnessConfigs: () => {},
      _installSkills: () => {},
    });
    assert.equal(selectCalls[0].initialValue, 'local');
  });

  it('harness option value is "claude" not "claude-code"', async () => {
    let multiselectOpts;
    const mockP = {
      intro: () => {},
      select: async () => 'global',
      text: async (opts) => String(opts.initialValue),
      multiselect: async (opts) => {
        multiselectOpts = opts;
        return [];
      },
      outro: () => {},
      cancel: () => {},
      isCancel: () => false,
    };
    await runWizard({
      _p: mockP,
      _which: () => null,
      _readState: () => ({}),
      _writeState: () => {},
      _writeHarnessConfigs: () => {},
      _installSkills: () => {},
    });
    const optionValues = multiselectOpts.options.map((o) => o.value);
    assert.ok(optionValues.includes('claude'), '"claude" must be an option value');
    assert.ok(!optionValues.includes('claude-code'), '"claude-code" must not appear');
  });

  it('calls writeHarnessConfigs with (harnesses, scope, mainPort as number, docsPort as number)', async () => {
    let captured;
    const mockP = makePromptMocks({
      selectValue: 'local',
      textValues: ['4001', '4002'],
      multiselectValue: ['claude', 'codex'],
    });
    await runWizard({
      _p: mockP,
      _which: () => null,
      _readState: () => ({}),
      _writeState: () => {},
      _writeHarnessConfigs: (...args) => { captured = args; },
      _installSkills: () => {},
    });
    assert.deepEqual(captured, [['claude', 'codex'], 'local', 4001, 4002]);
  });

  it('calls installSkills() after writeHarnessConfigs', async () => {
    const calls = [];
    const mockP = makePromptMocks({ multiselectValue: ['claude'] });
    await runWizard({
      _p: mockP,
      _which: () => null,
      _readState: () => ({}),
      _writeState: () => {},
      _writeHarnessConfigs: () => { calls.push('writeHarnessConfigs'); },
      _installSkills: async () => { calls.push('installSkills'); },
    });
    assert.ok(calls.includes('installSkills'), 'installSkills must be called');
    assert.ok(
      calls.indexOf('writeHarnessConfigs') < calls.indexOf('installSkills'),
      'writeHarnessConfigs must be called before installSkills',
    );
  });

  it('cancel at scope prompt: exits 0 without writing state', async () => {
    let writeStateCalled = false;
    const CANCEL = {};
    const exitMock = mock.method(process, 'exit', () => {});
    const mockP = {
      intro: () => {},
      select: async () => CANCEL,
      text: async () => {},
      multiselect: async () => {},
      outro: () => {},
      cancel: () => {},
      isCancel: (v) => v === CANCEL,
    };
    await runWizard({
      _p: mockP,
      _which: () => null,
      _readState: () => ({}),
      _writeState: () => {
        writeStateCalled = true;
      },
    });
    assert.equal(writeStateCalled, false);
    assert.equal(exitMock.mock.calls[0].arguments[0], 0);
  });
});

// ─── index.js main() ─────────────────────────────────────────────────────────

describe('index.js main()', () => {
  it('no TTY: calls runDefaults', async () => {
    const mockDefaults = mock.fn(async () => {});
    const mockWizard = mock.fn(async () => {});
    await main(false, { _runDefaults: mockDefaults, _runWizard: mockWizard });
    assert.equal(mockDefaults.mock.calls.length, 1);
    assert.equal(mockWizard.mock.calls.length, 0);
  });

  it('TTY present: calls runWizard', async () => {
    const mockDefaults = mock.fn(async () => {});
    const mockWizard = mock.fn(async () => {});
    await main(true, { _runDefaults: mockDefaults, _runWizard: mockWizard });
    assert.equal(mockDefaults.mock.calls.length, 0);
    assert.equal(mockWizard.mock.calls.length, 1);
  });
});

// ─── install-cli.js run() ────────────────────────────────────────────────────

describe('install-cli.js run()', () => {
  it('no TTY: calls runDefaults', async () => {
    const mockDefaults = mock.fn(async () => {});
    const mockWizard = mock.fn(async () => {});
    const { run } = await import('../cli/install-cli.js');
    await run([], { _isTTY: false, _runDefaults: mockDefaults, _runWizard: mockWizard });
    assert.equal(mockDefaults.mock.calls.length, 1);
    assert.equal(mockWizard.mock.calls.length, 0);
  });

  it('TTY present: calls runWizard', async () => {
    const mockDefaults = mock.fn(async () => {});
    const mockWizard = mock.fn(async () => {});
    const { run } = await import('../cli/install-cli.js');
    await run([], { _isTTY: true, _runDefaults: mockDefaults, _runWizard: mockWizard });
    assert.equal(mockDefaults.mock.calls.length, 0);
    assert.equal(mockWizard.mock.calls.length, 1);
  });
});
