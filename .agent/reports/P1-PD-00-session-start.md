# P1-PD-00: Agent D session start

Date: 2026-10-21. Agent: D (metadata only). Status: decisions recorded, nothing built.

## Changed
- `.agent/PLAN.md` section 8 (session notes, decisions), `.agent/BOARD.md` (PD-01 status, PD-02 and PD-03 wording, session notes). No source files changed.
- Snapshot of the uploaded tree: `archive/G1/Source` in the sandbox (E:\ archive root not reachable).

## Environment
- Electron cannot run in the sandbox (no node_modules, no network). A browser copy of `ui-next` was built with `tools/tests/helpers/app-fixture.js` and opened in headless Chromium 141 with a stubbed `electronAPI`. No page errors. The Metadata view shows the engine's tag form; with the stub's default null reply it shows "Couldn't read the tags", with a stub returning tags it shows the form.

## Owner decisions this session
- Single editor: layout 1A (cover left, fields right, More tags, Cancel and Save).
- Right panel: app-wide, not used by Metadata.
- Multi editor: one-screen tag sheet; load songs as rows, edit tag columns, apply a tag or name to checked rows; default mode Add; review then apply all; rows can be added and removed from the sheet.

## Step 1 done: tag service
- New `electron/tag-service.js` (`read`, `write`, `writeMany`; backend injectable, default is the existing Python writer in `metadata-editor.js`). `writeMany` returns the previous values per file (for the undo journal, PD-06) and skips files whose tags cannot be read.
- New `tools/tests/tag-service.test.js` (fake backend). Run: `node --test tools/tests/tag-service.test.js` gave 4 passed, 0 failed.
- Not wired into `main.js` or the preload yet: a new renderer call needs DP9 and a named preload entry.

## Step 2 done: editor layout 1A
- `src/ui-next/views/tools/metadata.css` only: the engine's form is a grid, cover and "Change cover" in a left column (10 to 13 rem), fields in the right column, "More metadata tags" under the fields (CSS `order`), toolbar, online results and Cancel/Save bar across both columns. One column below 760 px. No engine or markup change, so the old screen is untouched.
- Seen in the browser copy (Chromium, stubbed tags): wide window matches wireframe 1A; no page errors. At 700 px the page itself is 800 px wide in both the old and new CSS (app minimum width), so the editor fits its own container but the window scrolls sideways; not caused by this change.
- Existing behavior kept as it was: the engine shows the common fields by default; "More metadata tags" reveals the sort and grouping fields and Other Tags.
- Tests run (all passed, 0 skipped): `ui-next-metadata` 19, `ui-next-tokens` 23, `ui-next-shell` 20, `metadata-editor` 10, `tag-service` 4.

## Step 3 done: the tag sheet (staged only, nothing is written yet)
- `views/tools/tag-sheet-model.js` (plain logic, no DOM): rows = songs, columns chosen by the person (15 tags), staged cell edits, `applyValue` with Add (default, keeps old values), Replace, Remove, `changes()` for the review step. Multi-value tags split on `;` only.
- `views/tools/tag-sheet.js` + styles in `metadata.css`: "Add songs from..." (selection, queue, search results, all songs, favorites, any playlist, album or artist), Columns menu, apply bar with "Most used" chips, table with checkboxes and double-click or Enter or F2 to edit a cell, footer with Remove checked rows, Discard changes, a disabled "Review and apply" (step 4).
- `adapter/tag-sheet-bridge.js` (new, read only): sources, loading songs, reading one file's tags. Counts against the adapter budget (DP9, owner to decide).
- `views/tools/metadata.js`: a "One song | Many songs" switch; leaving with staged sheet changes asks first. The engine's single editor is hidden, not closed, while Many songs is shown (closing it makes the shell leave the view).
- Tags the library does not hold (for example Composer) are read from the files a few at a time when their column is shown.
- Seen in the browser copy with stubbed tags: add songs, add Composer column, check 3 rows, Add "Synthwave" (kept "Pop"), edit a title; no page errors. Bugs found and fixed on the way: array cells printed as objects, a second commit on Enter, the view bouncing back to the library.
- Tests: new `tag-sheet-model` (9) all pass; related suites 85 passed, 0 failed, 0 skipped.

## Step 4 done: review, write, undo
- `electron/main.js`: new `save-audio-metadata-many` handler (list of `{ fileUrl, metadata }`, at most 5000, every item checked; one file failing does not stop the others; each success updates songs.json like the single save). It uses `electron/tag-service.js` `writeMany`, which returns what each file held before and the writer's "not supported for this file type" list.
- `electron/preload.js` (`saveAudioMetadataMany`), `src/js/api/desktop-api.js`, `tools/tests/desktop-api.test.js`: the matching named entry (the preload parity test requires all three).
- `adapter/tag-sheet-bridge.js`: `writeTags`, `refreshSongs` (copies saved tags into the engine's in-memory songs and queue, as the single editor does), `notify` (the engine's notification).
- Sheet: "Review and apply" opens a before/after table (first 300 changes shown, the count is for all), Apply writes once, saved songs lose their staged edits and show the file's tags, failed songs stay staged with the reason in the status line and a warning notification. "Undo last apply" writes the previous values back for the songs that were saved (kept in memory until the app closes).
- Only changed tags are sent per song, so tags the sheet did not touch are not rewritten.
- Browser copy with stubbed save (song 2 made to fail): review dialog, apply, 1 failure kept staged, undo sent the earlier genre for the 2 saved songs, no page errors.
- Tests: new handler test in `songs-store.test.js` (valid batch, bad request, too many); related suites all pass (see summary).
- Notification API: Agent A's PA-06 (click target and Undo inside a notification) is not in this tree, so Undo is a button in the sheet and the notification is the engine's plain one. Switch when PA-06 lands.
- Not tested: real writing with Python/mutagen, M4A/MP4/WMA files (the writer refuses text tags there and the sheet shows that per song), Windows, Electron.

## Step 5 done: actions for the AI
- New `views/tools/tag-sheet-actions.js`: the sheet state and every operation, no screen. `tagSheetApi` (for the AI) and `tagSheetUi` (for the view). `createTagSheetActions(bridge)` takes a fake bridge in tests.
- `tag-sheet.js` rewritten to draw from it (same screen, same behavior; the browser flows from steps 3 and 4 give the same results).
- AI rules: calls return plain `{ ok, ... }` and never throw; the AI has no way to write by itself (`requestApply()` opens the person's review, `commit` is only on the UI object, a test enforces it); add is the default mode.
- `.agent/AI-TAG-SHEET.md`: one-page guide with an example. The AI is not connected to anything yet (Agent E).
- Browser check: AI loaded 30 songs, staged a genre on 12, the person got the review dialog and the AI received the outcome.
- Tests: new `tag-sheet-actions` (5), guard test updated (view uses no adapter file; actions use the bridge; the AI api has no write call).

## PD-04 started: which release is the original
- New `electron/release-rank.js` (pure, no network): `rankReleases`, `pickRelease`, `fileKinds`. Rule "original": earliest official album; singles and EPs rank lower; bootlegs and promos never win on date; compilation, live, remix, DJ-mix, demo, soundtrack and similar are skipped unless the file itself is one; releases of one release group count once. Output: ranked list with reasons, a confidence 0 to 1 and a decision: `auto` (0.85 and up), `review` (0.5 and up), `none`. Confidence drops when the next album is close, when MusicBrainz's own match score is low, and when there is only one candidate.
- Rule "popular": uses a popularity signal passed in by the caller; without one it falls back to "original" (as the brief says). No popularity source is connected: Deezer and iTunes terms and limits are not investigated yet (no network).
- `electron/online-metadata.js` (release scope): each release now also carries `status`, `primaryType`, `secondaryTypes`, `recordingScore` (additive; existing tests pass, 11/11). The MusicBrainz field names `status`, `release-group.primary-type` and `release-group.secondary-types` are from memory and need one live check.
- Tests: `tools/tests/release-rank.test.js` (7). Not wired into any screen or setting yet; applying and the review queue are PD-05.
- PD-07: in this tree the rail already shows Metadata above Settings, so it needs no work from D beyond a check on the owner's machine.

## Owner clarification
Columns are chosen by the person (for example add Composer to see it for all loaded songs). Rows are the loaded songs. The sheet gets a plain action set so Agent E's AI can use it later.

## Not run / not verified
- `npm run lint` (eslint is not installed here).
- No automated tests were run (nothing changed in source).
- Node tag libraries (node-taglib-sharp and others) were not verified: no network.
- No Windows or Electron check.

## Next
1. PD-01: tag service interface (`read`, `write`, `writeMany`) with the Python path as fallback, tests on copies of files.
2. PD-02: restyle to 1A. 3. PD-03: tag sheet, needs DP9 (adapter budget).
