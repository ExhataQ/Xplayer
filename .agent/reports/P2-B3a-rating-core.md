# Report: B3 Rating system, slice 1 (the core)

**Task:** B3 (POLISH-PLAN.md) | **Agent:** B | **Date:** 2026-11-05 | **Status:** Slice 1 of 3 in review. Not finished: no stars are shown anywhere yet.

## Slices
1. **This patch:** the rules, the saved ratings, the settings (Rating system, off by default), Smart Shuffle weight, backup and restore. Nothing visible except the Settings section.
2. Next: stars in the song list (a column), the song menu, the player and the song details; Home playlists Top rated and Not rated.
3. After: writing ratings into the file tags (needs the format check with real files; see "Not done").

## What works after this patch
- **Settings > Library > Rating system** (new section, after the folders): one switch, **off by default**. While it is on, a second switch **Smart Shuffle uses ratings** (on). Off means nothing uses ratings; the ratings already saved are kept.
- **Saved ratings** (`library/03h-ratings.js`): whole stars 1 to 5 per song id, like favorites; clearing is 0. `ratings:changed` and `ratingSettings:changed` are announced (both added to the adapter's event list). A rating set in another player shows too: the library scan already reads the tag rating, and the stars shown are the saved one, else the one from the tag.
- **Smart Shuffle** (`playback/10b`): when it picks songs from an artist it now takes them in a weighted random order: 5 stars 2.4, 4 stars 1.6, 3 stars and no rating 1, 2 stars 0.65, 1 star 0.35. No rating is neutral, never bad, and even a 1-star song still comes up. With the system or the switch off the order is the plain random one as before, byte for byte.
- **Backup and restore** (`library/03l`): ratings are in the export file (only when there are any, so older backups keep their shape); import merges (what is rated here stays) or replaces.
- `library/rating-rules.js` is the pure part (what counts as a rating, tag text to stars, labels, the weight, weighted order, the Home playlist rules `ratingPlaylist('top-rated' | 'not-rated', ...)`, the settings check); it already holds the rules slice 2 needs.

## Decisions I made (say if you want them different)
1. **Whole stars, 1 to 5** (no half stars). 0 is "not rated".
2. **Top rated = 4 stars and up**, best first.
3. **The weights above.** They nudge, they do not rule. Easy to change in one list in `rating-rules.js`.
4. **The third switch, Write ratings into file tags, is not shown yet.** It is saved in the settings (default on) but a switch that does nothing would be a lie; it appears with slice 3.
5. The section sits in the Library group, after the music folders and the download location.

## Changed files
| File | Change |
|---|---|
| `src/js/library/rating-rules.js`, `03h-ratings.js` | New (see above). |
| `src/js/main.js`, `core/00-state.js` | The two files imported in order; keys RATINGS and RATING_SETTINGS. |
| `src/js/playback/10b-playback-smart-shuffle.js` | The per-artist pick asks `songsInShuffleOrder` (falls back to the old random sort if the function is missing). |
| `src/js/library/03l-import-export.js` | Ratings in export, merge, replace. |
| `src/ui-next/adapter/ratings-bridge.js`, `adapter/engine-api.js` | New bridge (3 code lines of the plan budget: 605 of 700); two events allowed. |
| `src/ui-next/views/library/rating-settings.js`, `shell/appearance-settings.js`, `shell/settings-layout.js` | The Settings section and its place in the Library group. |
| `tools/tests/rating-rules.test.js` (9), `ratings-store.test.js` (7) | New unit tests. |
| `tools/tests/ui-next-settings-layout.test.js` | The Library tab now lists `Rating system` too. **A browser test: not run here.** |

## Checks
| Step | Result |
|---|---|
| `node --test tools/tests/rating-rules.test.js tools/tests/ratings-store.test.js tools/tests/shuffle.test.js` | 29 pass (the shuffle test failed once while I wrote this, and is fixed in the code, not in the test) |
| `node tools/tests/run.js unit`, compared with the zip you sent | same failures, none new |
| Adapter budget | 605 of 700 |
| Browser tests, lint, the app | **not run** (no browser, no ESLint here) |

## Not done, and why
- **Stars anywhere**: slice 2.
- **Tags**: the plan's first step is to check with real files which formats keep a rating and how other players read it. The tag package (`node-taglib-sharp`) is not installed in my environment, so I cannot run the real round trip here. For slice 3 I will write a script like the measuring tool: it writes a rating into each of the fixture files (mp3, flac, ogg, opus, m4a) with the app's own tag service, reads it back, and prints a table for you to run; only the formats that round-trip get the write. Tell me if you would rather send me files rated in another player.
- The stars read from tags assume the scan gives the rating as 0 to 1 (music-metadata's normalized value); that is not yet checked against real files.

## Needs the owner
1. Whole stars, Top rated at 4 and up, and the weights: right, or different?
2. In the running app: Settings > Library shows the Rating system section; turning it on shows the second switch; the settings survive a restart. (Nothing else changes yet.)

## Patch
`P2-B3a-rating-core.patch`, made against `Source-backup (16)`.
