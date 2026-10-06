# Agent A report 0012: main-process fixes

Applies on top of: report 0011 (A-15 patch applied). Not a plan step; no renderer or UI file changes.

## Fixed
- `electron/downloads.js`: file name is a plain name from the URL (a URL like `a%2F..%2F..%2Fx.mp3` used to write outside the folder); HTTP status must be 2xx (a 404 page was saved as audio); redirects followed (max 5); only http/https; half-written file removed on failure.
- `electron/main.js` `delete-file`: `shell.trashItem` on an absolute path to an existing audio file, replacing a PowerShell command string.
- New `electron/songs-data.js` (added to the copy list in `build/music_player.py`): reads and replaces the `SONGS_DATA` array by walking the JSON. The old lazy regex stopped at the first `];` inside a song's text, and `String.replace` with a string turned `$$`, `$&` into other text (a title `Money $$$` became `Money $$`). Used in `main.js`, `scanner.js`, `scan-folder.js`.
- `scan-folder.js` `saveMusicFolders` no longer drops `folderMetadata` (added time, song count).
- `window-manager.js`: window state saved 400 ms after the last move/resize, and from `getNormalBounds()`; the window refuses navigation away from the player page and new windows.
- `main.js`: the loading window is closed in a `finally` for rebuild, change-folder and welcome scan.

## Not done (needs a decision)
- Config files and generated `player.js` still live next to the code; moving them to `userData` needs a migration.
- `metadata-editor.py` still saves in place (not write-to-temp-then-rename).
- `music-folders.js` is Windows-path-only and does not decode `%20` in song URLs.

## Verification
Full suite plus `tools/tests/main-process-safety.test.js` (10 tests: song-list parsing/replacement, download names, real local HTTP server for success, redirect, 404, dropped connection, bad schemes, redirect loop).
