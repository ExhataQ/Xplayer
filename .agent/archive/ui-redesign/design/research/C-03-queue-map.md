# C-03 map: the queue panel (Agent C, 2026-10-17)

Short map, like B-01 gave the song list, so C-03 starts from facts. Everything below was read in `src/js/` and the starred items were also measured in the new shell with the real engine.

## What the engine does

- `updateQueueDisplay()` (`playback/10c`) writes the whole queue as HTML into `#queue-list` every time it runs. It looks the node up by id each call, so the node can be moved anywhere in the page.
- It decides the structure: a "Now Playing" label and row; an "Added to Queue" section for songs added by hand (`source === 'manual'` or `addedManually`); a "Next Songs" section for the rest; the first automatic row gets `next-in-queue`.
- It decides the limits: `queueDisplayLimit` rows, "N more songs" notes, a "Load more" button (`loadMoreQueueItems`) that also pulls more of the shuffle order when shuffle is on.
- Two special states: repeat-one shows the current row plus a "Repeating this song only" card; an empty queue shows a "Queue is empty" card; the end of the queue shows "No more songs in queue".
- Rows come from `renderRightPanelItem` (`ui/04a`): `.queue-item` with cover, `.queue-item-title`, `.queue-item-artist` and a `.more-info` button. Click plays that index (`playFromQueue`), right-click and the button open `rightPanelItemMenu`. The current row's title gets an inline accent color.
- Removing a row is `removeFromQueue(index)`; it also resets the player when the current song is removed and emits `queue:songsChanged`. Events: `queue:changed`, `queue:indexChanged`, `queue:songsChanged`.
- Drag and drop into the queue is styled through `body.dragging-song #queue-list .queue-item` (`css/left-panel.css`), so the id and row class matter for dropping songs onto the queue.

## Measured in the new shell *

With 5 songs queued and `#queue-list` moved into a visible box: 5 `.queue-item` rows, labels "Now Playing" and "Next Songs", and nothing styled: the old `right-panel.css` is not loaded. The `.more-info` button prints the raw text `more_horiz` (the Material Symbols font is not loaded and `legacy-icons.css` maps only Font Awesome). The empty and repeat-one cards use Font Awesome glyphs (`fa-music`, `fa-infinity`, `fa-forward`, `fa-ellipsis-h`).

`toggleRightPanel()` is a small state machine over the old right panel (queue, recents, tags, metadata tabs) and throws without `.queue-toggle-btn` *. It is not needed for a new queue panel, which should never call it.

## Options

| | Build from state (S2) | Reuse the engine's list (S3) |
|---|---|---|
| How | New rows from the adapter's queue and index, actions for play and remove | Move `#queue-list` into a visible panel and restyle `.queue-item` rows through the panel wrapper |
| Keeps | Full control of markup | Manual and automatic sections, display limit, load more, shuffle refill, repeat-one and empty cards, drag and drop onto the queue, row menus, all as the engine has them |
| Costs | Re-implements about 150 lines of rules (sections, limits, shuffle pull) and the row menu, and drag and drop to the queue would need new code | Styling by class names the engine owns; the glyphs need a CSS fix; the markup stays the engine's |
| Risk | Drift from engine behavior | Low: the same bet as the song list |

## Recommendation

**S3.** It follows the song-list decision (PATCH-PLAN: "queue panel likely follows S3 too"), keeps every engine rule, and is mostly CSS in `views/playback/`. What it needs from A:

1. A function in the adapter that moves `#queue-list` into an element C provides (views may not look the id up), for example `mountQueueList(container)`. It must run after the adapter builds the host.
2. `.more-info` glyph: map `more_horiz` to a Lucide `more-horizontal` icon in `adapter/legacy-icons.css` (A's file) or accept C overriding it from `views/playback/` with a wrapper selector.
3. Icons for the empty cards in `legacy-icons.css` (`fa-music`, `fa-infinity`, `fa-forward`, `fa-ellipsis-h`).
4. A decision where the panel lives: a right-hand panel, or a popover opened from a queue button in the player (DIRECTION.md decides; the queue button needs the player part names from `adapter/player-parts.js`, see `proposals/A-player-parts.patch`).

## C-03 tests to write when it starts

Real engine: add two songs by hand and see the "Added to Queue" section; click a row plays it; the menu button opens the row menu; removing the current row resets the player; shuffle plus "Load more" adds rows; repeat-one shows the card; a drag from the song list onto the queue still adds; no raw `more_horiz` text visible; tokens only in the CSS.
