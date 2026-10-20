# Round report: D17, D41, D37, D61, startup, keep both interfaces

Agent: A. Status: Done (automated tests passed; app opened and visually checked manually).

## Fixed
- **Adapter test failure.** The two tests imported `./adapter/...`, which `<base href="../">` resolves outside `ui-next/`. They now import `./ui-next/adapter/...`.
- **Startup delay.** The startup view now exists in the HTML (a static placeholder in `#startup`) and a small `early.js` module starts it before the app modules load, so it shows from the first paint instead of after the page loaded.
- **D17.** The fade-in ends at the volume set at that moment (`animateAudioVolume` takes a function for its end value).
- **D41.** Real cancel for downloads and the album art search, with a Cancel button in the notification center.
- **D37.** Space after a mouse click goes to the page; after keyboard navigation it presses the focused button.
- **D61.** Compact density now shortens library panel rows (`setLeftItemHeight` seam).
- **Notification Cancel button** used a computed action name, which `window-contract.test.js` forbids; it now uses two literal names.

## Phase 4: both interfaces stay (D64)
- `electron/ui-entry.js` decides the first load: `--ui=next`, `--ui=current` or `XPLAYER_UI` win, else the saved choice (`ui-choice.json` in the settings folder), else the current interface.
- Settings has an **Interface** row in both interfaces. It saves the choice and reloads the window into the other one (`switchUi` in `window-manager.js`, IPC `get-ui-choice` / `set-ui-choice`).
- `Launch-Xplayer-UI-Next.bat` still passes `--ui=next`, so it always starts the new interface; the in-app switch still works during that run.
- Switching reloads the page: what was in memory (queue, playing track) starts again from what is saved.

## Not verified
- Real Electron windows (the switch, the startup view, cancel on a real download), and the Windows manual checklists in the earlier reports.
