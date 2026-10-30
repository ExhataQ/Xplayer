# Report: PB-07 Context menu icons, floating shuffle menu, default cover

**Task:** PB-07 | **Agent:** B | **Date:** 2026-10-24 | **Status:** In review

## Summary
- **7.5 Icons:** every item in the engine's context menus (song rows, library items, the list menu, lyrics lines) now has a small static icon: add (plus), favorites (heart, filled in the accent color when the song is liked), queue, lyrics, metadata, file location, delete (turns red on hover), play, pin, shortcut, rename, folder actions, notification mute, and so on. The shapes come from the app's own icon set; the few it lacked (trash, pencil, share, open folder, folder minus, chart, music) are drawn in the same style.
- **7.4 Floating menu for shuffle mode:** the shuffle button in the player bar, the shuffle button in the list toolbar and the S key open a floating menu (Normal shuffle, Smart shuffle, Turn shuffle off) instead of the engine's modal dialog. The player-bar menu opens above the button. Smart shuffle is dimmed with the reason when the list has 50 songs or fewer. The checked mode shows. Create folder and create playlist are done in PB-06 (plus button and the empty-space menu).
- **7.6 Default cover:** the engine already used `src/assets/default-cover.svg` (the old interface's cover) for songs, albums and artists without art. I redrew it slightly (soft gradient background, larger note). Home cards for songs and playlists without a cover showed a letter; they now show this cover (artists keep the letter).

## Findings
- The engine hides its menu icons on purpose (`legacy-overlays.css`): Font Awesome is not loaded, so they were empty boxes. The icons are drawn with CSS masks per Font Awesome class, only inside `.context-menu`, so nothing else changes. A test checks that every class the engine writes in a menu has an icon.
- The shuffle dialog was one of the engine's modals; `selectShuffleMode` was only reachable through the engine's click handler. It is now also a legacy global (one line in `15b-controls-shuffle-btn.js`, next to `toggleNormalShuffle`), and so is `openShuffleModeDialog`, which four dialog-style tests use to open that dialog because the button no longer does.
- The menu component had no way to open above its button; added an `above` option (A's component, a few lines).

## Changed files
| File | Change |
|---|---|
| `adapter/context-menu-icons.css` (new, generated), `tools/build-context-menu-icons.mjs` (new) | the icons and their generator |
| `adapter/shuffle-menu.js` (new, 45 lines) | `shuffleModeInfo`, `chooseShuffleMode`, `openShuffleMenu`, `installShuffleMenu` |
| `components/menu.js` | `above` option |
| `views/library/list-toolbar.js` | shuffle opens the menu |
| `shell/shell.js` | installs the shuffle menu when the engine is ready |
| `views/home/shelf.js` | default cover for cards without one |
| `index.html` | link to the icon stylesheet |
| `src/assets/default-cover.svg` | redrawn |
| `src/js/playback/15b-controls-shuffle-btn.js` | `selectShuffleMode`, `openShuffleModeDialog` as legacy globals |
| Tests, new | `context-menu-icons.test.js`, `shuffle-menu.test.js`, `ui-next-menu-icons.test.js` |
| Tests, changed | `ui-next-listbar` and `ui-next-shell` (use the menu); `ui-next-dialogs` and `ui-next-phase1-gate` (open the engine's dialog directly) |

## Decisions made or needed
- No new DP. Icons and the menu follow the brief; the shapes are my choice (simple outline style, same stroke as the rest).
- Needed from A: review the `above` option in `components/menu.js` and the one line in `shell.js`.
- DP9: `adapter/shuffle-menu.js` is 45 lines.

## Checks
| Command or step | Result |
|---|---|
| `node --test` context-menu-icons, shuffle-menu | 5 tests, 5 pass (includes: every menu icon class has a rule; the generator reproduces the file) |
| `node --check` on the six edited browser tests and the new one | parse |
| Built app copy in headless Chromium (Python Playwright), the new test's steps | song row menu: 7 icons, library item menu: 4 icons, all 16 px masked images; player shuffle opens a menu above the button with no engine dialog; Smart sets `shuffleMode = smart`; reopening shows Smart checked and "Turn shuffle off", which turns it off; the toolbar shuffle and the S key open the same menu; Smart is disabled when the list has 10 songs; Home playlist and song cards use the default cover; no page errors; screenshots looked at |

## Not run
- The Node browser tests (`ui-next-*.test.js`, including the four I changed and `ui-next-menu-icons.test.js`): Node `playwright` is not installed here. Run `node --test tools/tests/ui-next-*.test.js`.
- Real Electron and Windows; the lyrics-line and notification menus were not opened (they use the same classes, covered by the class-coverage test).
- Whether the redrawn default cover looks right on a light theme.

## Environment
Linux sandbox, Node 22.22.2, Chromium via Python Playwright 1.56. No Electron, no `node_modules`.

## Manual checklist for the owner
1. Right click a song, a playlist in the left panel, and open the list's "more" menu: each item has an icon; the heart is filled for a liked song; Delete turns red on hover.
2. Click the shuffle button in the player bar: a menu opens above it. Pick Smart shuffle (needs more than 50 songs); open it again: Smart is checked and "Turn shuffle off" is there.
3. Click the shuffle button in a list's toolbar and press S: the same menu.
4. On Home, a playlist or song without cover art shows the default cover.
5. Look at the default cover in the Library list and the player bar on every theme.

## Open issues and follow-ups
- Menus that the new interface draws itself (the app menu, sort menu) have icons where it matters; this task covers the engine's menus.
- PB-14 and PE-05 are next.
