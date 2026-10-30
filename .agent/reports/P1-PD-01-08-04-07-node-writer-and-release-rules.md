# PD-01, PD-08, PD-04, PD-07: Node tag writer, real-file tests, release rules in the UI, rail check

Session of 2026-10-26. Agent D. Built in a copy of `Source-backup.zip`; the zip itself is the backup (the E: archive could not be made from here).

## What could and could not be checked here

No network, no `mutagen`, no `node-taglib-sharp`, no `music-metadata`, no Playwright browser. So:

- **Run and passing here:** all new unit tests (rules, backend safety net, backend choice, popularity, finder, release annotation, rail order), plus the existing related suites. Every new test group was mutation-checked (a deliberate bug in the code makes a test fail).
- **Never run here:** anything that needs the real library or mutagen (`tag-parity.test.js`: 31 tests, all skipped here), and the browser tests for the screens I touched.
- **Not in the unit group's pass count:** the six failures in `run.js unit` are the baseline ones already on the board (`cancel-running-work` x2, and the files that need `acorn`/ESLint). None involve these files.

## DP7: decided

`node-taglib-sharp` behind the existing tag service. Sources checked by web search: pure TypeScript, reads and writes MP3, FLAC, OGG, Opus, M4A, WMA, WAV, AIFF and APE, version 6.0.1. Not checked: install and run, and the licence (TagLib# is LGPL; confirm). `music-metadata` stays what it is, a reader.

## PD-01: the Node writer

| File | Job |
|---|---|
| `electron/tag-rules.js` | The rules of `metadata-editor.py` in Node, on a small model of one file's tags. No library, no files. |
| `electron/tag-lib-adapter.js` | The only code that touches the library. Anything unexpected becomes `unsupported`. |
| `electron/tag-node-backend.js` | Copy the file, write, **read it back from disk**, check the edited tags and that every other tag, the other-tags list and the cover are unchanged, otherwise put the copy back. |
| `electron/tag-backend.js` | `auto` (default): Node, then Python on `no-library`, `unsupported`, `verify-failed` or `failed`. `node` and `python` use one only. `XPLAYER_TAG_BACKEND` picks. |
| `electron/metadata-editor.js` | Exports the same three functions, now through the choice above. `main.js` and `tag-service.js` did not change. |

Behaviour today, before anything is installed: the package is missing, Node answers `no-library`, Python does the work, nothing changes for the person.

Handled by Node: MP3, WAV, AIFF (ID3 v2.4), FLAC, OGG, Opus. Everything else (M4A, WMA, APE, WavPack) goes to Python, which is how those files behaved before.

**To finish (owner):**

1. `npm install node-taglib-sharp` (updates `package.json` and the lock file; I did not edit them because `npm ci` fails when they disagree).
2. `python -m pip install mutagen`, then `XPLAYER_REQUIRE_REAL_TAGS=1 node --test tools/tests/tag-parity.test.js`.
3. Send me the failures. The adapter is the likely place: it was written from the documented API and may need small fixes. The verify step means a wrong guess rolls the file back and falls back to Python rather than damaging it.
4. When parity passes on Linux and Windows CI, Python can be removed (a later step; not done).

## PD-08

`tools/tests/tag-parity.test.js`, fixtures in `tools/tests/fixtures/audio` (checked with `ffprobe`: they decode and carry the expected tags), generator `tools/make-tag-fixtures.js`. Tests: read, save and read back (also with `music-metadata`), audio length unchanged (`ffprobe`), clearing a tag, cover, read parity and save parity against the Python backend, a non-audio file left untouched, the service end to end. CI job `real-tags` on Linux and Windows with `XPLAYER_REQUIRE_REAL_TAGS=1`. It fails until step 1 above is done, on purpose.

## PD-04

- **Sources verified (docs):** MusicBrainz release `status`; release-group `primary-type` and `secondary-types`; recording search can be filtered by `status`, `primarytype`, `secondarytype`. ListenBrainz `POST /1/popularity/release-group` with `{ "release_group_mbids": [...] }` answers `[{ release_group_mbid, total_listen_count, total_user_count }]`, null for unknown groups (a third-party listing used the key `_mbids`; the official page says `release_group_mbids`, which the code uses).
- **Not verified:** a live call of either service; that a *recording search* answer includes `release-group` inside each release. `online-metadata.js` now keeps `releaseGroupId`, `status`, `primaryType`, `secondaryTypes` there when present.
- **Wired:** tag sheet "Original album / Most popular album" choice; `main.js` accepts `popular`; `popular` asks ListenBrainz once per song and falls back to the original rule, saying so in the finding's reasons; the single-song editor marks the ranked release (and "Likely original (NN%)" on release-scope rows) instead of the earliest date.
- **Needs the owner:** `electron/user-agent.js` still has the placeholder contact address that was already in `online-metadata.js`. MusicBrainz and ListenBrainz ask for a real one and may block clients without it.
- **Changed on purpose:** `find-tags-ipc.test.js` used to assert that `rule: 'popular'` is refused; it now refuses an unknown rule and tests `popular`.
- **Not tested:** the editor and tag-sheet screens in a browser.

## PD-07

Already built (rail order is `Home, Library, Search, Recent, Lyrics, Metadata, Settings`, with the last three in the bottom group). Added `tools/tests/ui-next-rail-order.test.js` (static, no browser) so the order cannot slip.

## Unblocks

PB-09 (highlight the original release) can use `annotateSearch` in `electron/release-rank.js`; the editor already does.
