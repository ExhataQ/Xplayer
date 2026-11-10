# P1-PA-09: adapter budgets, measured and applied

Agent A, 2026-10-24. Status: in review. No brief item (housekeeping for DP9).

## Measured
Code lines (not blank, not comment, the rule the older size tests use) in `src/ui-next/adapter/*.js`:

| Group | Files | Lines | Limit |
|---|---|---|---|
| core (D18) | `store` 54, `actions` 76, `events` 49, `engine-view` 72 | 251 | 300 |
| engine (D30) | `engine-api` 64 | 64 | none of its own |
| legacy (D13) | `legacy-dom-adapter` 140 | 140 | 250 |
| phase 1 bridges | `library` 31, `listbar` 44, `notifications` 45, `playback` 24, `player-parts` 66, `search` 21, `songlist` 39, `startup` 8 | 278 | each has its own cap in its own test |
| plan bridges (DP9) | `home-bridge` 25, `menu-bridge` 17, `tag-sheet-bridge` 56 | 98 | 300 |

The board and plan said 318 (and 408 with `engine-api`) for the core files and 205 for `legacy-dom-adapter`. Those were raw line counts; with blank lines and comments left out the same files are 251, 315 and 140. Nothing was over budget.

## What changed
- `tools/adapter-budget.js` (new): measures every adapter file, puts it in a group, prints the table (`node tools/adapter-budget.js`).
- `tools/tests/ui-next-adapter-budget.test.js` (new, 4 tests): core within 300, legacy within 250, plan bridges within 300, every file in one group. Any `.js` file that is not in the list of phase 1 or core files counts as a plan bridge, so a new bridge is counted without being registered. Checked by adding a 210 line file: the test fails and names the totals.
- The older per-file caps and the 3-file D18 test are left as they are.
- Board: DP9 row says 98 of 300 used; PA-09 row; report row. Plan: the "budgets are spent" line corrected.

## Not done
- `songsort-bridge.js` (PB-08, Agent B's patch, 16 lines) is not in this tree. It will count toward the 300 when it is merged (114 of 300).
- No limit was invented for the phase 1 bridges or `engine-api`; they keep what they had.

## Update on the 2026-10-24 backup (found while syncing the board)
The same measuring on the newest backup gives **390 of 300** for the plan bridges: `ai-bridge` 206, `tag-sheet-bridge` 74, `ai-lyrics` 39, `home-bridge` 25, `library-create` 23, `menu-bridge` 17, `songsort-bridge` 6. A's three were 98. The other agents' bridges came in after DP9 was decided and nobody was measuring.
- This is the owner's call (new decision **DP14** on the board: raise the limit to 400, or E trims `ai-bridge`).
- Until then the test only stops growth: it fails above 390 (`PLAN_FROZEN_AT`, `tools/adapter-budget.js`). The owner sets the real limit by editing `LIMITS.plan` and removing that line.
- `playback-bridge` (phase 1) also grew from 24 to 44 lines; it keeps its own cap in its own test.
