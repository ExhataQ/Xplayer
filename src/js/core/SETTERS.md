# Setters (core/state-*.js)

One setter per global that another file used to assign directly. The variable stays declared in its original file (the UI variables that D's files used to declare are in `ui/04a0-ui-state.js`); the setter assigns it (and, for three of them, emits an event).

**Rules**

1. To change one of these variables from outside its own file, call its setter. Reading it directly is still fine.
2. The setter is the only place that may announce the change. Do not `emit` the same event next to the call.
3. State that changes on every mouse move or frame (`state-ui.js`) never emits.
4. A setter replaces the whole value. In-place changes (`playbackQueue.push(x)`) are not writes and stay as they are; if they need to be announced, call `setPlaybackQueue(playbackQueue)` afterwards.
5. Writing the variable directly from a file that does not declare it is now a bug. `node tools/dep-map.js writers <name>` lists the offenders.

`tools/tests/setters.test.js` fails if a setter wraps a variable that is not a top-level `let`, or if the three emitting setters stop emitting.

Files that still write these variables directly (for B, C and D to replace in their own steps) are in the last column. Only `03j` writing its own `selectedLibraryFolders` remains in A's files.


## core/state-queue.js

| Setter | Variable | Declared in | Emits | Still written directly from |
|---|---|---|---|---|
| `setPlaybackQueue(value)` | `playbackQueue` | `core/00-state.js` | `queue:changed` | 06k, 10c, 10d, 15b, 15c, core/state-queue.js |
| `setCurrentQueueIndex(value)` | `currentQueueIndex` | `core/00-state.js` | `queue:indexChanged` | 06b, 06k, 10c, 10d, 15b, 15c, 15e, core/state-queue.js |
| `setQueueDisplayLimit(value)` | `queueDisplayLimit` | `playback/15a0-controls-state.js` | - | 10c, 10d, core/state-queue.js |

## core/state-playback-modes.js

| Setter | Variable | Declared in | Emits | Still written directly from |
|---|---|---|---|---|
| `setIsShuffled(value)` | `isShuffled` | `core/00-state.js` | - | 10b, 10d, 15b, core/state-playback-modes.js |
| `setShuffleMode(value)` | `shuffleMode` | `core/00-state.js` | - | 10b, 10d, 15b, core/state-playback-modes.js |
| `setRepeatMode(value)` | `repeatMode` | `core/00-state.js` | - | 15b, 15c, core/state-playback-modes.js |
| `setRepeatFunctionalityActive(value)` | `repeatFunctionalityActive` | `playback/15a0-controls-state.js` | - | 15b, 15c, core/state-playback-modes.js |
| `setRepeatVisualState(value)` | `repeatVisualState` | `playback/15a0-controls-state.js` | - | 15b, 15c, core/state-playback-modes.js |
| `setSmartShuffleSourceId(value)` | `smartShuffleSourceId` | `playback/10a0-shuffle-state.js` | - | 10a, core/state-playback-modes.js |
| `setSmartShufflePreviousSong(value)` | `smartShufflePreviousSong` | `playback/10a0-shuffle-state.js` | - | 10a, core/state-playback-modes.js |
| `setSmartShuffleJourney(value)` | `smartShuffleJourney` | `playback/10a0-shuffle-state.js` | - | 10a, core/state-playback-modes.js |
| `setSmartShuffleJourneyIndex(value)` | `smartShuffleJourneyIndex` | `playback/10a0-shuffle-state.js` | - | 10a, core/state-playback-modes.js |
| `setShuffleIndex(value)` | `shuffleIndex` | `playback/10a0-shuffle-state.js` | - | 10a, core/state-playback-modes.js |
| `setShuffleOrder(value)` | `shuffleOrder` | `playback/10a0-shuffle-state.js` | - | 10a, core/state-playback-modes.js |
| `setShuffleSourceId(value)` | `shuffleSourceId` | `playback/10a0-shuffle-state.js` | - | 10a, core/state-playback-modes.js |

## core/state-now-playing.js

| Setter | Variable | Declared in | Emits | Still written directly from |
|---|---|---|---|---|
| `setLastPlayedSong(value)` | `lastPlayedSong` | `core/00-state.js` | - | 15d, 15e, core/state-now-playing.js |
| `setLastPlayedSongStartTime(value)` | `lastPlayedSongStartTime` | `core/00-state.js` | - | 15d, 15e, core/state-now-playing.js |
| `setIsManualPlay(value)` | `isManualPlay` | `core/00-state.js` | - | 07, 10d, 15d, core/state-now-playing.js |
| `setIsPrevNavigation(value)` | `isPrevNavigation` | `core/00-state.js` | - | 07, 10d, core/state-now-playing.js |
| `setLastPlaybackListId(value)` | `lastPlaybackListId` | `core/00-state.js` | - | 10d, core/state-now-playing.js |
| `setWasPlaying(value)` | `wasPlaying` | `playback/15a0-controls-state.js` | - | core/state-now-playing.js |
| `setShowRemainingTime(value)` | `showRemainingTime` | `playback/15a0-controls-state.js` | - | core/state-now-playing.js |
| `setAudioElement(value)` | `audioElement` | `core/00-state.js` | - | 10c, core/state-now-playing.js |
| `setGaplessAudioElement(value)` | `gaplessAudioElement` | `playback/15a0-controls-state.js` | - | 10c, core/state-now-playing.js |
| `setGaplessActiveElement(value)` | `gaplessActiveElement` | `playback/15a0-controls-state.js` | - | 10c, core/state-now-playing.js |

## core/state-navigation.js

| Setter | Variable | Declared in | Emits | Still written directly from |
|---|---|---|---|---|
| `setCurrentView(value)` | `currentView` | `core/00-state.js` | `view:changed` | 07, 08e, 08h, core/state-navigation.js |
| `setSearchQuery(value)` | `searchQuery` | `core/00-state.js` | - | 07, 08h, 14, core/state-navigation.js |
| `setHistoryNavigationIndex(value)` | `historyNavigationIndex` | `core/00-state.js` | - | 07, 15e, core/state-navigation.js |
| `setPlaybackHistoryStack(value)` | `playbackHistoryStack` | `core/00-state.js` | - | 07, 15e, core/state-navigation.js |
| `setIsNavigatingHistory(value)` | `isNavigatingHistory` | `ui/07-views.js` | - | 07, core/state-navigation.js |
| `setLyricsPreView(value)` | `lyricsPreView` | `core/00-state.js` | - | 07, 15e, core/state-navigation.js |
| `setLyricsPreScrollTop(value)` | `lyricsPreScrollTop` | `core/00-state.js` | - | 07, 15e, core/state-navigation.js |

## core/state-ghost-list.js

| Setter | Variable | Declared in | Emits | Still written directly from |
|---|---|---|---|---|
| `setCurrentSearchSessionId(value)` | `currentSearchSessionId` | `core/02-ghost-list.js` | - | 07, 08h, core/state-ghost-list.js |
| `setNextSearchItemSlotId(value)` | `nextSearchItemSlotId` | `core/02-ghost-list.js` | - | 04a, 07, 08h, 10d, core/state-ghost-list.js |
| `setNextFavoriteSlotId(value)` | `nextFavoriteSlotId` | `core/02-ghost-list.js` | - | 04a, 10d, core/state-ghost-list.js |
| `setNextHistorySlotId(value)` | `nextHistorySlotId` | `core/02-ghost-list.js` | - | core/state-ghost-list.js |
| `setHistoryGhostSlots(value)` | `historyGhostSlots` | `core/02-ghost-list.js` | - | core/state-ghost-list.js |

## core/state-folders.js

| Setter | Variable | Declared in | Emits | Still written directly from |
|---|---|---|---|---|
| `setCurrentOpenFolderId(value)` | `currentOpenFolderId` | `core/00-state.js` | - | core/state-folders.js |
| `setCurrentOpenFolderName(value)` | `currentOpenFolderName` | `core/00-state.js` | - | core/state-folders.js |
| `setFolderNavigationStack(value)` | `folderNavigationStack` | `core/00-state.js` | - | core/state-folders.js |
| `setSelectedLibraryFolders(value)` | `selectedLibraryFolders` | `library/03j-library-locations.js` | - | core/state-folders.js |

## core/state-ui.js

| Setter | Variable | Declared in | Emits | Still written directly from |
|---|---|---|---|---|
| `setHoveredSongIndex(value)` | `hoveredSongIndex` | `ui/04a-ui-render-core.js` | - | 05a, 06c, core/state-ui.js |
| `setLastMouseX(value)` | `lastMouseX` | `ui/06c-scrollbar-widget.js` | - | 04a, core/state-ui.js |
| `setLastMouseY(value)` | `lastMouseY` | `ui/06c-scrollbar-widget.js` | - | 04a, core/state-ui.js |
| `setNotificationHistory(value)` | `notificationHistory` | `ui/06j-notification-system.js` | - | 06b, core/state-ui.js |
| `setDownloadNotifyIndex(value)` | `downloadNotifyIndex` | `ui/06b-modals.js` | - | 06j, core/state-ui.js |
| `setLastRightPanelStateBeforeQueue(value)` | `lastRightPanelStateBeforeQueue` | `ui/08a-panel-layout.js` | - | 08a, core/state-ui.js |
| `setRightPanelCollapsed(value)` | `rightPanelCollapsed` | `core/00-state.js` | - | 08a, core/state-ui.js |
| `setAdvancedSettingsOpen(value)` | `advancedSettingsOpen` | `ui/08e-panel-settings.js` | - | 08e, core/state-ui.js |
| `setLeftPanelFilterMode(value)` | `leftPanelFilterMode` | `core/00-state.js` | - | core/state-ui.js |
| `setLeftPanelCollapsed(value)` | `leftPanelCollapsed` | `core/00-state.js` | - | core/state-ui.js |
| `setSelectionHighlights(value)` | `selectionHighlights` | `ui/04a-ui-render-core.js` | - | 17, core/state-ui.js |
| `setSelectedSongId(value)` | `selectedSongId` | `ui/04a-ui-render-core.js` | - | 17, core/state-ui.js |
| `setLastSelectedIndex(value)` | `lastSelectedIndex` | `ui/04a-ui-render-core.js` | - | 17, core/state-ui.js |
