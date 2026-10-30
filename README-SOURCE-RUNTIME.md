# Source-backed Xplayer test runtime

`E:\Programming\Music Player\Source` is the source of truth. The Electron build remains at `E:\.Storage.local\xplayer-test-runtime\node_modules\electron\dist\electron.exe`; runtime songs and generated player data remain under `ui-next-test\MusicPlayerOutput`, and test settings remain under `ui-next-test\config`.

Run `Launch-Xplayer-UI-Next.bat`. Optional Electron arguments passed to the batch file are appended after `--ui=next` (for example, `--remote-debugging-port=9339` for a local smoke test). The launcher sets `MUSIC_PLAYER_OUTPUT_DIR` and `MUSIC_PLAYER_CONFIG_DIR`, then runs `Prepare-Source-Backed-Runtime.ps1`. By default, config remains at `ui-next-test\config`; set `XPLAYER_TEST_CONFIG_DIR` before launch to use another isolated config during a smoke test. The helper preserves the existing generated `ui-next` and `js` folders as `ui-next-built` and `js-built`, then creates directory junctions from those output paths to `Source\src\ui-next`, `Source\src\js` and `Source\src\assets` (the default cover pictures; the new interface loads them as `../assets/`). The app therefore loads the current UI and engine renderer modules directly from the source tree without copying them after edits. The generated `player.js`, songs, covers, icons, Electron executable, and isolated config remain in the runtime.

The launcher still passes `--ui=next`. `electron\ui-entry.js` resolves that flag to `ui-next/index.html`; the `ui-next` junction makes that entry the source file. Production builds are unaffected because the junction setup runs only from this test-runtime launcher.

To verify the link targets, run:

```powershell
Get-Item 'E:\.Storage.local\xplayer-test-runtime\ui-next-test\MusicPlayerOutput\ui-next' -Force | Select-Object FullName,LinkType,Target
Get-Item 'E:\.Storage.local\xplayer-test-runtime\ui-next-test\MusicPlayerOutput\js' -Force | Select-Object FullName,LinkType,Target
Get-Item 'E:\.Storage.local\xplayer-test-runtime\ui-next-test\MusicPlayerOutput\assets' -Force | Select-Object FullName,LinkType,Target
```

The targets should be `E:\Programming\Music Player\Source\src\ui-next`, `E:\Programming\Music Player\Source\src\js` and `E:\Programming\Music Player\Source\src\assets`. The original generated folders are intentionally retained as `ui-next-built`, `js-built` and `assets-built`; do not remove them as part of routine source testing.

The launcher runs `Prepare-Source-Backed-Runtime.ps1` from `Source`, so it is always the current script and nothing needs to be copied. (Earlier versions ran a copy in `%RUNTIME%` (`E:\.Storage.local\xplayer-test-runtime`) that had to be updated by hand. If the console shows `Failed to load resource: net::ERR_FILE_NOT_FOUND` for `default-cover-*.svg`, that copy was stale and never made the `assets` link; it is no longer used and can be deleted.)
