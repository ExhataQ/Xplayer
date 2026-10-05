# Agent A report 0009: start-up error "normalizeIdList is not defined"

Steps: fix for A-13 (found by you in the app). Applies on top of: the zip `179de2e1-Xplayer-main_1` (A-13, B-07, D-05 and D-07 applied).
Archive (.agent/AGENTS.md section 1): not done, nothing archived.

## What went wrong

The stack ends in `preload.js:38`, which is the `cb(updates)` of `onScanCoverBatch`. The main process sends cover-scan messages while the page is still loading. ES modules (including `core/storage-schema.js`, where `normalizeIdList` lives) run after all classic scripts, so a message that arrives in between runs its callback before the module has registered its names. The same window already existed for `SONGS_DATA` (declared in `player.js`, the last script) but was shorter; making files modules widened it. I reproduced it in a test page by calling the callback the moment it is subscribed: it fails with `SONGS_DATA is not defined`, the same kind of error.

## Changes

- src/js/core/legacy.js: `whenAppReady(fn)`. Runs `fn` once start-up has finished (all scripts, all `DOMContentLoaded` handlers), at once if it already has; callbacks queued early run in the order they arrived; one that throws is logged and the rest still run. Registered on `window`.
- src/js/03k-cover-sync.js: the two cover-scan callbacks run inside `whenAppReady`.
- src/js/core/LEGACY.md: section "Start-up order and `whenAppReady`".
- tools/tests/startup-gate.test.js (new, 3 tests): early messages are applied afterwards and in order, with no page error; a throwing callback does not stop the next; after start-up the function runs at once.
- tools/change.log.txt.

## Tests actually run

- Full suite: see my reply for the count.
- With the gate removed from `onScanCoverBatch` in `03k`, the new tests fail.

## Needs from other agents

- B: `15e-controls-audio-events.js` registers `onThumbarPrev/PlayPause/Next` and `onWindowMaximize` while loading. The thumbnail buttons are user-driven, but `onWindowMaximize` can also be sent by the main process at any time, so wrap those callback bodies in `whenAppReady` too (or use `desktopApi.window.*` once A-14 is in: it will do this for every event subscription).

## Not done

- No other file was changed. Other callbacks driven from outside the page are not known to exist; `grep -n "electronAPI.on" src/js` lists them.

## For you (manual checks)

1. Start the app with a library whose covers are still being scanned -> no `is not defined` error in the console, covers appear.
