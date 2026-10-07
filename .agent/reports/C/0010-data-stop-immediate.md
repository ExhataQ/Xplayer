# Agent C report 0010: data-stop must also stop the other document listeners

Applies on top of: the zip plus `C-0009-c04-to-c07-rebased.patch`.
Fixes: `tools/tests/lyrics-panel-handlers.test.js`, "clicks on a stopped element do not reach other document listeners" (`0 !== 2`).

## Cause
Not a lost `stopPropagation` in the converted files: every converted element that had `event.stopPropagation()` kept it as `data-stop` (the track-next play button too). The bridge was the problem. An inline `event.stopPropagation()` ran on the button, so the click never reached `document`. The bridge runs on `document` and called `event.stopPropagation()` there, which does not stop the other listeners on the same node, so every document listener registered after it still ran. One of them (`06a-context-menus.js`, document click) clears the song selection, hence 2 selected songs became 0. The others are `06d` (tooltip), `06j` (notifications), `09`, `11g`, `19`.

## Change
- `src/js/core/legacy.js` (dispatch): `data-stop` calls `event.stopImmediatePropagation()`. It also keeps the click from `window`, as an inline stop did. The bridge file is position 4 in the manifest, before every file that adds a document listener, so all of them are skipped. The existing `cancelBubble` check still ends the walk up the path.
- `src/js/core/LEGACY.md`: the `data-stop` line says so.
- `tools/tests/legacy-bridge.test.js`: new test, a stopped element reaches no other document or window listener, a plain one does. It fails on the old line (checked) and passes now.
- `tools/change.log.txt`: entry.
The failing test was not touched.

## Results
- `node --test tools/tests/lyrics-panel-handlers.test.js`: 12 of 12 (was 11 of 12).
- `legacy-bridge.test.js`: 15 of 15.
- Every other test file (three groups: 130, 73 and 70 tests): 0 failures, 2 skipped (the existing `scroll` skips).
- `git diff --check`: no output, exit 0.
- Not run: Electron, the smoke checklist.

## Effect on other agents' conversions
Every `data-stop` in B's, D's and C's files now behaves as the inline `stopPropagation()` did (the document listeners are skipped). That restores the old behavior; nothing relied on the leak in the tests.
