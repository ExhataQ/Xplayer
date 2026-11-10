# A: the app showed no content (missing right panel file) and the PC-05 selection rule

## 1. No content after the PC-03/06/13/05 patch
Symptom (owner, 2026-10-27): the app starts but shows no songs; the console has `ERR_FILE_NOT_FOUND`.

Cause: `views/playback/playback.js` has `import { mountRightPanelContent } from './right-panel-content.js'`, and that file is not in the owner's tree. A static import of a missing file stops the whole module graph, so nothing after it loads. Reproduced here: 0 song rows.

The patch that was applied did not bring its new files. Missing in the tree: `src/ui-next/views/playback/right-panel-content.js`, `.agent/reports/P1-PC-13-right-panel-content.md`, `.agent/reports/P1-PC-05-selection.md` (and any test that C added for them). Existing tests show it too: `ui-next-right-panel` fails on "the player registers the panel content (PC-13)". `ui-next-player-bar` has 2 failures from C's cover viewer styles (`rgb(` in `player-bar.css`; `!important`/`transform`); those are C's to check.

Fix on A's side (a stop-gap): `playback.js` now loads that file with a dynamic `import()`, so a missing or broken file costs only the panel's content and logs `Playback view mountRightPanelContent could not start`. This is what the file's own header promised (each part is independent). Test `ui-next-playback-isolation.test.js` removes the file from a copy and checks that the library still loads.

Still needed from C: send `right-panel-content.js` and the two reports again (new files need to be included in the patch, for example with `diff -N` or `git add -N` before `git diff`).

## 2. PC-05 request for A: selection
`ui-next/base.css` now has the old screen's rule: nothing is selectable by dragging (`* { user-select: none }`), fields and editable text are (`input`, `textarea`, `[contenteditable]`), and so are the AI chat's messages (`.ai-msg__bubble`), where people copy answers. Test `ui-next-selection.test.js` (static rules, and computed values in the real shell). Not done: any other text that people may want to copy; say which.
