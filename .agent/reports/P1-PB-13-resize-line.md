# Report: PB-13 White column-resize line

**Task:** PB-13 | **Agent:** B | **Date:** 2026-10-21 | **Status:** In review

## Summary
The line between the Title and Album columns is dim at rest, as before, and now turns white (instead of orange) on hover, keyboard focus and while dragging. The owner chose this option ("B") from three: always white, white on hover and drag only, or dim at rest and white on hover and drag.

## Findings
- `.songlist-resizer::after` used `--border-subtle` at rest and `--accent` (orange) on hover, focus and drag, so nothing was white. *Read, and seen in a screenshot*
- There is no white token. `--text-primary` (`#ece9e3`, the app's near-white ink) is used, so the line stays readable if a light theme is added.
- The keyboard focus outline on the handle (`--focus-ring`, accent) is unchanged.

## Changed files
| File | Change |
|---|---|
| `src/ui-next/views/library/song-list.css` | Hover, focus and drag line: `--accent` to `--text-primary` |
| `tools/tests/ui-next-songlist.test.js` | New test (both library sizes): the line equals `--border-subtle` at rest and `--text-primary` on hover and during a drag |
| `.agent/BOARD.md` | PB-13 In review |

## Decisions made or needed
None. Owner chose option B on 2026-10-21.

## Checks
| Command or step | Result |
|---|---|
| `node --test --test-name-pattern="PB-13" tools/tests/ui-next-songlist.test.js` | 2 tests, 2 pass |
| Same with `--accent` put back | 2 fail (the test pins the change) |
| `ui-next-songlist`, `ui-next-library`, `ui-next-b06-finish`, `ui-next-tokens`, `ui-next-phase1-gate` | all pass (see counts below) |
| Screenshot at rest and on hover in the real new screen | dim line at rest; white, thicker line on hover |

## Not run
Real Electron on Windows; the full suite; `node tools/lint.js` (ESLint is not installed here); the line while resizing the window; other themes and accents (checked with the default accent only).

## Environment
Linux sandbox, Node v22.22.2, Playwright 1.56, headless Chromium. Fixture library of 60 fake songs.

## Manual checklist for the owner
1. Open a library with the Album column on.
2. Look at the header: a dim line between Title and Album.
3. Hover it: it turns white and a bit thicker. Drag it: it stays white.
4. Press Tab until the handle has focus: the line is white and the handle has the accent outline.

## Open issues and follow-ups
If the white feels too strong on hover, the thickness (2 px) can go back to 1 px; one line of CSS.

## Patch
`P2-B-wave2.patch` (PB-12, PB-13 and the Home bridge fix).
