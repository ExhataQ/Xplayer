# Report: Home in the shell (integration of PB-15), contract checks, and state of the delivered patches

**Task:** request from B (PB-15) | **Agent:** A | **Date:** 2026-10-21 | **Status:** In review

## Summary
Home is now a shell-owned main view: the stylesheet is linked, the rail's Home item opens it, and the cards work. A song card plays the song; a playlist, album or artist card goes to Library and opens that item. Checking the generated ids found a mismatch in the bridge, fixed in one function (below). This report also records what the new `Xplayer-main.zip` contained.

## Findings
- **Contract mismatch (reproduced):** the engine's `switchView(viewId)` cannot draw an album, artist or playlist. For albums and artists, `switchView` sets the view as current first and then calls `openDetailView`, which returns at once because the view is already current (`ui/07-views.js`, `switchView` then `openDetailView`). For `playlist-<id>` there is no entry in `viewConfigs`, so `switchView` ends in the "coming soon" branch. Running the engine: after `switchView(albumId)` the view name changed but all 60 songs stayed on screen; `openAlbum(id)`, `openArtist(id)` and `openPlaylist(id)` draw the right rows. `adapter/home-bridge.js` called `switchView`, so every non-song card would have changed nothing visible.
- **Ids:** the generated `viewId` values are the engine's own names (`playlist-<id>`, `a` plus 12 characters, `r` plus 12 characters); they match the played order the engine keeps and what the rail's `syncRailSelection` expects. They are right as ids, but not accepted by `switchView` as an opener.
- **Song playback (reproduced):** `playSongFromList(id)` without a list uses the engine's current view. While Home is up that view is whatever the engine showed last. With the engine on a two-song playlist, a recent song that is not in it does nothing (`startIndex === -1`, silent return). The bridge now passes `'all-songs'`, so the queue is the whole library.
- Playing a song from Home leaves the person on Home (the queue and the player bar update).
- **The new zip was inconsistent.** It had the CSS parts of my patches (`components.css`, `shell.css`, `songlist-rows.css`, the shell test) and an `import './notify.js'` and call in `shell.js`, but not `shell/notify.js`, `tooltip.js`, `notification-center.js`, `notifications.css`, B's Home files, the reports or the board. With that import and no file, the shell module cannot load. The full patch below restores all of it.
- **Stale test:** `ui-next-b06-finish.test.js` still pinned the right-aligned Persian title that PB-11 reverses. Updated to the round 2 decision.

## Changed files (this step)
| File | Change |
|---|---|
| `src/ui-next/index.html` | Links `views/home/home.css` |
| `src/ui-next/shell/shell.js` | Home entry in `VIEWS` (`own: true`), `mountHomeView`, `leaveHome`, `openHomeCard`; `showView` mounts shell-owned views and always releases Home first |
| `src/ui-next/adapter/home-bridge.js` | `openHomeItem` uses `openPlaylist`, `openAlbum`, `openArtist`; song cards pass `'all-songs'`; header comment explains why |
| `tools/tests/ui-next-home-shell.test.js` | New: 9 tests |
| `tools/tests/ui-next-b06-finish.test.js` | Persian title test follows PB-11 |
| `.agent/BOARD.md` | The two requests from B are marked done, with the mismatch |

## Decisions made or needed
- B: please review the one-function change in `home-bridge.js` (it is B's file; the board entry says so).
- DP9: the bridge is 40 lines now; the budget decision is still open.
- Home is not the start view. Library still opens first; changing that is a decision for the owner (DP2).

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/ui-next-home-shell.test.js` | 9 of 9 passed |
| `node tools/lint.js` | 0 errors, 0 warnings (139 files) |
| `node --test tools/tests/*.test.js` on the tree before the b06 test fix | 941 tests, 938 passed, 1 failed (`ui-next-b06-finish`, the stale Persian test), 2 skipped (one needs Windows path rules, one is timing-sensitive in a sandbox), 0 cancelled |
| `node --test tools/tests/ui-next-b06-finish.test.js` after the fix | 7 of 7 passed |

The full run was not repeated after the one-test fix; only that file was rerun.

## Not run
- Real Electron on Windows: clicking real cards with real covers, real playlists in a large library, the fade and arrow motion, reduced motion.
- A repeat of the full suite after the b06 test update.

## Environment
Linux container (2 CPUs), Node v22.22.0, headless Chromium through Playwright. Fixture library of 60 fake songs, no audio output. No Python.

## Manual checklist for the owner
1. Start with `--ui=next`, play three songs, open Home from the rail. Expected: "Recently played" lists them, newest first.
2. Click a song card. Expected: it plays and you stay on Home.
3. Click a playlist, album and artist card in turn. Expected: Library opens, the rail highlights Library, and the list shows only that item's songs.
4. Open an album in Library, go to Home, click the same album. Expected: Library opens on that album again.
5. Go to Home, then to Search. Expected: Home disappears; coming back draws it fresh.

## Open issues and follow-ups
- The engine's `switchView` bug for albums and artists is old and affects any caller; fixing it in the engine is outside this plan (engine seams must be additive). Only the bridge works around it.
- Playing from Home uses the whole library as the queue; a "play from this shelf" queue is a design choice for later.

## Patch
`P1-A-full-vs-xplayer-main.patch`: everything that `Xplayer-main.zip` is missing (PA-02 and PA-05 code, PA-06, the right-panel board entries, B's wave 1, the Home integration, the stale test fix), written against that zip. Verified by applying it to a fresh copy of the zip with `patch -p1 --binary` and comparing the result with the tested tree. It excludes `package.json`, `package-lock.json`, `node_modules` and `tools/CHANGELOG.md`.
