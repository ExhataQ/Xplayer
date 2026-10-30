# Report: owner round 2026-10-30 (translation in the right panel, Batch page, tool windows, Metadata first-open freeze)

**Agent:** C with pieces in E's and D's files, at the owner's request | **Date:** 2026-10-30 | **Status:** In review. Nothing was run in a browser or in Electron.

## 1. Translation in the right panel (and its full-size mode)
- The AI Translate controls are gone from the main Lyrics view (`views/tools/lyrics.js`) and live in the header of the right panel (`mountAiLyricsBar` is called from `right-panel-content.js`), so the full-size mode has them too. Four icon buttons: **Translate**, **Hide the original**, **Original only**, **Layout** (a menu).
- A song with a translation shows both texts together by default. `shell/lyrics-display.js` keeps the choice (mode: both, translated, original; layout) in localStorage and pairs the lines by time.
- Five layouts to try in the Layout menu: **Stacked** (default), **Translation first**, **Side by side**, **One line**, **Focus** (the translation only under the playing line). The auto-translate switch moved into the same menu.
- `saveTranslation` no longer makes the translation the active version: the Sync tool and every other reader keep the song's own lyrics, and the panel reads both versions (`translationPair` in `adapter/ai-lyrics.js`; `showOriginal`, `showTranslation` and `translationState` are gone).

## 2. Lyrics tool: Batch page (was "Many songs")
- Name: the tab is **Batch** (mine, one string in `lyrics.js`).
- The song title and artist are gone from the tool's header; the tabs (Find, Batch, Write, Sync) sit in the middle.
- The page is drawn by the new interface (`views/tools/lyrics-many.js`) in the Library's row design, loading rows as you scroll (`components/auto-load.js`). The engine still does the searching and keeps the state (`19-online-lyrics.js`).
- **Lists:** "Add songs from…" uses the same sources as the tag sheet (selected songs, queue, search results, All songs, Favorites, playlists, albums, artists). The page lists nothing until songs are added. "Find lyrics for all songs" is removed.
- Layout: a toolbar card (source, filter, select all, clear selection, remove selected, clear list; then Synced/Plain, skip existing, Stop and one primary "Find lyrics for N songs" button), a status line, the list with a status per row.
- **Instrumental:** when LRCLIB has no lyrics for a song but marks it instrumental, the row shows "Instrumental" and the song is marked (it counts as a success, and such songs are skipped on the next run). The mark is remembered by file in localStorage (`xplayer.instrumentalSongs`) and put back on the songs when the app starts, because the library has no field of its own for it.
- The old screen keeps the engine's own page and lists the whole library, as before.

## 3. Tool windows (Metadata editor, Sync)
- A button "Open in a new window" in the Metadata bar and on the Sync tab. It closes the editor in the main window first (asking about unsaved changes), then asks Electron for a window: `openToolWindow` in `electron/window-manager.js` (one per tool; asking again brings it forward and sends the new song), IPC `open-tool-window`, preload `openToolWindow` and `onToolWindowSong`.
- The window is the same page started with `?tool=metadata|sync&song=<id>`. `shell/tool-window.js` hides the title bar, rail, panels and player (`html[data-tool-window]`), starts the song silent (it pauses as soon as it plays) and shows only the tool; Sync opens its editor once a song is playing. Tool windows close with the main window.
- Limits you should know: the second window is a full second copy of the app (its own engine and audio). Saving tags in it does not refresh the main window's lists until the app is restarted or the library reloads; lyrics saved in either window are shared through localStorage but the other window sees them after it reloads its lyrics. The main window keeps playing whatever it was playing.

## 4. First open of Metadata freezes for a few seconds
What I checked (reading, not profiling):
- The one-song editor reads **one** file's tags (`openMetadataEditor` then `getAudioMetadata` for the playing song); nothing in that path loops over the library. The Many songs sheet reads tags only for the rows added to it (`tag-sheet.js`, `readTags`), and is not mounted at start. So the guess "it reads every song" is not what the code does.
- The library scans read every file, but they run at launch and in the main process, not when Metadata opens. The only synchronous IPC is the startup song list.
- A first-read cost is real: the first call loads the tag library (`node-taglib-sharp`, a large package, loaded with a synchronous `require` in the main process), and when that is missing it starts Python.
Fix, in the places that matter for a first-time cost: the tag library is now loaded in the background 4 seconds after the window has loaded (`warmUpTagBackend`), and any single read that takes over a second is written to the log with the file name (`[metadata] reading the tags of one file took N ms`). If the freeze is still there after this, that log line says whether it is one slow file or something else, and the next step is a profile.

## Changed files
`src/js/lyrics/19-online-lyrics.js`; `electron/main.js`, `preload.js`, `window-manager.js`, `metadata-editor.js`; `src/js/api/desktop-api.js`; `src/ui-next`: `shell/lyrics-display.js`, `shell/tool-window.js`, `shell/shell.js`, `shell/shell.css`, `adapter/engine-api.js`, `adapter/ai-lyrics.js`, `icons/custom-icons.js`, `index.html`, `views/ai/lyrics-bar.js`, `views/ai/auto-translate.js`, `views/playback/right-panel-content.js`, `views/playback/player-bar.css`, `views/tools/lyrics.js`, `lyrics.css`, `lyrics-many.js`, `lyrics-many.css`, `metadata.js`; tests `lyrics-translation-batch-windows.test.js` (new), `ui-next-lyrics-chrome.test.js`, `desktop-api.test.js`.

## Checks
- Node tests that read the sources pass: the new file, `ui-next-lyrics-chrome`, `desktop-api`, `lrc-parser`, `default-cover`. Syntax checks pass on every changed script.
- Adapter budget (DP14, already over): before plan: 525 of 300, now plan: 519 of 300. `ai-lyrics.js` shrank; the new helpers are in `engine-api.js`, which is not in the plan group.

## Not run
Everything visual and every Electron path: the header buttons and the five layouts, the Batch page, loading lists, instrumental, the tool windows, the warm-up. Browser tests that still expect the old pages and need updating: `ui-next-ai`, `ui-next-lyrics-editors`, `ui-next-lyrics-find`, `ui-next-lyrics-finder-notice`, `scroll`, `ui-next-tag-sheet-finder` and `ui-next-tag-sheet-journal` (they name "Many songs", the old header or the old translation bar).

## Manual checklist
1. Translate a song with AI. Expected: the right panel shows each line with its translation under it; the main Lyrics view has no translation controls.
2. Layout button, try each of the five. Expected: the panel redraws at once; the choice is still there after a restart.
3. Hide the original, then Original only, then each again. Expected: the panel shows only the translation, only the original, then both.
4. Full-size mode: same header, same buttons.
5. Lyrics, Batch. Expected: an empty list with a hint, no title above the tabs, tabs centered. Add songs from a playlist; scroll a long list (rows load as you go); check some and press Find lyrics. Expected: rows turn to found, instrumental or not found.
6. A song LRCLIB lists as instrumental. Expected: the row says Instrumental; restart the app: the right panel and the finder still treat it as instrumental.
7. Metadata and Sync: the window button. Expected: a big window with only that tool, the song loaded and not playing; the main window's editor closed.
8. Launch, wait 10 seconds, open Metadata. Expected: no freeze. If there is one, send the `[metadata]` line from the log.

## Open issues
- The window button for Sync only shows on the Sync tab; Write has none.
- The instrumental mark is by file path; moving a file loses it.
- Tool windows are not tested in a packaged build (the entry file path is the one the main window uses).
