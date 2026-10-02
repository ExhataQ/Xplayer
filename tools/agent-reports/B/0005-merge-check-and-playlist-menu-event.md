# Agent B report 0005: merge check, `16:42`, EB-B5 follow-up

Patch: `B-0005-merge-check-and-playlist-menu-event.patch`. Applies on top of the merged zip (all four agents). Optional, needs D first: `B-optional-EB-B5-allowlist.patch`.

## Merge check

- All 11 B app files (`04p`, `10b`, `10c`, `10d`, `13`, `15b`, `15c`, `15d`, `15e`, `16`, `17`), `scenarios-b.js` and `events-b.test.js` came through the merge **byte-identical**. `events-b.json` holds the same 45 sequences (only the JSON formatting differs).
- `manifest.json` has `04p-playback-events.js` after `17-song-selection.js`, and the 11 B rows are in `EVENTS.md`.
- **Lost in the merge:** B's entries in `tools/change.log.txt` (the merged log held only A's entry; C's and D's entries are also missing, which I did not restore). B's entries are restored in this patch.
- D's caveat about a duplicated trailing `updateScrollbarById` after a render moved into a subscriber: checked. 17 has none left (they moved into the subscribers with their renders). The only one in B files is `10c:143` (right-panel queue list), which does not follow a converted render.

## New reaction found: `16-context-menu-actions.js:42`

With D's per-call allowlist (D report 0002) `renderPlaylistDetailView` is no longer hidden by name, and the audit showed B at **31**. `addToPlaylistFromMenu()` redraws the open playlist view after a song is added from the context menu. That is a reaction and it is B's (D's report named it as EB-B3).

- Converted to `playlist:songAddedFromMenu { playlistId }` (new, emitted by 16). The "is that playlist open" check moved into the subscriber in `04p`, as in A's `playlist:songRemovedFromView`. The emit sits where the old call was, after the notification.
- The `17:109/115/121` calls D listed were already converted by B-0003: those detail-view redraws now live in the `viewSongs:changed` subscriber in `04p`.
- 3 scenarios added, recorded **on the unconverted merged code first**: playlist open (notification, then redraw), song already in the open playlist (same sequence), another view open (notification only). The 45 old sequences re-checked and unchanged; after conversion all 48 match.
- Sabotage check: removing the redraw from the new subscriber made `events-b` fail. Restored, passes.
- Audit for B: 31 -> **30**.

## EB-B5 (13-song-highlight): decision updated for D, nothing applied

D's allowlist is now per-file, so the entries in the old decision are rewritten. See `0004-EB-B5-highlight-decision.md` (replaced by the revised version). Summary:

- Keep the highlight calls direct. Recommended entries (as `fileExceptions`): `13-song-highlight.js` -> `updateActiveHighlight`, `updateSelectionHighlight`, `updateHoverHighlightAfterScroll`; `17-song-selection.js` -> `updateActiveHighlight`, `updateSelectionHighlight`.
- Simulated on a throwaway copy: B 30 -> **0**; project total 31 -> 1 (the one left is C's `08h-panel-search.js` `updateHeroCover`).
- **D asked B to confirm `14-song-navigation.js` `renderVisibleItems` x3 as `virtualScroll`: confirmed.** In `scrollToSongItem` and `applyScrollToSong` the code scrolls, resets the index fields, forces a render and immediately reads `firstVisibleIndex` / `lastVisibleIndex` back. It is a command that needs the result at once, not a reaction, so it stays a direct call. Side note for Plan 2: these B-file lines write D's `virtualScrollState` fields (ownership, not events).
- `B-optional-EB-B5-allowlist.patch` makes exactly that change to `tools/event-allowlist.json`. It was checked to apply to the merged project. **Apply only after D approves.**

## Not done, on purpose

- **Typeof guards in `13`** (13 redundant `typeof X === 'function'` checks): not touched. They are cleanup, not event-bus work, and `13` is waiting for D's decision. Best done in the same change as EB-B5.
- **Duplicate Recent-panel refresh in `15e`** (B-0001 finding): not touched. Removing it changes a recorded sequence; D also kept the same kind of dedupe out of Plan 1.

## Tests I ran (on the merged project plus this patch)

- `events-b`: 48 scenarios, pass.
- Everything else, run in groups: 12 suites (event-bus, events-a, events-c, events-d, events-wiring, manifest, setters, storage, search-engine, shuffle, recents, playback-settings) 67 tests, 66 pass, 1 skipped (old note in the storage test); 8 suites (metadata-backend, metadata-editor, music-folders, online-metadata, scan-folder-tags, scanner, search-ui, view-switch-song-list-cleanup) 51 pass; `scroll` 15 pass, 1 skipped (built-in, timing-sensitive in sandboxes). 0 failures. These ran before the 16 change; after it I re-ran `events-b`, `manifest`, `events-wiring`, `events-a`, `events-c`, `events-d` and `event-bus` (32 + 48 pass), and `scroll` (15 pass, 1 skipped).
- `node tools/event-audit.js`: A 0, B 30, C 1.
- No browser or Electron run of the app itself.

## Manual test checklist

1. Open a playlist. In All Songs (or another list), right-click a song, "Add to playlist", pick the open playlist. The playlist view shows the new song at once.
2. Add a song that is already in the open playlist. The "already in" warning shows and the view stays correct.
3. Add a song to a playlist while another view is open. The notification shows; the open view does not change; the playlist's song count in the left panel goes up.
