# Generation lifecycle

The generation UI currently coordinates several independent concerns in one page: sandbox lifecycle, website scraping, AI streaming, code application, and preview UI. This file documents the first refactoring boundary.

## Rule

Do not replace every boolean with one giant state machine. Keep independent lifecycles independent.

The shared **generation phase** covers only the user-visible generation pipeline:

```text
idle
 -> gathering
 -> planning
 -> generating
 -> applying
 -> complete

any active phase -> failed / cancelled
complete / failed / cancelled -> idle or gathering
```

The transition contract lives in `lib/generation-lifecycle.ts`.

## Existing state that should remain separate

- sandbox availability/identity;
- screenshot capture;
- selected file/folder UI;
- chat history;
- code-application detail;
- preview tab state.

These may correlate with generation but are not the same state.

## Migration strategy

1. Give `loadingStage` the shared `GenerationPhase` vocabulary.
2. Replace duplicated “busy” checks with `isGenerationBusy`.
3. Move start/complete/failure transitions behind one small helper.
4. Only after behavior is covered, remove redundant booleans such as overlapping “starting/generating/streaming” flags.
5. Keep streaming sub-state separate when it represents transport rather than generation phase.

This avoids a high-risk rewrite of `app/generation/page.tsx` while still creating one explicit contract for future changes.
