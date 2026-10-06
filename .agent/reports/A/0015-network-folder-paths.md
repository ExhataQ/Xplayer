# Agent A report 0015: network folder paths

Side plan step A-S6 (last open item). Applies on top of: report 0014. No renderer or UI file changes.

## Finding
`song.url` is `'file:///'` plus the path with `/` separators and no percent-encoding (`electron/tag-builder.js`), so the earlier worry about `%20` in song URLs does not apply; the existing code and a new test show spaces, `%` and non-Latin names match correctly.

## Bug fixed
`music-folders.js` collapsed every doubled backslash in a folder path. That also turned the two leading backslashes of a network folder (`\\server\share\Music`) into one, so adding such a folder stored a wrong path and its song count was always 0. New `normalizeFolderPath` keeps exactly two leading backslashes and still collapses doubled ones elsewhere (JSON-escaped paths). Used by `addMusicFolder` and `computeFolderSongCount`.

## Verification
`music-folders.test.js`: 5 tests (new: real url format with spaces, `%`, Persian letters and a network share; network folder add and duplicate check). Full suite.

## Side plan status
A-S1, A-S2, A-S4, A-S5, A-S6 done. Open, needs a decision or a Windows run: A-S3 (song list in its own JSON file needs a build change), `sandbox: true`, one Python process for batched tag saves.
