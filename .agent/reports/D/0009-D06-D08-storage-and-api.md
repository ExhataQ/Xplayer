# Agent D report 0009: storage and API swaps (D-06, D-08)

Steps: D-06 and D-08 (Phase 5). Applies on top of: `Xplayer-main_3_.zip` (A-13 and A-14 are in it; D-05 first slice and D-07 are applied). Independent of D-0010 (D-05 second slice); apply this one first.
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup\...` is not reachable from my environment. Nothing in the zip was changed; the patch is the only deliverable.

## Changes (6 lines of code in 3 files)

| File | Before | After |
|---|---|---|
| `05a-lazy-load-main-list.js` (2) | `localStorage.getItem(KEY)` / `localStorage.setItem(KEY, String(v))` | `storageRead(KEY)` / `storageWrite(KEY, v)` |
| `06b-modals.js` (3) | `window.electronAPI.downloadAndScan(...)` with an `if (window.electronAPI && window.electronAPI.downloadAndScan)` guard | `desktopApi.library.downloadAndScan(...)` with `desktopApi.supports('library.downloadAndScan')` |
| `06b-modals.js` (D-06) | `window.electronAPI.invoke('welcome-select-folder')` | `desktopApi.library.welcomeSelectFolder()` with `desktopApi.supports('library.welcomeSelectFolder')` |
| `06k-keyboard-shortcuts.js` (2) | `window.electronAPI.deleteFile(windowsPath)` | `desktopApi.files.deleteFile(windowsPath)` |

Also: `05a` removed from the "not yet" list in `storage-core.test.js`, `06b` and `06k` from the list in `desktop-api.test.js` (A asked each owner to do this), `tools/change.log.txt` entry, and a new `tools/tests/ui-storage-api.test.js` (12 tests).

**D-08 "done when"** is met and now guarded: `grep` finds no `localStorage`, `sessionStorage` or `electronAPI` in `04*`, `05*`, `06*`, `07*` (four static tests in the new file).
**D-06**: no renderer file calls the generic `electronAPI.invoke` any more (checked across all of `src/js`, outside `api/`). A can remove `invoke` from the preload in A-16.

## Why behavior is the same

- `storageRead(key)` returns `null` for a missing key, like `getItem`; `parseInt(null)` is `NaN` as before, so the default is used. `storageWrite(key, v)` stores `String(v)`. One intended difference: a write that fails (full or blocked storage) is now logged and returns `false`; before, `setItem` could throw and stop `setVirtualScrollThreshold` before it re-rendered the list.
- `desktopApi.supports('group.name')` is true exactly when `window.electronAPI[name]` is a function, which is what the old two-part guards tested. `desktopApi.<group>.<name>(...)` calls the same flat `window.electronAPI.<name>(...)` with the same arguments and returns its result.
- Welcome picker: the old guard needed `electronAPI.invoke`; the new one needs `electronAPI.welcomeSelectFolder`, which A-14 added to the preload on the same channel (`welcome-select-folder`; A's `desktop-api.test.js` checks the channel). With a preload older than A-14 the button would do nothing, as it did without `invoke`.
- `core/storage.js` and `api/desktop-api.js` load before `05a`, `06b` and `06k` (they are first and second in the manifest), and `05a` reads the threshold while it loads, which `core/storage.js` allows (it is a classic script).

## Proof

The page tests were run on the original tree (before) and the new tree (after): the 05a, 06b download and 06k tests give the same results on both. On the original tree only the four tests that must differ fail (the static no-`localStorage`/`electronAPI` checks and the welcome test, which used `invoke`). Sabotage (restored afterwards): a wrong delete path, a wrong storage value and a wrong guard name each fail the matching test (3 failures).

## Tests actually run (Chromium via Playwright; `NODE_PATH` pointing at the global modules and `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`)

- `ui-storage-api`, `storage-core`, `desktop-api`: 34 tests, 34 pass.
- Full suite on this tree: `node --test tools/tests/*.test.js` -> **226 tests, 224 pass, 0 fail, 2 skipped** (both skips are written into the tests themselves: a timing-sensitive scroll test and a storage test for a moved function).
- `node tools/event-audit.js --strict`: exit 0, 68 excepted calls.
- Not run: the app in real Electron.

## Needs from other agents

- **A:** nothing blocking. A-16 can drop the generic `invoke` now that D's last use is gone (B and C do not call it either). The "still using localStorage directly" list in `core/STORAGE.md` can lose `05a`.

## For you (manual checks)

1. Run `node --test tools/tests/ui-storage-api.test.js` (or the full suite) -> 0 failures.
2. Settings: change the virtual scroll threshold, close and reopen the app -> the value is kept.
3. Add a link (the "play from URL" dialog) with a real audio URL -> it downloads and plays (needs Electron). Try one that fails -> "Failed to download".
4. Start with no music folder (or clear the folders) -> the welcome dialog shows; "Select Folder" opens the folder picker and the dialog closes once you pick one; "Continue Empty" closes it.
5. Select a song you can lose, press Ctrl+D and confirm -> the file goes to the Recycle Bin and the song disappears from the list.
6. Console: no errors.

## Next step

D-05 second slice is the next patch (D-0010). D-09 (convert the UI shell to modules) waits for A-15 (staged), B-10, C-07 and the rest of D-05.
