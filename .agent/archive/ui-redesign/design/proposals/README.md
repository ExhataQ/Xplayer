# Proposals from C to A

C does not edit `adapter/`, `shell/`, `components/` or `index.html`. When C needs a change there, C drafts it here as a patch, tested on a scratch copy of the tree, for Agent A to review and apply (or change). Nothing here is applied by C.

## A-player-parts.patch (requests R-C1, R-C3, R-C4)

Apply from the project root: `git apply .agent/ui-redesign/proposals/A-player-parts.patch` (the patch expects patches 0004 and 0005 from C to be applied first).

| File | Change |
|---|---|
| `src/ui-next/adapter/player-parts.js` (new, 62 lines) | `playerPart(name)` returns the player's elements by 15 stable names; `onTime(callback)` is one shared listener on the audio element, attached by the first subscriber and removed by the last |
| `src/ui-next/index.html` | one line: link `views/playback/player-bar.css` |
| `tools/tests/ui-next-adapter-player.test.js` (new) | 3 real-browser tests: all names resolve inside the visible player; time, duration and play state advance and stop after unsubscribe; three subscribers share one listener and the last unsubscribe removes it |
| `tools/tests/ui-next-player-bar.test.js` | works whether or not `index.html` already links the stylesheet |

Checked on a scratch copy: the 3 new tests, `ui-next-player-bar` (8) and `ui-next-shell` (17, including gate 13, the adapter boundary, and gate 14, the 250-line budget) pass. Mutations: disabling the shared listener fails its test; leaving the stylesheet out still fails 5 of the 8 player-bar tests.

Not decided here: R-C2 (the full `store` and `actions` API) and R-C5's `mountQueueList`; both are bigger and A's call.
