# Agent D report 0021: D-09f, event subscribers as ES modules (04h to 04v)

Steps: D-09f (D3's first step). D-09h is not started: it needs D-09e applied (still todo on the board). Applies on top of the tree in `Xplayer-main.zip` (already contains D-0013 to D-0020: 06a, 06b, 06k and the leaf files are modules). Independent of D1's and D2's work except for one manifest hunk (see "Needs").
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup` is not reachable from my environment. No commit, no push. `.agent/BOARD.md` is not edited (yours).

## Rule used

As the board says: keep top-level `on(...)` calls and the current order. No `init` function.

## Changes

- `04h`, `04i`, `04j`, `04k`, `04l`, `04m`, `04n`, `04o`, `04p`, `04t`, `04u`, `04v` (`*-events.js`): one comment line and an empty `export {};` appended. Nothing else. They declare no function or variable and nothing else calls them, so there is nothing for `registerLegacyGlobals`. (`manifest.test.js` requires an `export` in every module, hence the empty one, as in `06e`.)
- `src/manifest.json`: the 12 entries moved from `"js"` to the **start** of `"modules"`, in the order they had (04h, 04i, 04j, 04k, 04l, 04m, 04n, 04o, 04p, 04t, 04u, 04v).
- New `tools/tests/event-subscribers-modules.test.js` (7 tests).
- `tools/change.log.txt`: one entry.

## Why order and timing are safe

- All 36 `on(...)` calls are in these 12 files; no other file subscribes (grep, and report 0013). So moving them cannot reorder them against other subscribers. Their order among themselves is unchanged.
- Modules run after every classic script. Before, the subscribers ran in the middle of the classic scripts; now after them. Anything emitted by a classic script while loading would be lost. The new test records every bus `dispatchEvent` and `addEventListener` in a real page and fails if one of these events is emitted before its subscriber exists. It passes. Placing the block first in `"modules"` means no other module runs before it.
- Handlers call classic names (`renderLeftPanelMainList`, `VIEWS`, `currentView`, ...) by bare name at event time; global functions and global `let`/`const` are visible from a module. Nothing in these files calls a module-private function, so the pinned call-sequence baselines did **not** change (no spied names dropped).

## Numbers

`node tools/dep-map.js` before and after: 113 files, 1058 globals, 81 file-level cycles, 27 load-time cross-file references, 0 forward, mutable globals written from other files 58: all identical (only the order of two lines differs).
`node tools/event-audit.js --strict`: exit 0, A 0, B 0, C 0, total 0 (plus 70 allowed by `fileExceptions`).

## Tests actually run

- Focused (manifest, events-wiring, events-a/b/c/d, converted-modules, listener-order, legacy-bridge, lint, event-bus, setters): 75 pass, 0 fail, real Chromium.
- New `event-subscribers-modules.test.js`: 7 pass.
- Sabotage (restored afterwards): moving `04t` to the end of `"modules"` fails 2 tests; a load-time `emit("lyrics:changed")` in `15a0` fails "no bus event is emitted before its subscriber exists".
- **Full suite (`node tools/tests/run.js`): 419 tests, 417 pass, 0 fail, 2 skipped** (the same two skips as in report 0020).
- Not run: real Electron; ESLint itself (not installable here, the registry is blocked; `lint.test.js` passes). Playwright 1.56 and acorn 8.18 were taken from `/opt/npm-tools`, not from `package-lock.json`.

## Needs from other agents

- You / D1 / D2: the `"modules"` hunk in `src/manifest.json` is at the very start of the list; D1 and D2 edit the same list further down. Apply patches one at a time; on a conflict keep both sides.
- A: `src/js/core/EVENTS.md` rule 5 says "revisit when files become modules". The rule stands (top-level `on(...)`); the doc is A's file, so I did not edit it.

## Not done

- D-09h (virtual scroll `05a`, `05b`, `05c`): waits for D-09e.

## For you (manual checks)

1. Start the real Electron app, play a song, then open Recents -> the recent list and its count update.
2. Pin and unpin a playlist, create and delete a playlist and a folder -> the left panel redraws and the notification shows.
3. Search in the main box and in the left panel, clear the left search -> the list and hero update.
4. Open Lyrics, import or edit lyrics -> the Lyrics view redraws. Switch right panel tabs to Recently played -> it fills.
5. Toggle gapless / crossfade in Settings -> the other checkbox follows.

## Next step

D-09h after D-09e is applied; D-09i last.
