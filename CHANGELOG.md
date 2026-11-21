# Changelog

## Unreleased

## 1.0.0-beta.1 - 2026-11-21

First public beta.

### Added
- Library with songs, albums, artists, playlists, playlist folders, favorites and history; background scanning; automatic backups of the library file.
- Gapless playback, crossfade, equalizer, waveform seek bar and visualizer; queue, shuffle and Smart Shuffle (beta).
- Mini Player and Quick Player windows. Files opened from Windows play in the Quick Player; with the full app running they replace the queue.
- Lyrics: plain and synced, a sync editor that works on its own songs, online lookup (LRCLIB) for one song or many.
- Tag and cover editor for MP3, FLAC, OGG, Opus and M4A, one song or many, with undo; online tag lookup (MusicBrainz).
- Optional AI assistant with your own OpenRouter key (organise library, playlists, tags, lyrics translation). Off until you accept the privacy screen.
- Library health (beta).
- Help > About (version, licence, project page) and Help > Open logs, a log viewer with file paths and your user name removed.
- First-run welcome (theme, playback options, music folders) and a Default apps page in Settings.
- Settings > Data > About > Check for updates: asks GitHub whether a newer release exists, only when you press the button. Nothing is downloaded or installed.
- Installer (per user, no administrator needed) and a portable zip. The installer asks whether to delete your data when uninstalling.

### Fixed
- Copy diagnostics and the log viewer now remove whole file paths, not only the user folder.
- The `[gapless]` lines in the console while songs play are gone.
- Downloading a link stops at 2 GB or when the server goes quiet for 30 seconds, and removes the partial file.
- Names with `<` or `>` in a song tag or an imported playlist no longer break the delete dialogs.
- The song that was playing when the app closed, with its position, is back in the player bar at the next start, paused.
- Scrolling fast through a long song list no longer freezes the app.
- Smart Shuffle no longer freezes on songs too long for its groups, and is much faster on large libraries.
- The waveform works while the visualizer or equalizer is on.
- Back and Forward restore scroll positions and walk the screens inside Library health.
- Portable build: audio files get the Xplayer icon after it is chosen as the default app.
