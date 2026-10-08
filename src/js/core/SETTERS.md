# Setters (core/state-*.js)

One setter per global that another file used to assign directly. The variable stays declared in its original file; the setter assigns it (and, for three of them, emits an event).

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
| `setPlaybackQueue(value)` | `playbackQueue` | `00-state.js` | `queue:changed` | 06k, 10c, 10d, 15b, 15c, core/state-queue.js |
| `setCurrentQueueIndex(value)` | `currentQueueIndex` | `00-state.js` | `queue:indexChanged` | 06b, 06k, 10c, 10d, 15b, 15c, 15e, core/state-queue.js |
| `setQueueDisplayLimit(value)` | `queueDisplayLimit` | `15a0-controls-state.js` | - | 10c, 10d, core/state-queue.js |

## core/state-playback-modes.js

| Setter | Variable | Declared in | Emits | Still written directly from |
|---|---|---|---|---|
| `setIsShuffled(value)` | `isShuffled` | `00-state.js` | - | 10b, 10d, 15b, core/state-playback-modes.js |
| `setShuffleMode(value)` | `shuffleMode` | `00-state.js` | - | 10b, 10d, 15b, core/state-playback-modes.js |
| `setRepeatMode(value)` | `repeatMode` | `00-state.js` | - | 15b, 15c, core/state-playback-modes.js |
| `setRepeatFunctionalityActive(value)` | `repeatFunctionalityActive` | `15a0-controls-state.js` | - | 15b, 15c, core/state-playback-modes.js |
| `setRepeatVisualState(value)` | `repeatVisualState` | `15a0-controls-state.js` | - | 15b, 15c, core/state-playback-modes.js |
| `setSmartShuffleSourceId(value)` | `smartShuffleSourceId` | `10a0-shuffle-state.js` | - | 10a, core/state-playback-modes.js |
| `setSmartShufflePreviousSong(value)` | `smartShufflePreviousSong` | `10a0-shuffle-state.js` | - | 10a, core/state-playback-modes.js |
| `setSmartShuffleJourney(value)` | `smartShuffleJourney` | `10a0-shuffle-state.js` | - | 10a, core/state-playback-modes.js |
| `setSmartShuffleJourneyIndex(value)` | `smartShuffleJourneyIndex` | `10a0-shuffle-state.js` | - | 10a, core/state-playback-modes.js |
| `setShuffleIndex(value)` | `shuffleIndex` | `10a0-shuffle-state.js` | - | 10a, core/state-playback-modes.js |
| `setShuffleOrder(value)` | `shuffleOrder` | `10a0-shuffle-state.js` | - | 10a, core/state-playback-modes.js |
| `setShuffleSourceId(value)` | `shuffleSourceId` | `10a0-shuffle-state.js` | - | 10a, core/state-playback-modes.js |

## core/state-now-playing.js

| Setter | Variable | Declared in | Emits | Still written directly from |
|---|---|---|---|---|
| `setLastPlayedSong(value)` | `lastPlayedSong` | `00-state.js` | - | 15d, 15e, core/state-now-playing.js |
| `setLastPlayedSongStartTime(value)` | `lastPlayedSongStartTime` | `00-state.js` | - | 15d, 15e, core/state-now-playing.js |
| `setIsManualPlay(value)` | `isManualPlay` | `00-state.js` | - | 07, 10d, 15d, core/state-now-playing.js |
| `setIsPrevNavigation(value)` | `isPrevNavigation` | `00-state.js` | - | 07, 10d, core/state-now-playing.js |
| `setLastPlaybackListId(value)` | `lastPlaybackListId` | `00-state.js` | - | 10d, core/state-now-playing.js |
| `setWasPlaying(value)` | `wasPlaying` | `15a0-controls-state.js` | - | core/state-now-playing.js |
| `setShowRemainingTime(value)` | `showRemainingTime` | `15a0-controls-state.js` | - | core/state-now-playing.js |
| `setAudioElement(value)` | `audioElement` | `00-state.js` | - | 10c, core/state-now-playing.js |
| `setGaplessAudioElement(value)` | `gaplessAudioElement` | `15a0-controls-state.js` | - | 10c, core/state-now-playing.js |
| `setGaplessActiveElement(value)` | `gaplessActiveElement` | `15a0-controls-state.js` | - | 10c, core/state-now-playing.js |

## core/state-navigation.js

| Setter | Variable | Declared in | Emits | Still written directly from |
|---|---|---|---|---|
| `setCurrentView(value)` | `currentView` | `00-state.js` | `view:changed` | 07, 08e, 08h, core/state-navigation.js |
| `setSearchQuery(value)` | `searchQuery` | `00-state.js` | - | 07, 08h, 14, core/state-navigation.js |
| `setHistoryNavigationIndex(value)` | `historyNavigationIndex` | `00-state.js` | - | 07, 15e, core/state-navigation.js |
| `setPlaybackHistoryStack(value)` | `playbackHistoryStack` | `00-state.js` | - | 07, 15e, core/state-navigation.js |
| `setIsNavigatingHistory(value)` | `isNavigatingHistory` | `07-views.js` | - | 07, core/state-navigation.js |
| `setLyricsPreView(value)` | `lyricsPreView` | `00-state.js` | - | 07, 15e, core/state-navigation.js |
| `setLyricsPreScrollTop(value)` | `lyricsPreScrollTop` | `00-state.js` | - | 07, 15e, core/state-navigation.js |

## core/state-ghost-list.js

| Setter | Variable | Declared in | Emits | Still written directly from |
|---|---|---|---|---|
| `setCurrentSearchSessionId(value)` | `currentSearchSessionId` | `02-ghost-list.js` | - | 07, 08h, core/state-ghost-list.js |
| `setNextSearchItemSlotId(value)` | `nextSearchItemSlotId` | `02-ghost-list.js` | - | 04a, 07, 08h, 10d, core/state-ghost-list.js |
| `setNextFavoriteSlotId(value)` | `nextFavoriteSlotId` | `02-ghost-list.js` | - | 04a, 10d, core/state-ghost-list.js |
| `setNextHistorySlotId(value)` | `nextHistorySlotId` | `02-ghost-list.js` | - | core/state-ghost-list.js |
| `setHistoryGhostSlots(value)` | `historyGhostSlots` | `02-ghost-list.js` | - | core/state-ghost-list.js |

## core/state-folders.js

| Setter | Variable | Declared in | Emits | Still written directly from |
|---|---|---|---|---|
| `setCurrentOpenFolderId(value)` | `currentOpenFolderId` | `00-state.js` | - | core/state-folders.js |
| `setCurrentOpenFolderName(value)` | `currentOpenFolderName` | `00-state.js` | - | core/state-folders.js |
| `setFolderNavigationStack(value)` | `folderNavigationStack` | `00-state.js` | - | core/state-folders.js |
| `setSelectedLibraryFolders(value)` | `selectedLibraryFolders` | `03j-library-locations.js` | - | core/state-folders.js |

## core/state-ui.js

| Setter | Variable | Declared in | Emits | Still written directly from |
|---|---|---|---|---|
| `setHoveredSongIndex(value)` | `hoveredSongIndex` | `04a-ui-render-core.js` | - | 05a, 06c, core/state-ui.js |
| `setLastMouseX(value)` | `lastMouseX` | `06c-scrollbar-widget.js` | - | 04a, core/state-ui.js |
| `setLastMouseY(value)` | `lastMouseY` | `06c-scrollbar-widget.js` | - | 04a, core/state-ui.js |
| `setNotificationHistory(value)` | `notificationHistory` | `06j-notification-system.js` | - | 06b, core/state-ui.js |
| `setDownloadNotifyIndex(value)` | `downloadNotifyIndex` | `06b-modals.js` | - | 06j, core/state-ui.js |
| `setLastRightPanelStateBeforeQueue(value)` | `lastRightPanelStateBeforeQueue` | `08a-panel-layout.js` | - | 08a, core/state-ui.js |
| `setRightPanelCollapsed(value)` | `rightPanelCollapsed` | `00-state.js` | - | 08a, core/state-ui.js |
| `setAdvancedSettingsOpen(value)` | `advancedSettingsOpen` | `08e-panel-settings.js` | - | 08e, core/state-ui.js |
| `setLeftPanelFilterMode(value)` | `leftPanelFilterMode` | `00-state.js` | - | core/state-ui.js |
| `setLeftPanelCollapsed(value)` | `leftPanelCollapsed` | `00-state.js` | - | core/state-ui.js |
| `setSelectionHighlights(value)` | `selectionHighlights` | `04a-ui-render-core.js` | - | 17, core/state-ui.js |
| `setSelectedSongId(value)` | `selectedSongId` | `04a-ui-render-core.js` | - | 17, core/state-ui.js |
| `setLastSelectedIndex(value)` | `lastSelectedIndex` | `04a-ui-render-core.js` | - | 17, core/state-ui.js |
