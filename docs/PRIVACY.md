# Privacy

Xplayer keeps your music library, playlists, ratings, lyrics and settings on your computer. There is no account, no analytics and no
crash reporting. Nothing is sent anywhere until you use one of the features below. The AI part of this page is built from the same
list the app shows you (Settings > AI > What the AI receives), so the two cannot disagree.

## Where your data is

- Installer: `%APPDATA%\Xplayer`.
- Portable zip: the `Xplayer-Data` folder next to `Xplayer.exe`.

Uninstalling the installer asks whether to delete this folder too (the default is to keep it). Delete it yourself if you want everything gone.

## Features that contact the internet

| Feature | Service | What is sent |
|---|---|---|
| Tag lookup, "find tags online" | MusicBrainz and the Cover Art Archive | The title, artist, album and length of the song you ask about; for a cover, the id of the release found. |
| Popularity in the tag finder | ListenBrainz | The MusicBrainz release-group id of the album being checked. |
| Find lyrics online | LRCLIB | The artist, title, album and length of the song. |
| Check for updates (only when you press the button) | GitHub | A request for the project's list of releases. Nothing about you or your library. |
| Play from URL, download | The address you type | A normal request for that address. |
| AI (off until you accept the privacy screen) | OpenRouter, then the model you chose | See below. |

Each request carries a User-Agent that names the app and its version (`Xplayer/<version> ( https://github.com/ExhataQ/Xplayer )`), as
these services ask. Your IP address is visible to every service you contact, as with any website.

## AI

The AI features are off until you read the privacy screen and accept it. They need your own OpenRouter key, which is kept on your
computer (encrypted with the system's key store when Windows provides one).

What may be sent, depending on the task:

- Organizing, shuffling and fixing tags: your library, up to 1,000 songs per request, each as title, artist, album, length and any of
  the tag fields that have a value (genre, year, composer, label, BPM, rating, play count and similar). Above 400 songs only title,
  artist, album, length and the flags playing, selected and favorite are sent.
- The queue order, the playlist names with their songs, and the folders that hold playlists.
- Translating lyrics: the words of each line, never the timestamps.
- Reading lyrics (a switch in the chat, off by default): the first 700 characters, without timestamps, of up to 40 songs.
- Chat: your last few messages and the assistant's replies.
- Tag lookup from the chat (a switch): title, artist and album of the first 10 songs go to MusicBrainz.

Never sent: file names and folder paths, cover art, comments, copyright and encoder fields, and your real song ids (the AI sees numbers
1, 2, 3 ...). Lyrics are sent only for a translation, or when you switch on "AI may read lyrics" for a request.

Requests go from the app to OpenRouter and from there to the model you picked. **Free models may keep or learn from what they
receive**, and each model's provider has its own retention rules. If a detail of your library is private, do not use the AI on it.
The AI can only ask for the actions shown in the preview; you approve each change and each change can be undone.

## Diagnostics

"Copy diagnostics" in Settings > About puts text on your clipboard. It is never sent by the app. File names and folder paths in it are
replaced with `<path>`, so it is safe to paste into a bug report; read it first anyway.

## Questions

Open an issue at https://github.com/ExhataQ/Xplayer/issues. For anything private, see `SECURITY.md`.
