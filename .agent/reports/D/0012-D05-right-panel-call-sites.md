# Agent D report 0012: right-panel call sites (D-05, last part)

Step: D-05. Applies on top of: the zip plus the combined D-0010 patch (reports 0010 and 0011).
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup\...` is not reachable from my environment.

## Changes

- `10c-playback-queue.js` (**B's file**, 4 calls of `renderRightPanelItem`) and `19-online-lyrics.js` (**C's file**, 1 call): `onClick: 'playFromQueue(n)'` and `contextMenuArgs: 'id, {queueIndex: n}'` became `action: ['playFromQueue', [n]]` and `menuArgs: [id, { queueIndex: n }]`; the picker row uses `action: ['selectOnlineLyricsPickerSong', [id]]`. Same functions, same arguments. Nothing else in those files changed.
- `04a-ui-render-core.js`: the old `onClick` / `contextMenuArgs` string path is removed from `renderRightPanelItem`. No inline `on...=` handler is left in any D file.
- `ui-handlers.test.js`: 04a ceiling 3 -> 0; the right-panel test now covers the action path only.
- `.agent/BOARD.md`, `tools/change.log.txt`: updated.

## Tests actually run

- Full suite, `node --test tools/tests/*.test.js`: 303 tests, 301 pass, 0 fail, 2 skipped (the same two skips as before). `event-audit --strict` exits 0.
- The new queue-panel test (rows from the real queue renderer: click plays the index, "..." opens the menu with `{ queueIndex }`) passes on both the old string call sites (before this patch) and the new action call sites (after), so the call-site change keeps behavior.
- Not run: real Electron.

## Needs from other agents

- **B and C:** review and apply (two files, five calls). If you would rather make the change yourselves, the pattern is in `04a-ui-render-core.js`, `renderRightPanelItem`.

## For you (manual checks)

1. Queue tab: click a queue row (plays it), right-click it and click "..." (song menu opens; Remove from queue still works), including the "Now Playing" row and the repeat-one view.
2. Online lyrics: open the song picker, click a row (it gets selected), right-click and "..." (menu opens).
3. Recent tab: same as report 0011.

## Next step

Mark D-05 `applied + verified` after the checks. D-09a does not wait for it; D-09g (04a) does.
