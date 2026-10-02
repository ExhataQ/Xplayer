# Event bus (00b-events.js) and event catalog

## API

```js
emit(name, detail)        // fire an event; detail is optional
const off = on(name, fn)  // subscribe; fn receives the event, the payload is e.detail
off()                     // unsubscribe (returned by on)
```

There is no separate `off()` function: `on()` returns the unsubscribe function. The bus is a platform `EventTarget` with `CustomEvent`, so it works in the renderer and in plain Node tests.

- `emit` with no detail gives subscribers `e.detail === null` (platform behavior, not `undefined`).
- Handlers run synchronously, in the order they subscribed, before `emit()` returns.
- An error in a handler is reported by the platform but does not stop the emitter or other handlers.
- Load order: `00b-events.js` loads second, so every later file may call `emit`/`on`.

## Rules

1. **Naming:** `subject:verbChanged` in camelCase (`playlist:listChanged`). One event means one thing that happened, not one screen to redraw.
2. **Owner:** the agent whose file emits an event owns its name and payload. Subscribers never rename it. Adding a subscriber needs no one's permission.
3. **Payload:** one plain object, or nothing. Never positional values.
4. **No per-frame events.** Scroll, hover, mouse move and `timeupdate` stay as direct calls.
5. **Subscribers** live in a `04x-<area>-events.js` file (UI) or in the panel file that reacts. One `on(...)` per reaction.
6. **Emitters never call a render function directly** once a subscriber exists for that reaction. Calls inside one subsystem stay normal calls.
7. **Order matters.** If the old code navigated or computed something before refreshing, that step stays before the `emit`.
8. Every converted reaction gets a call-order scenario in `tools/tests/helpers/call-sequence-scenarios.js`, with the expected sequence measured on the unconverted code first.

Known exception to rule 1: `recents:count-changed` is kebab-case. It was named before the rule was written and is kept so recorded sequences and subscribers stay unchanged; rename it in Plan 2. Setter events `queue:changed`, `queue:indexChanged` and `view:changed` (core) have no subscriber yet on purpose.

## Catalog

Data events (emitted by Agent A files, subscribed in `04h`-`04o`):

| Event | Payload | Emitted from | Subscribed in |
|---|---|---|---|
| `recents:added` | `{ song }` | `03e` | `04h` |
| `recents:count-changed` | `{ count }` | `03e` | `04h` |
| `recents:cleared` | none | `03e` | `04h` |
| `history:added` | none | `03e` | `04h` |
| `history:cleared` | none | `03e` | `04h` |
| `pinned:changed` | `{ itemId, itemName, pinned }` | `03g` | `04j` |
| `playedOrder:changed` | `{ listId }` | `03g` | `04j` |
| `folderPin:changed` | `{ folderId, itemId, itemName, pinned }` | `03g` | `04j` |
| `playlist:listChanged` | none | `03c` | `04k` |
| `playlist:deleted` | `{ playlistName }` | `03c` | `04k` |
| `playlist:songCountChanged` | `{ playlistId, count }` | `03c` | `04k` |
| `folder:listChanged` | none | `03h` | `04o` |
| `searchHistory:cleared` | none | `03i` | `04l` |
| `searchHistory:entryDeleted` | `{ sessionId }` | `03i` | `04l` |
| `playbackSetting:changed` | `{ key, value, settings }` | `03f` | `04m` |
| `library:rebuilt` | `{ songs }` | `03j` (`resetLibraryAfterRebuild`, also called by `changeMusicFolder`) | `04i` |
| `covers:scanCompleted` | none | `03k` | `04i` |
| `playlist:songRemovedFromView` | `{ songId, playlistId }` | `09` | `04k` |
| `data:imported` | none | `03l` | `04n` |

State events (emitted by the setters in `core/`, no subscribers yet; for B, C and D to use in Phase 2):

| Event | Payload | Emitted by | Meaning |
|---|---|---|---|
| `queue:changed` | `{ queue }` | `setPlaybackQueue` | the whole queue was replaced |
| `queue:indexChanged` | `{ index }` | `setCurrentQueueIndex` | the position in the queue changed |
| `view:changed` | `{ view }` | `setCurrentView` | the current view name changed |

### Events added after the first release: add rows only in your own section

Agent A events: all in the first table above. A has no direct reaction calls left (`node tools/event-audit.js A`).

Agent B events (playback, selection):

| Event | Payload | Emitted from | Subscribed in |
|---|---|---|---|
| `playback:stateChanged` | `{ playing }` | `15e`, `10d` | `04p` |
| `playback:recentViewChanged` | none | `15d`, `15e` | `04p` |
| `playback:recentPanelChanged` | none | `15e`, `16` | `04p` |
| `shuffle:changed` | `{ isShuffled }` | `15b`, `10b`, `10d` | `04p` |
| `shuffle:listChanged` | `{ isShuffled }` | `15b` | `04p` |
| `repeat:listChanged` | none | `15c` | `04p` |
| `queue:songsChanged` | none | `10c` | `04p` |
| `favorites:changed` | none | `17` | `04p` |
| `songs:changed` | none | `17` | `04p` |
| `viewSongs:changed` | `{ count }` | `17` | `04p` |
| `leftPanelCounts:changed` | none | `17` | `04p` |
| `playlist:songAddedFromMenu` | `{ playlistId }` | `16` | `04p` |

Agent C events (lyrics, panels):

| Event | Payload | Emitted from | Subscribed in |
|---|---|---|---|
| `lyrics:changed` | `{ songId }` (`null` when the change is not about one song: remove-all in `08g`, or no current song in `08b`) | `08b`, `08g`, `11a`, `11b`, `11f`, `18`, `19` | `04t` |
| `search:resultsChanged` | `{ view, songs }` | `08h` (main search box, subhero filter) | `04u` |
| `search:summaryChanged` | `{ query, count, sessionId }` | `08h` (main search box) | `04u` |
| `leftPanelSearch:cleared` | none | `08h` (left panel search box) | `04u` |
| `rightPanel:tabChanged` | `{ tab }` | `08d` `switchRightPanelTab` | `04v` |

`lyrics:changed` means "this song's lyrics, synced variants or display mode changed and the Lyrics view must show it". 14 emitters send it only while the Lyrics view is open (the condition stayed at the call site); the two editor buttons in `18` (`saveLyricsFromEditor`, `clearLyricsForCurrentSong`) send it unconditionally, exactly as they called `renderLyricsView()` before.

`search:resultsChanged` means "the visible song list for `view` is now `songs`" (the list was already filtered; subscribers redraw, then re-apply highlight and selection). `search:summaryChanged` is emitted just before it by the main search box so the hero shows the new query and count first. The `search:summaryChanged` subscriber also calls `updateHeroCover(VIEWS.SEARCH_ITEMS)` right after `setupHeroSection`, as the emitter did. Emitters keep their navigation calls (`pushViewToHistory`, `showTracklistHeader`, `resetLeftPanelActiveState`) as direct calls.

`rightPanel:tabChanged` is emitted for every tab (`queue`, `tags`, `metadata`, `recently-played`) after the header and buttons were updated; the subscriber draws the Recently played list only for that tab. It sits where the old direct call sat, so the order inside `switchRightPanelTab` is unchanged.

Agent D events (UI shell):

| Event | Payload | Emitted from | Subscribed in |
|---|---|---|---|

Known inconsistency: `recents:count-changed` is kebab-case; every other name is camelCase. It stays until a patch renames it together with `04h` and the pinned call-order tests.

## Not events yet (planned, owned by the agent that emits them)

B (playback): `song:changed`, `song:started`, `song:ended`. C (lyrics and panels): lyrics loaded and settings changes. Add them to this file in the same patch that adds the emitter.
