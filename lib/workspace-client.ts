'use client';

const WORKSPACE_STORAGE_KEY = 'open-lovable-workspace-key';
export const WORKSPACE_HEADER = 'X-Open-Lovable-Workspace';

export function getOrCreateWorkspaceKey(): string {
  if (typeof window === 'undefined') return 'default';

  const existing = window.sessionStorage.getItem(WORKSPACE_STORAGE_KEY);
  if (existing) return existing;

  const generated =
    globalThis.crypto?.randomUUID?.() ??
    `workspace-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.sessionStorage.setItem(WORKSPACE_STORAGE_KEY, generated);
  return generated;
}

export async function workspaceFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const headers = new Headers(init.headers || {});
  headers.set(WORKSPACE_HEADER, getOrCreateWorkspaceKey());
  return fetch(input, {
    ...init,
    headers,
  });
}
