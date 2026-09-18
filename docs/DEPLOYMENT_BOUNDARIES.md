# Deployment Boundaries

## Current sandbox state model

The current server implementation keeps active sandbox/provider/cache state in process-level globals such as:

- `global.activeSandbox`
- `global.activeSandboxProvider`
- `global.sandboxState`

These globals are referenced by multiple API routes, including sandbox creation, file retrieval, code generation, code application, status, and termination.

## Consequence

This architecture should be treated as **single-user / single-active-workspace per server process** unless a stronger isolation layer is added.

It is not sufficient to assume that a request's `sandboxId` automatically isolates all backend state: several code paths read the process global directly.

A shared multi-user deployment could therefore risk:

- one request observing another request's active sandbox state;
- file-cache or manifest cross-talk;
- one user terminating/replacing the process-global active provider;
- non-deterministic behavior when concurrent generations overlap.

This document is a deployment boundary, not a claim that cross-user leakage has been observed.

## Before multi-user production use

Introduce an explicit workspace/session key and move mutable sandbox state behind a keyed store:

```text
request
  -> authenticated/session workspace key
  -> workspace state lookup
  -> provider/sandbox/cache scoped to that key
  -> operation
  -> scoped update
```

The isolation key must be derived from a trusted application/session boundary, not accepted blindly from untrusted request input.

At minimum, tests should cover:

1. two concurrent workspaces cannot read each other's file cache;
2. killing workspace A does not terminate workspace B;
3. code generation uses the manifest associated with its own workspace;
4. stale workspace IDs fail closed;
5. process restart behavior is explicit;
6. cleanup/TTL prevents abandoned sandbox state from leaking indefinitely.

## Current recommendation

Until the above exists, deploy this fork only where one trusted user/workspace owns the server process at a time, or place an external isolation layer around each user/workspace instance.
