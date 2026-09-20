import type { SandboxFileCache } from '@/types/sandbox';
import type { ConversationState } from '@/types/conversation';

export const WORKSPACE_HEADER = 'x-open-lovable-workspace';
export const DEFAULT_WORKSPACE_KEY = 'default';

export interface WorkspaceRuntime {
  workspaceKey: string;
  provider: any | null;
  sandbox: any | null;
  sandboxData: { sandboxId: string; url: string } | null;
  fileCache: SandboxFileCache | null;
  existingFiles: Set<string>;
  conversationState: ConversationState | null;
  lastViteRestartTime: number;
  viteRestartInProgress: boolean;
  creationPromise: Promise<{ sandboxId: string; url: string; provider?: string }> | null;
  createdAt: number;
  lastAccessed: number;
}

declare global {
  // eslint-disable-next-line no-var
  var __openLovableWorkspaceRuntimes: Map<string, WorkspaceRuntime> | undefined;
}

const registry =
  globalThis.__openLovableWorkspaceRuntimes ??
  new Map<string, WorkspaceRuntime>();

globalThis.__openLovableWorkspaceRuntimes = registry;

export function normalizeWorkspaceKey(value: string | null | undefined): string {
  const candidate = String(value || DEFAULT_WORKSPACE_KEY).trim();
  if (!candidate) return DEFAULT_WORKSPACE_KEY;
  if (candidate.length > 128 || !/^[A-Za-z0-9._-]+$/.test(candidate)) {
    throw new Error('Invalid workspace key');
  }
  return candidate;
}

export function getWorkspaceKey(request?: Request): string {
  if (!request) return DEFAULT_WORKSPACE_KEY;
  const value = request.headers.get(WORKSPACE_HEADER);
  if (!value) {
    throw new Error(`Missing required workspace header: ${WORKSPACE_HEADER}`);
  }
  return normalizeWorkspaceKey(value);
}

export function getWorkspaceRuntime(workspaceKey: string): WorkspaceRuntime {
  const key = normalizeWorkspaceKey(workspaceKey);
  const existing = registry.get(key);
  if (existing) {
    existing.lastAccessed = Date.now();
    return existing;
  }

  const runtime: WorkspaceRuntime = {
    workspaceKey: key,
    provider: null,
    sandbox: null,
    sandboxData: null,
    fileCache: null,
    existingFiles: new Set<string>(),
    conversationState: null,
    lastViteRestartTime: 0,
    viteRestartInProgress: false,
    creationPromise: null,
    createdAt: Date.now(),
    lastAccessed: Date.now(),
  };
  registry.set(key, runtime);
  return runtime;
}

export function getWorkspaceRuntimeForRequest(request?: Request): WorkspaceRuntime {
  return getWorkspaceRuntime(getWorkspaceKey(request));
}

export function clearWorkspaceRuntime(workspaceKey: string): void {
  registry.delete(normalizeWorkspaceKey(workspaceKey));
}

export function listWorkspaceRuntimeKeys(): string[] {
  return Array.from(registry.keys());
}
