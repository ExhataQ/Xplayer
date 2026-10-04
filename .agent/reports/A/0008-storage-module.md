# Agent A report 0008: storage module

Steps: A-13. Applies on top of: the zip `e2933ae2-Xplayer-main_1` (A-11 and A-12 applied).
Archive (.agent/AGENTS.md section 1): not done, nothing archived.

## Changes

- src/js/core/storage.js (new, classic script, first in the manifest): `storageRead`, `storageWrite`, `storageRemove`, `storageReadBool`, `storageWriteBool`, `storageReadJson(key, fallback, normalize?)`, `storageWriteJson`. The only code that touches `localStorage` in A's files. It is classic and first because `00-state.js` and `01-sizes.js` read saved values while they load, and modules run later.
- src/js/core/storage-schema.js (new, ES module under `modules`): read-time validators `normalizeIdList`, `normalizeStringList`, `normalizeObjectList`, `normalizePlaylists`, `normalizeFolders`, `normalizePinnedMap`, `normalizeSettings`, `normalizePanelWidths`.
- 00-state.js, 01-sizes.js, 03c, 03e, 03f, 03g, 03h, 03i, 03l, ui/layout.js: every `localStorage` call replaced (about 45). Keys and stored formats are unchanged. Playlists, folders, favorites, pinned items, order, history, recents, search history, folder pins and the two settings objects are validated on read.
- 03-storage.js: `getStoredJson` removed (it is replaced by `storageReadJson`); only the three list limits remain.
- src/js/core/STORAGE.md (new): the contract and the list of files still calling `localStorage`.
- Tests: storage-core.test.js (new, 11 tests), storage.test.js, recents.test.js and converted-modules.test.js updated; converted-modules.test.js gained a page test that loads old-format saved data. .agent/PLAN.md, BOARD.md, tools/change.log.txt updated.

## Contract

See `src/js/core/STORAGE.md`. In short: nothing throws; writes return true or false and log a warning; reads return the fallback for missing, empty, unparsable or unreadable values; a read never rewrites storage.

Two behaviour changes, both on failure paths only:
- A failed write (quota, storage disabled) used to throw out of the calling function (except in `saveToRecentlyPlayed`, which caught it). It now returns false and logs, and the function carries on, so for example the `playlist:listChanged` event still fires. If you want the user told about a failed save, that is a small follow-up.
- Wrong-shaped saved data is repaired in the returned value (a playlist with no `name` becomes "Untitled playlist", a folder with no `children` gets `[]`, an entry without an `id` is dropped, a setting of the wrong type falls back to its default). It is written back only when the app saves that list again.

## Numbers

`node tools/dep-map.js` before -> after: load-time cross-file references 26 -> 28 (forward 0 -> 0; the two new ones are `00-state` and `01-sizes` calling `core/storage.js`, which loads first); file-level cycles 73 -> 73.
`node tools/event-audit.js --strict`: exit 0, A/B/C 0, 68 allowed by fileExceptions.

## Tests actually run

- All 25 files in tools/tests (see the final count in my reply).
- Deliberate break: replacing the saved left-panel read in 00-state.js with `false` makes the older-saved-data page test fail; restored.
- Not run: the manual checks below; Electron.

## Needs from other agents

- B (B-09): `16-context-menu-actions.js` (play history) -> `storageReadJson(STORAGE_KEYS.PLAY_HISTORY, [], normalizeObjectList)` / `storageWriteJson`.
- C (C-06): `08a-panel-layout.js` (right panel collapsed), `08f-panel-extended-metadata.js` (extended metadata settings, hide right-panel lyrics), `18-lyrics-editor.js` (custom lyrics and synced lyrics).
- D (D-08): `05a-lazy-load-main-list.js` (virtual scroll threshold).
- Each: remove your file from the `notYet` list in `tools/tests/storage-core.test.js` when you swap it. Never read through a validator at load time (modules are not available yet); check inline like `01-sizes.js` does.

## Not done

- The five files above (not A's). So `grep localStorage` is not yet empty outside the storage module; A's files are clean.
- No schema version or migration: nothing needed one, since formats did not change.

## For you (manual checks)

1. Open the app with your existing library -> playlists, folders, favorites, history and recents look the same as before.
2. Create a playlist, favorite a song, close and reopen -> both are still there.
3. Collapse the left panel, close and reopen -> it stays collapsed.
