# Agent D report 0017: D-09d part 1, 06b stops reassigning its close functions

Step: first part of D-09d (`06a`, `06b`, `06k`). The plan says to do this before converting `06b`: "turn each wrapper into a module-level variable or a named step that the close function calls (a small, tested change on its own), then convert." **Applies on top of D-0015 (D-09b)**; it is independent of D-0016 (D-09c) (no common file) and of the lint patch. No commit, no push.
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup` is not reachable from my environment. `.agent/BOARD.md` and `tools/change.log.txt` are not edited; please add the entries.

## Why only this part of D-09d

D-09d is not one mechanical move like D-09b and D-09c. Report 0013 lists four separate problems; this patch removes the first and the rest are listed under "Still to do". Converting any of the three files before they are solved would silently break something, so I did not convert anything here.

## The problem

Five dialogs in `06b` did `const originalClose = closePlaylistModal; closePlaylistModal = function () { <cleanup>; originalClose(); }` (four playlist/folder dialogs) or the same for `closeAddLinkModal` (the link dialog). The wrappers never unwind, so after N dialogs a close runs N cleanups, newest first, then the real close. This matters because `createModal` removes an older dialog's elements without running its cleanup: the older dialog's keydown handler (and, for the edit-playlist dialog, `window.handleEditPlaylistCover` / `window._editPlaylistTempCover`) is removed only by that chain.

In a module the reassignment would change a module-private binding, while `registerLegacyGlobals` would keep the **original** function on `window`. `07a`'s `data-action="closePlaylistModal"` handlers call the bare global name, so after conversion every Cancel button would skip all cleanup.

## Change (only `src/js/06b-modals.js`)

- Two module-level lists, `playlistModalCleanups` and `addLinkModalCleanups`, and `runModalCleanups(list)` (newest first).
- `closePlaylistModal` and `closeAddLinkModal` call `runModalCleanups` first, then do what they did before.
- The five reassignments became `list.push(function () { <the same cleanup body> })`. Bodies are copied unchanged. Like the chain, the lists keep their entries for the life of the page.
- Nothing else: no exports, no manifest change. `06b` is still a classic script.

## One deliberate behavior difference (a leak that is now fixed)

Closing the **add link** dialog by clicking its overlay used to leave its Enter/Escape keydown handler attached for the rest of the session: `createModal` was given the close function as it was before that dialog's wrapper existed, and this dialog keeps its cleanup only in the wrapper. With the explicit list the cleanup runs on every close route. A user would have seen Enter or Escape being swallowed (and Enter calling `playFromUrl` with no input) after closing that dialog by clicking outside it. The playlist and folder dialogs were not affected, because their cleanup is also stored on `overlay._cleanup`, which the base close already runs.

If you prefer a strictly identical refactor, say so; keeping the leak would need a more awkward shape and I would not recommend it.

## Proof

- New `tools/tests/modal-close.test.js`, 25 real-page tests: for each of the five dialogs, Cancel, Escape and (except add link) a click on the overlay all close it and remove its keydown handler, and it can be opened and closed three times in a row; the edit-playlist helpers on `window` exist only while it is open; a dialog opened over another one cleans up the older one when the newer one closes; add link opened twice is cleaned up by one close; closing the link dialog does not disturb a later playlist dialog. A leaked handler is detected with a probe: a synthetic Enter or Escape keydown whose `defaultPrevented` is read.
- **Run on the unmodified code first: 25 tests, 24 pass, 1 fail** (`add link: a click on the overlay removes its keydown handler`, the leak above). **After the change: 25 pass.**
- Sabotage check (restored afterwards): without the edit-playlist `push`, `a dialog opened over another one: closing the newer one also cleans up the older one` fails.
- `lint-globals`: 928 -> 931 names (the two lists and `runModalCleanups` are top-level declarations of a classic script; they stop being globals when `06b` becomes a module). `dep-map.js`: load-time references 27, forward 0 (unchanged). `event-audit --strict` exits 0.

## Tests actually run

- `modal-close` 25/25 after the change.
- Full suite (`npm test`): **353 tests, 351 pass, 0 fail, 2 skipped, exit 0** (475 s). The two skips are the same as in the earlier runs (`a tiny thumb nudge shows real rows only` and `storage getters fall back to empty arrays`).
- Not run: real Electron (the plan asks for one after D-09d is finished).

## Still to do for D-09d (not started, in this order)

1. **`ui/player-bar.js` (A's file)**: the `initMarqueeOnHover` guard (`typeof initMarqueeOnHover === 'function'`, report 0013 section 3) must change before `06k` moves, or the title/artist marquee silently stops. Needs your word that editing A's file is fine, as for D-09b.
2. **`06a` live variables**: `activeContextMenuSlot` (read by `16`) and `currentContextSongId` (read by `10c`, `16`, `17`) are top-level `let`s that other files read by bare name. In a module they would no longer be globals. They need to move to `core/state-ui.js` with setters, the way D-01/D-02 did for the other UI variables (`core/SETTERS.md`). That is its own small patch with a test.
3. **Convert `06b`** (export, `registerLegacyGlobals` for the 20 names in report 0013, keep `window.handleEditPlaylistCover` / `window._editPlaylistTempCover` as they are, they are meant to be on `window`; `modal-close.test.js` already guards the behavior), then **`06k`** (after step 1), then **`06a`** (after step 2). Order in `"modules"`: `06a` **before** `06c`, `06k` after `06d` (report 0015, "For D-09d").
4. **One real Electron run** after step 3: file:// module loading, keyboard shortcuts, every dialog, context menus.

## For you (manual checks, classic build)

1. Open "New playlist", close it with Cancel, Escape and by clicking outside; after each, press Enter and Escape in the main window: nothing should react.
2. Same for "Edit playlist" (rename and Save once), "New folder", "Edit folder" and "Add link"; for "Add link" close it by clicking outside and then press Enter: nothing should happen (it did before this patch).
3. Edit a playlist, pick a cover image, Save: the cover changes. Open the edit dialog again and Cancel: the old cover stays.
