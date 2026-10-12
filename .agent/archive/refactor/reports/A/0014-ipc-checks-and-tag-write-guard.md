# Agent A report 0014: argument checks and safer tag writes

Side plan steps A-S4 and A-S5. Applies on top of: report 0013. No renderer or UI file changes.

## What changed
- New `electron/ipc-checks.js` (added to the copy list in `build/music_player.py`): `isAbsolutePath`, `isAudioPath`, `isImagePath`, `isDirectory`, `isHttpUrl`, `stringList`.
- `main.js` uses them before acting: `show-file-in-explorer` (absolute path), `delete-file` (absolute audio file), `import-dropped-files` (only absolute audio paths; none left gives `{success:false}`), `download-and-scan` (http/https link), `save-audio-cover` and `save-audio-metadata` cover (absolute image file), `add-music-folder` with a path (must be an existing folder, else `reason: 'not-found'`), `remove-music-folder(s)` (strings only), `get-folder-stats` (absolute path).
- `metadata-editor.py`: `restore_on_failure` keeps a temporary copy while a tag or cover save runs and puts the original bytes back if it fails; the copy is deleted either way. If the copy cannot be made nothing is edited.

## Why a copy and not "write to a new file, then rename"
On Windows the rename can fail while the player has the song open, which would break a save that works today.

## Not done
- One Python process for a batch of saves.
- `sandbox: true` for the window. The preload only requires `electron`, so it should work, but it needs a run of the real app on Windows.
- `music-folders.js` Windows-only paths and `%20` in song URLs.

## Verification
Full suite. `metadata_backend_logic.py` has 2 new tests; run against the old script they fail (checked), against the new one they pass. `main-process-safety.test.js` has 2 new tests.
