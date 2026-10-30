# Changelog

## Unreleased

### Added
- New interface: one custom scrollbar everywhere (slim thumb in the theme color, no arrow buttons). Settings > Appearance > Scrollbar color switches it to a neutral grey, and Scrollbar shape picks a flush bar or a wall tab.
- Two interfaces ship together. Switch in Settings > Interface (either interface); the choice is saved. Flags `--ui=next`, `--ui=current` and `XPLAYER_UI` still decide the first load.
- New interface: startup view, notification center with Cancel, tooltips, accent themes, density, resizable library panel, lyrics, metadata editor, settings sections, dialogs, search, library views.
- Cancel for downloads and album art search. The download's partial file is removed; the cover search stops after the current batch.

### Changed
- Library panel: switching the filter chips or the A to Z / Recent order fades the rows in.
- Removing a queue song that is not playing no longer redraws the song list; a pin change draws the left panel once.
- Space after a mouse click goes to the page instead of repeating the click.
- Compact density also shortens library panel rows.
- A volume change during a track's first second is kept (fade-in no longer overwrites it).

### Fixed
- New interface: dragging playlists, folders and songs shows the drop line, target ring, folder tint and drag label again, and dropping songs on the Library panel adds them to Liked Songs.
- Startup: the startup view shows from the first paint instead of after the page loaded.
- Adapter API tests load their modules under the `<base href>` used by the new interface.
