# UI-A08 Tooltip rollout and the shared Space rule

Agent: A. Status: In review. Decisions: D37 (proposed).

## What changed and why
- **`components/tooltip.js`**: `delegateTooltips(root, resolve)`, one set of listeners for a whole subtree, so controls the engine builds and recycles get the shared tooltip without per-element wiring. Same delay and hide rules as `attachTooltip`, plus hide on scroll (rows move under a still pointer). Controls with their own `attachTooltip` are skipped (`hasTooltip`).
- **`shell/tooltips.js`** (new): takes the engine's `title` and `data-original-title` into `data-tip` the moment they appear or change, so the old tooltip (ui/06d) and the browser's native one never show. A trailing key in a title ("Stamp current time (F1)") goes to the shortcut slot. An icon-only control keeps an accessible name. Views can use `data-tip`, `data-tip-state`, `data-tip-description`, `data-tip-shortcut` directly. A small rule table adds text where the engine gives none: add-to-queue description, favorite toggle (tooltip follows the click), theme buttons (name from `data-theme`, state "Current"), panel cover play button.
- **`shell/space-key.js`** (new): one rule for every button, tab, radio, switch and checkbox: Space presses it, Enter presses it when it is not a real button. Text fields, menu items, sliders and the page itself keep their behaviour. The private copies in `views/playback/transport.js` (`ownSpaceKey`) and `cover-viewer.js` are removed; queue rows keep their arrow keys.
- **List toolbar** (`list-toolbar.js`): Play/Pause with a description, Shuffle with On/Off and the engine's `S` key, Find with a description, More. `iconButton` accepts a function for `tooltip`, read each time it opens.
- **`tokens.css`**: `--layer-tooltip` 70 to 100300. Engine dialogs sit at 80 and the sync editor's confirm at 100060, so at 70 the new tooltip would have hidden under them (the old one was 100200).
- **`shell.js`**: installs both modules at the start of `init`.

## Notes
- The engine rewrites the active theme button's label to "pink theme active"; the tooltip name ignores it.
- An engine title that is emptied clears the tooltip. An engine that removes a title outright leaves the last text; no current engine code does that.
- `.more-info` (row menu button) is a div that cannot take keyboard focus. Not changed here (A-12).

## Decision D37 (proposed)
Space presses whichever button is focused, everywhere, as the player's buttons already did. A mouse click leaves focus on the button, so click a row's heart, then Space, toggles it again instead of pausing. Alternative: press only for keyboard focus (`:focus-visible`); that would change the shipped player behaviour and its test. Not done without your decision.

## Tests run
New `ui-next-tooltips` (17): all pass, repeated. Breaking each piece on purpose (Space rule, title take-over, tooltip layer, hide on scroll, favorite stay-open) makes a test fail. 30 related files pass with 0 failures, including `ui-next-playback` (17), `ui-next-components-behavior` (64), `keyboard-shortcuts`, `modal-close`, `ui-next-shell`, `ui-next-tokens`, `ui-next-listbar`. Run here with Playwright from the sandbox's Python install. **Not run:** ESLint / `tools/lint.js` (no `node_modules`, no network), the rest of the suite, the project archive step (E:\ not reachable).

## Not done
Electron and Windows run; RTL check; the `.more-info` focus gap (A-12); tooltips for controls that appear only with a song loaded (lyrics editors) are covered by the generic title take-over but were not hovered one by one.

## Manual checklist
1. Hover a row's heart, queue and "..." buttons: styled tooltip, no second unstyled one. Click the heart: the tooltip changes to "Remove from favorites".
2. List toolbar: Play says "Play all songs in this list", after starting it says Pause; Shuffle shows Off/On and S.
3. Settings: hover a theme: "Pink theme"; the current one shows Current.
4. Open any engine dialog with a titled button: its tooltip is visible above the dialog.
5. Tab to a Settings button, a dialog button and a chip: Space presses each and does not pause the song.
6. Space in a text field types a space; Space on the seek bar and with nothing focused still plays or pauses.
