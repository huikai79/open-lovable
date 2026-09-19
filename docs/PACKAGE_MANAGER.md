# Package Manager Policy

This fork currently inherits multiple lockfiles from upstream:

- `package-lock.json`
- `pnpm-lock.yaml`
- `bun.lock`

The project README also documents multiple package managers. Deleting or regenerating inherited lockfiles without an upstream-aware migration would create unnecessary fork drift, so this hardening pass does **not** choose a new universal package manager.

## Verification baseline for this fork

GitHub Actions uses the npm path:

```bash
npm ci
npm run check
```

Therefore:

- `package.json` + `package-lock.json` are the reference pair for this fork's CI.
- A PR that changes runtime dependencies should keep the npm lockfile consistent so `npm ci` remains reproducible.
- pnpm/bun lockfiles remain inherited compatibility artifacts until the fork deliberately decides otherwise.

## If package-manager policy changes

Treat it as an explicit migration:

1. confirm upstream's current package-manager policy;
2. choose one reference manager and version;
3. regenerate its lockfile from a clean checkout;
4. update README, CLI scaffolding, CI, and deployment instructions together;
5. validate fresh installation and build;
6. only then remove obsolete lockfiles.

Do not casually update multiple lockfiles using different dependency-resolution runs and assume they describe an identical dependency graph.
