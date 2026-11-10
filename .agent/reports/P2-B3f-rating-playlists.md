# Report: B3 Rating system, slice 3 (the playlists Top rated and Not rated, and the rating in Show metadata)

**Task:** B3 (POLISH-PLAN.md) | **Agent:** B | **Date:** 2026-11-09 | **Status:** In review. Not seen in the app (no browser here).

## What works after this patch (only while Settings > Library > Rating system is on)
- **Two real playlists, kept up to date by themselves:** **Top rated** (4 stars and up, best first) and **Not rated** (songs with no rating, in library order). They show on Home under "Your playlists" and in the left panel, play with their own queue, sort (including by Rating), and can be pinned, like any playlist.
- **They follow the ratings:** a moment after a rating changes (600 ms, so a run of clicks makes one update), the playlists are brought up to date; the number of songs in the left panel follows, and **if the playlist is open its rows are drawn again**, so the rows on screen and the clicks agree (a song you rate down leaves Top rated). Turning the system on or off updates them at once, and they are made when the app starts and after a library rebuild or a restore.
- **Created only when they would hold a song**, so you do not get an empty Top rated on day one; once they exist they are kept even when they go empty (a list you have open does not vanish under you). **Turning the Rating system off removes both** (and, if one is open, the app goes to All songs first). Your ratings stay saved; turning it on again makes them again.
- **They are not yours to edit by hand:** songs cannot be added (the Add to playlist menu and picker do not list them, a dropped song or file is refused, the left panel does not light up as a drop target), cannot be removed from them (the menu item is not offered), and Delete says "Top rated follows your ratings. Turn the Rating system off to remove it." Renaming is allowed.
- **Show metadata** (the song's metadata window, which already has selectable text and a Copy button on every value): a **Rating** row while the system is on ("3.5 stars", or a dash when not rated), with its Copy button.
- The Settings text says it: "...with the playlists Top rated and Not rated kept for you. Off hides all of it and removes those two playlists."

## How, and a decision I made (say if you want it different)
The plan said "Home: the playlists Top rated and Not rated". Home only shows what the engine knows as a list, and the engine's list kinds (Favorites, History, ...) are each wired into about twenty places (queue, highlight, navigation, drag and drop), so adding two more of those blind was too risky. The engine **already has everything a list needs for a playlist**, so these are real playlists marked `smart` and maintained by `library/03i-rating-playlists.js`. The rules (what goes in, when to create, when to remove) are pure, in `library/rating-rules.js` (`planRatingPlaylists`), with tests. The price: they appear in the left panel's playlists too, and they are in backups (harmless: they are rebuilt from the ratings).
**If you would rather have them only on Home**, as shelves of songs, or hidden from the left panel, tell me; the first is a few lines, but it plays songs from the whole library, not from the list.

## Changed files
| File | Change |
|---|---|
| `src/js/library/rating-rules.js` | `RATING_PLAYLISTS`, `isRatingPlaylist`, `planRatingPlaylists` (pure). |
| `src/js/library/03i-rating-playlists.js`, `src/js/main.js` | New: reads, saves, tells the lists, redraws the open one; the triggers. |
| `src/js/playlists/03c-playlists.js`, `library/import-dropped.js`, `ui/06l-drop-rules.js` | No add, remove, delete or drop on a rating playlist. |
| `src/js/ui/06a-context-menus.js`, `src/ui-next/adapter/playlist-picker-bridge.js` | Not listed in Add to playlist (old submenu and the picker); no Remove from playlist inside them. |
| `src/js/ui/06b-modals.js` | The Rating row of Show metadata. |
| `src/ui-next/views/library/rating-settings.js` | Text. |
| `tools/tests/rating-rules.test.js` (+5), `rating-playlists.test.js` (new, 5) | Tests. |
| (none) | The generated tables in the archive are left as they were. |

## Checks
| Step | Result |
|---|---|
| The two test files | 21 pass |
| `node tools/tests/run.js unit`, compared with the zip you sent | same failures, none new (944 pass) |
| The app, the browser tests, lint | **not run** (no browser, no ESLint here) |

## Needs the owner (to look at)
1. Turn the Rating system on, rate a few songs 4 or more: after a moment **Top rated** appears (Home > Your playlists, and the left panel), and **Not rated** holds the rest. Open Top rated and rate a song down to 2: it leaves the list at once and the rows stay right.
2. Drag a song onto Top rated: it takes no drop. Right-click a song > Add to playlist: neither is listed. Right-click Top rated > Delete: the message.
3. Turn the system off: both playlists are gone (from Home and the left panel); on again: back.
4. Show metadata on a song: a Rating row.
5. Do you want the two playlists in the left panel too, or only on Home?

## What is left of B3
Writing ratings into the file tags (needs the format check with real files; the plan's "Write ratings into file tags" switch comes with it), and keyboard use of the stars in the list. The stars in the metadata editor (the edit sheet) belong with the tag writing, because editing a rating there is a tag write.

## Patch
`P2-B3f-rating-playlists.patch`, made against `Source-backup (19)`.
