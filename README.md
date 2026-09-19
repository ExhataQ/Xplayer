# ExhataQ

ExhataQ is a local desktop music player built with Electron, JavaScript, HTML, and CSS.

It is designed around a local music library, with a focus on fast navigation, playback, organization, and control over song information.

## Features

- Local music library scanning
- Folder-based music library management
- Artists, albums, genres, favorites, history, and playlists
- Queue and playback controls
- Shuffle and repeat playback
- Search and library navigation
- Album artwork and color-based player UI
- Lyrics viewing and editing
- Synced LRC lyrics support
- Online lyrics search through LRCLIB
- Multi-song lyrics finder
- Audio metadata editor
- Multi-value metadata fields such as Artist, Genre, Composer, and Album Artist
- JSON metadata import/export
- Online metadata search through MusicBrainz
- Cover art selection and saving
- MusicBrainz release and original-release information

## Tech Stack

- Electron
- JavaScript
- HTML / CSS
- Python
- Mutagen for audio metadata handling
- MusicBrainz for online metadata
- LRCLIB for online lyrics

## Project Structure

```text
ExhataQ/
├── electron/       # Electron main process and native functionality
├── src/            # Player UI and frontend code
├── build/          # Generated player build
└── tools/          # Build utilities and tests
```

## Running from Source

Requirements:

- Node.js
- Python 3
- Python package: `mutagen`

Install the Electron dependencies:

```bash
cd electron
npm install
```

The project is currently developed primarily for Windows.

## Tests

The project includes tests for the scanner, music folders, and storage systems.

From the `electron` directory:

```bash
npm test
```

## Metadata

ExhataQ can read and write audio metadata directly in supported audio files. The metadata editor supports standard fields as well as additional tags and MusicBrainz identifiers.

Metadata can also be exported to and imported from JSON, making it possible to keep an external copy of metadata before making changes.

## Lyrics

Lyrics can be stored and edited inside ExhataQ, including synchronized LRC lyrics.

The online lyrics system uses LRCLIB. The multi-song finder can search the library sequentially and report whether synchronized or plain lyrics were found for each selected song.

## Online Services

Some features use external services:

- MusicBrainz — music metadata and release information
- Cover Art Archive — album artwork associated with MusicBrainz releases
- LRCLIB — lyrics and synchronized lyrics

These services are only used by their respective online features; normal local playback does not require them.

## Status

ExhataQ is an actively developed personal project. Features and internal APIs may change as the player evolves.

## License

No license has currently been specified.
