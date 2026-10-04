# Agent B report 0010: convert inline handlers in the playback files

Steps: B-07. Applies on top of: B report 0009 (the state `Xplayer-main.zip` was sent in).
Archive (.agent/AGENTS.md section 1): not done, no access to the archive root from here.

## Changes

- `src/js/10c-playback-queue.js`: the queue's "Load more" button now uses `actionAttrs('loadMoreQueueItems')` instead of `onclick="loadMoreQueueItems()"`, and `registerActions({ loadMoreQueueItems })` sits right after the function.
- `src/js/15b-controls-shuffle-btn.js`: the three buttons of the shuffle dialog (Normal Shuffle, Smart Shuffle, Turn Shuffle Off) use `actionAttrs('selectShuffleMode', [...])`, and `registerActions({ selectShuffleMode })` sits right after the function. The Smart Shuffle button, when disabled (list of 50 songs or fewer), carries no action at all, so nothing can run from it whatever the browser does with clicks on disabled buttons.
- `src/js/15b-controls-shuffle-btn.js`, the dialog's own `modal.onclick`: it used to call `event.stopPropagation()` on every click. That would have made the three buttons dead, because the bridge listens on `document` and never sees a click that was stopped below it. It now stops the click only when it did not come from a `[data-action]` element. Removing the line instead was not possible: `createModal` (`06b-modals.js`, not mine) sets `overlay.onclick = closeFunction` with no target check, so without the stop a click inside the dialog would close it.
- `tools/tests/playback-handlers.test.js`: new, 9 real-browser tests with real mouse clicks (see below).
- `tools/change.log.txt`: one entry.
- No other code was touched. No comment names an agent, step or plan.

## What changes at runtime

- Clicks on the dialog's three action buttons now reach `document` (before they were swallowed by the dialog). The document-level click listeners are `09-folders-playlists.js:39` (capture phase, so it already saw them), the bridge itself, `06a-context-menus.js:881`, `06d-tooltip-system.js:114`, and `06j` while a notification is open. I read all of them: `06a:881` only closes a context menu when one is active (none can be while this dialog is open) and its selection-clearing branch exempts clicks inside `.playlist-modal`, which this dialog has; `06d:114` hides an already hidden tooltip; `06j` also closes on `mousedown`, which was never stopped. A test checks that selected songs stay selected after a click on a dialog button.
- Order inside the dialog: the overlay's close handler now runs before the action (it runs at the overlay, the action at `document`). `selectShuffleMode` starts by closing the dialog anyway, so the result is the same.
- "Load more": the action now runs at `document`, after its ancestors. I listed the click listeners on the whole path with the browser's debugger: none of `#queue-list`, `#queue-content`, `#right-panel-content`, `#right-panel` or `body` has one, and the bridge registers before `06a` and `06d`, so those two still see the same (already re-rendered) target as before.
- Clicks on the rest of the dialog (title, text, padding) still do not leave it, and the backdrop still closes it. Escape does not close this dialog, before and after.

## Numbers

`node tools/dep-map.js` before and after: mutable globals written from other files **52 -> 52**, file-level cycles **71 -> 71**, load-time cross-file references **26 -> 26** (no state is touched in this step).
Inline `on...=` handlers in `src/js` and `build/music_player.html`: **318 -> 314**; in B's files **4 -> 0**.
`node tools/event-audit.js --strict`: exit 0.

## Tests actually run

- Full set, `node --test` on all 24 files in `tools/tests/` with Playwright and a real browser, in four groups: **158 tests, 156 pass, 0 fail, 2 skipped**. The skips are old: an obsolete note in the storage test, and the timing-sensitive scroll test that skips itself in sandboxed environments. (149 + the 9 new tests.)
- `playback-handlers.test.js` (new, 9 tests): "Load more" adds a page of songs and disappears at the end; Normal Shuffle turns shuffle on and closes the dialog; Turn Shuffle Off, also while Smart Shuffle is on; Smart Shuffle works above 50 songs; Smart Shuffle is disabled on a short list and a click does nothing; clicks inside the dialog stay inside and the backdrop closes it; selected songs survive a click on a dialog button; and no inline handler is left in `15b` and `10c`. Run against the **original** code, only the last one fails, so the others describe the old behavior.
- I tried five deliberately broken versions and each fails a test: the dialog keeping its unconditional `stopPropagation`, `loadMoreQueueItems` not registered, the disabled button keeping its action, the "off" button passing the wrong argument (this one first slipped through, which is why the "also while Smart Shuffle is on" test exists), and a misspelled registration (caught by `legacy-bridge.test.js`).
- Before/after behavior probe (a throwaway script, **not in this patch**): 14 scenarios with real mouse clicks on both controls on the original and the new code, including the disabled button, selection, backdrop and Escape: **38 of 38 states identical**, and the original gave identical results on two runs. The only difference is the intended one: clicks on the dialog's action buttons now reach `body`, `document` and `window`.
- Not run: the Electron app.

## Needs from other agents

- D (D-05): `renderRightPanelItem` in `04a-ui-render-core.js` writes `onclick`, `oncontextmenu` and an inner `stopPropagation` from strings that `10c` passes in (`onClick: \`playFromQueue(...)\`` and `contextMenuArgs` at `10c` lines 17-18, 55-56, 71-72 and 101-102). Those inline handlers are generated in D's file, so they were not part of B-07. To convert them, D and B must change the renderer's options in the same patch (for example an action name and arguments instead of code strings). B will do its side when D says how.

## Not done

- The JS property handlers in B's files (`shuffleButton.onclick`, `repeatButton.onclick`, `audioElement.onended` and similar, 9 in `15a` to `15e`) are not inline markup and are unchanged; the call-order tests call some of them directly.
- B-08: see report 0011.

## For you (manual checks)

1. Queue a long list (play from All Songs), open the Queue tab, scroll to the bottom and click "Load more" -> more songs appear; at the end of the queue the button is gone.
2. Click the shuffle button, then "Normal Shuffle" -> the dialog closes and shuffle is on. Open it again: "Turn Shuffle Off" is there and works, also after choosing Smart Shuffle.
3. On a list with more than 50 songs, "Smart Shuffle v1" starts Smart Shuffle. On a short list (a small playlist) it is greyed out; clicking it does nothing and the dialog stays.
4. Click the dialog's title or empty space -> it stays open; click outside the box -> it closes.
5. Select a few songs, open the shuffle dialog, click a button -> the songs stay selected.

## Next step

B-08 is blocked on decisions that belong to A (report 0011). `BOARD.md` still shows B-01 to B-04 as `todo` although they are applied; B-07 can be set to applied once this patch is merged.
