import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_WORKSPACE_KEY,
  clearWorkspaceRuntime,
  getWorkspaceKey,
  getWorkspaceRuntime,
  listWorkspaceRuntimeKeys,
  normalizeWorkspaceKey,
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
