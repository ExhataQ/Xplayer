# Agent B report 0006: review of A's playback setters

Steps: B-01. Applies on top of: `Source-backup__3_.zip` (A's foundation, `.agent/` layout). Report only, no code changed.
Archive (.agent/AGENTS.md section 1): not done, no access to the archive root from here.

## Changes

- `.agent/reports/B/0006-review-of-playback-setters.md`: this report.
- `tools/change.log.txt`: one entry.

## What I checked

I read `core/SETTERS.md` and `core/state-queue.js`, `state-playback-modes.js`, `state-now-playing.js` and `state-navigation.js`, then listed every direct write to a setter-wrapped variable in B's files (scope-aware, same rules as `tools/dep-map.js`, so a local variable with the same name is not counted): **101 write sites** in 10b, 10c, 10d, 14, 15a, 15b, 15c, 15d, 15e, 15f and 17. `10a` also writes 6 times, but only to variables it declares itself, which is allowed.

## Result: the setters are OK for B, no change is needed to start

- Every variable B writes has a setter, and each setter assigns the variable it names. None is missing (checked against all 101 sites).
- Load order is safe: `emit` is in `00b-events.js` (position 1) and the setters load at positions 4 to 10, before `10a`.
- Nothing listens to `queue:changed`, `queue:indexChanged` or `view:changed` today (the only `on('queue:` is B's own `queue:songsChanged`), so the extra events that the queue setters emit change nothing yet.
- No converted write is in a per-frame handler (`ontimeupdate`, `mousemove`, `requestAnimationFrame`). `ontimeupdate` only calls `updateAudioProgress`. Rule 3 of `SETTERS.md` is not at risk.
- The write forms in B's files are: plain `x = v` (95), statement-level `x++`, `x--` and `x += n` (3), and `list[x++]` used as a value (3, all in `10b`). All have a direct setter equivalent: `setX(v)`, `setX(x + 1)`, `setX(x + n)`; the three `list[x++]` reads become "read `list[x]`, then `setX(x + 1)`", which keeps the order.

## Things A should know (suggestions, none blocks B-02 to B-04)

1. **Queue and index are set one after the other, so each pair emits two events with a half-updated state in between.** There are 14 pairs in B's files: `10c` 212/213; `10d` 121/126, 187/195, 215/216, 236/244, 252/257, 349/356, 381/388, 390/395; `15b` 56/63, 73/74, 111/126; `15c` 34/41, 79/80 (line numbers before B-02). A future subscriber of `queue:changed` would see the new queue with the old index. Nobody subscribes now. Before anyone does, either document that subscribers must not read the other variable, or add one setter that sets both and emits once (A's file).
2. **In-place changes do not emit** (rule 4 of `SETTERS.md`). B has 15 such sites that are not writes and are not converted: `playbackQueue.push` or `.splice` in `10c` (163, 183, 201, 234, 263, 283, 303, 330), `10d` (94, 205), `15b` (69, 79), `15c` (47), `15d` (35), `15e` (180). If the queue panel ever subscribes to `queue:changed`, these need `setPlaybackQueue(playbackQueue)` afterwards, or a separate event.
3. **Variables only B's files use** (for A-07, so A can move them out of `00-state.js`): `wasPlaying` (15f), `showRemainingTime` (15a), `queueDisplayLimit` (10c, 10d), `repeatVisualState` (15b, 15c), `repeatFunctionalityActive` (10b, 10c, 10d, 15b, 15c, 15d, 15e). The five smart-shuffle variables and `shuffleIndex` are declared in `10a` and used only in `10a`, `10b` and (for `shuffleIndex`) `10c`. Moving a declaration into a B file and removing it from `00-state.js` must be **one change**: a `let` declared in two scripts is a SyntaxError. B will do its half when A asks.
4. **Not B-only, despite being written from `17`:** `selectionHighlights` and `lastSelectedIndex` are used all over `04a-ui-render-core.js` (D). They stay D's variables, and B's `17` writes them through their setters.
5. `setIsNavigatingHistory` and `setCurrentView` have no B writers; nothing to do.

## Numbers

`node tools/dep-map.js` (unchanged, nothing was modified): mutable globals written from other files 52, file-level cycles 70, load-time cross-file references 26.
`node tools/event-audit.js --strict`: exit 0, A 0, B 0, C 0.

## Tests actually run

- Review only. The read-only checks above (load order, subscribers, per-frame handlers) were done by script on this zip.
- Not run, and why: no code changed, so no test was needed for this step.

## Needs from other agents

- A: nothing now. Optional: items 1 to 3 above, before the queue events get a subscriber or A-07 removes variables from `00-state.js`.

## Not done

- Nothing in this step.

## For you (manual checks)

1. None for this step.

## Next step

B-02: replace the writes in `10c` and `10d`.
