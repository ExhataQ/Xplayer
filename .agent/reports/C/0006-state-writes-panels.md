# Agent C report 0006: replace writes in the panel files

Steps: C-01. Applies on top of: `Source-backup.zip` as uploaded (includes C 0001 to 0005 and the A, B, D work).
Archive (.agent/AGENTS.md section 1): not done. `E:\Backup\Programming\Music player` is not reachable from this environment. I kept a copy of `src/`, `tools/` and `.agent/` from before the edit; take your own snapshot before applying.

## Changes

- `src/js/08a-panel-layout.js`: 4 writes -> `setRightPanelCollapsed(true/false)` (2) and `setLastRightPanelStateBeforeQueue({...})` (2, object literal kept as is).
- `src/js/08e-panel-settings.js`: 9 writes -> `setAdvancedSettingsOpen(...)` (6) and `setCurrentView(VIEWS.SETTINGS)` (3).
- `src/js/08h-panel-search.js`: 8 writes -> `setSearchQuery` (2), `setCurrentSearchSessionId` (3), `setCurrentView` (2), `setNextSearchItemSlotId` (1).
- `tools/change.log.txt`: entry appended.
- Order of statements and the values written are unchanged; reads stay bare variables. No new comments, no new files, no manifest change (the setters in `core/state-*.js` already load before `08*`).

## Numbers

`node tools/dep-map.js` before -> after: mutable globals assigned from other files **52 -> 52**, file-level cycles **70 -> 70**, load-time cross-file references **26 -> 26** (forward: 0). The totals do not move because each name still has the setter file as a writer, and `07`, `04a`, `10d` and `14` still write some of these names. The real check is `dep-map.js writers rightPanelCollapsed lastRightPanelStateBeforeQueue advancedSettingsOpen currentView searchQuery currentSearchSessionId nextSearchItemSlotId`: **no `08a`, `08e` or `08h` entry any more** (before: 08a x4, 08e x9, 08h x8).
`node tools/event-audit.js --strict`: exit 0. A 0, B 0, C 0, 76 by fileExceptions (unchanged).

## Tests actually run

- `node --test tools/tests/setters.test.js manifest.test.js events-c.test.js events-wiring.test.js search-ui.test.js`: 31 pass, 0 fail.
- `node --test tools/tests/metadata-editor.test.js view-switch-song-list-cleanup.test.js playback-settings.test.js`: 18 pass, 0 fail.
- Not run: the full suite, `scroll.test.js` (nothing in virtual scroll changed), the app in Electron, the smoke checklist.
- Environment: `dep-map.js` needs `acorn`; `Source-backup.zip` has `node_modules` but it did not resolve here, so I ran with `NODE_PATH` pointing at an installed copy.

## Behavior note

`setCurrentView` emits `view:changed { view }`. Before, these 5 writes in `08e` and `08h` did not announce anything; now they do. `view:changed` has no subscribers today (checked with grep), and `07-views` will announce the same event once D migrates it, so nothing observable changes. If a subscriber is added later it will see these views too, which is the intent of the setter.

## Needs from other agents

- **A (A-07, second half):** these three variables are now written only by their setter, so they can be moved or removed from `00-state.js`:
  - `lastRightPanelStateBeforeQueue`: used only in `08a` and `core/state-ui.js`. Safe to move the declaration into `08a`.
  - `advancedSettingsOpen`: used only in `08e` and `core/state-ui.js`. Safe to move into `08e`.
  - `rightPanelCollapsed`: **not** panel-only. It is also read in `01-sizes.js` (12 times) and `99-player.js` (3 times), and initialised in `00-state.js` from `localStorage`. Leave the declaration where it is.
- **A:** the "Still written directly from" column in `core/SETTERS.md` still lists `08a`, `08e` and `08h`. Please update it (it is your file).
- **B and D (not mine):** the other writers of `currentView`, `searchQuery`, `currentSearchSessionId`, `nextSearchItemSlotId` are `07`, `04a`, `10d`, `14`.

## Not done

- Nothing in the step is left open. Plan 1 leftovers that are mine and still open: the `all-songs-count` bug in `08h`. It is a plain one-line behavior change, so I left it. The PLAN lists it as "probable"; I confirmed it earlier by reading the code and from the recorded scenario (the cleared-search branch throws after the list is redrawn), but I have not seen it in the running app.

## For you (manual checks)

1. Open Settings from a song list, then Advanced settings, then close it -> each screen opens and closes as before; the back button returns to the previous view.
2. Open Settings from History and from Search History, and open Advanced settings there -> same.
3. Type in the main search box, then clear it -> list filters, header and count follow, the full list returns.
4. Open an album, type in its search box -> list filters; empty it -> full list.
5. Collapse and expand the right panel; switch to Tags and back; open the Queue tab from a collapsed panel -> the panel returns to the state it had before the queue opened.
6. Restart the app after collapsing the right panel -> it stays collapsed.

## Next step

C-04, C-05 (need A-10, the handler bridge) and C-06 (needs A-13 and A-14) are blocked. Nothing else is open for C in Phase 1.
