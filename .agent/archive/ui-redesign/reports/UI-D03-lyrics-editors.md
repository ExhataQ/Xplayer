# Report UI-D03: Lyrics write and sync editors as modes of the Lyrics page

Agent D, 2026-10-18. Status: In review. Browser-tested; the Windows and Electron checklist below has not been run. Built on the `Source-backup` tree (it already holds D-01, D-04 and A's adapter API).

## Decisions taken (also written on the board)

- **D31**: Write and Sync are tabs of the Lyrics page, next to View and Find (this replaces the interim buttons of D-01). The engine builds each editor once as an overlay on `<body>`; the bridge moves it into the page and the skin makes it fill the page.
- **D34**: leaving the Lyrics view, or picking another tab, closes an open editor and asks first when something would be lost: the Write draft with the engine's own question style (`Discard unsaved lyrics?`), the Sync editor with the engine's own dialog (`Discard Sync?`, only when timings exist). The sync dialog answers later, so after Discard the page lands on View and the person picks the tab again.

## What changed

| File | Change |
|---|---|
| `adapter/engine-view.js` | `adoptLyricsEditors(host)` moves the two editors into the page; `releaseEngineView` puts them back on `<body>`. |
| `adapter/engine-api.js` | `lyricsEditors()`, `lyricsEditorDirty()`, `watchLyricsEditors()`. The watcher observes the two overlay elements' class and the children of `<body>` only, never the whole page. `playback:stateChanged` is allow-listed. |
| `adapter/legacy-overlays.css` | The two editors are taken out of the interim overlay rule (L-13). |
| `views/tools/lyrics.js` | Four tabs. Opens, closes and guards the editors; mirrors the audio's playing state to the page for the play button; `leaveLyrics()`. |
| `views/tools/lyrics-editors.css` | New. Skin for both editors, tokens only, about 640 lines. |
| `shell/shell.js` | Lyrics gets a `leave` guard; the shell follows the engine to Lyrics when it opens an editor (a song's menu does). |
| `index.html` | Links `lyrics-editors.css`. |
| `tools/tests/ui-next-lyrics-editors.test.js` | New, 20 tests. |
| `tools/tests/ui-next-lyrics.test.js` | Updated for the four tabs (the buttons are gone) and the fifth allow-listed event. |

## Findings

- **L-13 (fixed here).** `adapter/legacy-overlays.css` made `.lyrics-editor-overlay` and `.sync-editor-overlay` always visible, full-window with a scrim. The engine never removes them, it only removes the class `active`. After opening and closing an editor once, a scrim stayed over the whole app and swallowed clicks. The two selectors are removed; `body > .lyrics-editor-overlay` and `.sync-editor-overlay` are now hidden outside the page.
- An editor left open keeps its document-level key handlers (Escape, and Ctrl+Enter which saves). Leaving the page with an editor open would have let Ctrl+Enter save a half-typed lyric from anywhere. The leave guard closes it.
- The Sync editor's line menu (right click) is built by the engine with inline colors and Font Awesome icons. The skin overrides the colors with tokens and hides the empty icon slots. A-05's menu work may replace it.
- The engine's `showConfirmDialog` is a `playlist-modal` (D-06 style) and works in the page unchanged.
- The Sync editor needs the song's `duration` as text. The test fixture has a number, so the tests set text first. The real app is not affected.

## Design notes

- Both editors are moved, not cloned, so every id and handler the engine cached stays valid.
- Write is a single column: serif text field, Clear on the left, Cancel and Save on the right. Each line takes its own direction (`unicode-bidi: plaintext`).
- Sync is two columns (lines, player) that stack when the page is narrower than 46rem (a container query on the page, so the collapsed side panel counts). When stacked, the player is pinned at the top and the lines scroll beneath it; the volume row, the details and the LRC preview are dropped.
- Only the line being worked on shows its six timing buttons, on a row under its text; the insert buttons show on hover and keyboard focus.
- Play and pause are drawn with CSS masks from `data-playing` on the page, which comes from `store.isPlaying()` and `playback:stateChanged`. Volume has a single glyph (the slider shows the level).
- No Lucide icons were added (cannot be built offline); words and a few characters (note, plus) stand in.

## Checks

- `node --test tools/tests/ui-next-*.test.js`: 321 tests, all pass (301 in the base, 20 new).
- New tests cover: tokens only, link order, the interim rule gone, gate 13, the narrow watcher, a rule for every editor class; four tabs and when Write and Sync are enabled; Write in the page, filling it, and Cancel; the app not blocked after closing an editor; Save and Clear; draft guards for tabs and for leaving the view (including that Ctrl+Enter afterwards saves nothing); Sync loading lines, one focused row with timing buttons; the play button state; the engine's Discard Sync dialog (Keep Editing and Discard); Sync without timings; the line menu look; an editor opened by the engine from another view for a song that is not playing; the smallest window; contrast in three themes with translucent backgrounds blended.

## Not run

- `lint`, `render-modules`, `drag-drop-modules` and the production build: the `acorn` and ESLint packages are not in this environment (`node_modules` is empty). Run `npm run lint:strict` and the full test run on your machine.
- Electron and a real main process. Saving as .lrc or .txt (the footer buttons) and Import .lrc go through file dialogs and were not exercised.
- Real audio: stamping uses the audio element's `currentTime`; playback of a real file while stamping was not tried.

## Environment

Headless Chromium (Playwright), Linux; the 30 fixture songs of `tools/tests/helpers/app-fixture.js`.

## Manual checklist (Windows app, `--ui=next`)

1. Lyrics, tab Write: the saved text appears; type, Save: back on View with the new text; Clear empties them.
2. Write with a draft, click View, Find or another rail item: the question; No keeps the draft.
3. Tab Sync: Load Plain Lyrics (or a saved variant, or Import .lrc), play the song, press F1 or the plus button to stamp lines; the line moves on; Copy and Follow work; the scrubber and volume slider drag.
4. Save as .lrc and Save as .txt open the save dialogs; Save stores the variant and returns to View.
5. Sync with stamps, click another tab: Discard Sync? appears; Keep Editing stays, Discard closes.
6. Right click a line: the menu opens with every entry working.
7. A right-to-left song in Write and Sync.
8. Smallest window: Sync stacks, the player stays pinned while the lines scroll.
9. From a song's menu choose Edit lyrics for a song that is not playing: the shell goes to Lyrics in Write.

## Follow-ups

- D-02: finish Find (results list, the multi-song finder); only a baseline exists.
- A: the board still shows A-04c as not started although its report says it is done; whether `adapter/engine-api.js` folds into `store`, `actions`, `events`; Lucide icons for the editors if wanted; the engine's `lyrics.css` can be deleted at cutover.
