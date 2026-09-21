# Workspace Runtime Architecture

## Purpose

V3 removes the builder's primary sandbox state from process-wide globals and scopes it to a browser-session workspace key.

The workspace key is an **isolation namespace**, not authentication. It prevents unrelated builder sessions in the same server process from sharing the same mutable sandbox/cache/conversation state. It does not prove user identity or authorize access by itself.

## Request flow

```text
browser session
  -> getOrCreateWorkspaceKey()
  -> X-Open-Lovable-Workspace header
  -> getWorkspaceRuntimeForRequest()
  -> workspace runtime
       - provider / sandbox metadata
       - file cache + manifest
       - existing file set
       - conversation state
       - Vite restart state
```

The browser stores the key in `sessionStorage`, so a new browser tab/session can have an independent runtime.

Missing workspace headers fail closed on workspace-aware routes instead of silently joining a shared default runtime.

## Workspace-scoped endpoints

The v3 builder path scopes sandbox state for:

- conversation state
- create sandbox v2
- sandbox status / kill
- file discovery and manifest cache
- AI generation stream
- streamed and non-streamed code application
- package installation and package detection
- command execution
- Vite restart and log inspection
- project zip export

Server-to-server calls between these routes must forward the workspace header rather than falling back to the default runtime.

## Provider boundary

Workspace state stores the `SandboxProvider` abstraction. File discovery, package management, commands, and most lifecycle operations should use provider methods instead of reaching directly into provider-specific sandbox SDK objects.

Binary zip export is currently an exception because it needs provider-specific binary access.

## Legacy boundary

`/api/create-ai-sandbox` is the old v1 route and still uses process globals. The current generation page uses `/api/create-ai-sandbox-v2`.

V3 does **not** claim the legacy route is workspace-isolated. New code must not add dependencies on it. A later cleanup can remove or migrate it after confirming no external caller relies on it.

## Security boundary

The workspace header is intentionally not an authentication credential.

A multi-user public deployment still needs a trusted identity/session layer that binds a workspace key to an authenticated principal. Without that binding, a client that learns another workspace key could attempt to address that namespace.

## Regression contract

A workspace-aware route should:

1. obtain runtime state through `getWorkspaceRuntimeForRequest`;
2. avoid `global.activeSandbox*`, `global.sandboxState`, and `global.existingFiles`;
3. forward `X-Open-Lovable-Workspace` on internal fetches to stateful routes;
4. use `SandboxProvider` methods where practical;
5. fail with "no active sandbox for this workspace" instead of falling back to another workspace's active provider.


## Pre-merge provider smoke gate

The existing `Quality` workflow can be manually dispatched against this branch before merge.

Use:

- **mode:** `provider-smoke`
- **provider:** `e2b` or `vercel`
- **confirm_external_costs:** `true`

The job first runs normal static quality, then starts the built Next application and exercises one real workspace through:

```text
create-ai-sandbox-v2
  -> sandbox-status
  -> get-sandbox-files
  -> run-command-v2 ("printf open-lovable-provider-smoke")
  -> kill-sandbox
```

The provider-smoke job is deliberately manual because creating an external sandbox may incur provider usage/cost. A normal pull request or push never runs this external smoke path.

Required repository secrets:

- E2B: `E2B_API_KEY`
- Vercel PAT path: `VERCEL_TOKEN`, `VERCEL_TEAM_ID`, `VERCEL_PROJECT_ID`

A passing smoke run proves that the selected provider can complete this lifecycle on the tested revision. It does not prove multi-region persistence, multi-user authorization, or long-running reliability.
