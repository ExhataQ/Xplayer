# Source-backed Xplayer test runtime

`E:\Programming\Music Player\Source` is the source of truth. The Electron build remains at `E:\.Storage.local\xplayer-test-runtime\node_modules\electron\dist\electron.exe`; runtime songs and generated player data remain under `ui-next-test\MusicPlayerOutput`, and test settings remain under `ui-next-test\config`.

Run `Launch-Xplayer-UI-Next.bat`. Optional Electron arguments passed to the batch file are appended after `--ui=next` (for example, `--remote-debugging-port=9339` for a local smoke test). The launcher sets `MUSIC_PLAYER_OUTPUT_DIR` and `MUSIC_PLAYER_CONFIG_DIR`, then runs `Prepare-Source-Backed-Runtime.ps1`. By default, config remains at `ui-next-test\config`; set `XPLAYER_TEST_CONFIG_DIR` before launch to use another isolated config during a smoke test. The helper preserves the existing generated `ui-next` and `js` folders as `ui-next-built` and `js-built`, then creates directory junctions from those output paths to `Source\src\ui-next` and `Source\src\js`. The app therefore loads the current UI and engine renderer modules directly from the source tree without copying them after edits. The generated `player.js`, songs, covers, icons, Electron executable, and isolated config remain in the runtime.

The launcher still passes `--ui=next`. `electron\ui-entry.js` resolves that flag to `ui-next/index.html`; the `ui-next` junction makes that entry the source file. Production builds are unaffected because the junction setup runs only from this test-runtime launcher.

To verify the link targets, run:

```powershell
Get-Item 'E:\.Storage.local\xplayer-test-runtime\ui-next-test\MusicPlayerOutput\ui-next' -Force | Select-Object FullName,LinkType,Target
Get-Item 'E:\.Storage.local\xplayer-test-runtime\ui-next-test\MusicPlayerOutput\js' -Force | Select-Object FullName,LinkType,Target
```

The targets should be `E:\Programming\Music Player\Source\src\ui-next` and `E:\Programming\Music Player\Source\src\js`. The original generated folders are intentionally retained as `ui-next-built` and `js-built`; do not remove them as part of routine source testing.
