// ==============================================================================
// STATE UI
// ==============================================================================
// Transient UI state: panels, selection, hover, notifications. Never emits events (some of it changes on every mouse move).
// Setters only: each one assigns the variable that is still declared in its original
// file. Nothing was changed to call them by creating this file. Listed in core/SETTERS.md.

export function setHoveredSongIndex(value) {
    hoveredSongIndex = value;
}

export function setLastMouseX(value) {
    lastMouseX = value;
}

export function setLastMouseY(value) {
    lastMouseY = value;
}

export function setNotificationHistory(value) {
    notificationHistory = value;
}

export function setDownloadNotifyIndex(value) {
    downloadNotifyIndex = value;
}

export function setLastRightPanelStateBeforeQueue(value) {
    lastRightPanelStateBeforeQueue = value;
}

export function setRightPanelCollapsed(value) {
    rightPanelCollapsed = value;
}

export function setAdvancedSettingsOpen(value) {
    advancedSettingsOpen = value;
}

export function setLeftPanelFilterMode(value) {
    leftPanelFilterMode = value;
}

export function setLeftPanelCollapsed(value) {
    leftPanelCollapsed = value;
}

export function setSelectionHighlights(value) {
    selectionHighlights = value;
}

export function setSelectedSongId(value) {
    selectedSongId = value;
}

export function setLastSelectedIndex(value) {
    lastSelectedIndex = value;
}

// Classic scripts and inline handlers still call these by name; registered until the final flip.
if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        setHoveredSongIndex,
        setLastMouseX,
        setLastMouseY,
        setNotificationHistory,
        setDownloadNotifyIndex,
        setLastRightPanelStateBeforeQueue,
        setRightPanelCollapsed,
        setAdvancedSettingsOpen,
        setLeftPanelFilterMode,
        setLeftPanelCollapsed,
        setSelectionHighlights,
        setSelectedSongId,
        setLastSelectedIndex
    });
}
