# Report: default covers 404 in the source-backed runtime

**Task:** owner request (console errors) | **Agent:** A | **Date:** 2026-10-28 | **Status:** In review

## Summary
The console showed `Failed to load resource: net::ERR_FILE_NOT_FOUND` for `default-cover-liked.svg`, `-playlist`, `-folder`, `-album` and `-artist` (and the line above them, cut off in the paste, is most likely `-all-songs`). The launcher now runs `Prepare-Source-Backed-Runtime.ps1` from `Source` instead of a copy in the runtime folder, so the `assets` link is always made.

## Findings
- The new interface asks for the covers as `../assets/` (from `ui-next/index.html`) and `../../assets/` (from `ui-next/adapter/*.css`), which is `<output>\assets\` in the source-backed runtime (PB-21). In the source tree they are all in `src/assets/`.
- PB-21 added an `assets` junction to `Prepare-Source-Backed-Runtime.ps1` for this, but `Launch-Xplayer-UI-Next.bat` ran `%RUNTIME%\Prepare-Source-Backed-Runtime.ps1`, a separate copy in `E:\.Storage.local\xplayer-test-runtime`, and the README asked for that copy to be replaced by hand after each change. A copy that was not replaced does not make the link, so `<output>\assets` stays the old generated folder, which has `default-cover.svg` only. That is exactly the pattern in the console: every per-kind cover fails, the plain song cover does not.
- **Inferred, not seen:** I cannot look at `E:\.Storage.local\xplayer-test-runtime`. The check is below.

## Changed files
| File | Change |
|---|---|
| `Launch-Xplayer-UI-Next.bat` | runs `%SOURCE%\Prepare-Source-Backed-Runtime.ps1`; stops with a message if that file is missing |
| `README-SOURCE-RUNTIME.md` | the "copy it over that one" note replaced; says the old runtime copy is unused |
| `tools/tests/source-runtime-assets.test.js` | new test: the launcher runs the script from Source and not from `%RUNTIME%` |

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/source-runtime-assets.test.js tools/tests/default-cover.test.js` | 6 of 6 pass (the new launcher test fails on the tree without this change) |

## Not run
The launcher and the PowerShell script on Windows (no Windows or PowerShell here).

## Manual checklist for the owner
1. Apply the patch and start `Launch-Xplayer-UI-Next.bat`. Expected: the console prints `assets now links to ...\Source\src\assets` (the first time) and the covers show; no `ERR_FILE_NOT_FOUND`.
2. If it still fails, run: `Get-Item 'E:\.Storage.local\xplayer-test-runtime\ui-next-test\MusicPlayerOutput\assets' -Force | Select-Object FullName,LinkType,Target`. `LinkType` should be `Junction`, target `Source\src\assets`. If it is a plain folder, the script did not run or could not rename it (`assets-built` already exists): rename or remove that folder and start again.
3. A normal build (`build/music_player.py`) copies the covers to `<output>\assets` as well; that is unchanged.

## Open issues and follow-ups
- The stale `E:\.Storage.local\xplayer-test-runtime\Prepare-Source-Backed-Runtime.ps1` is no longer used and can be deleted.
