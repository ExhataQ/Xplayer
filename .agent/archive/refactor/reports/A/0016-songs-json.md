# Agent A report 0016: the library in songs.json

Side plan step A-S3. Applies on top of: report 0015. Renderer change: one expression in `99-player.js`.

## What changed
- New `electron/songs-store.js` (in the copy list of `build/music_player.py`): `readSongs(dir)`, `writeSongs(dir, songs)`, `updateSongs(dir, fn)`. File: `MusicPlayerOutput/songs.json`, `{"version":1,"songs":[...]}` (a bare array is accepted too). Writes go to a temporary file and are renamed into place; the previous list is kept as `songs.json.bak`; a lock file (`songs.json.lock`, cleared if older than 30 s) makes two writers take turns; an unreadable file is set aside as `songs.json.corrupt-<time>` and the `.bak` is used. If there is no `songs.json`, a list still inside an older `player.js` is read and saved to `songs.json` (the old file is not touched).
- `main.js`: tag saves use `updateSongs`; start-up and "change folder" read through the store; new sync message `songs-store:load` answers the preload.
- `scanner.js`, `scan-folder.js`: every write of the list goes through the store; merging dropped files into the library happens under one lock.
- `preload.js` + `api/desktop-api.js`: new `library.getStartupSongs` (kind `sync`).
- `99-player.js`: `SONGS_DATA` is the list from `desktopApi.library.getStartupSongs()` when that returns an array; otherwise the `{{SONGS_DATA}}` placeholder (plain browser, all page tests).
- `build/music_player.py`: `player.js` gets `[]`; an existing `songs.json` is kept; a list in an older `player.js` is saved to `songs.json`; the hero count comes from the list. `tools/clean_for_share.py` also deletes `songs.json*`.

## Upgrade note
After applying, run the build once. It saves your current library into `songs.json` (checked on a copy: 2 songs with `$$$` and `];` in their titles came through unchanged, and a second build left an edited `songs.json` as it was). If you start the app without rebuilding, the old page code still works from the old `player.js`.

## Notes
- Start-up reads the list with one synchronous message to the main process (about the same work as parsing it from `player.js`; the gain is safety, not speed).
- Two scans at once still end with the last one's list (nothing merges them), but they can no longer corrupt the file.

## Not done
- `SONGS_DATA` is still a global list that renderer code changes in place (`06b`, `03j`, `import-dropped`); moving that to a store is part of the later module work.

## Verification
Full suite. `songs-store.test.js` (14 tests): round trip, `.bak`, carry-over, damaged file, hand-made array, lock released on error, stale lock, four processes writing 100 songs at once (without the lock only 38 survive: checked), main.js wiring with a fake electron, page uses the list from `getStartupSongs` / falls back to the placeholder. The real build was run in a temporary copy.
