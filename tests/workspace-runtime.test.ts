import assert from 'node:assert/strict';
import test from 'node:test';

import {
  DEFAULT_WORKSPACE_KEY,
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
