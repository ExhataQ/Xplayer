# A-11 Smoke checklist: old versus new

Agent: A. Status: In review. Run the browser tests (`node --test tools/tests/*.test.js`) for the automated part. The manual part is for you in Electron.

## Automated (browser and unit, run in this round)
- Both interfaces load without a page error (`window-contract`, `ui-next-phase1-gate`, `ui-entry`).
- The new interface plays, resizes, and shows the library, lyrics, metadata and settings (`ui-next-*`).
- The old interface still loads and plays (`scroll`, `playback-settings`, `startup-setting`).
- The switch: Settings in the new interface calls `setUiChoice('current')`; the choice is saved and read back (`ui-entry.test.js`).

## Manual, in Electron (you)
| # | Check | Old | New | Switch |
|---|---|---|---|---|
| 1 | Starts, shows the window at the saved size | | | |
| 2 | Startup screen shows from the first paint, then hides | n/a | | |
| 3 | Play, pause, next, previous, seek | | | |
| 4 | Volume change during a track's first second stays (D17) | | | |
| 5 | Download, then Cancel (D41); album art search, then Cancel | | | |
| 6 | Space after a mouse click plays or pauses; after Tab it presses the button (D37) | | | |
| 7 | Compact density changes song rows and library panel rows (D61) | | | |
| 8 | Settings > Interface switch reloads into the other interface | | | |
| 9 | After a switch, a plain launch opens the saved interface | | | |
| 10 | `--ui=current` overrides a saved `next` | | | |

Record PASS or FAIL in the table and open a gap for each FAIL (A-12).
