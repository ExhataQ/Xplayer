# P1-PA-13 Mouse back and forward

Status: In review. Task: brief 8.4.

## Cause
The engine's mouse handler (`ui/06k`, buttons 3 and 4) walks the engine's own history (`pushViewToHistory` in `ui/07`). That history holds only the engine's lists, playlists, albums, artists and settings. Home, Lyrics, Metadata and the AI chat are shell views, so they were skipped, and going back from them landed on a list the person had not just seen.

## Fix (shell only, no adapter line)
- `shell/nav-history.js`: the shell's own history, one entry per place `{ view, engine }`, 100 at most. A new place after going back drops the forward ones. An engine switch that follows a view change at once (a Home card: Library, then the playlist) replaces that entry, so it is one step.
- `shell/shell.js`: `showView` records, the engine's `view:changed` records lists and detail views, going back shows the view (panel kept) and reopens the engine's list, playlist, album or artist. A view that asks to stay (Metadata with unsaved text) keeps the position.
- The mouse buttons are caught in the capture phase on `window`, so the engine's handler never runs; the buttons are not passed on to the browser.

## Matrix (test `ui-next-nav-history.test.js`, 10 tests)
Walk back and forward in order; new place cuts the forward list; ends do nothing; same place adds nothing; Home card replaces; later engine switches are their own steps; a refusing view; the 100 limit. In the real shell: Library, Settings, Lyrics both ways with the rail following; Home; Favorites then Metadata and back to Favorites; other mouse buttons untouched.

## Not covered
Search and Recents are panel items (the main view stays), so they are not steps. The panel open or closed state is not restored.
