# Agent D report 0005: dead code and the lint warning

Steps: D-05. Applies on top of: D-0004-left-panel-list-helper.patch.
Archive (.agent/AGENTS.md section 1): not done as written (`E:\` not reachable from the sandbox); the uploaded `Source-backup1.zip` stayed untouched as the snapshot.

## Changes

Each name was grepped over `src tools electron build README.md claude.md` before removal:

- `PAUSE_ICON_HTML` (`src/js/00-state.js`): the only hit besides the definition is a prose list in `tools/prompt.txt` (line 425, not code). It pointed to `icons/pause.svg`, which does not exist. Removed.
- `src/assets/icons/main-pause.svg`: no hit for `main-pause` anywhere. Deleted.
- `"pause.svg"` in the icon copy list of `build/music_player.py`: the file does not exist, and the loop skips missing files, so the entry only did nothing. Removed; `pause.png` (exists) is still copied.
- `currentContextPlaylistId` (`src/js/06a-context-menus.js`): one declaration and one `= null` assignment, never read (the plan's lint warning). Both removed. Its neighbour `currentContextSongId` is not part of this step and was not touched.
- `tools/change.log.txt`: entry appended.

## Numbers

Lint before and after (see "Tests"): 0 errors, 1 warning -> 0 errors, 0 warnings (`node tools/lint.js --strict` exits 0).
`node tools/tests/run.js --timing`, seconds: `output-dir` 0.4, `lint` 2.5, `manifest` 0.3, `legacy-bridge` 21.5, `converted-modules` 7.3, `electron-injected-names` 7.4, `ui-core-render-module` 3.0, `player-bar` 8.8, `playback-modules` 11.6.
`node tools/dep-map.js`: 58 / 2 + 69 / 148 (forward 0), unchanged.
`node tools/event-audit.js --strict`: exit 0, A 0, B 0, C 0, total 0 (plus 70 allowed by fileExceptions).

## Tests actually run

- `output-dir` (the build test), `lint` (unit), `manifest`, `legacy-bridge`, `converted-modules`, `electron-injected-names`, `ui-core-render-module`, `player-bar`, `playback-modules`: 77 tests, all pass.
- Lint: ran with a stand-in for the `globals` package (the real one cannot be installed in this sandbox: the egress policy blocks registry.npmjs.org). The stand-in lists the browser globals read from the headless Chromium and the Node globals. It reproduced the plan's baseline exactly on the untouched tree (0 errors, 1 warning, the same `currentContextPlaylistId` message), so the 0 / 0 after the change is credible, but please run `npm run lint:strict` once on your machine.
- Not run: `build/music_player.py` end to end with the real Electron output (the build test covers the copy logic; no packaging was done here), scanner and metadata tests.

## Needs from other agents

- A: `tools/prompt.txt` line 425 lists `PAUSE_ICON_HTML` in a prose inventory and lines 171 and 983 mention `pause.svg`. That file is A's (A-02 triages it). Not edited here.

## Not done

- `PLAY_ICON_HTML` (same place) is also read by nothing, and `icons/play.svg` exists and is copied. The plan did not name it, so it stays; say if you want it removed too.

## For you (manual checks)

1. Run `Source/build/music_player.py`, check `App/MusicPlayerOutput/icons/` -> `play.svg`, `pause.png`, `play.png`, `prev.png`, `next.png`, `lyrics.svg` are there, no `pause.svg`.
2. Start the app, play and pause a song -> the play/pause buttons in the player bar and the subhero show the right icons.
3. Right-click a song, a playlist and an album, close each menu by clicking elsewhere -> no error in DevTools.

## Next step

Phase 1 for Agent D is complete once D-01 to D-05 are applied and verified. Phase 2 (agent A) can start when A, B and C have also finished.
