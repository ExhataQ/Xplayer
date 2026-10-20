# UI-B05 List toolbar, kind label and Recently played

Agent: B. Status: In review. Decisions: D26 (resolved), D28.

## What changed and why
- **List toolbar** in the song list's title bar: Play/Pause, Shuffle, Find in this list, More options. They call the engine's own sub-header handlers through `adapter/listbar-bridge.js` (45 lines or fewer, enforced by a test), so behaviour matches the old UI.
- **Kind label** above the title (Album, Artist, Playlist, Search results) so album, artist and playlist views are told apart.
- **Recently played** rail item shows the engine's history view with the same list and toolbar.
- **Icon**: `ellipsis` added to `icons.js` and the generator list.
- **Play button style**: shell.css's generic `.icon-btn` rule loads after components.css and overrode the solid variant. `.list-toolbar .icon-btn--solid` restores the size and colours.

## Notes
- Shuffle opens the engine's "Shuffle mode" dialog; `aria-pressed` follows the engine state.
- Find creates the hidden `#subhero-search-input` and calls `performSubheroSearch`. Escape on an empty field closes it. Switching list closes it.
- Search view has no toolbar.

## Tests run
`ui-next-listbar` (7), `songlist` (22), `search` (7), `library` (16), `shell` (17), `tokens` (23), `phase1-gate` (11): all pass. `node tools/lint.js --strict`: clean. The full suite exceeded the 2 minute tool limit here and was not run to completion.

## Not done
Cover art in the title bar; Artists index "coming soon" parity; Electron run; RTL check.

## Manual checklist
1. Open Library, play/pause from the toolbar; the icon swaps.
2. Shuffle: dialog appears; the button shows pressed after choosing a mode.
3. Find: type, list filters; Escape closes.
4. More: menu shows pin/clear history as appropriate.
5. Open an album and Liked Songs: labels read Album and Playlist.
6. Recently played shows history; More has Clear history.
7. Narrow the window: Find shrinks, nothing overlaps.
