# Changelog

## Unreleased

### Added
- Two interfaces ship together. Switch in Settings > Interface (either interface); the choice is saved. Flags `--ui=next`, `--ui=current` and `XPLAYER_UI` still decide the first load.
- New interface: startup view, notification center with Cancel, tooltips, accent themes, density, resizable library panel, lyrics, metadata editor, settings sections, dialogs, search, library views.
- Cancel for downloads and album art search. The download's partial file is removed; the cover search stops after the current batch.

### Changed
- Space after a mouse click goes to the page instead of repeating the click.
- Compact density also shortens library panel rows.
- A volume change during a track's first second is kept (fade-in no longer overwrites it).

### Fixed
- Startup: the startup view shows from the first paint instead of after the page loaded.
- Adapter API tests load their modules under the `<base href>` used by the new interface.
