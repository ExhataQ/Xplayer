# Agent C report 0007: move the two panel-only variables

Steps: C-01 (follow-up to report 0006), response to A report 0004 (A-07b). Applies on top of: `Xplayer-main__1_.zip` as uploaded (includes C 0006, A 0004, D 0005).
Archive (.agent/AGENTS.md section 1): not done, `E:\Backup` is not reachable here. I kept a copy of `src/`, `tools/` and `.agent/` from before the edit; take your own snapshot.

## Changes

- `src/js/08a-panel-layout.js`: now declares `let lastRightPanelStateBeforeQueue = { wasCollapsed: false, wasTab: 'tags' };` at the top, same value as in `00-state.js`.
- `src/js/08e-panel-settings.js`: now declares `let advancedSettingsOpen = false;` at the top, same value.
- `tools/change.log.txt`: entry appended.

Moved: `lastRightPanelStateBeforeQueue` -> `08a`, `advancedSettingsOpen` -> `08e`. Not moved: `rightPanelCollapsed` (also read by `01-sizes` and `99-player`, as said in report 0006).

## MUST be applied together with Agent A's change

**Apply this patch and Agent A's removal in the same step.** `00-state.js` is A's file, so I did not touch it. A must delete these two declarations from `src/js/00-state.js`:

```
let advancedSettingsOpen = false;
```
```
let lastRightPanelStateBeforeQueue = {
    wasCollapsed: false,
    wasTab: 'tags'
};
```
I checked the failure mode: with only my patch the page stops at load with `SyntaxError: Identifier '...' has already been declared` (both names). With only A's removal the first use would fail. After the removal, `00-state.js` should not mention either name.
Nothing else refers to them: not an inline handler, not `build/`, `electron/`, or a test (grep checked).
`core/state-ui.js` setters keep working because they name the variable at call time (A report 0004, point 3). Both files load after `core/state-ui.js` and every use is inside a function, so nothing reads them at load.

## Numbers

`node tools/dep-map.js`, in a scratch copy with both sides applied: mutable globals assigned from other files **52** (unchanged; these two were already single-writer), file-level cycles **70** (unchanged), load-time cross-file references **26**, forward 0 (unchanged).
`node tools/event-audit.js --strict`: not re-run, no call changed.

## Tests actually run

In a scratch copy with my patch plus A's removal: `setters`, `manifest`, `events-c`, `search-ui`, `metadata-editor`, `view-switch-song-list-cleanup`: 35 pass, 0 fail.
Control with my patch alone: `search-ui` fails with the "already been declared" error above (expected).
Not run: full suite, `scroll.test.js`, the app in Electron, the smoke checklist.

## Needs from other agents

- **A:** the `00-state.js` removal above, in the same application. Please also update `core/SETTERS.md` ("Declared in" for `setLastRightPanelStateBeforeQueue` -> `08a-panel-layout.js`, `setAdvancedSettingsOpen` -> `08e-panel-settings.js`; and the "Still written directly from" column, which still lists `08a`, `08e`, `08h`).
- A: A-10 (handler bridge) is still `todo` on the board; C-04 and C-05 wait for it.

## Not done

- `all-songs-count` bug in `08h`: unchanged, still your decision.

## For you (manual checks)

1. Apply A's removal and this patch, start the app -> no console error, library loads.
2. Open Settings, then Advanced settings, close -> works as before.
3. Collapse the right panel, open the Queue tab, leave it -> the panel returns to the state it had before.

## Next step

C-04 and C-05 start when A-10 is applied and verified.
