# Report: PC-07 Lyrics opens Sync, PC-10 DL3 check

**Tasks:** PC-07, PC-10 | **Agent:** C | **Date:** 2026-10-24 | **Status:** In review (not run in a browser)

## PC-07
Brief 4.1 asks that Lyrics in the rail open the Sync tool. Choosing Lyrics now opens the Sync tab when a song is playing. With nothing playing, or when the engine opens its own lyrics page (the player bar's lyrics button, a song's menu), the page stays on View, because Sync needs a song and an engine-opened page must not be changed.
- `shell/shell.js`: `selectView` passes `{ chosen: true }` to `showView`; the Lyrics tooltip now says what it does.
- `views/tools/lyrics.js`: `mountLyricsModes(host, options)` calls `go('sync')` for a chosen visit with a song playing and no editor open.
- Choosing Lyrics while already on it does nothing, as before, so an open editor is never rebuilt.
- The Sync icon is a waveform already (PA-03). The big-boxes alternative (4.2) is not built; it is a design choice for you.
- Open point: after PC-13 puts lyrics in the right panel, reading lyrics will not need the Lyrics item, which fits this change. Until then, reading lyrics from the rail takes one more click on View.

## PC-10
Already done. The report that raised F-1 said the engine offered "Use LRC for this song" only when the query differed from the song's own. In `lyrics/19-online-lyrics.js` that condition no longer exists: `hasOnlineLyricsQueryChanged` is gone and the button is shown whenever Find was opened for a song (`fromHeader` false). `ui-next-lyrics-find.test.js` has the test "an unchanged query ... also offers Use LRC for this song (DL3)". Read only; I did not run that test.

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/ui-next-lyrics-rail-sync.test.js` | 3 passed (wiring only) |

## Not run
Browser tests. New: "Lyrics in the rail opens the Sync tool..." in `ui-next-lyrics.test.js`. Existing lyrics tests enter Lyrics from the rail before playing, which I checked by reading, so they should still land on View; unverified.
