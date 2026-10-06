# Agent A report 0013: settings files in the user-data folder

Side plan step A-S2. Applies on top of: report 0012. No renderer or UI file changes.

## What changed
- New `electron/storage-paths.js` (added to the copy list in `build/music_player.py`): `configPath('foldersConfig' | 'setupFlag' | 'downloadFolder' | 'windowState')`. Folder is `MUSIC_PLAYER_CONFIG_DIR` if set, else Electron's user-data folder, else the code folder (running a script on its own works as before).
- A file that exists only next to the code is moved to the user-data folder the first time it is asked for (copy, then delete the old one, so a later reset cannot bring it back).
- `main.js`, `downloads.js`, `window-manager.js` use it. `scanner.js` passes the folder to the scan process.
- `scan-folder.js` uses `music-folders.js` `readConfig`/`writeConfig` (now exported) instead of its own copy, so `folderMetadata` is kept. It also exports `addMusicFolder`/`removeMusicFolder` for tests.

## Upgrade note
On first start after this patch, the saved music folders, the first-run flag, the download folder and the window position are moved from the app folder to the user-data folder (`%APPDATA%\music-player` on Windows). Nothing is lost; if a copy fails the setting starts from its default. `tools/clean_for_share.py` still removes any leftover files in the app folder.

## Not moved
`MusicPlayerOutput/player.js` and `covers/`: the page loads them by relative path, so that is a build change (A-S3).

## Verification
Full suite; `main-process-safety.test.js` now has 12 tests (moves once, never overwrites, reset stays reset, scan process uses the given folder and keeps folder details).
