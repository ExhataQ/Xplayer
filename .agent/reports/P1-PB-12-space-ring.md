# Report: PB-12 Space no longer draws the selection ring; Tab keeps it. Also: the Home bridge fix

**Task:** PB-12, and PB-15 follow-up | **Agent:** B | **Date:** 2026-10-21 | **Status:** In review

## Summary
After a mouse click on a row, pressing Space (play or pause) drew the 2 px accent selection ring on that row. It no longer does. Tab, Shift+Tab and the arrow keys still show it, and Space after Tab keeps it. Separately, the zip I received had Agent A's Home wiring and tests but not A's fix to `adapter/home-bridge.js`, so 5 of A's Home tests failed; I applied the fix (A's finding: `switchView` cannot open a playlist, album or artist, and a song needs the 'all-songs' list).

## Findings
- **Cause (reproduced):** clicking a row's number cell focuses the row with `:focus-visible` false and no ring. Pressing Space then made `:focus-visible` true, because Chromium treats any key press as keyboard use, and `.song-item:focus-visible` draws `box-shadow: inset 0 0 0 2px`. A click on the row's title area left focus on the page body in my probe, so no ring showed there; the bug needs the row to hold focus.
- Space itself is the engine's play or pause (`ui/06k`, which cancels the key), so the fix must not touch Space handling, only the styling. `shell/space-key.js` (A) is unchanged.
- The play mark in the number cell also shows for `:focus-visible`. I left it: the row is also `.last-selected` after a click, so it shows anyway.
- Tab from a row goes into the row's own buttons (favorite, queue), then the next row. Shift+Tab returns to the row.

## Changed files
| File | Change |
|---|---|
| `src/ui-next/views/library/input-mode.js` | New: `trackInputMode()` sets `<html data-input="pointer|keyboard">`. Pointer down sets pointer; Tab, arrows, Home, End, Page Up and Down set keyboard; Space and Enter change nothing |
| `src/ui-next/views/library/song-list.js` | Starts it in `attachSongList`, stops it in `detach()` |
| `src/ui-next/adapter/songlist-rows.css` | The row ring now needs `html[data-input='keyboard']` |
| `src/ui-next/adapter/home-bridge.js` | `openHomeItem`: `openPlaylist`, `openAlbum`, `openArtist` through `engineAction`; songs play with `'all-songs'` |
| `tools/tests/ui-next-songlist.test.js` | New test (runs in both library sizes): click then Space shows no ring; Tab, Shift+Tab shows it; Space keeps it; a click removes it |
| `.agent/BOARD.md` | PB-12 In review; PB-13 waiting for the owner; PB-15 note |

## Decisions made or needed
- The flag lives in my view, not in a shared script by `shell/space-key.js` as the board suggested, to avoid editing A's files. If other lists need it, A can move it to the shell. Needs: A's opinion (follow-up only).
- PB-13 needs one owner answer: see the board.

## Checks
| Command or step | Result |
|---|---|
| Probe on the zip as received: click number cell, then Space | `focus-visible` true, ring `2px inset accent` (reproduced) |
| Same probe after the fix | ring `none` |
| `node --test --test-name-pattern="PB-12" tools/tests/ui-next-songlist.test.js` | 2 tests (two library sizes), 2 pass |
| Same with the `html[data-input='keyboard']` scope removed from the CSS | 2 fail (the test pins the fix) |
| `ui-next-home-shell` before the bridge fix | 9 tests, 4 fail plus 1 more (5 failures in the 14 Home tests) |
| `ui-next-home-shell`, `ui-next-home` after the fix | 9 and 5 pass |
| `ui-next-songlist` 26, `ui-next-library` 16, `ui-next-b06-finish` 7, `ui-next-shell` 20, `ui-next-phase1-gate` 11, `ui-next-adapter-api` 3, `ui-next-tokens` 23 | all pass |

## Not run
- Real Electron on Windows (a real keyboard, a real mouse).
- `node tools/lint.js` (ESLint is not installed in this sandbox) and the full suite (A ran it before their last test fix).
- Other lists (search results, queue, panel rows) with the same Space behavior: not checked, they use other styles.
- Touch and pen input: a pen or finger tap sets pointer mode through `pointerdown`; not tried.

## Environment
Linux sandbox, Node v22.22.2, Playwright 1.56, headless Chromium, no project `node_modules`. Fixture library of 60 fake songs, no audio.

## Manual checklist for the owner
1. Click a song's number cell, then press Space: the song plays or pauses and no accent ring appears on the row.
2. Press Tab until a row is focused: the ring appears. Press Space: it stays.
3. Click another row: the ring goes away.
4. In Home, click a playlist, an album and an artist card: Library opens on that item with only its songs.

## Open issues and follow-ups
- Share `input-mode.js` with other lists if the owner sees the same ring elsewhere.
- The old zip A mentions (`Xplayer-main.zip`) and this one differ; please send the next zip made from the tree with all patches applied so we start from one base.

## Patch
`P2-B-wave2.patch`: against the zip `Source-backup_1.zip`.
