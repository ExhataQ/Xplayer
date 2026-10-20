# UI-A03 / A-04: shell and legacy DOM adapter

**Owner:** A. **Status:** In review. **Patch:** `ui-next-shell-and-adapter.patch`. **Apply after** `engine-contract-and-seek-fix.patch` (this patch edits the contract, board and test files that one adds).

## What the patch does

| File | Change |
|---|---|
| `src/ui-next/index.html` | Replaces the placeholder page with the shell. Loads `../player.js` and `../js/main.js` (the unchanged engine) after the adapter mounts |
| `src/ui-next/adapter/legacy-dom-adapter.js` | New. Builds every element the engine needs into 4 slots (138 code lines, budget 250) |
| `src/ui-next/adapter/legacy-icons.css` | New. The four Font Awesome glyphs the engine writes (`fa-play`, `fa-pause`, `fa-volume-up`, `fa-volume-mute`) drawn as Lucide masks (D12) |
| `src/ui-next/shell/shell.css`, `shell.js` | New. Title bar, rail, panel host, empty views, player host. Tokens only |
| `tools/tests/ui-next-shell.test.js` | New. 17 real-browser tests: the behavioral gate 1 to 14 from the contract |
| `.agent/ui-redesign/ENGINE-CONTRACT.md`, `.agent/BOARD.md`, this report | Updated: section 10.1 and 13, L-03, L-07, L-10, decision D14 |

No change to `src/js/`, `src/css/`, `build/`, or `electron/`. The old UI is untouched and stays the default.

## Evidence

**Boot:** zero page errors, zero failed requests, zero console errors; the engine clears `aria-busy`; 30 songs load.

**Gate (`node --test tools/tests/ui-next-shell.test.js`):** 17 of 17 pass, 4 consecutive runs, about 21 s each. Real mouse, real WAV, unmodified engine. Gates 1 to 12 drive the player; 13 and 14 are static checks (no list classes or hidden-host references outside `adapter/`, no JS lookup of adapter ids, adapter within budget).

**The gate can fail:** with `legacy-icons.css` unlinked, 2 tests fail; with `#repeat-one` dropped from the adapter, 8 fail.

**Engine node identity (gate 11):** 27 IDs and 2 classes keep their node through play, pause, next, previous, seek, mute, repeat, queue edit, list render and `library:rebuilt`.

**Visual check:** screenshots of the shell at rest, playing, with the logo menu open, and at 800x600.

**Full suite (`node tools/tests/run.js`, one core):** 447 tests, 437 passed, 9 failed, 1 skipped (before this patch: 430, 420, 9, 1). The 9 failures are the same 9 files as before, all `Cannot find module 'acorn'`, and they fail identically on the untouched baseline: `drag-drop-modules`, `lint`, `render-modules`, `setters`, `ui-core-render-module`, `ui-handlers` ("inline event handlers"), `ui-views-module`, `ui-virtual-scroll-modules`, `window-contract`. The sandbox has no network, so `acorn`, `acorn-walk`, `eslint` and `globals` could not be installed. **Those 9 files, including `lint`, have not run against this code: please run `npm test` after `npm i acorn acorn-walk eslint globals`.** In particular `lint` and `ui-handlers` scan source and should be checked against `src/ui-next/`.

## Findings while building

1. **The engine sizes the old player.** `applyFooterWidths()` writes inline `width`/`max-width` onto `.player-left-section` and its two siblings (it capped the left column at 187px). The new player leaves those class names out; the engine tolerates that. Contract L-07.
2. **The marquee needs specific CSS.** The engine scrolls long titles with an inline `translateX` and needs `text-overflow: clip` plus a 3px gutter. An ellipsis clipped the first and last characters. Ported into `shell.css`. Contract L-03.
3. **Engine-created overlays are unstyled (L-10, decision D14).** The shuffle dialog works and is tested, but it renders unstyled below the visible window, so a user clicking Shuffle in the new shell sees nothing. The same applies to context menus, playlist dialogs, lyrics editors, the metadata modal and toasts. Loading the old `css/` files is not an option: they restyle global classes such as `.container` and `.player-btn`.

## Not done, and why

- **D14 is open.** I did not add interim overlay styling because it is a scope decision and each overlay has an owning task.
- **Not built:** queue button and lyrics panel in the player bar (C-03, D-01), real views (B, C, D), logo (A-09), app menu items (A-05, D8 names only the groups).
- **Electron not run.** Click through the new shell once in the real app: window drag, minimize, maximize, close, back, forward.
- **How to open it:** start the app with `--ui=next` or set `XPLAYER_UI=next` (`electron/ui-entry.js`). Without the flag the old UI starts. I did not change the entry logic.

## How to apply

1. Snapshot the project (AGENTS.md section 1).
2. Apply `engine-contract-and-seek-fix.patch` first if you have not.
3. `git apply --check ui-next-shell-and-adapter.patch`, then `git apply ui-next-shell-and-adapter.patch` (add `--ignore-whitespace` if your git converts line endings).
4. `node --test tools/tests/ui-next-shell.test.js`, then `npm test` (after `npm i acorn acorn-walk eslint globals`).
