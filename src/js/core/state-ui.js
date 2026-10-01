// ==============================================================================
// STATE UI
// ==============================================================================
// Transient UI state: panels, selection, hover, notifications. Never emits events (some of it changes on every mouse move).
// Setters only: each one assigns the variable that is still declared in its original
// file. Nothing was changed to call them by creating this file. Listed in core/SETTERS.md.

function setHoveredSongIndex(value) {
    hoveredSongIndex = value;
}

function setLastMouseX(value) {
    lastMouseX = value;
}

function setLastMouseY(value) {
    lastMouseY = value;
}

function setNotificationHistory(value) {
    notificationHistory = value;
}

function setDownloadNotifyIndex(value) {
    downloadNotifyIndex = value;
}

function setLastRightPanelStateBeforeQueue(value) {
    lastRightPanelStateBeforeQueue = value;
}

function setRightPanelCollapsed(value) {
    rightPanelCollapsed = value;
}

function setAdvancedSettingsOpen(value) {
    advancedSettingsOpen = value;
}

function setLeftPanelFilterMode(value) {
    leftPanelFilterMode = value;
}

function setLeftPanelCollapsed(value) {
    leftPanelCollapsed = value;
}

function setSelectionHighlights(value) {
    selectionHighlights = value;
}

function setSelectedSongId(value) {
    selectedSongId = value;
}

function setLastSelectedIndex(value) {
    lastSelectedIndex = value;
}
