import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_WORKSPACE_KEY,
  clearWorkspaceRuntime,
  finishWorkspaceCreation,
  getOrStartWorkspaceCreation,
  getWorkspaceKey,
  getWorkspaceRuntime,
  listWorkspaceRuntimeKeys,
  normalizeWorkspaceKey,
  requestWorkspaceTermination,
} from '../lib/sandbox/workspace-runtime.ts';

test('workspace keys are validated', () => {
  assert.equal(normalizeWorkspaceKey(undefined), DEFAULT_WORKSPACE_KEY);
  assert.equal(normalizeWorkspaceKey('abc-123_test'), 'abc-123_test');
  assert.throws(() => normalizeWorkspaceKey('bad key with spaces'));
});

test('workspace runtimes isolate mutable state', () => {
  const a = getWorkspaceRuntime('test-a');
  const b = getWorkspaceRuntime('test-b');

  a.existingFiles.add('a.ts');
  a.fileCache = {
    files: {
      'a.ts': { content: 'A', lastModified: 1 },
    },
    lastSync: 1,
    sandboxId: 'sandbox-a',
  };

  assert.equal(a.existingFiles.has('a.ts'), true);
  assert.equal(b.existingFiles.has('a.ts'), false);
  assert.equal(b.fileCache, null);
  assert.ok(listWorkspaceRuntimeKeys().includes('test-a'));
  assert.ok(listWorkspaceRuntimeKeys().includes('test-b'));
});


test('workspace request requires an explicit header', () => {
  const request = new Request('https://example.test/api');
  assert.throws(
    () => getWorkspaceKey(request),
    /Missing required workspace header/,
  );
});

test('workspace request accepts a valid explicit header', () => {
  const request = new Request('https://example.test/api', {
    headers: { 'x-open-lovable-workspace': 'workspace-explicit' },
  });
  assert.equal(getWorkspaceKey(request), 'workspace-explicit');
});

test('same workspace key reuses runtime and clear removes it', () => {
  const first = getWorkspaceRuntime('workspace-reuse');
  const second = getWorkspaceRuntime('workspace-reuse');
  assert.equal(first, second);

  clearWorkspaceRuntime('workspace-reuse');
  assert.equal(listWorkspaceRuntimeKeys().includes('workspace-reuse'), false);

  const third = getWorkspaceRuntime('workspace-reuse');
  assert.notEqual(first, third);
});


test('concurrent workspace creation reuses one promise', async () => {
  const runtime = getWorkspaceRuntime('workspace-create-lock');
  let factoryCalls = 0;

  const factory = async () => {
    factoryCalls += 1;
    return {
      sandboxId: 'sandbox-create-lock',
      url: 'https://sandbox.example',
      provider: 'test',
    };
  };

  const first = getOrStartWorkspaceCreation(runtime, factory);
  const second = getOrStartWorkspaceCreation(runtime, factory);

  assert.equal(first, second);
  assert.equal(factoryCalls, 1);

  const result = await first;
  assert.equal(result.sandboxId, 'sandbox-create-lock');

  finishWorkspaceCreation(runtime, first);
  assert.equal(runtime.creationPromise, null);
  clearWorkspaceRuntime('workspace-create-lock');
});

test('termination blocks new workspace creation', () => {
  const runtime = getWorkspaceRuntime('workspace-termination');
  requestWorkspaceTermination(runtime);

  assert.equal(runtime.terminationRequested, true);
  assert.throws(
    () =>
      getOrStartWorkspaceCreation(runtime, async () => ({
        sandboxId: 'should-not-start',
        url: 'https://sandbox.example',
      })),
    /termination is in progress/,
  );

  clearWorkspaceRuntime('workspace-termination');
});

test('finishWorkspaceCreation cannot clear a newer promise', async () => {
  const runtime = getWorkspaceRuntime('workspace-finish-ownership');
  const first = Promise.resolve({
    sandboxId: 'sandbox-old',
    url: 'https://old.example',
  });
  const second = Promise.resolve({
    sandboxId: 'sandbox-new',
    url: 'https://new.example',
  });

  runtime.creationPromise = second;
  finishWorkspaceCreation(runtime, first);
  assert.equal(runtime.creationPromise, second);

  finishWorkspaceCreation(runtime, second);
  assert.equal(runtime.creationPromise, null);
  clearWorkspaceRuntime('workspace-finish-ownership');
});
