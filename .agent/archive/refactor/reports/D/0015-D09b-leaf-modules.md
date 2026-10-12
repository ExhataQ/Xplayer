# Agent D report 0015: D-09b, leaf files as ES modules (06c, 06d, 06e, 06h, 06j)

Step: D-09b. **Applies on top of D-0014 (D-09a2)**; that one must go in first. Uses the decisions in report 0013: you told me to make the changes in other agents' files myself, so this patch also touches `ui/player-bar.js` and two docs in `core/` (A's). No commit, no push.
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup` is not reachable from my environment.

## Changes

- `06c`, `06d`, `06e`, `06h`, `06j`: top-level function declarations that other files use got `export`, and each file ends with a guarded `registerLegacyGlobals({...})` for exactly the names the survey found (report 0013, Appendix A). No logic edits. `06e` has no functions; it ends with `export {};` (the manifest test wants an export, as for `15c`).
  - 06c: `updateScrollbarById`, `initExternalScrollbar`. 06d: `temporarilySuppressTooltip`. 06h: `openImageViewer`, `closeImageViewer`. 06j: `showNotification`, `showCoverProgressNotification`, `completeCoverProgressNotification`, `toggleNotificationPanel`, `closeNotificationPanel`, `clearAllNotifications`, `removeNotificationItem`, `renderNotificationPanel`.
- `06c`, the hidden global (report 0013, section 2): `updateExternalScrollbar = updateScrollbar;` became `window.updateExternalScrollbar = updateScrollbar;`. Every caller still finds it by name (most behind `typeof` guards), and tests that replace it on `window` still work.
- `ui/player-bar.js` (A's file, section 3): `addEventListener('click', openImageViewer)` became `addEventListener('click', () => openImageViewer())`, so nothing reads the module's function while the page loads. (`openImageViewer` takes no arguments, so passing no event changes nothing.) The `initMarqueeOnHover` guard in the same file is for `06k`; I change it in D-09d, when `06k` moves.
- `src/manifest.json`: the five files moved from `"js"` to `"modules"`, placed right after `06i-theme-switcher.js`, in their old relative order.
- `tools/tests/converted-modules.test.js`: the 13 registered names added. New `tools/tests/ui-leaf-modules.test.js` (7 tests, 4 in a real page).
- Docs: `core/SETTERS.md` says where the UI variables are declared (`04a0-ui-state.js`); `core/LEGACY.md` status line brought up to date (it still said no inline handler was converted).
- `tools/change.log.txt`: entry added.

## Proof that behavior did not change

- The 4 real-page tests were run on the tree **before** this patch (classic files) and **after** (modules): they pass on both. They check that the registered names exist on `window`, `updateExternalScrollbar` is a function, `lastMouseX/Y`, `setLastMouseX`, `showNotification` and `notificationHistory` still work together, a click on the album art opens the image viewer and `closeImageViewer` closes it, and the tooltip text moves to `data-original-title` and shows on hover (06e and 06d).
- Sabotage check (restored afterwards): without `openImageViewer` in the 06h registration, 4 tests fail (`ui-leaf-modules` x2, `converted-modules` x2).
- Listener order: the document and window listeners of these files are still registered after the bridge and `04a`/`06a`, in the order 06c, 06d, 06e (06j and 06h register none). `06e`'s `DOMContentLoaded` listener now runs after `99-player.js`'s instead of before (report 0013, section 4); the tooltip test passes with that order.
- `dep-map.js`: load-time references 28 -> 27 (the `ui/player-bar` use of `06h` is gone), forward references 0. `event-audit --strict` exits 0.

## Tests actually run

- `manifest`, `converted-modules`, `legacy-bridge`, `ui-handlers`, `scroll`, `ui-leaf-modules`: 73 tests, 72 pass, 0 fail, 1 skip. Full suite (`node --test tools/tests/*.test.js`): **314 tests, 312 pass, 0 fail, 2 skipped**.
- Not run: real Electron. The plan asks for one run after D-09d (file:// module loading, shortcuts, modals).

## For D-09d (note, so it is not forgotten)

When `06a` becomes a module, insert it in `"modules"` **before** `06c` (not at the end). `06a` and `06d` both register a document `click` listener and `06a` runs first today. The same holds for `06k` (it must come after `06d`, before 99-player's DOMContentLoaded handler) and `04a` (before `06a`).

## For you (manual checks)

1. Start the app; no console errors.
2. Scroll the song list and the left panel: the custom scrollbar follows; resize the window.
3. Hover the buttons in the player bar and header: tooltips appear with the same text as before.
4. Click the album art: the fullscreen viewer opens, click zooms, Esc and the close button close it.
5. Trigger a notification (add a song to a playlist), open the bell panel, dismiss one, clear all; run a cover update or download to see the progress notification.
