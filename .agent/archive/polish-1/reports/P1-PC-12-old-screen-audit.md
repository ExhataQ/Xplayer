# Report: PC-12 Old-screen audit, player and lyrics

**Task:** PC-12 (brief 20) | **Agent:** C | **Date:** 2026-10-28 | **Status:** Done; fixes built from a read of the code, not run in a browser

## Method
I compared the old stylesheets (`src/css/player.css`, `src/css/lyrics.css`: 208 class and id names) with everything in `src/ui-next`. 23 names were absent from the new code; 11 of those are still written by the engine. I read each of the 11, and read the old lyrics display code (`lyrics/11a-lrc-parser-display.js`, `18-lyrics-editor.js`) against the right panel. This finds styles and behaviors that were lost; it does not find things that only look different.

## Differences found
| # | Difference | Result |
|---|---|---|
| 1 | Instrumental markers (`[instrumental]`) were drawn as a note in the old lyrics page; the right panel showed a blank line | **Fixed:** shown as a note (`rp-line--instrumental`), a click on it seeks like any line |
| 2 | The Find page's search spinner (`online-lyrics-spinner`) never turned: its animation lived in the old stylesheet | **Fixed** in `lyrics-find.css` (with reduced motion respected) |
| 3 | The expand icon in Find results (`online-lyrics-expand`) lost its size and color | **Fixed** |
| 4 | The comma between artists in the player's artist line (`player-artist-sep`) lost its dimmer color | **Fixed** in `player-bar.css` |
| 5 | The picker row that is selected in "use for another song" (`online-lyrics-picker-row`) | No gap: `lyrics-find.css` already styles `.queue-item.selected` there |
| 6 | Long title and artist scroll on hover in the player (marquee) | No gap: the new bar keeps it (`shell.css`, `legacy-dom-adapter.js`) |
| 7 | `player-center-section`, `player-right-section`, `queue-toggle-btn`, `lyrics-view-root`, `track-lyrics-line-instrumental-block` | Skip: the new player bar, the queue button and the right panel replace them |
| 8 | `saved-lyrics-modal`, `saved-lyrics-body` (the old saved lyrics window, `08g-panel-saved-lyrics.js`) | Skip, not verified: I found no entry point to it in the new screens |
| 9 | **A song with several saved synced versions: the old lyrics page listed them and let you pick, rename or delete one.** With the View page gone there is no screen for it: the engine keeps the versions, but a person cannot change which one plays | **Not fixed, owner's decision.** Suggestion: a small version picker in the right panel's lyrics header; the engine already has `selectSyncedVariant`, `renameSyncedVariant`, `deleteSyncedVariant` |
| 10 | The old page could switch between plain and synced lyrics when both exist; the right panel shows synced when there is any, otherwise plain | Skip: a choice that was rarely needed; say if it should come back |

## Changed files
`views/playback/right-panel-content.js`, `views/tools/lyrics-find.css`, `views/playback/player-bar.css`, `tools/tests/lyrics-finder-write-audit.test.js` (new).

## Checks
Node tests pass (they read the sources). Not run: a browser.

## Manual checklist for the owner
1. Play a song whose LRC has an `[instrumental]` line. Expected: the right panel shows a note at that time, not a gap.
2. Lyrics, Find, press Search. Expected: the spinner turns while it searches.
3. Play a song with two artists. Expected: the comma between them is dimmer than the names.
4. Decide on row 9 (versions picker) and 10.
