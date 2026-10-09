# Agent D report 0010: inline handlers, second part (D-05)

Step: D-05, status stays **in progress** (5 inline handlers left, all waiting on B and C). Applies on the zip `Xplayer-main_21`. No commit, no push.
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup` is not reachable from my environment.

## Changes

Inline handlers in D files: **96 -> 5** (this count includes `setAttribute('on...')` sites, which the test now counts too).

- `07a-ui-actions.js`: new actions for everything below, plus `applyActionAttrs` (copies an `actionAttrs(...)` string onto an element built with createElement) and `ITEM_CONTEXT_MENUS`. `switchView` is not registered here (C registers it).
- 04b, 04c, 04d, 05b: left-panel items, folder rows, album cards, filter tags, chevrons and cover play buttons. The play buttons use the marker `data-stop-mousedown`.
- 06f, 06g: the container mousedown listeners return early for `[data-stop-mousedown]`. They run before the bridge, so `data-stop` alone could not block them.
- 04a: song rows (click, dblclick, contextmenu, Enter), number cell, favorite button, more button, artist and album spans, cover images. The unused `onClick` / `onContextMenu` config fields are gone (04a and 04e).
- 04f, 06j, 07-views, 06a (menu items that stopped propagation now use `contextMenuAction` with stop; three names added to `CONTEXT_MENU_ACTIONS`).
- 06b dialogs: every button became a `data-action`. `modal.onclick = stopPropagation` became `data-stop`, and overlays use the new `closeOnOverlayClick`, so a click inside a dialog does not close it.
- `build/music_player.html`: all 20 inline handlers converted (main list all-songs and favorites items with their context menus, right panel header and menu, metadata edit, seek and volume, extended info overlay, image viewer).

## Left inline on purpose (5, all in 04a)

- `renderRightPanelItem` builds `onclick` / `oncontextmenu` / more-info from `onClick` and `contextMenuArgs` strings passed by 10c (B) and 19 (C), and by 04e (mine, a plain `playSongFromList` string).
- The add-to-queue button: 10c looks it up with `.add-to-queue-btn[onclick*=...]`.
- **Needs from B and C:** give me an action-based config for these callers (I can add it to `renderRightPanelItem` when you say so), and change the 10c selector.

## Notes

- The old selectors `.left-panel-item[onclick*="favorites"]` (99-player) and `[onclick*="recent"]` (04h) never matched the main-list items (different class), so converting those items changes nothing for them.
- The two cover `onerror` handlers that did not clear themselves now remove `data-action-error` first (they can no longer loop if the placeholder fails).

## Tests actually run

- `ui-handlers`: 20/20 (3 new browser tests: template controls with arguments, song rows, cover fallback). `converted-modules`: the minimum count of inline-called functions lowered from 10 to 3, because most are gone. `legacy-bridge` and `manifest` pass. `event-audit --strict` exits 0.
- Dialog probe in a real page: a click inside the dialog keeps it open, a click on the overlay closes it, Cancel closes it, Create makes the playlist and closes it.
- Full suite (`node --test tools/tests/*.test.js`): **298 tests, 296 pass, 0 fail, 2 skipped** (the same two skips as before).
- **Not done:** a full old-tree-vs-new-tree probe of every converted control (I did that for the earlier slices; the probe scripts were lost with the sandbox). Not run: real Electron.

## For you (manual checks)

1. Left panel: click and right-click a playlist, folder, album, artist, All Songs and Liked Songs. Click the folder chevron and a cover play button (they must not start a drag or open the item).
2. Song list: click, double-click, Enter, right-click, the number cell, the heart, the "..." button, and the artist and album names.
3. Dialogs: create/edit playlist and folder, Add link, "Create new": buttons work, clicking inside does not close, clicking outside does.
4. Seek bar, volume bar, image viewer, extended info panel, notification dismiss.
