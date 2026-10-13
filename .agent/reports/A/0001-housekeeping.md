# Agent A report 0001: remove dead tool folders, triage prompt.txt

Steps: A-01, A-02. Applies on top of: Source-backup.zip as received (2026-10-12).
Archive (.agent/AGENTS.md section 1): NOT done as written. `E:\Backup\Programming\Music player` does not exist in the sandbox, so no real archive group could be chosen. A byte-identical copy of the received tree was made first (verified with `diff -rq`) in the sandbox only. Your original zip is the true pre-change state.

## Changes

- tools/spike-modules/ (4 files): deleted. Its result is recorded in the archived A report 0004.
- tools/test-shuffle/ (shuffle-test.html, test-shuffle-v1/test-shuffle-v1.html): deleted. `shuffle.test.js` covers the logic.
- tools/change.log.txt: one dated entry for A-01 and A-02.
- tools/prompt.txt: NOT changed (no "delete prompt.txt" instruction).

## A-01 grep result

Searched `package.json`, `.github/`, `eslint.config.js`, `tools/lint*.js`, `tools/tests/`, `build/`, `electron/`, `src/`, `README.md`, `claude.md`.
- `spike-modules`, `test-shuffle`, `run-spike`, `spike-module`, `spike-sibling`, `shuffle-test.html`, `test-shuffle-v1`: no hits in any of them.
- Remaining mentions: `.agent/PLAN.md` and `BOARD.md` (the plan itself), `tools/change.log.txt` (history, left as is), `tools/prompt.txt` (see A-02).
- The plan expected one sentence in `tools/tests/README.md`; there is none (`grep` finds neither folder name there), so C-05 has nothing to remove for this.

## A-02 stale names

| File | Names that look like files | Not found |
|---|---|---|
| tools/prompt.txt | 165 | 15 (10 real stale, 5 generic/generated) |
| README.md | 0 | 0 |
| claude.md | 48 | 1 (`MusicPlayerOutput/songs.json`, runtime data in `App/`, correct) |
| .agent/AGENTS.md | 9 | 0 |

The 10 real stale names in prompt.txt: `04b-ui-render-views.js`, `05-lazy-load.js`, `06c-ui-widgets.js`, `08-panels.js`, `10-playback.js`, `11-lrc.js`, `15-playback-controls.js` (all split or renamed, e.g. `05a/b/c-lazy-load-*`, `06c-scrollbar-widget.js`), `code-cleanup-plan.md`, `Source/code-cleanup-plan.md`, `test-shuffle-v1.html` (just deleted by A-01). The other 5 (`Node.js`, `.test.js`, `index.html`, `player.js`, `App/MusicPlayerOutput/player.js`) are generic words or generated output. It also still describes the pre-module layout and lists functions per file.

**Recommendation: regenerate in short form** (a file list with one line each, produced after the Phase 2 move so it is written once), not keep and not delete now. Deleting needs your explicit "delete prompt.txt".

## Numbers

- `npm run lint`: exit 0, 0 errors, 1 warning (`currentContextPlaylistId`, same as baseline), 136 files.
- `node tools/tests/run.js unit`: 154 tests, 153 passed, 0 failed, 1 skipped (the `storage.test.js` skip, C-01), about 27 s.
- `dep-map` / `event-audit`: not run, no renderer code touched.

## Not run

Browser tests and full suite (nothing they cover changed). Real Electron: not available here.

## Needs from other agents

- none

## Not done

- BOARD.md not edited: it is updated after you apply and verify the patch.

## For you (manual checks)

1. Check `tools/` -> `spike-modules` and `test-shuffle` are gone, `placeholder-test` is still there.
2. Open `tools/placeholder-test/test-placeholders.html` -> it still loads as before.

## Next step

A-01 and A-02 to `applied + verified` on the board. A-03 waits for B, C, D.
