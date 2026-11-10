# Report: B3 Rating system, slice 2a (the stars control, the song menu, the right panel)

**Task:** B3 (POLISH-PLAN.md) | **Agent:** B | **Date:** 2026-11-05 | **Status:** Slice 2a in review. Slice 2 is not finished (see below).

## What works after this patch (only while Settings > Library > Rating system is on)
- **Song menu, Rate:** a submenu like the others (opens on hover): 5 stars down to 1 star, a check on the rating all the chosen songs share, and **Remove rating** when any of them has one. It rates the whole selection when several songs are selected (one message: "Rated 3 songs 4 stars"), otherwise the clicked song ("Rated "Title" 4 stars").
- **Right panel:** a row of five stars under the cover, for the song that plays. Click a star to set it, click the star that is the rating to clear it; the keyboard works too (Left/Right/Up/Down, Home, End, Delete). It follows the song, the setting, and ratings set anywhere else.
- **The stars control** (`components/stars.js`, exported from the components index): five radio buttons, one tab stop, a hover preview, accessible names ("3 stars"). A state changes colour and fill only, never the size (the B8 rule; the size guard test covers its style). New `star` icon in `icons/custom-icons.js`, and the menu icon `fa-star` in the generator `tools/icons/build-context-menu-icons.mjs` (the generated css regrown: 3 lines).
- Off means none of this shows (no Rate item, no stars row).

## Not done yet (the rest of slice 2)
- **The song list column** of stars and its entry in the columns menu: the rows are the engine's, so this touches the row markup, the grid layout and the header together. I did not want to do that without being able to see it, so it needs its own careful step.
- **Song details** (the metadata sheet): the stars there.
- **Home playlists Top rated and Not rated:** the rule is written and tested (`ratingPlaylist` in `library/rating-rules.js`: 4 stars and up best first; no rating), but a Home playlist needs a new kind of list in the engine's views.
- The player bar (the heart sits there): I put the stars in the right panel instead of crowding the bar; say if you want them in the bar too.

## Changed files
| File | Change |
|---|---|
| `src/ui-next/components/stars.js`, `components.css`, `index.js` | The stars control and its style; export. |
| `src/ui-next/icons/custom-icons.js` | `star`. |
| `src/ui-next/views/playback/now-playing-rating.js`, `right-panel-content.js`, `player-bar.css` | The stars row under the cover (two lines added to the panel file; its layout line is untouched). |
| `src/ui-next/adapter/ratings-bridge.js` | `ratingSystemOn`, `ratingOfSong`, `rateSong` (plan budget stays under 700). |
| `src/js/ui/06a-context-menus.js`, `16-context-menu-actions.js` | The Rate submenu; `setRatingFromMenu`. |
| `src/js/library/03h-ratings.js` | `ratingOfId`. |
| `tools/icons/build-context-menu-icons.mjs`, `src/ui-next/adapter/context-menu-icons.css` | The star in menus (generated). |
| `tools/tests/rating-menu.test.js` | 8 new unit tests (the menu action with one song, several, outside the selection, remove; the menu builder; the stars control; the right panel wiring). |

## Checks
| Step | Result |
|---|---|
| `node --test tools/tests/rating-menu.test.js` | 8 pass |
| `node tools/tests/run.js unit`, compared with the zip you sent | same failures, none new (two existing tests failed on my first try, the menu icon list and the right panel layout line, and are fixed in the code, not in the tests) |
| Size guard (`states-keep-size`) | passes with the stars style |
| The app, browser tests, lint | **not run** (no browser, no ESLint here) |

## Needs the owner
1. Turn the Rating system on, play a song: stars under the cover in the right panel; set and clear them with the mouse and the keyboard.
2. Right-click a song: Rate opens on hover with five rows; try it with several songs selected.
3. Do the stars look right (size, colour, spacing)? I could only read the style.
4. For the list column: do you want it as its own column (like Time) with a header, or smaller, inside the song title cell?

## Patch
`P2-B3b-rating-stars.patch`, on top of `P2-B3a-rating-core.patch`.
