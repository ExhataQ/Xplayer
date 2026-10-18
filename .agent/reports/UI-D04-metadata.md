# Report UI-D04: Metadata editor in the new shell

Agent D, 2026-10-17. Status: In review. Browser-tested with a stubbed main process; the Windows and Electron checklist below has not been run.

## Decisions taken (also written on the board)

- **D30**: the Metadata rail item shows the engine's own tag form (strategy S3, D16). The form is the "metadata" tab of the engine's right panel, so the bridge moves that tab into the view host (`showEnginePanel` in `adapter/engine-view.js`). It edits the song that is playing and follows the playing song as long as the form holds no unsaved changes.
- **D31**: leaving the view with unsaved changes asks first, with the engine's own question ("Discard unsaved metadata changes?"). Choosing Metadata again while on it does nothing, so a click on the rail icon cannot wipe the text.

## What changed

| File | Change |
|---|---|
| `adapter/legacy-dom-adapter.js` | Provides `#metadata-editor-content` inside `#metadata-content` (L-12, below). 1 line. |
| `adapter/engine-view.js` | `showEnginePanel(host, tab)` moves one tab of the engine's right panel into the host, `releaseEngineView` gives both kinds of moved node back. +25 lines. |
| `adapter/engine-api.js` | Allow-lists `rightPanel:tabChanged`; adds `metadataEditor()` (is the form drawn, does it hold unsaved changes) and `engineConfirm()`. |
| `views/tools/metadata.js` | New. Empty state, follows the song, `leaveMetadata()` guard. |
| `views/tools/metadata.css` | New. Skin for the engine's form, tokens only: sticky toolbar and Save bar, two-column fields, chips for multi-value fields, cover box, other tags, online results, error state. |
| `shell/shell.js` | The Metadata item shows the panel (`enginePanel`) and gets a `leave` guard hook. The shell follows the engine into the editor (a song's menu opens it) and out of it (Save, Cancel, Back go back to the view the person came from). |
| `index.html` | Links `metadata.css`. |
| `tools/tests/ui-next-metadata.test.js` | New, 19 tests. |
| `tools/tests/ui-next-lyrics.test.js` | The allow-list assertion now lists four events. |

## Findings

- **L-12 (fixed here).** The engine renders the form into `#metadata-editor-content` and does nothing when it is missing. The old template has that element inside `#metadata-content`; the new shell's panel had an empty `#metadata-content`. The adapter now provides it.
- Engine behaviour, not changed (out of D's scope): choosing More tags re-draws the form, and the cover status goes back to "No cover selected" even when the person already picked a file. Reading the code, the picked file is still saved (`metadataEditorCoverPath` is not cleared), so only the preview is wrong. A or the owner can decide whether to change the engine.
- The engine's form uses Material Symbols for its icons. They are hidden and the labels carry the meaning (the back button gets the word Back from CSS).
- No new Lucide icons were possible offline, so the toolbar has no icons.

## Design notes

- The panel node is moved, never cloned, so every id the engine cached stays valid. When the view is left, the node goes back to the hidden panel.
- The toolbar and the Save bar stay in view while the long form scrolls (sticky). Save is disabled until something changes, as in the engine.
- The form leaves the engine in charge of Save, Cancel, Back, import and export, online search and the cover. Nothing about saving was changed.
- Online results are cards with the match first and its releases as small buttons; the original release is marked by the engine's text.

## Checks

- `node --test tools/tests/ui-next-*.test.js`: 244 tests, all pass (225 before, 19 new).
- New tests cover: tokens only, link order, gate 13, allow-list, a rule for every engine class, the empty state and a song starting, the filled form with chips and Save waiting for a change, Save sending only the changed field and going back, Back and Cancel, the leave question (No keeps the text, Yes leaves and closes), no question on a clean form, re-choosing the view, the engine opening the editor by itself (once), following the song (clean) and not following it (dirty), adding and removing values, online search and using a release, an unreadable file, sticky bars and the 800 px window, contrast in three themes.

## Not run

- `drag-drop-modules`, `lint` and `render-modules` need the `acorn` package, which is not installed here (same without these changes). Run them on your machine; `lint` checks the new files.
- Electron and the real main process. The tests stub `electronAPI` (`getAudioMetadata`, `saveAudioMetadata`, `searchOnlineMetadata`, `getOnlineMetadata`), so reading and writing real tags, the cover picker and the JSON import and export dialogs were not exercised.

## Environment

Headless Chromium (Playwright), Linux; the 30 fixture songs of `tools/tests/helpers/app-fixture.js`.

## Manual checklist (Windows app, `--ui=next`)

1. Metadata from the rail with nothing playing: empty state.
2. Play a song, open Metadata: the form fills from the file.
3. Change a title, Save: back to the previous view; the song list and player show the new title.
4. Change a title and click another rail item: the question; No keeps the text, Yes leaves.
5. Right-click a song, Edit metadata (once the library view shows the engine's menu): the shell goes to Metadata.
6. Search online, use a release: the form fills, Save is enabled; the cover downloads.
7. Change cover: the picker opens, the preview shows the file, Save writes it.
8. Import and Export JSON.
9. A file with a tag the form does not edit: More metadata tags lists it under Other Tags.
10. Window at its smallest size: no sideways scroll, Save bar visible.

## Follow-ups

- D-02 and D-03 (find, write, sync) remain. D-03 needs the sync editor's overlay as a mode.
- The right-click "Edit metadata" path depends on the library view (B-03) for the menu.
- A: engine's `toggleMetadataMore` cover preview reset (above); whether `engine-view.js` (now about 75 lines) and `engine-api.js` fold into A-04c; Lucide icons for the toolbar if wanted.
