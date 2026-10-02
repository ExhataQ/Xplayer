# Agent B report 0001: EB-B1 and EB-B2

Patch: `B-0001-audio-shuffle-repeat-events.patch`. Applies on top of the current zip.

## Done

- **EB-B1** `15e-controls-audio-events.js` (6 calls). **EB-B2** `15b`, `15c`, `15d`, `10b` (11 calls). 17 reaction calls converted, 0 left in these five files.
- New subscriber file `src/js/04p-playback-events.js`, inserted in `src/manifest.json` right after `17-song-selection.js`. The DOM code moved verbatim.
- 16 scenarios in `helpers/scenarios-b.js`, recorded into `expected/events-b.json` **on the unconverted code first**. After the conversion the suite reproduces every sequence exactly: no call added, removed or reordered.

## Events added (rows are in `EVENTS.md`, Agent B section)

| Event | Payload | Replaces |
|---|---|---|
| `playback:stateChanged` | `{ playing }` | `updateSubheroPlayButton` x3 in 15e (play/pause sync, and the two "queue ended" branches, which pass `isCurrentViewPlaying()` evaluated at the same point as before) |
| `playback:recentViewChanged` | none | `renderRecentlyPlayed` in 15e (repeat one) and 15d (next, repeat one); the `currentView === VIEWS.RECENT` check moved into the subscriber |
| `playback:recentPanelChanged` | none | `renderPortableRecentlyPlayed` x2 in 15e; the "panel is open" check moved into the subscriber |
| `shuffle:changed` | `{ isShuffled }` | `updateSubheroShuffleButton` in 15b and 10b |
| `shuffle:listChanged` | `{ isShuffled }` | the 2 list-redraw chains in 15b (repeat one active). The Recent branch runs only when `isShuffled` is false, exactly as the old code |
| `repeat:listChanged` | none | the list-redraw chain in 15c (shuffled) |

Emit sites are at the position of the old call and handlers run synchronously, so ordering relative to the surrounding code is unchanged.

## Tests I ran

- `events-b` (16 scenarios): passes after conversion. Baseline recorded before touching app code.
- Sabotage check, done twice: removing `updateSubheroShuffleButton()` from the subscriber, and removing `renderPortableRecentlyPlayed()`. Both made `events-b` fail. Restored, passes again.
- `events-b`, `manifest`, `events-wiring`, `shuffle`: 29 tests, 29 pass.
- `node tools/event-audit.js B`: 81 -> 64.
- I did not run the other browser suites (`scroll`, `search-ui`, `view-switch-song-list-cleanup`, etc.); this patch does not touch what they cover.

Headless limits: there is no real audio. Scenarios that reach `audioElement.play()` stub it in `setup`. The "shuffled queue exhausted" scenario stubs `getNextShuffledSong` to return null, and the smart-shuffle scenario stubs `getSongsForList` (60 songs) and `playCurrentViewFromStart`. The test app has only 20 songs, so these stubs are the only way to reach those branches.

## Findings

- **Duplicate refresh, not removed.** In `audio.onended` with repeat one, the recorded sequence is `renderPortableRecentlyPlayed, renderRecentlyPlayed, renderPortableRecentlyPlayed`. The first one comes from `saveToRecentlyPlayed` through `recents:added` (04h); the last is 15e's own call. Removing the last is a pure removal. I kept it because I could not rule out the case where the save is skipped (queue item missing) while the refresh still runs. D (EB-D3) or a later B patch can decide.
- `recents:added` redraws only the portable panel, never the Recent view. That is why 15d and 15e still need `playback:recentViewChanged`.
- The old shuffle-on branch (repeat one) never redrew the Recent view while shuffle-off did. Kept as is.
- No allowlist changes were needed.

## Not done / next

- `10d-playback-song.js` has `updateSubheroShuffleButton` (can reuse `shuffle:changed`) and `updateSubheroPlayButton` (`playback:stateChanged`): EB-B3.
- EB-B3 (10c, 10d, 16), EB-B4 (17) and the EB-B5 decision on 13-song-highlight are still open.
- The archive step from AGENTS.md (E:\ paths) was not possible in my environment; a pristine copy of the zip contents was used to build the diff instead. Please archive on your side before applying.

## Manual test checklist

1. Start the app, play a song, press pause then play in the player bar. The subhero play/pause button must follow each press.
2. Open a playlist, play it, let the last song finish with repeat off. The player bar resets to "No song selected" and the subhero shows Play.
3. Turn shuffle on and off from the shuffle dialog (Normal Shuffle / Turn Shuffle Off). The subhero shuffle button highlights and clears.
4. Set repeat to repeat one, then toggle shuffle in All Songs view, in the Recent view, and in a search result. The visible list must redraw each time (no stale playing marker).
5. With shuffle on, click the repeat button a few times in All Songs, Recent and Search. The list redraws as before.
6. Open the Recent view and the right-panel Recently Played tab. With repeat one, press Next, and let a song end. The Recent view and the panel show the replayed song at the top.
7. Use Smart Shuffle on a list with more than 50 songs. The subhero shuffle button shows "Smart Shuffle is on".
