# Report: PD-07 Metadata rail item above Settings

**Task:** PD-07 | **Agent:** D | **Date:** 2026-10-27 | **Status:** Done (verified, no code change)

## Summary
Brief 3.1 asks for a Metadata item in the rail above Settings. It is already there, built under PA-04, so this task only verified it and closes the board row.

## Findings
- `src/ui-next/shell/shell.js` lists `metadata` (icon `tag`, `end: true`, mounted by `mountMetadata`) directly between `lyrics` and `settings`; the three `end: true` items form the bottom group. *Read and run.*
- `ui-next-rail-order.test.js` asserts the order `home, library, search, recent, lyrics, metadata, settings`, that Metadata is the item right before Settings and right after Lyrics, and that only those three carry `end: true`. 4 of 4 pass.
- `ui-next-rail.test.js` 15 of 15 pass. `ui-next-metadata.test.js` 18 of 19: "Save sends only what changed, then the shell goes back..." fails, and it fails the same way on the untouched backup (not caused by this task, not investigated).

## Changed files
None, except the PD-07 row on `.agent/BOARD.md`.

## Checks
Run with Chromium through Playwright (Node v22.22.2, Linux sandbox): the three files above, results as stated. Not run: real Electron and Windows.

## Open issues and follow-ups
- The failing metadata test needs its own look.
