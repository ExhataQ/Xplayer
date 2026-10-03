// ==============================================================================
// WINDOW CONTROLS
// ==============================================================================

// Title bar close / minimize / maximize buttons.

function closeApp() {
    if (window.electronAPI) {
        window.electronAPI.closeApp();
    }
}
function minimizeApp() {
    if (window.electronAPI) {
        window.electronAPI.minimizeApp();
    }
}

function maximizeApp() {
    if (!window.electronAPI) return;
    window.electronAPI.maximizeApp();
}

function updateMaximizeIcon(maximized) {
    const icon = document.getElementById('maximize-icon');
    const btn = document.getElementById('maximize-btn');
    if (!icon || !btn) return;
    if (maximized) {
        btn.setAttribute('aria-label', 'Restore');
        icon.innerHTML =
            '<path d="M1.5 3.5 L1.5 9.5 L7.5 9.5 L7.5 3.5 Z" stroke="currentColor" stroke-width="1" fill="none" shape-rendering="crispEdges"/><path d="M3.5 3.5 L3.5 0.5 L9.5 0.5 L9.5 6.5 L7.5 6.5" stroke="currentColor" stroke-width="1" fill="none" shape-rendering="crispEdges"/>';
    } else {
        btn.setAttribute('aria-label', 'Maximize');
        icon.innerHTML =
            '<rect x="0.5" y="0.5" width="9" height="9" stroke="currentColor" stroke-width="1" fill="none" shape-rendering="crispEdges"/>';
    }
}
