# Agent B report 0013: B-10 last file, `14-song-navigation.js` as a module

Steps: B-10 (completes it). Applies on top of: `Xplayer-main__2_.zip` plus A 0018.
Archive (.agent/AGENTS.md section 1): not done, no `E:\Backup` here.

## Changes

- `src/js/14-song-navigation.js`: `export` on `navigateToCurrentArtist`, `navigateToCurrentSongInList`, `switchToViewAndScroll` (the only three used from other files, the template or 15e); guarded `registerLegacyGlobals` for them. The scroll helpers stay private. All assignments in the file are to its own local variables, so strict mode changes nothing.
- `src/manifest.json`: moved from `js` to `modules`, right after `13-song-highlight.js`.
- `tools/tests/converted-modules.test.js`: the three names added to the registered list.
- `tools/change.log.txt`: one entry.

## Numbers

`dep-map.js` and `event-audit.js` could not run (`acorn` not installed, no network). A load-time reference check by hand: `ui/player-bar.js` uses the two navigation functions only inside click handlers (arrow functions), so nothing needs them while loading.

## Tests actually run

- `node --test tools/tests/manifest.test.js`: 12 pass.
- Syntax check of the converted file as a module: ok.
- Not run: every browser test (no Playwright here), `converted-modules`, `playback-modules`, `event-audit`, `setters`.

## Needs from other agents

- none

## Not done

- Nothing in B's column is left except the nine `button.onclick = ...` property handlers (unchanged on purpose).

## For you (manual checks)

1. Play a song, click the title in the player bar -> the list scrolls to and highlights that song in its source view.
2. Click the artist name in the player bar and in the track-info panel -> the artist page opens.
3. Play from a playlist, album, favorites and search, then click the title -> each opens the right view.
4. History view: play a song, click its row's play -> works as before (uses `switchToViewAndScroll`).

## Next step

B-10 is complete. D-09 and A-16 remain.
