# UI-A04c - Adapter API and source-backed runtime

**Date:** 2026-10-17  
**Status:** Implemented and verified  
**Source:** `E:\Programming\Music Player\Source`  
**Runtime:** `E:\.Storage.local\xplayer-test-runtime`

## Scope

Completed the P5 adapter API with 179 code lines across `store.js`, `actions.js`, and `events.js` (within D18's 300-line budget). State is exposed as read-only getters/copies; actions call the existing engine functions or wired transport controls; subscriptions are limited to the catalogued engine events and pass through the event detail with the existing unsubscribe function. The view bridge subscribes to `view:changed` and synchronizes rail selection, while supported rail navigation calls the existing `switchView`.

Added adapter behavior and boundary tests, including the 300-line gate, `src/js/` import prohibition outside adapter/components, and direct engine-global access checks. Updated `ENGINE-CONTRACT.md` with the delivered adapter boundary.

The runtime launcher now preserves the generated `ui-next` and `js` folders as `ui-next-built` and `js-built`, then creates junctions to the source UI and renderer. It retains the runtime Electron executable, output data, `player.js`, and isolated config. `--ui=next` remains selected; the source UI uses the runtime output for generated player data and the source junctions for UI and engine modules. The runtime instruction document records launch and verification steps.

## Changed files

**Source repository**

- `.agent/ui-redesign/ENGINE-CONTRACT.md`
- `src/ui-next/adapter/actions.js`
- `src/ui-next/adapter/engine-view.js`
- `src/ui-next/adapter/events.js`
- `src/ui-next/adapter/store.js`
- `src/ui-next/shell/shell.js`
- `tools/tests/ui-next-adapter-api.test.js`

**Test runtime**

- `Launch-Xplayer-UI-Next.bat`
- `Prepare-Source-Backed-Runtime.ps1`
- `README-SOURCE-RUNTIME.md`

`.agent/BOARD.md` and `tools/change.log.txt` were not modified. The prescribed `.agent/reports/TEMPLATE.md` was not present, so this report uses the repository's task-evidence sections.

## Verification

- `node --test tools/tests/ui-next-adapter-api.test.js tools/tests/ui-next-adapter-player.test.js tools/tests/ui-next-shell.test.js tools/tests/ui-next-library.test.js tools/tests/ui-next-phase1-gate.test.js tools/tests/ui-entry.test.js tools/tests/output-dir.test.js` — **66 passed, 0 failed, 0 skipped**.
- `npm run lint:strict` — **137 files checked, 0 errors, 0 warnings**.
- `git diff --check` — passed with no output.
- Runtime junction preparation was run twice; both `ui-next` and `js` links verified idempotently, and the original generated folders remain present.
- Launched Electron through `Launch-Xplayer-UI-Next.bat --remote-debugging-port=9340` with a temporary config override. The page opened at the runtime `ui-next/index.html` URL; resolving that entry followed the junction to `Source\src\ui-next\index.html`. The renderer engine was ready, `store.songs('all-songs')` returned 495 songs, and `js/main.js` resolved to `Source\src\js\main.js`. The existing isolated config was not used or changed during this smoke run.

No production build was run: the change does not modify build assembly, and the test runtime intentionally loads renderer source through junctions. No interactive Electron window-control checklist was performed; launch, source resolution, renderer boot, and adapter access were verified in the runtime smoke test.

## Deliverables and limitations

The implementation and tests are complete. Source and runtime changes are delivered in separate review patches. The source-backed runtime is intentionally Windows-path-specific and requires the source repository to remain at `E:\Programming\Music Player\Source`.
