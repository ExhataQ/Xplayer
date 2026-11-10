# Report: C8 Panel toggle animations and the other chosen motions

**Task:** C8 (POLISH-PLAN.md) | **Agent:** C | **Date:** 2026-11-09 (closing made instant, owner's request) | **Status:** In review (needs a look in the running app; motion has to be felt)

## Summary
The six motions from the plan's "Motion chosen" list are in. Everything moves only `transform` and `opacity`, nothing loops, and everything goes through Reduce animations (C7): with it on, panels open and close at once as before. **Closing has no animation** (owner's decision, 2026-11-09): a panel, the queue or a dialog that closes is simply gone, and the view beside it does not move. Only opening is animated.

| # | Motion | What you will see |
|---|---|---|
| 1 | Panels slide | The left panel, the right panel and the queue move in from their own edge when they open (200 ms, soft ease-out). The queue rises from the player. Closing: no animation. |
| 2 | The view shifts | When a panel opens, the view beside it starts 14 px toward where the panel pushes it and settles (220 ms), instead of jumping. Closing a panel does not move it. |
| 3 | Play button | The icon swaps with a short scale and fade (160 ms) when playing starts or stops. |
| 4 | Song added to a playlist | That playlist's row in the left panel pulses once (scale 1.03, 420 ms). |
| 5 | Drops | The row that had the drop ring settles (from scale 1.04, 220 ms). A row that cannot take the drop eases to its dimmed look (150 ms). |
| 6 | Dialogs and menus | Dialogs, menus, context menus and the Play from URL style dialogs rise 6 px while fading in (the existing short motion time). |

## Findings
- **The panels only had hidden / not hidden.** Opening shows the panel at once and then moves it in (`shell/panel-motion.js`). Closing hides it at once. (A first version also slid the panels out over 150 ms and shifted the view when they closed; the owner asked for no animation on closing, so the slide-out, its keyframes and the delayed hide are removed.) *read, tested*
- **Only the person's own opening moves.** Not at start-up (nothing moves until the first press or key), not when the window size decides which panel fits (`panel-layout.js`), and never with Reduce animations on. *tested*
- **A first version had a bug I found with the tests:** the right panel's layout listener passed the layout result where my code expected a yes/no "slide" flag, so the panel opened without moving. Fixed with an explicit flag that the open and close buttons raise.
- **The view's shift briefly made the page 14 px wider** (a scroll bar could flash). The app now clips what sticks out while the shift runs. *reproduced, fixed, tested*
- **The plan said "the width change eases"** for the list. A width cannot be animated with transform only, so the view shifts a few pixels toward its place instead (decision 1).

## How it works
- `src/ui-next/shell/panel-motion.js`: `slidePanel(node, kind, show, apply)` runs the caller's own show / hide at once, and when the person opens a panel it sets `data-enter` and `data-shift` on the view for a moment. Used by the right panel (`right-panel.js`), the left panel (`shell.js`, `setPanelClosed`) and the queue (`queue-panel.js`).
- `src/ui-next/shell/motion.css` (new, linked from `index.html`): all the keyframes and rules, every one under `:where(:root:not([data-motion='reduced']))`.
- `src/ui-next/shell/small-motions.js` (new): the playlist pulse (listens to the engine's `playlist:songCountChanged`) and the drop settle (the target that still wears the engine's ring at the moment of the drop).
- `views/playback/transport.js`: marks the play button for 200 ms when playing changes.
- `src/js/playlists/03c-playlists.js`: one addition to an existing event: `playlist:songCountChanged` now carries `added: true` when a song was really added (the same event is sent for a removal, and the pulse must not fire for that). Nothing else reads it, so nothing else changes.

## Changed files
| File | Change |
|---|---|
| `src/ui-next/shell/panel-motion.js`, `shell/motion.css`, `shell/small-motions.js` | New. |
| `src/ui-next/index.html` | Links `shell/motion.css`. |
| `src/ui-next/shell/right-panel.js`, `shell/shell.js`, `views/playback/queue-panel.js`, `views/playback/transport.js` | Use the slide / swap. |
| `src/js/playlists/03c-playlists.js` | `added: true` on a real add. |
| `tools/tests/ui-next-motion-chosen.test.js` | New: 3 static + 9 browser tests. |
| `tools/tests/ui-next-playback.test.js`, `ui-next-panels.test.js`, `ui-next-right-panel.test.js` | Wait for the panel to be hidden before asserting it is gone (a leftover from the slide-out version; harmless, the wait now ends at once). |

## Decisions made or needed
1. **The shift is a small slide, not an exact easing of the width** (transform and opacity only, as the plan says). Tell me if you want to relax that rule for the view only.
2. **The dragged picture is drawn by the system** (native drag and drop), so I cannot make it settle into a target or ease back after a refused drop. What the app can do is done: the target settles, and a target that cannot take it fades to its dimmed look. Doing the rest would mean replacing native dragging with my own, which is a much larger change.
3. Closing is instant everywhere (panels, queue), so the earlier note about a quick double click no longer applies.
4. Times: 200 ms in, 220 ms shift. Say if you want it faster or slower.

## Checks
| Command or step | Result |
|---|---|
| `node tools/tests/run.js ui-next-motion-chosen` | 12 of 12 pass (nothing moves at start; left panel closes at once with no marker, no animation and no view shift, then slides in; right panel; queue; Reduce animations: closed at once, no markers, a stray marker does not animate; play marker; pulse on add, none on remove or when reduced; settle and dimming; dialogs and menus; no sideways scroll during the shift) |
| Neighbouring tests (shell, panels, layout, rail, playback, player bar, right panel, queue drag, dialogs, library, notifications, drag drop, context menu) | 239 pass, 28 fail: the same 28 as the unmodified backup, test by test (the 12 more passes are the new tests) |
| Existing tests: the queue test measures the drawer, so it waits for the rise to end first (opening still moves). The waits for "hidden" that the slide-out version needed stay in place and are harmless | `ui-next-playback` (queue, 3 places), `ui-next-panels`, `ui-next-right-panel` |

## Not run
- **ESLint**: not installed.
- **Real Electron and your eyes.** I tested that the right things start and stop at the right time and only in the allowed way; whether 200 ms feels right is for you to judge.
- **The play button swap with real playback**: headless Chromium here has no audio, so the test checks the marker and the style, and that the script raises the marker when `playing` changes.
- **Light theme**.

## Environment
Linux sandbox, Node v22, Playwright with its bundled Chromium. No network, no ESLint.

## Manual checklist for the owner
1. Click the left panel button in the title bar. **Expected:** the panel is gone at once and the view does not move. Click again: the panel slides in from the left and the view settles a few pixels.
2. Same with the right panel (slides in from the right) and with the queue button (rises from the player; closes at once).
3. Start the app. **Expected:** nothing slides at start-up.
4. Shrink the window until a panel steps aside. **Expected:** no slide, as before.
5. Turn on Reduce animations. **Expected:** every panel opens and closes at once with no movement, and none of the other motions below happen.
6. Press play and pause. **Expected:** the icon swaps with a short grow-and-fade.
7. Add a song to a playlist from the song menu or by dropping it on the playlist. **Expected:** that playlist's row in the left panel pulses once. Remove a song: no pulse.
8. Drag a song over a playlist and drop. **Expected:** the playlist row settles. While dragging, rows that cannot take it fade to dim instead of snapping.
9. Open a menu, a context menu and a dialog (Play from URL). **Expected:** each rises a few pixels as it fades in.
