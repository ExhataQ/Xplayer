# Agent C, patch 0001: EB-C1 `lyrics:changed`

## What changed
16 direct `renderLyricsView()` calls became `emit('lyrics:changed', { songId })`. One subscriber, `src/js/04t-lyrics-events.js`, calls `renderLyricsView()`. Added to `src/manifest.json` right after `21-language-detect.js`. Row added to `EVENTS.md` in section C.

| File | Calls | Function(s) | Condition (unchanged, still at the call site) |
|---|---|---|---|
| `18` | 5 | `saveLyricsForSong`, `clearLyricsForSong`, `selectSyncedVariant`, `renameSyncedVariant`, `deleteSyncedVariant` | `currentView === VIEWS.LYRICS` |
| `18` | 2 | `saveLyricsFromEditor`, `clearLyricsForCurrentSong` | **none** (always redraws) |
| `11a` | 1 | `setLyricsDisplayMode` | Lyrics view open |
| `11b` | 3 | `importLrcFile`, `saveLrcPaste`, `clearSyncedLyricsForCurrentSong` | Lyrics view open |
| `11f` | 1 | `saveSyncEditor` | Lyrics view open |
| `08g` | 2 | `deleteSavedLyricsEntry` (only if it is the playing song), `removeAllSavedLyrics` | Lyrics view open |
| `08b` | 1 | `updateAlbumArt` | Lyrics view open |
| `19` | 1 | `applyOnlineLyricsToSong` | Lyrics view open |

(`18`: 5 guarded + 2 unguarded = 7.) Payload `songId` is `null` for remove-all (`08g`) and when `08b` has no current song.

## Decision for D: where the view guard lives
I kept `if (currentView === VIEWS.LYRICS)` on the emitter side. Reason: two call sites in `18` (`saveLyricsFromEditor`, `clearLyricsForCurrentSong`) never had the guard, and the baseline shows they redraw even with another view open. Moving the guard into the subscriber would change those two. Cost of the current choice: the event only fires while the Lyrics view is open, so a future second subscriber (for example the right-panel lyrics box) would not hear about changes made in other views. If D prefers "always emit, subscriber checks the view", the two unguarded sites need a payload flag or an explicit decision to accept the behavior change. Not done here.

## Same calls, same order
Scenarios in `tools/tests/helpers/scenarios-c.js`: 16 cases x {Lyrics view open, another view open} = 32. Spies: `renderLyricsView`, `renderTrackLyricsBox`, `showNotification`. Baseline recorded with `EVENT_BASELINE=1` on the unconverted code, before any app file was touched. After conversion the recorded sequences match exactly. **Calls removed: none. Order changes: none.**

## Allowlist
No changes.

## Not converted in this patch
`07-views.js` still calls `renderLyricsView()` twice (lines 339 and 386). It is D's file and is view setup, not a lyrics change.

## Verification (all run, in this session)
- `EVENT_BASELINE=1 node --test tools/tests/events-c.test.js` on the unconverted code: pass, 32 sequences recorded.
- After conversion: `events-c`, `manifest`, `events-wiring`: all pass.
- `scroll.test.js` + `event-bus.test.js`: 21 pass, 1 skipped, 0 fail.
- Sabotage check: commented out `renderLyricsView()` in `04t`; `events-c` failed; restored (byte-identical).
- `node tools/event-audit.js C`: 42 -> 26. Total 164 -> 148.
- Full suite not run (brief says not to). I did not run the app in Electron.
- Environment note: the audit needs `acorn` and `acorn-walk`; the zip has no `node_modules`, so I ran with `NODE_PATH` pointing at a global copy.

## Needs from other agents
Nothing. D: please review the guard decision above and `04t`.

## Manual test checklist
1. Play a song, open the Lyrics view, edit lyrics, Save: view updates. Clear: view updates.
2. Same from a different view (open the editor from the right panel): Save and Clear still redraw the Lyrics view as before; Ctrl+Enter also.
3. Lyrics view: switch Plain/Synced; the buttons and text follow.
4. Import an .lrc file; paste LRC and save; clear synced lyrics: Lyrics view updates.
5. Save from the sync editor: new variant shown. Pick, rename, delete a variant: view updates.
6. Settings > Saved lyrics: delete the playing song's entry, then Remove all: Lyrics view updates.
7. Online lyrics: apply a result to the playing song while the Lyrics view is open.
8. Change song while in the Lyrics view: lyrics follow the new song.
9. Do 1, 4 and 6 from another view: Lyrics view is not forced open.
