# Report: PD-09 Old-screen audit, metadata

**Task:** PD-09 | **Agent:** D | **Date:** 2026-10-21 | **Status:** In review

## Summary
Compared what the old screen does for metadata with what the new screen (`src/ui-next`) does. The single editor itself is the same engine code in both, so its features carry over. One thing the old screen had is still missing in the new one (the read-only "Show metadata" window, which depends on Agent B's song menu); the other (the extended song info pop-up) is rebuilt and styled. One bug of my own was found and fixed on the way (the sheet did not repaint the song lists after a save).

## Findings (investigations)

| # | Old screen | New screen | Verdict |
|---|---|---|---|
| 1 | Editor: all fields, "More metadata tags", cover change, Search online (MusicBrainz, Song or Release scope), Import and Export JSON, locked until tags are read, never rewrites untouched tags, dirty guard (`src/js/library/20-metadata-editor.js`, 10 tests in `tools/tests/metadata-editor.test.js`) | Same engine code, hosted in the Metadata view and restyled (`views/tools/metadata.js`, 1A layout). *read*; the editor was also *reproduced* in a browser copy | Carried over |
| 2 | Opened from the right panel's Metadata tab (`ui/08d-panel-right-tabs.js`) for the playing song | Rail item Metadata; still the playing song only; empty state "No song playing" | Carried over, entry moved |
| 3 | Edit more than one song | Not possible in the old screen | New in the new screen: Many songs (tag sheet) |
| 4 | Song menu "Show metadata": read-only window with Title, Artist, Album, Genre, Year, Track number, Language, Composer, Comment, BPM (`ui/06a-context-menus.js:208`, `ui/06b-modals.js:103`) | No song context menu exists in `ui-next` yet (song list has only the Columns menu, `views/library/song-list.js`) | **Missing**, depends on Agent B's song menu |
| 5 | Extended song info ("Track Information" pop-up): a panel listing extra tags for the current song in groups People, Structure, Publishing, Identifiers, Technical, Misc, Sort, and Settings toggles to choose which fields show (`ui/08d`, `ui/08e-panel-settings.js:360`, `ui/08f-panel-extended-metadata.js`, `EXTENDED_METADATA_FIELDS` in `core/00-state.js:127`) | Nothing in `ui-next` opened it, and its inside was unstyled (the old css is not loaded; `adapter/legacy-overlays.css` says so) | **Fixed: owner chose to keep the pop-up.** New styled pop-up `views/tools/song-info.js`, opened by an Info button in the Metadata view and by `openSongInfo()` for a player-bar button (Agent A) |
| 6 | After saving, the editor repaints the song list and the Albums and Artists groups (`refreshCurrentViewAfterMutation`, `20-metadata-editor.js:441`) | Single editor: unchanged, still does it. My tag sheet did not | **Bug in step 4, fixed** (`adapter/tag-sheet-bridge.js`); checked in the browser copy: the repaint runs once per save and once per undo |
| 7 | Recents cover refresh after an edit (`library/03a-recents.js`) | Engine side, same | Carried over |

## Changed files
| File | Change |
|---|---|
| `src/ui-next/adapter/tag-sheet-bridge.js` | `refreshSongs` now also asks the engine to repaint its lists (finding 6); `infoModel`, `setInfoField` for the pop-up (finding 5) |
| `src/ui-next/views/tools/song-info-model.js`, `song-info.js` (new) | Track information pop-up: same groups and order as the old one, Fields picker instead of the Settings toggles, values the library lacks are read from the file |
| `src/ui-next/views/tools/metadata.js`, `metadata.css` | Info button next to One song / Many songs; pop-up styles (tokens only) |
| `tools/tests/song-info-model.test.js` (new) | 3 tests |

## Decisions made or needed
- **Finding 4:** when Agent B adds the song menu, add "Show metadata" (read-only) and "Edit tags" (puts that song into the Many songs sheet). Needs a one-line request on the board to B. Proposed, not built.
- **Finding 5 (decided by the owner):** keep the pop-up (option c). Built as above. Still to do by Agent A: an info button in the player bar that calls `openSongInfo()` (request on the board). The old `track-info-btn`, `#extended-info-overlay` and the `.extended-info-overlay` block in `adapter/legacy-overlays.css` are no longer needed once that is in; not removed yet.

## Checks
| Command or step | Result |
|---|---|
| `node --test` on `tag-sheet-*`, `tag-service`, `release-rank`, `online-metadata`, `ui-next-metadata`, `ui-next-tokens`, `ui-next-shell`, `ui-next-phase1-gate`, `desktop-api`, `songs-store`, `metadata-editor` | 140 passed, 0 failed, 0 skipped (before finding 6's one-line fix; rerun below) |
| Browser copy, save and undo through the sheet with a counter on `refreshCurrentViewAfterMutation` | 2 calls, no page errors |
| Browser copy, Info button with no song (notice shown), with a song (pop-up with grouped values read from the file, Fields picker, Conductor switched off hides its row, Escape closes) | works, no page errors. Fixed on the way: values clipped by a too wide minimum width, groups printed as objects |

## Not run
Electron, Windows, real tag writing, linter (eslint is not installed here). The old and new screens were compared by reading the code; only the Metadata view was seen running.

## Environment
Linux sandbox, Node 22-class, no Python tag writing, headless Chromium through Playwright, no network.

## Manual checklist for the owner
1. Open Metadata, Many songs, load a playlist, add Genre "Test" to two songs, Review and apply. Expected: the song list and Albums and Artists groups show the change without restarting.
2. Press Undo last apply. Expected: they change back.
3. Check on the old screen what "Show metadata" and the extended info look like, and tell me which of options (a), (b), (c) you want.

## Open issues and follow-ups
Findings 4 and 5 above. Search results in the old screen match on metadata fields (`search/03b-search-engine.js`); that belongs to Agent B's audit.

## Patch
`0001-pd-tag-service-and-board-notes.patch`: all of D's work so far. Excludes `node_modules`, `.claude` and anything outside the project folder.
