# P1-PA-07: application menu and hotkeys

Agent A, 2026-10-22. Status: in review. The structure is the one proposed in brief 18.2; **the owner still has to confirm it** (and the hotkeys below).

## What changed
- `shell/app-menu.js` (new): the logo menu now has seven submenus: File, Edit, View, Playback, Tools, Window, Help. One capture listener handles the new hotkeys; a combination with an arrow does not fire inside a text box. Engine keys (Space, S, R, M, L) are shown in the menu but still handled by the engine.
- `adapter/menu-bridge.js` (new, 30 lines): opens the engine's New playlist / New folder / Play from URL dialogs, presses the player's shuffle and repeat buttons, runs window calls through the desktop bridge. DP9 budget: 40 (home-bridge) + 30 = 70 of 300 used.
- AI entries (Edit > Undo, Playback > AI shuffle, Tools > AI chat) still come from `shell/ai-chrome.js` and appear in their groups once E registers them.
- Keyboard shortcuts page gets an Application group.
- Tests: `ui-next-app-menu.test.js` (5); the AI slots and settings layout tests were updated for submenus.

## Hotkeys proposed (to confirm)
Ctrl+1 Home, Ctrl+2 Library, Ctrl+3 Search, Ctrl+4 Recently played, Ctrl+F Find, Ctrl+Q Queue, Ctrl+E Metadata, Ctrl+, Settings, Ctrl+N New playlist, Ctrl+Shift+N New folder, Ctrl+U Play from URL, Ctrl+/ Keyboard shortcuts, Ctrl+Right Next, Ctrl+Left Previous. No clash found with the engine's keys (checked `06k`, the lyrics sync editor's Ctrl+Z/Y and the list's Ctrl+A/D). AI: Ctrl+Shift+A, S, U.

## Disabled entries, and what each needs
- Open file, Open folder, Import and export: an engine or Electron action for opening a file or folder (today only "Change Music Folder (Legacy)" and Settings).
- Redo, Select all (menu only; Ctrl+A already works in lists): no undo stack except AI's; a select-all action in the adapter.
- Big picture mode, Zoom, Full screen, Always on top: need Electron window calls (`electron/window-manager.js` has none). Zoom and Big picture mode are also undefined features.
- About, Check for updates, Open logs: need a version and update source and a log path from the main process.
- Minimize, Maximize, Close window work only when the desktop bridge has them; "Close window" follows the minimize-on-close setting.

## Checked and not run
Headless Chromium only, with a stubbed desktop bridge: the window entries were not run against real Electron. Real Windows hotkey behavior (AltGr layouts, global conflicts) not run. Full `node --test tools/tests/*.test.js` not run after this change.
