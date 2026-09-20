# Workspace Runtime v3

The v3 builder path scopes mutable sandbox state to a browser-session workspace key.

## Request flow

```text
browser session
  -> X-Open-Lovable-Workspace
  -> workspace runtime registry
  -> provider / sandbox metadata / file cache / existing-files set
  -> API operation
```

The same workspace header is propagated through core builder calls and relevant server-to-server calls.

## What this fixes

The primary builder path no longer relies on one process-global active sandbox, file cache, conversation history, package operation target, command target, or Vite restart state.

A boundary regression check scans API routes and fails if forbidden process-global sandbox state is reintroduced outside the explicit legacy allowlist.

## Important security boundary

The workspace key is a **runtime namespace, not authentication or authorization**. It isolates in-process mutable state between browser sessions, but it does not establish user identity.

A multi-user production deployment still needs a trusted authenticated principal/session and authorization binding. The server must not treat possession of an arbitrary workspace key as proof that a caller owns a workspace.

The registry is also process-local. It does not provide persistence or coordination across multiple server processes/regions.

## Legacy route

`/api/create-ai-sandbox` remains an explicitly allowlisted legacy v1 route that uses process-global state. The v3 builder uses `/api/create-ai-sandbox-v2`.

Do not add new callers to the legacy route.
