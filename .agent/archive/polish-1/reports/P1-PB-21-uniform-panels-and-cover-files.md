# Report: PB-21 / PB-07 uniform left panels and default cover files

**Task:** PB-21, PB-07 | **Agent:** B | **Date:** 2026-10-28 | **Status:** In review

## Summary
Three owner requests: (1) `default-cover-song.svg` goes away and `default-cover.svg` is the song cover; (2) the other default covers did not show on items; (3) Library, Search and Recents had different layouts and sizes.

## Findings
- **Covers not showing:** the panel CSS and `defaultCover()` point at `../assets/` and `../../assets/` from `ui-next/`. The browser resolves those from the URL, so they mean `<output>/assets/` whether `ui-next` is a copy (production build) or a junction to `src/ui-next` (the source-backed runtime started by `Launch-Xplayer-UI-Next.bat`). Neither made that folder: `build/music_player.py` copied only `icon.png`, `icons/` and `fonts/`, and `Prepare-Source-Backed-Runtime.ps1` linked only `ui-next` and `js`. The owner runs the source-backed runtime, which a build change alone does not reach. *read*
- **Layout:** Library draws controls as chips, then the field, then a sort row, with `padding: 8px 16px 12px`, and its list fills the panel to the bottom. Search drew the field first, then the chips, with its own padding, and its results had 12 px under them; Recents had no controls and no top space. *read*

## Changed files
| File | Change |
|---|---|
| `src/assets/default-cover-song.svg` | deleted |
| `src/ui-next/adapter/default-cover.js` | `song` (and unknown kinds) return `../assets/default-cover.svg` |
| `src/ui-next/adapter/default-covers.css` | `.cover-ph--song` uses `default-cover.svg` |
| `build/music_player.py` | copies every `src/assets/default-cover*.svg` to `<output>/assets/` |
| `Prepare-Source-Backed-Runtime.ps1`, `README-SOURCE-RUNTIME.md` | an `assets` junction to `Source\src\assets` next to `ui-next` and `js`; an existing real `assets` folder is kept as `assets-built` |
| `tools/tests/source-runtime-assets.test.js` | new: the script links assets; every `../assets/default-cover*.svg` path in ui-next names an existing file |
| `tools/tests/default-cover.test.js` | song file name, the deleted file, and the build copy |
| `src/ui-next/views/library/library-panel.css` | variables `--panel-pad-top` (4 px), `--panel-pad-bottom` (8 px), `--panel-list-end` (4 px); controls and list use them |
| `src/ui-next/views/library/panel-lists.css` | `.plist-panel__controls` has the Library controls' rules; results use the same side and end padding; Recents gets the top space |
| `src/ui-next/views/library/search-panel.js` | chips and field in one controls block, chips first like the Library |

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/default-cover.test.js tools/tests/source-runtime-assets.test.js tools/tests/ui-next-queue-drag-open.test.js` | 8 of 8 pass |
| `python3 -m py_compile build/music_player.py` | passes |
| `node --check` on `search-panel.js` | passes |

## Not run
The build itself, the app, and every browser test (no Chromium here). `ui-next-panel-lists`, `ui-next-library` and `ui-next-b06-finish` were not run; none of them uses the class names that changed (`plist-panel__bar`, `plist-panel__chips`).

## Environment
Linux sandbox, Node 22, no browser, no network.

## Manual checklist for the owner
1. Copy `Source\Prepare-Source-Backed-Runtime.ps1` over `E:\.Storage.local\xplayer-test-runtime\Prepare-Source-Backed-Runtime.ps1` (the launcher runs that copy), then start `Launch-Xplayer-UI-Next.bat`. Expected: `ui-test\MusicPlayerOutput\assets` is a junction to `Source\src\assets` (`Get-Item ... -Force` shows LinkType Junction). For a production build, rebuild instead: `MusicPlayerOutput/assets/` then holds the seven default cover files.
2. Start the app. Create a playlist, a folder, and look at an album or artist without art. Expected: each shows its own default cover in the Library panel; Liked Songs and All Songs show theirs.
3. Give a playlist a cover. Expected: the real picture replaces the default.
4. Open Library, Search and Recents one after another. Expected: the same left and right padding, the same row size, a small space above the first control and under the last row; Search shows chips, then the field, like the Library.
5. Switch density to compact. Expected: all three panels follow the smaller rows.

## Open issues and follow-ups
- `App/` was not edited; the production output has the covers only after a rebuild.
- `default-cover.svg` has rounded corners (rx 4 of 24) and a smaller note than the old song file; say if it should be square like the others.
- Library keeps its sort row; Search has none, so Search's controls are shorter by that row.

## Patch
`FIX-covers-runtime-board-2026-10-28.patch`, made against the owner's backup 10 (what that backup was missing). Excludes `Source/tools/CHANGELOG.md`.
