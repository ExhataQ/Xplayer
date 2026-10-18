# UI-B06: finishing B (cover in title bar, compact panel, right-to-left, row behaviors)

Agent: B. Status: In review. Decision: D29. Built on your new source (`Source-backup`), which already had B-03 and B-04; this patch **includes B-05** (list toolbar, kind label, Recently played), which that source did not have.

## What changed and why
- **Cover in the title bar.** The list title bar shows the cover the engine already draws for the list (image or built-in drawing), 64 px, round for artists. It is a copy taken from the hidden heading block through `adapter/listbar-bridge.js` (`listCover`, `onListCoverChange`), with ids removed so the page has no duplicate ids.
- **Compact library panel.** When the panel is collapsed to 72 px it now keeps a cover-only list (it used to hide everything). Names are clipped, not removed, so screen readers still read them. Chips, find and sort hide; the engine's row height is unchanged.
- **Right-to-left text.** Row title, artist and album use `unicode-bidi: plaintext` with `text-align: start`, so a Persian title lines up on the right of its cell and English ones stay left. The list title uses `dir="auto"`.
- **Artists index.** Checked: the engine's "view coming soon" fallback is only reached for unknown view names. In the new shell the Artists index is the Artists chip in the library panel (D9), and opening an artist gives a normal song list (label Artist, round cover, toolbar). No change needed; recorded as D29.
- **Row behaviors checked in the new shell:** click selects, right-click opens the engine's song menu. Both are covered by a test.
- **B-05** (included): toolbar (Play, Shuffle, Find, More), kind label, Recently played rail item, `ellipsis` icon, and the Play button style fix (shell.css loads after components.css and overrode the solid variant). Details in `UI-B05-list-toolbar.md`.
- **Board:** D21 to D29 recorded; B-03 to B-06 In review.

## Tests run
`ui-next-b06-finish` (6 new), `listbar` (7), `songlist` (22), `search` (8), `library` (16, one earlier run had a timing flake that passed on 3 reruns), `shell` (20), `tokens` (23), `phase1-gate` (11), `adapter-api` (3). See the final run in the delivery message for the full suite and lint.

## Not done
- **Row drag and drop:** the engine's song rows have no drag handlers at all, so there is nothing to restyle; reordering is a new feature, not a parity gap. Left as a question for you.
- **Rows inside an opened folder** in the library panel are still the engine's markup, checked only for no errors.
- **Electron/Windows run**, other themes and accents, and a native right-to-left review by a Persian reader.
- Cover colors drawn by the engine (fixed colors in its SVGs) cannot follow the theme without an engine change.

## Manual checklist (`--ui=next`)
1. Open an album, an artist, Liked Songs: the title bar shows the cover (round for artists) and the right label.
2. Collapse the panel with the arrow: a column of covers stays; click one to open it; expand again.
3. Add a song with a Persian title: it sits on the right of its cell; English titles stay on the left.
4. Click a row (it selects); right-click (the song menu opens).
5. Narrow the window: title bar, toolbar and cover do not overlap.
