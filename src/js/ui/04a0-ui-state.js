// UI state that other files read or assign by bare name, declared once here. core/state-ui.js and
// core/state-navigation.js assign these by name; other files and tests read them.
// Selection and hover (04a)
export let hoveredSongIndex = -1;
export let selectedSongId = null;
export let lastSelectedIndex = null;
export let selectionHighlights = [];
// Context menu (06a)
export let activeContextMenuSlot = null;
export let currentContextSongId = null;
// Download notification slot (06b)
export let downloadNotifyIndex = -1;
// Mouse position for the scrollbar and song highlight (06c)
export let lastMouseX = 0;
export let lastMouseY = 0;
// Notification panel (06j)
export let notificationPanelOpen = false;
export let notificationHistory = [];
// Back and forward navigation (07-views)
export let isNavigatingHistory = false;
// Virtual scroll threshold (05a): the saved value is read there at load; 08e reads it when drawing Settings
export let VIRTUAL_SCROLL_THRESHOLD = 0;

// Names other files call or read by name (inline handlers, other modules).
// Variables other files read and assign by name: the accessors read and write this file's own variables.
if (typeof registerLegacyState === 'function') {
    registerLegacyState({
        hoveredSongIndex: [() => hoveredSongIndex, (value) => { hoveredSongIndex = value; }],
        selectedSongId: [() => selectedSongId, (value) => { selectedSongId = value; }],
        lastSelectedIndex: [() => lastSelectedIndex, (value) => { lastSelectedIndex = value; }],
        selectionHighlights: [() => selectionHighlights, (value) => { selectionHighlights = value; }],
        activeContextMenuSlot: [() => activeContextMenuSlot, (value) => { activeContextMenuSlot = value; }],
        currentContextSongId: [() => currentContextSongId, (value) => { currentContextSongId = value; }],
        downloadNotifyIndex: [() => downloadNotifyIndex, (value) => { downloadNotifyIndex = value; }],
        lastMouseX: [() => lastMouseX, (value) => { lastMouseX = value; }],
        lastMouseY: [() => lastMouseY, (value) => { lastMouseY = value; }],
        notificationPanelOpen: [() => notificationPanelOpen, (value) => { notificationPanelOpen = value; }],
        notificationHistory: [() => notificationHistory, (value) => { notificationHistory = value; }],
        isNavigatingHistory: [() => isNavigatingHistory, (value) => { isNavigatingHistory = value; }],
        VIRTUAL_SCROLL_THRESHOLD: [() => VIRTUAL_SCROLL_THRESHOLD, (value) => { VIRTUAL_SCROLL_THRESHOLD = value; }]
    });
}
