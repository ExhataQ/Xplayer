# Agent D report 0002: allowlist fix (decision 1 from report 0001)

Applies on top of D-0001. Decisions 2 (dedupe in 04h/04i/04n) and 3 (leftPanelVirtualState helper) were not done: they touch frozen test sequences or other agents' files and do not move Plan 1 forward. They stay listed as follow-ups.
Archive (AGENTS.md section 1) not done: no access to `E:\Backup` here.

## Changes

- `tools/event-audit.js` (A's file, tiny edit, approved by the human): (1) every allowlist category with a `names` array counts, not just four fixed ones; (2) an entry `"file.js:name"` allows that name only in that file.
- `tools/event-allowlist.json`: removed `renderPlaylistDetailView`, `renderAlbumDetailView`, `renderArtistDetailView`, `renderFolderContents` from navigation (they are called both as commands and as reactions). New category `virtualScroll` (`renderVisibleItems`, `setVirtualScrollThreshold`, `snapVirtualScrollThreshold`) with the correct reason. `updateNavigationButtons` moved to `setup` (only start-up callers).
- `tools/change.log.txt`: entry appended.

## Effect on the audit (run, with NODE_PATH pointing at an installed acorn)

164 -> **174** (A 41 -> 47, B 81 -> 85, C 42). The 10 new calls were hidden before:
- A: `09` renderPlaylistDetailView x2 (:88 reaction, :137 navigation), renderFolderContents x3 (:172 reaction, :228 and :244 navigation); `99:100` renderFolderContents (start-up).
- B: `16:45` renderPlaylistDetailView; `17:109/115/121` detail views (EB-B4).

`--strict` still exits 1 (expected). I checked that a `file:name` entry works by adding one temporarily (174 -> 173), then restored the file.

## Needs from other agents

- **A (EB-A5, EB-A6):** convert `09:88` and `09:172` (reactions). Then add the remaining navigation calls as per-file entries: `09-folders-playlists.js:renderPlaylistDetailView`, `09-folders-playlists.js:renderFolderContents`, `99-player.js:renderFolderContents` (start-up). Say why in your report; D reviews.
- **B (EB-B3, EB-B4):** convert `16:45` and `17:109/115/121`. In EB-B5 also cover `14-song-navigation.js` `renderVisibleItems` x3: it is now in `virtualScroll`, so it no longer appears in the audit; B only needs to confirm that choice.
- **C:** nothing.

## Tests actually run

`node --test tools/tests/manifest.test.js tools/tests/events-d.test.js`: 12 pass, 0 fail. (One earlier grep showed 11; a rerun gave 12/12, the first count was a truncated read of the output.) Not run: browser tests (no Playwright here); nothing in this patch touches the renderer.

## Manual checks

None needed: tooling only, no app behavior changed.
