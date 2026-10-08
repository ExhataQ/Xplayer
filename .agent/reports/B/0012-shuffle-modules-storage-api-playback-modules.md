# Agent B report 0012: B-08 shuffle modules, B-09 storage and API swap, B-10 playback modules (partial)

Steps: B-08, B-09, B-10 (all but `14-song-navigation.js`, see Not done). Applies on top of: the state `Xplayer-main_2.zip` was sent in (A reports up to 0016, D 0009, C 0010).
Archive (.agent/AGENTS.md section 1): not done, no access to `E:\Backup`; a full copy of the project was taken in the workspace before the first edit, which is not the archive.
If `src/js/10a0-shuffle-state.js` is already in your tree untracked, delete it before `git apply` (the patch adds it with the same content).
One patch for the three steps: they share `manifest.json`, `converted-modules.test.js` and the change log.

## Changes

- `10a-playback-shuffle.js`, `10b-playback-smart-shuffle.js`: ES modules, registered with `registerLegacyGlobals`; `10b` imports from `10a`. `createShuffleOrder(songs, excludeSongId, isDeleted)` and `generateSmartShuffleJourney(songs, excludeSongId, sourceId, deps)` take optional dependencies; defaults read the same globals as before.
- `10a0-shuffle-state.js` (the untracked file already in the zip, now used): the 7 shuffle variables, classic, because core/state-playback-modes.js assigns them by bare name.
- `15a0-controls-state.js` (new, classic): `showRemainingTime` and `wasPlaying`, assigned by core/state-now-playing.js.
- `10c`, `10d`, `13`, `15a` to `15g`, `16`, `17`: ES modules. Every function used by another file, an inline handler or a test is `export`ed and registered; the rest stay private. `15c` and `15d` have no function, so they carry an empty `export {}`.
- `15e`, `16` (B-09): `window.electronAPI` and `localStorage` replaced by `desktopApi`, `getPlayHistory` and `storageWriteJson`. `16` now reads history through `getPlayHistory()` (repairs bad stored data instead of throwing).
- `src/manifest.json`: 10a0 and 15a0 added to `js`; the files above moved to `modules`.
- Tests: `shuffle.test.js` imports the modules (6 tests, one new: deleted songs); `converted-modules.test.js` lists the new names; the "not yet" lists in `desktop-api.test.js` and `storage-core.test.js` are empty; new `playback-modules.test.js` (6 real-browser tests); recorded sequences lost entries that are now calls inside one module (below).
- `tools/test-shuffle/shuffle-test.html`: loads the module (needs a local web server).
- `tools/change.log.txt`: one entry per step.

## Behavior notes

- Calls inside one module are invisible to spies. Two recorded sequences lost one entry each, nothing else: `refreshCurrentViewAfterMutation` in `expected/events-b.json` (favorites scenario, called by `toggleFavorite` in 17) and `clearGaplessPreload` in `events-wiring.test.js` (gapless scenario, called by `prepareGaplessNextTrack` in 10c). I checked both in the code.
- The thumbar and window-maximize callbacks of 15e now wait for start-up (desktopApi does this).
- Modules run after every classic script, so B's button wiring now runs after `04p` to `04v` and `ui/player-bar.js`. No two files wire the same element, and the tests show the same behavior.

## Numbers

`node tools/dep-map.js` before and after: mutable globals written from other files **52 -> 54** (`shuffleOrder` and `shuffleSourceId` are now assigned by `10a`, a module, while declared in `10a0`), file-level cycles **75 -> 74**, load-time cross-file references **28 -> 29** (forward 0 -> 0; the new one is 15e reading `desktopApi` while it loads, and `desktopApi` is loaded first).
`node tools/event-audit.js --strict`: exit 0, 0 / 0 / 0, 70 allowed.

## Tests actually run

- Full set, `node --test tools/tests/*.test.js`: **295 tests, 293 pass, 0 fail, 2 skipped** (the two old skips). A first run failed 2 tests, the two sequences above.
- ESLint (scratch install, not in the patch) on the 13 converted files as strict modules: no undefined names, no stray `this`, no implicit globals.
- Deliberate break: unregistering `toggleMute` fails `playback-modules.test.js`.
- Not run: the Electron app; the manual checks below.

## Needs from other agents

- A: `ui/player-bar.js` passes `navigateToCurrentSongInList` and `navigateToCurrentArtist` to `addEventListener` while it loads, so `14-song-navigation.js` cannot be a module until that file becomes a module or wraps them in arrow functions. Needed before A-16.
- A: `core/SETTERS.md` owner column (shuffle variables are in `10a0`, `showRemainingTime` and `wasPlaying` in `15a0`); `core/STORAGE.md` still lists `16` as using `localStorage`; setters for `shuffleOrder` and `shuffleSourceId` so `10a` stops assigning them.
- D: `10c` still builds `onclick` strings for `renderRightPanelItem` (report 0010); unchanged.

## Not done

- `14-song-navigation.js` stays classic (above), so B-10 is not complete and A-16 cannot start.
- The 9 JS property handlers (`shuffleButton.onclick` and similar) are unchanged.

## For you (manual checks)

1. Start the app, play a song, press Next, Previous, Pause -> each works; thumbnail-bar buttons (prev, play/pause, next) work and the play icon follows the state.
2. Shuffle button -> Normal Shuffle, then Smart Shuffle on a list over 50 songs -> songs play in shuffled order; "Turn Shuffle Off" works.
3. With shuffle on, click Repeat twice -> states cycle off, all, one.
4. Click the elapsed-time text -> it switches to remaining time and back; drag the volume slider and press mute -> volume changes and restores.
5. Right-click a song -> Show in folder opens Explorer; Delete song moves the file to the Recycle Bin; in History right-click -> delete entry removes it.
6. Queue panel -> Load more; maximize and restore the window -> the maximize icon follows.

## Next step

A: player-bar change, then B converts `14` (one line in the manifest plus exports). Then A-16 can proceed.
