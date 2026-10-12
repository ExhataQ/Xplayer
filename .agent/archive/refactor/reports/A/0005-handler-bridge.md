# Agent A report 0005: handler bridge (A-10)

Step: A-10. Applies on top of `a-spike-and-owners.patch`.
Archive (.agent/AGENTS.md section 1): not done, no `E:\Backup` here.

## Changes

- `src/js/core/legacy.js` (new, loaded right after `00b-events.js`): `registerLegacyGlobals`, `registerActions`, `actionAttrs`, `legacyGlobalNames`, `registeredActionNames`, and one delegated listener per event type on `document` (`click`, `dblclick`, `contextmenu`, `mousedown`, `change`, `input`, `keydown`, `focusout` for blur, `error` in the capture phase).
- `src/js/core/LEGACY.md` (new): the API, how to write a `data-action`, a conversion table for the real handlers in this code base (checked against all 300 of them: only `this`, `event`, `this.value`, `this.checked`, `return false`, `stopPropagation` and `preventDefault` occur), and the places where a delegated handler differs from an inline one.
- `src/manifest.json`: one line.
- `tools/tests/legacy-bridge.test.js` (new): 14 tests.
- `.agent/PLAN.md`, `.agent/BOARD.md`, `tools/change.log.txt`: A-10 done; B-07, C-04, D-05, A-12, C-05, D-07 no longer wait for A-10.

No existing source file was changed, and no inline handler was converted: B, C and D do that in their own files.

## Design choices (so reviewers can push back)

1. **Registration is explicit.** `data-action` calls only functions registered with `registerActions`, not any global with that name. Reason: the name sits in HTML, and a name looked up on `window` could reach any function (including built-ins). It also gives an inventory, and a test.
2. **Same behaviour as inline handlers where it matters:** `this` is the element, `window.event` is set, `return false` cancels the default, a throwing handler does not stop the elements above it, ordering child then parent, `data-stop` replaces `event.stopPropagation()`. The path is taken from `composedPath()` at the start, so a handler that removes its own element does not cut off the parents (same as native).
3. **Handlers get exactly the listed arguments** (not an extra event argument), so a function with optional first parameters is not called with an event by accident. The event is available as `"$event"` in `data-args`, or `window.event`.
4. **One known difference, documented in LEGACY.md:** delegated handlers run when the event reaches `document`, after inline handlers on ancestors. A converted child inside an unconverted parent with its own inline handler cannot stop it. Rule: convert a nested group together.
5. Event types are fixed to the ones that occur in the code (and `error`, which does not bubble, is captured on `document`). Adding another is a one-line change in `EVENT_TYPES`.

## Tests actually run

- `node --test tools/tests/legacy-bridge.test.js`: 14 pass (2 static, 12 in the real page). Covers a `data-action` click (args, `this`, `window.event`), tokens, bubbling and `data-stop`, a failing handler, `return false`, seven event types, an image `error`, an unknown action name, escaping of quotes/brackets/unicode, and a bridged inline handler registered from a real module (`import()` of a blob) plus a module-private action.
- Sabotage check: I broke the bridge in seven ways (no `data-stop`, ignore `return false`, no capture for `error`, no error isolation, allow duplicate globals, no attribute escaping, and an unregistered `data-action` name in a source file). Each made at least one test fail; the restored file passes.
- Also ran the same flow once in a real Electron 44.5.1 (Chromium 152): the click, the escaped argument, the bridged inline handler registered from a module, and no page errors.
- Related tests: `manifest` 11, `events-wiring` 12, `setters` 3, `event-bus` 6, `events-a` 1, `scroll` 15 (1 skipped as before), `search-ui` 4, `view-switch-song-list-cleanup` 6, `playback-settings` 2, `metadata-editor` 10, all pass. `node tools/event-audit.js --strict` exits 0.
- Not run: the other tests (`online-metadata`, `scan-folder-tags`, `scanner`, `metadata-backend`, `music-folders`, `shuffle`, `search-engine`, `recents`, `storage`); they do not load `core/legacy.js`.

## Needs from other agents

- **B, C, D:** B-07, C-04 and D-05 can start. Read `src/js/core/LEGACY.md` first. Per file: convert the whole nested group together, register the actions in the same file, add a test or a manual check of each converted control, and keep `tools/tests/legacy-bridge.test.js` passing.
- **D:** `build/music_player.html` (49 inline handlers, 6 of them `onerror` for images) is in D-05's list. The `{{PLACEHOLDER_IMAGE}}` ones need a function that sets the placeholder; see the `onerror` row in LEGACY.md.

## Not done

- No handler converted (not this step's job).
- The bridge is not exercised by the app yet (no markup uses `data-action`), so it is covered by the tests only until the first conversion.

## For you

1. Nothing is required. When B, C or D send their first handler conversion, check that control in the app by hand once.

## Next step

A-11 (split `99-player.js`) waits for A-07b (the 11 variables). A-12 (storage, recents, search engine as modules) has no waiting step and can start.
