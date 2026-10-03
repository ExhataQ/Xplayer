// ==============================================================================
// PANEL LAYOUT
// ==============================================================================

// Left panel collapse / expand, panel resize handles, and the tracklist header effect.
// Registers the window resize listener at load, so keep this file after the other
// scripts that register their own resize listeners.

function isBelowCollapseThreshold() {
    return window.innerWidth < COLLAPSE_THRESHOLD;
}

function collapseLeftPanel() {
    setLeftPanelCollapsed(true);
    const leftPanel = leftPanelElement;
    const collapseBtn = document.getElementById('collapse-panel-btn');
    const titleGroup = document.querySelector('.left-panel-header-title-group');
    const collapseIcon = document.getElementById('collapse-panel-icon');

    leftPanel.classList.add('collapsed');
    if (collapseBtn) collapseBtn.classList.add('active');
    if (titleGroup) titleGroup.setAttribute('data-original-title', 'Open your library');
    if (collapseIcon) collapseIcon.textContent = 'left_panel_open';
    panelWidths.left = COLLAPSED_WIDTH;
    localStorage.setItem(STORAGE_KEYS.LEFT_PANEL_COLLAPSED, 'true');
    recalcLayoutWidths();
    setTimeout(function () {
        if (typeof updateSettingsMargins === 'function') updateSettingsMargins();
    }, 30);
}

function expandLeftPanel() {
    if (isBelowCollapseThreshold()) return;
    setLeftPanelCollapsed(false);
    const leftPanel = leftPanelElement;
    const collapseBtn = document.getElementById('collapse-panel-btn');
    const titleGroup = document.querySelector('.left-panel-header-title-group');
    const collapseIcon = document.getElementById('collapse-panel-icon');

    leftPanel.classList.remove('collapsed');
    if (collapseBtn) collapseBtn.classList.remove('active');
    if (titleGroup) titleGroup.setAttribute('data-original-title', 'Collapse your library');
    if (collapseIcon) collapseIcon.textContent = 'left_panel_close';
    panelWidths.left = MIN_PANEL_WIDTH;
    localStorage.setItem(STORAGE_KEYS.LEFT_PANEL_COLLAPSED, 'false');
    recalcLayoutWidths();
    setTimeout(function () {
        if (typeof updateSettingsMargins === 'function') updateSettingsMargins();
    }, 30);
}

function toggleLeftPanelCollapse() {
    if (leftPanelCollapsed) {
        expandLeftPanel();
    } else {
        collapseLeftPanel();
    }

    recalcLayoutWidths();
    updateScrollbarById('left-panel-main-content');
}

window.addEventListener('resize', function () {
    if (isBelowCollapseThreshold() && !leftPanelCollapsed) {
        collapseLeftPanel();
        recalcLayoutWidths();
        updateScrollbarById('left-panel-main-content');
    } else if (!isBelowCollapseThreshold() && leftPanelCollapsed) {
        expandLeftPanel();
        recalcLayoutWidths();
        updateScrollbarById('left-panel-main-content');
    }
    if (typeof updateLibraryLocationsLayout === 'function') updateLibraryLocationsLayout();
});

function initPanelResize(panelId, options = {}) {
    const {
        handleSide = 'right',
        minWidth = SCREEN_WIDTH * (285 / 1920),
        maxWidth = SCREEN_WIDTH * (400 / 1920),
        onResize = null
    } = options;

    const panel = document.getElementById(panelId);
    if (!panel) return;

    const resizeHandle = document.createElement('div');
    resizeHandle.className = 'panel-resize-handle';
    panel.appendChild(resizeHandle);

    let isResizing = false;
    let startX, startWidth;

    function startResize(e) {
        isResizing = true;
        startX = e.clientX;
        startWidth = parseInt(getComputedStyle(panel).width, 10);
        document.body.classList.add('no-select');
        document.body.style.cursor = 'grabbing';
        if (panelId === 'left-panel') {
            const scrollbar = document.getElementById('left-panel-scrollbar');
            if (scrollbar) scrollbar.style.opacity = '0';
        }
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
    }

    function doResize(e) {
        if (!isResizing) return;
        e.preventDefault();
        let delta = e.clientX - startX;
        if (handleSide === 'left') {
            delta = -delta;
        }
        const newWidth = startWidth + delta;

        if (panelId === 'left-panel' && typeof leftPanelCollapsed !== 'undefined') {
            const collapseAt = minWidth * 0.625;
            const expandAt = minWidth * 0.75;
            if (!leftPanelCollapsed && newWidth < collapseAt) {
                collapseLeftPanel();
                recalcLayoutWidths();
                updateScrollbarById('left-panel-main-content');
                startWidth = COLLAPSED_WIDTH;
                startX = e.clientX;
                return;
            }
            if (leftPanelCollapsed && newWidth > expandAt && !isBelowCollapseThreshold()) {
                expandLeftPanel();
                recalcLayoutWidths();
                updateScrollbarById('left-panel-main-content');
                panel.style.width = minWidth + 'px';
                startWidth = minWidth;
                startX = e.clientX;
                return;
            }
            if (leftPanelCollapsed) {
                return;
            }
        }

        const minMainWidth = SCREEN_WIDTH * (400 / 1920);
        const gapSize = 7;
        const rightPanelActive = document.getElementById('right-panel')?.classList.contains('active');
        const totalGaps = rightPanelActive ? gapSize * 4 : gapSize * 2;
        const appWidth = document.documentElement.clientWidth;

        let otherPanelWidth;
        if (panelId === 'left-panel') {
            otherPanelWidth = rightPanelActive ? panelWidths.right : 0;
        } else {
            otherPanelWidth = panelWidths.left;
        }

        const dynamicMax = appWidth - otherPanelWidth - totalGaps - minMainWidth;
        const effectiveMax = Math.min(maxWidth, dynamicMax);

        const finalWidth = Math.min(Math.max(newWidth, minWidth), effectiveMax);
        panel.style.width = finalWidth + 'px';
        panelWidths[panelId === 'left-panel' ? 'left' : 'right'] = finalWidth;
        if (onResize) onResize(finalWidth);
        void panel.offsetHeight;
    }

    function stopResize() {
        if (!isResizing) return;
        isResizing = false;
        document.body.classList.remove('no-select');
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
        if (panelId === 'left-panel') {
            const scrollbar = document.getElementById('left-panel-scrollbar');
            if (scrollbar) scrollbar.style.opacity = '';
        }
    }

    resizeHandle.addEventListener('mousedown', startResize);
}

function initTracklistScrollEffect() {
    const content = document.querySelector('.content');
    const tracklistHeader = document.querySelector('.tracklist-header');
    const heroSection = document.querySelector('.playlist-hero-section');

    if (!content || !tracklistHeader || !heroSection) return;

    function updateHeaderBackground() {
        const tracklistRect = tracklistHeader.getBoundingClientRect();
        const contentRect = content.getBoundingClientRect();
        const tracklistTop = tracklistRect.top - contentRect.top;

        if (tracklistTop <= 0) {
            tracklistHeader.classList.add('scrolled');
        } else {
            tracklistHeader.classList.remove('scrolled');
        }
    }

    content.addEventListener('scroll', updateHeaderBackground);
    window.addEventListener('resize', updateHeaderBackground);
    updateHeaderBackground();
}
