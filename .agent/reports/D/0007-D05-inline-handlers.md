# Agent D report 0007: convert inline handlers (D-05), first slice

Step: D-05 (Phase 3). Applies on top of: `Xplayer-main_2_.zip` (the newest version; rebased from `Xplayer-main_1_.zip`, only `tools/change.log.txt` needed a manual merge). Apply it **before** D-0008 (D-07).
Archive (.agent/AGENTS.md section 1): **not done**, `E:\Backup\...` is not reachable from my environment. Nothing in the zip was changed; the patch is the only deliverable.
D-06: not touched, as asked. D-07: separate patch D-0008.

## Result

**84 inline handlers became `data-action`.** Attribute-style `on...="..."` in the D files: **161 before, 78 after** (counted with the same regex before and after, `.onclick = fn` property assignments excluded).

| File | Before | After | What was converted |
|---|---|---|---|
| `build/music_player.html` | 60 | 20 | 41 header, panel, hero, player and notification buttons, and the `oninput`/`onblur` search boxes |
| `04e-render-favorites-history.js` | 1 | 0 | Clear List |
| `04f-render-search-history.js` | 4 | 1 | Clear List (x2), the history row (id and query now passed as data, no hand-made quote escaping) |
| `04g-render-lyrics-view.js` | 11 | 0 | mode buttons, editor, sync, import, paste, online, and the four synced-variant controls |
| `06a-context-menus.js` | 31 | 3 | 28 menu items: the song, queue, playlist, folder, artist, album and history menus |
| everything else | 22 / 3 / 6 / 1 / 4 / 16 / 1 / 1 | same | not converted, see below |

New and changed files:
- `src/js/07a-ui-actions.js` (new): `registerActions` for the 49 names used by the template and by 04e, 04f, 04g. Each entry is a plain call of the global function of the same name. It ignores the return value, because an inline `onclick="fn()"` did not return it either (the bridge treats a returned `false` as preventDefault). Added to `src/manifest.json` right after `07-views.js` (one line).
- `06a-context-menus.js`: a `CONTEXT_MENU_ACTIONS` table (21 names, each looked up when clicked) and 6 small actions: `contextMenuAction` (function, then close menu), `contextMenuPinItem`, and four "play from menu" helpers that **close the menu first**, as the old inline code did. The old `pinAction` string of code became `actionAttrs(...)` arguments.
- `tools/tests/ui-handlers.test.js` (new, 17 tests): a ceiling per D file for the inline handlers left (it can only go down), and 4 browser tests (template controls, search history, context menus, lyrics view).
- `tools/change.log.txt`: entry added.

## How I checked "behavior exactly"

I wrote a probe that clicks every converted control in a real page and records which functions are called, with what arguments, in what order, and with which `this`. I ran it on the original tree and on the converted tree and compared:
- Template controls: 40 of 40 identical (one is `performSearch`, a `const` that cannot be spied on).
- Dynamic markup (song, queue, playlist, folder, artist, album, special-item and history context menus; search history; recently played; lyrics view in synced and plain modes): 82 of 82 identical, 70 of them converted.
- Unconverted controls: unchanged.

What the probe found, and I fixed:
1. `this`: `onclick="goBack()"` calls it with `this` = window; the first version of my wrapper passed the element. Now a plain call.
2. The right-panel title `#right-panel-header-title` (template line 511) has its `onclick` rewritten at runtime by `08d-panel-right-tabs.js` (`setAttribute('onclick', ...)`). With `data-action` on it, a click ran both. **Reverted to inline.**
3. A first probe click on a search-history row did nothing in either tree, because the click went to `blockRowEdgeDeadZone` (a capture listener in 04a that swallows clicks near row edges). Not a bug; my probe now clicks the element centre.

One intended difference: a name that contained `"`, `\` or `<` used to break the inline attribute (the old code only escaped `'`). `actionAttrs` escapes everything, so those names now work. For every other name the arguments are identical.

Sabotage check: I broke three conversions on purpose (menu close order, a missing argument in the search-history row, a wrong variant action); `ui-handlers.test.js` failed on each (3 of 4 browser tests), and passes again once restored.

## Left inline on purpose (78)

The bridge listens on `document`, so these would behave differently if converted now:
- **They call `event.stopPropagation()`** (inline or inside the function, such as `showContextMenu(event)`): about 40 in 04a, 04b, 05b, 06a (3), 06j, 07 and the template. A document-level handler cannot stop other document listeners (the tooltip hider in 06d, the menu closer in 06a), so a click would newly reach them.
- **Inside a modal**: every modal in 06b has `modal.onclick = e => e.stopPropagation()`, so a delegated click inside never reaches `document`. The 16 modal buttons are one group; they need the bridge to support a "stop here" mode first.
- **Found by other code through their `onclick` text**: the left-panel items (`04h:14`, `07:112`, `99-player.js:544`) and `10c:238` (add-to-queue button). Converting them needs edits in A's and B's files.
- **`mousedown`**: the song-row and left-panel handlers run before the drag listeners in `06f` and `06g`; `startSeek` and `setVolume` in the template do the same with the progress and volume bars.
- **`onerror` and the extended-info and image-viewer overlays** (template): nested `stopPropagation` groups.
- **The right-panel title**, rewritten at runtime (above).
- Not converted, but safe candidates for a second slice (I did not have time to probe them): the three filter tags (template lines 197, 202, 205) and `showSubheroContextMenu(event)` (line 440).

## D-07 (theme switcher module)

Done in the next patch, D-0008 (report 0008). The module script type this needed now exists in the manifest.

## Tests actually run (Chromium via Playwright; `NODE_PATH` pointing at the global modules and `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`)

- Baseline, original tree: `node --test tools/tests/*.test.js` -> **149 tests, 147 pass, 0 fail, 2 skipped**.
- Converted tree, same command -> **166 tests, 164 pass, 0 fail, 2 skipped** (the 17 new ones are mine; the 2 skips are the same as before, including the timing-sensitive scroll test).
- `node tools/event-audit.js --strict`: exit 0, A 0 / B 0 / C 0 (76 excepted), unchanged.
- The `legacy-bridge` guard test passes (every `data-action` name is registered).
- Not run: the app in real Electron.

## Needs from other agents

- **A:** (1) a "stop here" mode for the bridge (for example a capture-phase listener for `data-stop`) so the ~40 `stopPropagation` handlers and the modals can be converted; (2) update the status line in `core/LEGACY.md` (it still says no handler is converted).
- **B and C:** nothing from this patch. In `10c:238` and `99-player.js:544`, selecting by `[onclick*=...]` has to change before the left-panel items and add-to-queue buttons can be converted.

## For you (manual checks)

1. Run `node --test tools/tests/ui-handlers.test.js tools/tests/legacy-bridge.test.js tools/tests/manifest.test.js` -> 0 failures. Better: the full suite.
2. Open the app: click Back, Forward, Settings, Notifications (clear all), Minimize and Maximize, Close is safe to skip. Collapse and expand the left and right panels.
3. Type in the main search box and in the left-panel search box, then clear each with the X; click away from the left-panel search (blur).
4. Right-click a song, an artist, an album, a playlist and a folder; click a few items, such as Add to queue, Play and Pin to top. The menu must close after each one.
5. Open Search History (click a row, click delete on another, Clear List) and Recently Played (Clear List).
6. Open the Lyrics view: switch Plain and Synced, open the editor, and rename and delete a synced variant.
7. In the right panel, click the title ("Queue" / source name) in each tab. It must switch once, not twice.
8. Check the console: no errors.

## Next step

After you apply this and run the checks, mark D-05 `in progress` (first slice) in `.agent/BOARD.md`; it is not finished until the stopPropagation groups are converted. A's bridge change and the module script type unlock the rest and D-07.
