# Agent A report 1

Covers A-01, A-02, A-03, A-05, A-06, A-07. A-04 needs you (see the end). Applies on top of `folders-event-slice.diff`.

## A-01 Analysis tool

`tools/dep-map.js` runs; `acorn` and `acorn-walk` are in `package.json` devDependencies.

| Measure | PLAN baseline | Before this patch | After this patch |
|---|---|---|---|
| Mutable globals written from other files | 52 | 52 | 52 (the other files still write them) |
| Writes from A's own files to globals they do not define | - | 35 | 0 |
| File-level cycles reported | 63 | 63 | 70 |
| Load-time cross-file references | 14 | 22 | 22 |

The cycle count rose from 63 to 70 because each setter file refers to variables declared in other files, which is an edge dep-map counts. This is expected: the setters sit apart from the variables on purpose, and the count falls again when A-15 moves each variable next to its setter. It does not affect load order.

The load-time references rose from 14 to 22 because each `04h`-`04o` subscriber file calls `on(...)` from `00b-events.js` at load. None is a forward reference (the tool reports 0 forward).

## A-02 Test baselines (run in the agent sandbox, Playwright available)

| Test | Result |
|---|---|
| shuffle, storage, recents, search-engine, manifest | pass (storage: 1 skipped, as shipped) |
| metadata-editor, playback-settings, scroll, search-ui, view-switch-song-list-cleanup | pass (scroll: 1 skipped, as shipped) |
| events-wiring, event-bus, setters (new), others in `tools/tests` | pass |

Nothing failed or could not run. These ran in a Linux sandbox, not on your machine, so run `tools/tests` once yourself before applying.

## A-03 Smoke checklist

`tools/smoke-checklist.md` copied from PLAN.md section 6.

## A-05 Event bus

The bus exists as `src/js/00b-events.js`, not `core/events.js`. API and catalog (17 data events plus 3 state events) are in `src/js/core/EVENTS.md`. B, C and D may start their Phase 2 steps.

## A-06 Setters

52 setters in 7 files under `src/js/core/` (`state-queue`, `state-playback-modes`, `state-now-playing`, `state-navigation`, `state-ghost-list`, `state-folders`, `state-ui`), registered in the manifest after `02-ghost-list.js`. Every one of the 52 names dep-map reports has one. Table in `src/js/core/SETTERS.md`. Three emit: `setPlaybackQueue` (`queue:changed`), `setCurrentQueueIndex` (`queue:indexChanged`), `setCurrentView` (`view:changed`); nothing subscribes yet. `tools/tests/setters.test.js` guards them.

## A-07 Writes in A's own files

35 direct assignments replaced with setter calls: `03e` 2, `03j` 4, `03m` 4, `09` 10, `99-player` 15. `node tools/dep-map.js writers` now lists only `03j` writing its own `selectedLibraryFolders`. `recents.test.js` now also loads `core/state-ghost-list.js`, because `03e` calls its setters.

Not done: removing variables from `00-state.js`. That waits for B, C and D to report which variables only they use.

## Not done, and why

- **A-04 module spike** needs Electron, which an agent cannot launch. You: build, open `App/electron.exe`, and paste the DevTools console output. A-10, A-11 and later wait on it.
- **A-08 remainder:** `03j` `changeMusicFolder()` still has an inline refresh that duplicates `library:rebuilt` but differs (calls `updateAllCounts()` twice, writes queue state). It needs the real backend to measure, so it is not converted. `03k` and `03m` stay as UI files.
- **A-09** waits for D-03.
- Archive per AGENTS.md section 1 (`E:\Backup\...`) was not made; the sandbox has no such drive. Make it before applying.
- `tools/change.log.txt` is empty in the zip; add your usual entry.
