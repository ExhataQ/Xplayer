# Report UI-D01: Lyrics in the new shell

Agent D, 2026-10-17. Status: In review. Browser-tested; the Windows and Electron checklist below has not been run.

## Decisions taken (also written on the board)

- **D28**: the access views need to the engine goes through `adapter/engine-api.js` (`nowPlaying`, `engineView`, `engineAction`, `engineEvent`), about 45 lines. It is the first slice of A-04c, written by D with the owner's permission. It counts toward D18 together with `engine-view.js`. A may fold it into `store`, `actions` and `events`.
- **D29**: Write and Sync are buttons next to the View and Find tabs, not tabs. The engine opens its two editors as overlays, and a tab that does not stay selected is wrong. D-03 builds them as modes of the panel and they become tabs then.

## What changed

| File | Change |
|---|---|
| `adapter/legacy-dom-adapter.js` | Provides the `#tag-*` elements (L-11, below). 4 lines of code. |
| `adapter/engine-api.js` | New. The views' only way to the engine. `engineEvent` waits for the engine when it is called before the engine's modules have run (the shell is). |
| `views/tools/lyrics.js` | New. The mode bar: song and artist, View and Find tabs (the Tabs component), Write and Sync buttons, and a hint when the song has no lyrics. It follows the engine, also when the engine changes view itself. |
| `views/tools/lyrics.css` | New. Skin for the engine's lyrics page, tokens only. Serif text in a 46rem column, the engine's own `--lyrics-font-size` kept, synced line states, empty state, buttons, variants list, follow button, a baseline for Find. |
| `shell/shell.js` | The Lyrics rail item shows the engine page (`engine: 'lyrics'`) and calls the new `mount` hook. The shell now follows the engine to Lyrics, so the lyrics button in the player bar works. |
| `index.html` | Links `lyrics.css`. |
| `tools/tests/ui-next-lyrics.test.js` | New, 16 tests. |

## Findings

- **L-11 (fixed here).** `updateAlbumArt` (ui/08b) returns at once when any `#tag-*` element is missing, and the new shell's hidden panel had none. That function is what emits `lyrics:changed` when the song changes, so a Lyrics page that was open stayed on "No song playing" while a song played. The old UI is not affected. The adapter now provides the elements. The same gap probably affects the metadata panel (D-04).
- **The lyrics button in the player bar did nothing visible.** The engine switched to its lyrics page, which was drawn in the hidden host, while the shell stayed on Library. The shell now listens for `view:changed`. Fixed here.
- The engine's own stylesheets and Material Symbols are not loaded in ui-next, so icon names appeared as words ("graphic_eq", "edit"). The skin hides them and relies on the labels. The variants' edit and delete buttons get the words Rename and Delete from CSS. No new Lucide icons were added (they cannot be built offline), so the bar has no icons yet.
- The test fixture gives songs a numeric `duration`; the real app has text, and the engine's sync editor escapes it as text. The test sets a text duration first. Not a bug in the app.

## Design notes

- Strategy S3 (D16): the engine's node is moved, never cloned. Only the view host's content is replaced when the view changes.
- The engine's toolbar (display mode, import, paste) is moved above the text with CSS `order`, so it does not scroll away with a long song. Its Edit, Sync and Find buttons are hidden because the bar has them.
- Each line sets its own direction (`unicode-bidi: plaintext`), so a Persian line starts on the right and an English line on the left, in the same song.
- Synced lines: upcoming `--text-secondary`, past `--text-tertiary`, current `--text-primary`.
- The bar wraps at the smallest window (800 px wide); nothing scrolls sideways.

## Checks

- `node --test tools/tests/ui-next-*.test.js`: 225 tests, all pass (209 before, 16 new).
- New tests cover: tokens only, link order, gate 13 for the view, an allow-listed event list, a rule for every lyrics class the engine writes, opening from the rail with node identity, a song starting while the page is open, serif and layout, tab switching in both directions (also when the engine switches by itself), Write and Sync opening the editors, the no-lyrics hint, leaving and coming back, right-to-left lines, the 800 px window, the player-bar button, and contrast in three themes (4.5:1 for text, 3:1 for past lines).

## Not run

- `drag-drop-modules`, `lint` and `render-modules` need the `acorn` package, which is not installed in this environment. They fail the same way without these changes. Run them on your machine, in particular `lint`, which lints the new files.
- Electron. The tests run in headless Chromium with a stubbed `electronAPI`.
- Real playback with audio: the active line moving with the song was checked by class, not by playing audio.

## Environment

Headless Chromium (Playwright), Linux. Songs are the 30 fixture songs of `tools/tests/helpers/app-fixture.js`.

## Manual checklist (Windows app, `--ui=next`)

1. Open Lyrics from the rail with nothing playing: empty state, Write and Sync disabled.
2. Play a song with synced lyrics: the line being sung is bright, clicking a line seeks, scrolling away shows the "Follow lyrics" button.
3. Click the lyrics button in the player bar from another view: the shell goes to Lyrics.
4. Find: search for a song, use a result. Back to View.
5. Write and Sync open the engine's editors (not restyled yet, D-03).
6. A Persian or Arabic song: lines start on the right.
7. Window at its smallest size: no sideways scrolling.

## Follow-ups

- D-02: finish the Find page (results list, the multi-song finder). Only a baseline is here.
- D-03: Write and Sync as modes of the panel, then they become tabs.
- D-04: check the metadata panel with the `#tag-*` elements now present.
- A: decide whether `engine-api.js` folds into A-04c; add Lucide icons for the bar if wanted; the engine's `lyrics.css` can be deleted at cutover.
