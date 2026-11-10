# P1-PA-11: Settings layout (hub and pages) and Keyboard shortcuts page

Agent A, 2026-10-22. Status: in review.

## What changed
- `shell/settings-layout.js` (new): the engine still draws Settings (strategy S3, nothing rebuilt). After Appearance and the AI section are injected, the sections are moved into five groups: General (Appearance, Right Panel, Window, Interface, Startup screen), Playback (Playback & Audio, Smart Shuffle), Library (Music Library plus its folder list, Play from URL), AI (Agent E's section), Data (Backup & Restore, Advanced). An unknown future section stays at the end under "More".
- A floating bar (a `nav` with the shared `chipGroup`) sits centered under the title and sticks while the page scrolls. Pressing a group scrolls to it (instant with reduced motion); the active chip follows the scroll. A group with no sections (AI before E registers) is not shown.
- `shell/shortcuts-page.js` (new): Help > Keyboard shortcuts opens a dialog with the engine's shortcuts (written out by hand from `js/ui/06k-keyboard-shortcuts.js`; keep in step) and an AI group when E's commands are registered.
- Fix: the AI hotkeys now run in the capture phase and stop the event, so Ctrl+Shift+S does not also trigger the engine's plain S (shuffle).
- CSS in `views/tools/settings.css` (tokens only); icon `keyboard` added by hand to `icons.js`.
- Tests: `ui-next-settings-layout.test.js` (7). The AI slots tests still pass (7).

## For Agent E
Nothing to change: `registerAiSettings` now lands in the AI group. Your section's body gets the same width and rules as the others; use the `.settings-threshold-row` / `.settings-toggle-row` classes from `views/tools/settings.css`, or the shared components.

## Not done
- Not every setting has moved to a different place: the engine's own wording and controls are unchanged (that is the engine's page). Moving a setting out of the engine is a separate change (it is shared with the old screen, D64).
- Mouse buttons 3/4 are listed on the page, but their behavior is PA-13.

## Checked and not run
- All ui-next tests, lint: see the hand-off message. Headless Chromium only; real Electron and Windows not run.

## Rework (2026-10-23, owner request)
- The floating section bar is gone. Settings opens on a **hub of cards** (General, Playback, Library, AI when registered, Data); each card opens **its own page** with a Back button, a title and a one-line summary. Back, Escape (outside a field) and the rail item all return to the hub; focus moves to the page title, and back to the card. A redraw by the engine (Advanced Settings > Back) returns to the page you were on.
- **Theme styling** (`views/tools/settings.css`, tokens only): hub cards and section cards on `--surface-panel` with a subtle border, accent-tinted icon chips, pill switches for the toggles, hairlines between rows, inset folder list. Follows all three themes and the accent colors. A short entrance animation, off with reduced motion.
- **Old interface, hidden in the new screen only** (the engine page is shared with the old screen and is unchanged): View Play History and Search History buttons; the Theme Color block; the engine's own Interface section (the new Interface row in Appearance stays); the "Change Music Folder (Legacy)" button (the Music Library Folders block is the folder control); empty Font Awesome icon boxes. "Smart Shuffle v1" is shown as "Smart Shuffle" and "Background (new interface)" as "Background".
- Tests: `ui-next-settings-layout.test.js` rewritten for the hub and pages (6 Settings tests + shortcuts/hotkeys); `ui-next-settings`, `ui-next-appearance`, `ui-next-ai-slots` and `ui-next-startup-wiring` open the right page first; the contrast and 800 x 600 checks now cover the hub and every page.
- Known and not from this change: `ui-next-lyrics-find.test.js` "at the smallest window nothing scrolls sideways" times out on the untouched backup too.
