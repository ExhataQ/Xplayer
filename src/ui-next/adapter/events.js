export const ENGINE_EVENTS = Object.freeze([
    'recents:added',
    'recents:countChanged',
    'recents:cleared',
    'history:added',
    'history:cleared',
    'pinned:changed',
    'playedOrder:changed',
    'folderPin:changed',
    'playlist:listChanged',
    'playlist:deleted',
    'playlist:songCountChanged',
    'folder:listChanged',
    'searchHistory:cleared',
    'searchHistory:entryDeleted',
    'playbackSetting:changed',
    'library:rebuilt',
    'covers:scanCompleted',
    'playlist:songRemovedFromView',
    'data:imported',
    'queue:changed',
    'queue:indexChanged',
    'view:changed',
    'playback:stateChanged',
    'playback:recentViewChanged',
    'playback:recentPanelChanged',
    'shuffle:changed',
    'shuffle:listChanged',
    'repeat:listChanged',
    'queue:songsChanged',
    'favorites:changed',
    'songs:changed',
    'viewSongs:changed',
    'leftPanelCounts:changed',
    'playlist:songAddedFromMenu',
    'lyrics:changed',
    'search:resultsChanged',
    'search:summaryChanged',
    'leftPanelSearch:cleared',
    'rightPanel:tabChanged'
]);

const allowedEvents = new Set(ENGINE_EVENTS);

export function on(name, callback) {
    if (!allowedEvents.has(name)) throw new RangeError(`Engine event "${name}" is not approved for UI subscriptions`);
    if (typeof callback !== 'function') throw new TypeError('Event callback must be a function');
    const subscribe = window.on;
    if (typeof subscribe !== 'function') throw new Error('Engine event bus is not available');
    return subscribe(name, (event) => callback(event.detail));
}
