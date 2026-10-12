# Agent D report 0006: move `isNavigatingHistory` to `07-views.js` (A-07b, D's part)

Steps: A-07b (D's one variable). Applies on top of: `Xplayer-main__1_.zip` (A-04 and A-07 done, D-01 and D-02 applied).
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup\...` is not reachable from my environment.

## Changes

- `src/js/07-views.js`: declares `let isNavigatingHistory = false;` at the top (same initial value as before). It is the only file that uses the variable.
- `src/js/00-state.js`: the old declaration line is removed **in this same patch**. That is A's file and A's report 0004 says A deletes the line, but A also warns that the declaration and the removal must be applied together (declared twice stops the app at load; declared nowhere fails at first use). To keep the tree safe, D's part and the removal are one patch. **Tell A that `isNavigatingHistory` is already removed, so A's `00-state.js` removal for B and C has 10 variables, not 11.** If A's patch also deletes this line, it will not apply.
- `tools/change.log.txt`: entry added.

## Why it is safe

- The only references anywhere in `src/`, `tools/`, `electron/` and `build/` are the 2 reads in `07-views.js` (lines 554 and 588 before the edit), the 4 `setIsNavigatingHistory(...)` calls in `07` (D-02) and the setter body in `core/state-navigation.js`. No test, HTML or inline handler uses it.
- The setter assigns the variable by name only when called, after all scripts have loaded, so the new location works the same.
- The declaration is at the top of `07-views.js`, before any function that uses it.
- `07-views.js` loads after `core/state-navigation.js`, but nothing calls the setter during load.

## Numbers

`node tools/dep-map.js writers isNavigatingHistory`: `(let, defined in 07-views.js)`, written only from `core/state-navigation.js` (the setter). Before: defined in `00-state.js`.
`node tools/event-audit.js --strict`: exit 0, A 0 / B 0 / C 0 (76 excepted), unchanged.

## Tests actually run

- `node --test` on `setters`, `manifest`, `events-a/b/c/d`, `events-wiring`, `event-bus`, `search-ui`, `view-switch-song-list-cleanup`: 46 tests, **20 pass, 0 fail, 26 skipped** (Playwright is not installed here).
- Syntax of `00-state.js` and `07-views.js` checked with acorn: ok.
- Not run: any test that boots the app (they skip here). The "declared twice or not at all" failure shows up exactly there, so please run `scroll.test.js` and `view-switch-song-list-cleanup.test.js` with Playwright. They would fail at once if the declaration was missing.

## Needs from other agents

- **A:** drop `isNavigatingHistory` from your removal list (see above). In `src/js/core/SETTERS.md`, the row for `setIsNavigatingHistory` still says "Declared in `00-state.js`"; it is now `07-views.js` (your file, so I did not edit it). Also the "Still written directly from" column for `07` is out of date after D-02.
- **A-10 (handler bridge):** nothing in `07-views.js` changes for the bridge yet. D-05 (inline handlers) and D-07 (theme switcher) start when A-10 is applied.

## Not done

- D-05, D-06, D-07, D-08, D-09: blocked on A-10, A-14, A-13, A-15 as in `BOARD.md`. Nothing for D to start.

## For you (manual checks)

1. Run `node --test tools/tests/scroll.test.js tools/tests/view-switch-song-list-cleanup.test.js` with Playwright -> 0 failures, no "already been declared" error.
2. Open the app, click All Songs, a playlist, then Back and Forward several times -> views change, Back/Forward buttons enable and disable correctly.
3. Play a song while you are on Back/Forward history -> the history stack does not gain a duplicate entry for the song you navigated to (that is what `isNavigatingHistory` guards).
4. Open DevTools -> Console: no `ReferenceError` or `Identifier ... has already been declared`.

## Next step

Wait for A-10. After it is applied, send me the new zip: D-05 and D-07 start.
