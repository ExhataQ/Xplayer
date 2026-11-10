# Report: PB-15 Home page as shelves (prototype, not yet in the shell)

**Task:** PB-15 | **Agent:** B | **Date:** 2026-10-21 | **Status:** In review (prototype)

## Summary
The owner chose to start simple and build Home from shelves: horizontal rows with faded edges that can hold playlists, songs, albums or artists, with more shelves added later. I built the shelf component, a registry of shelves, and a read-only bridge. The first shelves are Recently played (songs), Your playlists, Recent albums and Recent artists. A shelf with nothing in it is not drawn; with nothing at all, Home shows an empty state.

## Findings
- The engine already holds everything these shelves need, so there is no engine change: `getRecentlyPlayedSongs()` (`library/03a-recents.js`), `getPlaylists()`, `getAlbums()`, `getArtists()` (each with `cover`) and `getPlayedItemOrder()` (`playlists/03g-pinned-items.js`), which the library panel already uses to sort "Recent". *Read, and reproduced in the running app*
- `collectAllLeftPanelItems()` would also work, but it filters by the panel's own view (chips, search), so Home would change when the person filters the panel. I read the underlying lists instead.
- The scroll-edge fade is a CSS mask. Its widths are registered custom properties (`@property`), which must have `inherits: true` because `.shelf` sets them and `.shelf__row` uses them. I first wrote `false`; the screenshot showed no fade, and the test now pins the fix. *Reproduced*

## Changed files
| File | Change |
|---|---|
| `src/ui-next/views/home/shelf.js` | New: one shelf (title, row, edge fades, arrows) |
| `src/ui-next/views/home/home.js` | New: `SHELVES` registry and `mountHome(host, { shelves, read, open })` |
| `src/ui-next/views/home/home.css` | New: layout, cards, fades (tokens only; reduced motion respected) |
| `src/ui-next/adapter/home-bridge.js` | New, read only: `homeData()` and `openHomeItem(item)`, 36 lines. **Needs DP9 before merge** |
| `tools/tests/ui-next-home.test.js` | New: 5 browser tests |
| `.agent/BOARD.md` | DP5 decided; PB-15 In review; PB-06 correction; new "Requests from B to A" |

## Decisions made or needed
- DP5 decided by the owner (shelves, simple first).
- DP9: line budget for `home-bridge.js` (36 lines).
- Playlist, album and artist cards call the engine's `switchView`; the shell must follow (request to A).

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/ui-next-home.test.js` | 5 tests, 5 pass |
| Fade test against the CSS with `inherits: false` put back | fails (the test pins the fix) |
| `ui-next-phase1-gate`, `ui-next-adapter-api`, `ui-next-tokens`, `ui-next-shell` | 11, 3, 23 and 20 tests pass |
| Screenshots of Home mounted in the real new screen with 400 fake songs and seeded history | Shelves, arrows and fades as designed; no console errors |

## Not run
- Real Electron and Windows. Real cover art (fixture covers are one grey square). Real playlists (the fixture has none, so the playlists shelf was only tested with fake data).
- ESLint and `tools/lint.js` (ESLint is not installed in this sandbox). The full test suite.
- Clicking a card in the real engine to open a playlist, album or artist (the test checks the click handler, not the engine view change).
- Right-to-left titles inside cards (CSS keeps them on the left like the list; not measured).

## Environment
Linux sandbox, Node v22.22.2, Playwright 1.56 with headless Chromium, global Playwright through NODE_PATH, no project `node_modules`.

## Manual checklist for the owner
1. After A wires Home in: start the app and open Home from the rail.
2. Play three songs. Home should show them under Recently played, newest first.
3. Play something from an album and by an artist. They should appear under Recent albums and Recent artists.
4. With more cards than fit, the right edge should fade; scroll or press the arrow and the left edge should fade too; at the end the right fade goes away.
5. Click a playlist card: Library opens on that playlist. Click a song card: it plays.
6. Turn on reduced motion in Windows: the fade should change without animation.

## Open issues and follow-ups
- Future shelves: Recently added, Most played, Liked songs. Each is one entry in `SHELVES`; Most played needs play counts, which `getPlayHistory()` may have (not checked).
- Whether a shelf needs a "Show all" link (not built).
- Card size (148 px) is a first guess.

## Patch
`P1-B-wave1.patch` (PB-11, the PB-06 request, PB-15). Excludes the shell wiring.
