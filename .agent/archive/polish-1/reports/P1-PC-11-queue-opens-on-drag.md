# Report: PC-11 Queue opens when songs are dragged near it

**Task:** PC-11 | **Agent:** C | **Date:** 2026-10-28 | **Status:** In progress

## Summary
Dragging a song toward the queue now opens the queue drawer, so the engine's existing drop-on-queue code has a target. Nothing was run in a browser or in Electron; only the geometry is tested.

## Findings
- The engine already supports dropping songs on `#queue-list` (`js/ui/06f-drag-drop-songs.js`, mouseup branch `dropTargetIndicator`). It is not reachable in the new screen because the drawer is hidden until the queue button is pressed. *read*
- While a song is dragged the engine puts `dragging-song` on `document.body` and removes it in its own `mouseup`. *read*
- `queue-panel.js` closed the drawer on any `pointerdown` outside it. A press on a song row (the start of every drag) therefore closed a drawer the person had opened, so dragging into an open drawer could never work. *read*

## Changed files
| File | Change |
|---|---|
| `src/ui-next/views/playback/queue-drag-open.js` | new: `isNearRect(point, rect, margin)` and `QUEUE_NEAR_DISTANCE` (72 px) |
| `src/ui-next/views/playback/queue-panel.js` | a `MutationObserver` on the body class; while `dragging-song` is set, `mousemove` opens the drawer when the pointer is within 72 px of the queue button; a drawer opened by the drag closes when the drag ends; a press on a `.song-item` no longer closes the drawer at once, it closes on release unless a drag started |
| `tools/tests/ui-next-queue-drag-open.test.js` | new: geometry tests |

No adapter file changed (DP9 and DP14 budgets unchanged: `node tools/adapter-budget.js` lists the same files).

## Decisions made or needed
- The 72 px zone is a guess; the owner may want it larger or tied to the drawer's rectangle. Easy to change (`QUEUE_NEAR_DISTANCE`).
- A drawer the person opened themselves stays open after the drag; only one opened by the drag closes again.

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/ui-next-queue-drag-open.test.js` | 2 of 2 pass |
| `node --check` on `queue-panel.js` (copied as `.mjs`) | passes |
| `node --test tools/tests/default-cover.test.js` (SVG check, no code change) | 3 of 3 pass |

## Not run
- The real drag in a browser or Electron (no Playwright or Chromium here, no network). The existing queue tests in `ui-next-playback.test.js` were not run either.
- Whether the drop lands where the indicator shows once the drawer opens mid-drag.

## Environment
Linux sandbox, Node 22, no browser, no Python tag backend. `node_modules` was not part of the zip.

## Manual checklist for the owner
1. Open Library with songs and the queue closed. Press and hold a song, move toward the queue button in the player bar. Expected: the drawer opens when the pointer is near the button.
2. Move over a queue row and release. Expected: the "Added 1 item(s) to queue" notification, the song appears, the drawer closes after the drop.
3. Repeat but release away from the queue. Expected: the drawer closes, nothing is added.
4. Open the queue with its button, then press a song row and drag it into the drawer. Expected: the drawer stays open and the drop adds the song; it stays open afterwards.
5. With the queue open, click (do not drag) a song row. Expected: the drawer closes on release, as before.
6. Drag a song to a playlist in the left panel without going near the queue button. Expected: the drawer stays closed.

## Open issues and follow-ups
- PB-10 (filter animation) is still not started and was listed as a dependency on the board.
- Touch and pen input are not covered (the engine's drag uses mouse events).

## Patch
`PC-11-and-board-2026-10-28.patch`: the three files above, this report and `BOARD.md`. It excludes `Source/tools/CHANGELOG.md` (integration owner only).
