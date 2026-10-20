# Report UI-A07: toasts and the notification center

**Agent:** A (Claude)  **Date:** 2026-10-18  **Status:** In review. Browser-tested with the real engine; the Windows and Electron checklist below has not been run.

## What you get

- Every `showNotification(...)` the engine already makes (160 call sites) now shows as a short **toast** (bottom right, above the player) and is kept as an entry under **Earlier** in the **notification center** that opens from the title bar bell.
- Downloads and the album art search show under **In progress** with a bar, a status line and a percent. Finishing moves the row to Earlier and shows a toast.
- The bell carries an accent dot while something is running or unread. Its label and tooltip say how many ("Notifications, 1 in progress, 2 unread"), so the dot is never the only signal.
- Dismiss one entry, or Clear all. Empty state: "Nothing new".
- The engine's own bell, badge and panel are not used and not visible.

## Decisions taken

- **D40, no engine edit.** The engine keeps `notificationHistory` and calls `renderNotificationPanel()` after every change, but sends no event. That function draws into `#notification-panel-list` when the page has one. `adapter/notifications-bridge.js` provides that element, hidden, treats each redraw as "something changed" and reads a copy of the history. The engine's markup is never shown. Alternative rejected: wrapping `window.showNotification`, which misses the engine's progress functions and its internal calls.
- **D41, no cancel button.** DIRECTION.md asks for cancel on running work. The engine has no way to stop a download or the art search (no handler, no IPC), so a button would lie. It needs a main-process change, which is out of scope (PLAN.md section 2). Open for you: add real cancel later (touches `electron/`, `desktop-api.js` and the engine's download and cover code).
- **D42, what counts as an error.** The engine uses its `error` type for removals too ("Playlist deleted", "Entry deleted from history"). Only an `error` whose wording says a failure (failed, could not, invalid, not available ...) is drawn as an error (red icon, `role="alert"`, 8 seconds). The other `error` entries are information. `warning` is a toast of kind info with a warning icon in the center; `heart` is success.
- **Toast and center do not double up:** while the center is open, a new entry appears in the list and no toast is shown.
- The engine's `duration` argument (for example 1500 ms) is not kept in its history, so toasts use the component's defaults (4 s, errors 8 s).

## Changed files

New:
- `src/ui-next/adapter/notifications-bridge.js` (about 40 code lines; counts toward the adapter budget, D18)
- `src/ui-next/shell/notification-center.js`
- `src/ui-next/shell/notifications.css` (tokens only)
- `tools/tests/ui-next-notifications.test.js` (3 static, 12 browser)
- this report

Edited (shared files, small):
- `src/ui-next/shell/shell.js`: 1 import, 1 call (`mountNotifications(bell)`) next to where the bell is created.
- `src/ui-next/index.html`: one stylesheet link (`shell/notifications.css`) after `shell.css`.
- `src/ui-next/icons/icons.js`, `tools/build-ui-next-icons.js`: three Lucide icons added (`bell-off`, `download`, `image`) and listed in the generator. Existing icons were not regenerated, because the Lucide copy available here (v1.59.0) draws some shapes differently from the vendored ones; the new three come from that version.
- `.agent/BOARD.md`: A-07 row, D40 to D42, Reports row.

Not touched: `src/js/`, `src/css/`, `electron/`, `build/`, `components/`, `tokens.css`, `views/`, `tools/CHANGELOG.md` (the integration owner writes it after Phase 3).

## Checks (cloud container, Node 22, headless Chromium; Playwright, acorn, eslint installed with `npm i --no-save`)

- `node --test tools/tests/ui-next-notifications.test.js`: 15 tests, all pass. They cover: bell and closed state; toast, dot and unread count; opening clears the dot; error wording rules; at most three toasts, five entries in the center; a burst keeps the newest toast; dismiss and Clear all against the real engine history; a running bar updated in place (same node), dot "running", completion moves to Earlier; completion toast when closed; Enter, Escape, focus return, press outside; 800 x 600 window (inside, no sideways scroll, above toasts); right-to-left `dir=auto` and no markup injection; the engine's old elements stay hidden. Also: tokens only, imports only through the bridge and components, bridge size.
- A deliberate break (every `error` drawn as an error) made the error-wording test fail; restored, it passes.
- Existing suites, all pass: shell 20, adapter-api 3, tokens 23, components 26, components-behavior 64, phase1-gate 11, startup 6, player-bar 8, playback 17, settings 16, listbar 7, search 8, songlist 22, b06-finish 6, lyrics 16, lyrics-editors 20, lyrics-find 15, metadata 19, dialogs 12, adapter-player 5, waveform 9. `ui-next-library` had **1 failure on its first run**; I did not capture which test. It passed 16 of 16 on four re-runs of this tree and on the untouched original, so I treat it as a timing flake under load, not a result of this change. Please watch for it.
- `node tools/lint.js`: 138 files, 0 errors, 0 warnings.

## Not run

- Electron (real window, real downloads, real album art search). Headless Chromium with a stubbed `electronAPI` only.
- The full `npm test` suite.
- Archive step (AGENTS.md section 1): the project and archive folders are not reachable from here. The uploaded zip was the snapshot; snapshot yours before applying.

## Found

1. `ui-next-library` flake, above.
2. The engine's error messages are short ("Failed to download", "Failed to save"). DIRECTION.md wants errors to say what happened and offer a next step. There is no retry action to attach for most of them, so none was invented. Wording belongs to the engine's call sites (A-12 gap fixes).
3. The engine writes the progress message with an emoji and a percent; the bridge strips them and the center draws its own icon and bar.

## Manual checklist (Windows app, `--ui=next`)

1. Open the app. The bell in the title bar has no dot.
2. Add a song to a playlist (or create one). Expect a toast bottom right; it goes away by itself after about 4 seconds; the bell gets a dot.
3. Open the bell. The dot disappears; the entry is under Earlier with its time. Press Escape: it closes and focus is back on the bell.
4. Do something that fails (for example save lyrics to a read-only file). Expect an error toast with a red icon that stays about 8 seconds.
5. Start a download from a link (or let the album art search run after adding a folder). Expect no toast for progress, a dot on the bell, and under In progress a row with a moving bar and percent. Open the center while it runs: the bar keeps moving and nothing jumps.
6. When it finishes: the row moves to Earlier, and a toast appears (if the center is closed).
7. Dismiss one entry with the x; Clear all; expect "Nothing new".
8. Shrink the window to the minimum: the center stays fully on screen.
9. Switch theme and accent in Settings: toast, center and dot recolor and stay readable.

## Follow-ups

- Real cancel for downloads and the art search (D41).
- A-08 should give the bell's tooltip the shared state line (done here: it shows "1 in progress, 2 unread").
- `tools/tests/README.md` counts and `tools/CHANGELOG.md`: at the end of Phase 3.
