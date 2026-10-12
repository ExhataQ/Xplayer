# Agent D report 0011: additions to D-0010 (D-05), and the D-09 plan

Steps: D-05 (rest), D-09 planning. Applies on top of: the zip plus `D-0010-D05-inline-handlers-part2.patch` (report 0010). Shipped as one combined patch.
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup\...` is not reachable from my environment.

## Changes

- `04a-ui-render-core.js`: the add-to-queue button uses `actionAttrs('addSongToQueueNext', [id], { stop: true })`, `data-stop-dblclick` and `data-song-id`. `renderRightPanelItem` accepts `action: [name, args]` and `menuArgs: [...]`; the old `onClick` and `contextMenuArgs` strings still work, so B and C can move their callers later (3 inline handlers stay in 04a for that, down from 5).
- `07a-ui-actions.js`: new `rightPanelItemMenu` (context menu with extra arguments, with `preventDefault`, as the old inline code), and lazy actions `addSongToQueueNext`, `playFromQueue`, `selectOnlineLyricsPickerSong`.
- `04e-render-favorites-history.js`: the recent-songs rows use `action`.
- `10c-playback-queue.js` (**B's file, one line**): the add-to-queue button is found by `.add-to-queue-btn[data-song-id="${songId}"]`. The old `[onclick*="${songId}"]` selector stops matching once the button is converted, and it also matched ids that merely contain the number.
- `tools/tests/ui-handlers.test.js`: 04a ceiling 5 -> 3; 4 browser tests: dialogs (every button, click inside, overlay), add to queue, filter tags, right-panel rows (new fields and old strings, including `preventDefault`).
- `.agent/PLAN.md`, `.agent/BOARD.md`: D-09 split into D-09a to D-09i with dependencies, D-05 status, next actions. `tools/change.log.txt`: entry added.

## Findings

- I wrote the dialog, filter-tag and add-to-queue tests for my own earlier attempt, before I saw report 0010. They pass unchanged on the D-0010 code (its dialogs behave the same as the old ones: same calls, clicks inside stay inside and do not reach `document` listeners, overlay closes). That is an independent check of D-0010.
- `06b` still reassigns `closePlaylistModal` (four dialogs) and `closeAddLinkModal`, and creates and deletes `window.handleEditPlaylistCover` and `window._editPlaylistTempCover`. That is fine today (actions look the function up when clicked) but breaks when `06b` becomes a module. Written into D-09a and D-09d.
- `data-action="switchView"` in the template depends on `19-online-lyrics.js` (C) registering `switchView`. It works, but if C moves or renames that registration the left-panel items stop working. The guard test would catch it.
- The selectors `.left-panel-item[onclick*="favorites"]` (99-player) and `[onclick*="recent"]` (04h) match nothing, before and after. Dead code.

## Numbers

`node tools/dep-map.js`: mutable globals written from other files 54 (unchanged), load-time references 28, forward 0 (unchanged), **file-level cycles 75 -> 81**. The rise comes from D-0010 itself (more call-through actions in `07a`; the zip plus D-0010 alone also gives 81), not from these additions. It does not matter for classic scripts, but it is the number D-09 has to bring down, so it is recorded here.
`node tools/event-audit.js --strict`: exit 0.

## Tests actually run (Chromium via Playwright)

- `ui-handlers.test.js`: 24 of 24 pass.
- Sabotage (restored afterwards): putting the old `onclick*=` selector back in 10c fails the add-to-queue test; removing `preventDefault` from `rightPanelItemMenu` fails the right-panel test.
- Full suite, `node --test tools/tests/*.test.js`: **302 tests, 300 pass, 0 fail, 2 skipped** (the same two skips as before). My first version used a computed action name and the bridge guard test (`action names are literal`) failed it; the right-panel rows now pick from a table with written-out names.
- Not run: real Electron.

## Needs from other agents

- **B:** confirm the one-line selector change in `10c`. Then apply D-0012 (the four `renderRightPanelItem` calls in `10c` use `action` / `menuArgs`).
- **C:** apply D-0012 (the one `renderRightPanelItem` call in `19` uses `action`).
- **A:** update the status line in `core/LEGACY.md` (it still says no handler is converted).

## For you (manual checks)

1. Click the "+" on songs 1, 10, 11 (and any other ids that contain each other) -> the flash is on that song's button only, and the song is added next in the queue; double-clicking "+" does not play the song.
2. Open the Recent (history) tab: click a row -> it plays; right-click and "..." -> the song menu opens, with no browser menu.
3. Queue tab: click a row, right-click, "...": same as before (D-0012 changes these call sites).
4. Everything in report 0010's manual list.

## Next step

B and C apply D-0012; then D-05 is done and D-09a can be run (it does not wait for D-05).
