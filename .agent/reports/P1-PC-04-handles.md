# Report: PC-04 Volume handle during a drag

**Task:** PC-04 | **Agent:** C | **Date:** 2026-10-21 | **Status:** In review

## Summary
The owner's wish, in their words: with the mouse away the handle stays as it is today (hidden). While the mouse is over the bar and the button is held down, the handle must stay visible, also when the volume reaches zero. The cause was a missing drag state in the new stylesheet. One rule in `views/playback/player-bar.css` fixes it. No engine change, no change to `shell.css`.

An earlier version of this task made the handle always visible. That was a misreading of the owner's wish and is not part of this patch.

## Findings
| What | Where | Confidence |
|---|---|---|
| The engine adds the class `dragging` to `#volume-slider` while the mouse button is held and removes it on release. | `src/js/playback/15g-controls-volume-fade.js` lines 238 to 260 | *Read* |
| The old stylesheet showed the volume handle for `:hover` and for `.dragging`. The new `shell.css` kept only `:hover` for the volume handle (the seek bar kept both). Pulling the pointer past the end of the bar toward zero ends the hover, so the handle vanished mid-drag. | `css/player.css` lines 366 to 367 (old), `shell/shell.css` lines 465 to 468 (new) | *Reproduced* in Chromium: the new test fails without the fix |
| The seek bar already has the drag rule. With the waveform on it has no handle on purpose (the colored part of the waveform shows the position, owner's choice). | `shell/shell.css`, `views/playback/player-bar.css` | *Read* |

## Changed files
| File | Change |
|---|---|
| `src/ui-next/views/playback/player-bar.css` | New rule `.player-host #volume-slider.dragging #volume-knob { opacity: 1 }` with a comment; higher specificity than `shell.css`, no `!important`, no `transform` |
| `tools/tests/ui-next-player-bar.test.js` | One static test and one browser test |

## Checks
| Command | Result |
|---|---|
| `node --test tools/tests/ui-next-player-bar.test.js` | 10 pass, 0 fail |
| Same file with the new rule removed (mutation check) | 2 fail (the new tests), 8 pass |
| `node --test` on `ui-next-waveform`, `ui-next-waveform-scale`, `ui-next-shell`, `ui-next-panels`, `ui-next-right-panel` | 9, 6, 20, 6 and 6 pass, 0 fail |

The browser test: handle hidden with the mouse away; shown on hover; press and drag past the left end and below the bar (pointer outside the slider, volume 0); handle still shown; release and move away; hidden again.

## Not run
Real Electron and Windows, a visual check, the rest of the test suite. Checked only in headless Chromium through the test fixture.

## Environment
Node v22.22.2 in a container; Playwright with Chromium available.

## Manual checklist for the owner
1. Move the mouse away from the player bar: no volume handle (as before).
2. Hover the volume bar: the handle appears.
3. Hold the button and drag to zero, then keep going left or down so the pointer leaves the bar: the handle stays visible, at zero too.
4. Release and move away: the handle fades out.

## Open issues and follow-ups
- A visual check of the handle at zero (half of the 12 px dot sits outside the bar at 0% and 100%); no clipping was found by reading the code, but it is untested by eye.

## Patch
Part of `0005-agent-c-on-new-tree.patch` (see the summary there).
