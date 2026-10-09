// UI state that other files read or assign by bare name, kept in one classic script so the files
// that used to declare it can become ES modules (D-09). core/state-ui.js and core/state-navigation.js
// assign these by name; classic files and tests read them. They move into the state modules in A-16.
// Selection and hover (04a)
let hoveredSongIndex = -1;
let selectedSongId = null;
let lastSelectedIndex = null;
let selectionHighlights = [];
// Context menu (06a)
let activeContextMenuSlot = null;
let currentContextSongId = null;
// Download notification slot (06b)
let downloadNotifyIndex = -1;
// Mouse position for the scrollbar and song highlight (06c)
let lastMouseX = 0;
let lastMouseY = 0;
// Notification panel (06j)
let notificationPanelOpen = false;
let notificationHistory = [];
// Back and forward navigation (07-views)
let isNavigatingHistory = false;
// Virtual scroll threshold (05a): the saved value is read there at load; 08e reads it when drawing Settings
let VIRTUAL_SCROLL_THRESHOLD = 0;
