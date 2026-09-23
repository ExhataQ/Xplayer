// ==============================================================================
// Placeholder Test — generates 500 skeleton rows in each list and wires up
// scrollbars, panel resize, and hover behavior identical to the app.
// ==============================================================================

const LEFT_ROW_COUNT = 500;
const SONG_ROW_COUNT = 500;

// --- Left panel rows ---
function buildLeftPanelList() {
    const list = document.getElementById('left-panel-list');
    if (!list) return;

    let html = '';
    for (let i = 0; i < LEFT_ROW_COUNT; i++) {
        html += `
            <li class="left-panel-main-item">
                <div class="subfolder-row">
                    <div class="main-item-cover-wrapper">
                        <div class="pt-left-cover-skeleton"></div>
                    </div>
                    <div class="main-item-info">
                        <div class="skeleton-bar pt-left-title"></div>
                        <div class="skeleton-bar pt-left-subtitle"></div>
                    </div>
                </div>
            </li>`;
    }
    list.innerHTML = html;
}

// --- Main song list ---
function buildSongList() {
    const list = document.getElementById('song-list');
    if (!list) return;

    let html = '';
    for (let i = 0; i < SONG_ROW_COUNT; i++) {
        html += `
            <div class="song-item pt-song-row">
                <div class="song-number-item">
                    <div class="pt-number-placeholder"></div>
                </div>
                <div class="left-song-item">
                    <div class="song-cover pt-song-cover"></div>
                    <div class="song-info">
                        <div class="skeleton-bar title"></div>
                        <div class="skeleton-bar artist"></div>
                    </div>
                </div>
                <div class="song-album">
                    <div class="skeleton-bar pt-album-placeholder"></div>
                </div>
                <div class="right-song-item">
                    <div class="pt-action-placeholder"></div>
                    <div class="skeleton-bar duration"></div>
                    <div class="pt-more-placeholder"></div>
                </div>
            </div>`;
    }

    list.innerHTML = html;
}

function syncAlbumPlaceholderAlignment() {
    const headerAlbum = document.querySelector('.tracklist-album');
    const firstAlbum = document.querySelector('.pt-song-row .song-album');
    if (!headerAlbum || !firstAlbum) return;

    const delta = headerAlbum.getBoundingClientRect().left - firstAlbum.getBoundingClientRect().left;
    document.querySelectorAll('.pt-album-placeholder').forEach((placeholder) => {
        placeholder.style.transform = `translateX(${delta}px)`;
    });
}

// ==============================================================================
// External scrollbar — ported from src/js/06c-scrollbar-widget.js, trimmed to just
// the pieces needed for the test page (no drag-to-track animation, no shared
// state across pages).
// ==============================================================================
function initExternalScrollbar(contentId, scrollbarId, thumbId) {
    const content = document.getElementById(contentId);
    const externalScrollbar = document.getElementById(scrollbarId);
    const scrollbarThumb = document.getElementById(thumbId);
    if (!content || !externalScrollbar || !scrollbarThumb) return;

    function updateScrollbar() {
        const contentHeight = content.scrollHeight;
        const visibleHeight = content.clientHeight;

        if (contentHeight <= visibleHeight) {
            scrollbarThumb.style.height = '0px';
            scrollbarThumb.style.display = 'none';
            return;
        }

        scrollbarThumb.style.display = 'block';
        const scrollRatio = visibleHeight / contentHeight;

        const topOffset = 0;
        const bottomGap = 6;
        const trackHeight = externalScrollbar.clientHeight - topOffset - bottomGap;
        const maxThumbHeight = Math.max(30, trackHeight * 0.98);
        const rawThumbHeight = scrollRatio * visibleHeight;
        const thumbHeight = Math.min(maxThumbHeight, Math.max(30, rawThumbHeight));
        scrollbarThumb.style.height = thumbHeight + 'px';

        const scrollTop = content.scrollTop;
        const maxScrollTop = contentHeight - visibleHeight;
        const scrollPercent = maxScrollTop > 0 ? scrollTop / maxScrollTop : 0;
        const maxThumbTop = trackHeight - thumbHeight;
        scrollbarThumb.style.top = topOffset + scrollPercent * maxThumbTop + 'px';
    }

    content.addEventListener('scroll', updateScrollbar);
    window.addEventListener('resize', updateScrollbar);
    updateScrollbar();

    let hideTimeout = null;
    let isDragging = false;

    function showScrollbar() {
        if (hideTimeout) {
            clearTimeout(hideTimeout);
            hideTimeout = null;
        }
        if (content.scrollHeight > content.clientHeight) {
            externalScrollbar.classList.add('visible');
        }
    }

    function hideScrollbarAfterDelay() {
        if (isDragging) return;
        if (hideTimeout) clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => {
            externalScrollbar.classList.remove('visible');
            hideTimeout = null;
        }, 750);
    }

    content.addEventListener('mouseenter', showScrollbar);
    content.addEventListener('mouseleave', hideScrollbarAfterDelay);
    scrollbarThumb.addEventListener('mouseenter', showScrollbar);
    scrollbarThumb.addEventListener('mouseleave', hideScrollbarAfterDelay);
    externalScrollbar.addEventListener('mouseenter', showScrollbar);
    externalScrollbar.addEventListener('mouseleave', hideScrollbarAfterDelay);

    scrollbarThumb.addEventListener('mousedown', (e) => {
        e.preventDefault();
        showScrollbar();
        isDragging = true;
        document.body.classList.add('no-select');
        document.body.classList.add('dragging-scrollbar');
        scrollbarThumb.classList.add('dragging');

        const startY = e.clientY;
        const startTop = parseInt(scrollbarThumb.style.top) || 0;
        const contentHeight = content.scrollHeight;
        const visibleHeight = content.clientHeight;
        const thumbHeight = parseInt(scrollbarThumb.style.height) || 30;
        const trackHeight = externalScrollbar.clientHeight;
        const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
        const maxScrollTop = contentHeight - visibleHeight;

        function onMouseMove(e) {
            const deltaY = e.clientY - startY;
            let newTop = startTop + deltaY;
            newTop = Math.max(0, Math.min(maxThumbTop, newTop));
            const scrollPercent = maxScrollTop > 0 ? newTop / maxThumbTop : 0;
            content.scrollTop = scrollPercent * maxScrollTop;
            scrollbarThumb.style.top = newTop + 'px';
        }

        function onMouseUp() {
            isDragging = false;
            document.body.classList.remove('no-select');
            document.body.classList.remove('dragging-scrollbar');
            scrollbarThumb.classList.remove('dragging');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            hideScrollbarAfterDelay();
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

// ==============================================================================
// Panel resize — ported from src/js/99-player.js's initPanelResize and
// src/js/01-sizes.js's panel width management. Trimmed to the essentials
// needed for the test page to resize its two panels.
// ==============================================================================
const SCREEN_WIDTH = window.screen.width;
const COLLAPSED_WIDTH = 74;
const RIGHT_COLLAPSED_WIDTH = 40;

const panelWidths = {
    left: SCREEN_WIDTH * (400 / 1920),
    right: SCREEN_WIDTH * (400 / 1920)
};

let leftPanelCollapsed = false;
let rightPanelCollapsed = false;

function recalcLayoutWidths() {
    const rightPanel = document.getElementById('right-panel');
    const rightPanelActive = rightPanel && rightPanel.classList.contains('active') && !rightPanelCollapsed;
    const gapSize = 7;
    let totalGaps;
    if (rightPanelCollapsed) {
        totalGaps = gapSize * 1;
    } else if (rightPanelActive) {
        totalGaps = gapSize * 3;
    } else {
        totalGaps = gapSize * 2;
    }
    const newTotalAvailable = document.documentElement.clientWidth - totalGaps;

    const leftPanel = document.getElementById('left-panel');
    const mainContent = document.getElementById('main-content');
    if (!leftPanel || !mainContent) return;

    const maxPanelWidth = SCREEN_WIDTH * (400 / 1920);
    const minPanelWidth = SCREEN_WIDTH * (285 / 1920);
    const MIN_MAIN_WIDTH = SCREEN_WIDTH * (610 / 1920);

    if (leftPanelCollapsed) {
        panelWidths.left = COLLAPSED_WIDTH;
    } else {
        panelWidths.left = Math.min(Math.max(panelWidths.left, minPanelWidth), maxPanelWidth);
    }
    panelWidths.right = Math.min(Math.max(panelWidths.right, minPanelWidth), maxPanelWidth);

    const effectiveLeft = leftPanelCollapsed ? COLLAPSED_WIDTH : panelWidths.left;
    const mainWidth =
        newTotalAvailable -
        effectiveLeft -
        (rightPanelActive ? panelWidths.right : rightPanelCollapsed ? RIGHT_COLLAPSED_WIDTH : 0);

    if (mainWidth < MIN_MAIN_WIDTH && !leftPanelCollapsed) {
        const totalShrink = MIN_MAIN_WIDTH - mainWidth;
        const leftCanShrink = Math.max(0, panelWidths.left - minPanelWidth);
        const rightCanShrink = rightPanelActive ? Math.max(0, panelWidths.right - minPanelWidth) : 0;
        const totalCanShrink = leftCanShrink + rightCanShrink;
        if (totalCanShrink > 0 && totalShrink > 0) {
            const shrink = Math.min(totalShrink, totalCanShrink);
            if (rightPanelActive) {
                panelWidths.left -= (leftCanShrink / totalCanShrink) * shrink;
                panelWidths.right -= (rightCanShrink / totalCanShrink) * shrink;
            } else {
                panelWidths.left -= shrink;
            }
        }
    }

    applyPanelWidths();
}

function applyPanelWidths() {
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');

    if (leftPanel) {
        leftPanel.style.width = (leftPanelCollapsed ? COLLAPSED_WIDTH : panelWidths.left) + 'px';
    }
    if (rightPanel) {
        if (rightPanelCollapsed) {
            rightPanel.style.removeProperty('width');
            rightPanel.classList.add('collapsed');
        } else {
            rightPanel.style.width = panelWidths.right + 'px';
            rightPanel.classList.remove('collapsed');
        }
        document.documentElement.style.setProperty('--right-panel-width', panelWidths.right + 'px');
    }

    const mainContent = document.getElementById('main-content');
    if (mainContent) {
        const minMainWidth = SCREEN_WIDTH * (400 / 1920);
        mainContent.style.minWidth = minMainWidth + 'px';

        const totalWidth = document.documentElement.clientWidth;
        const gaps = 7;
        const rightPanelVisible = rightPanel && rightPanel.classList.contains('active') && !rightPanelCollapsed;
        let gapCount;
        let rightPanelWidth;

        if (rightPanelCollapsed) {
            gapCount = 1;
            rightPanelWidth = RIGHT_COLLAPSED_WIDTH;
        } else if (rightPanelVisible) {
            gapCount = 3;
            rightPanelWidth = panelWidths.right;
        } else {
            gapCount = 2;
            rightPanelWidth = 0;
        }

        const mainWidth = totalWidth - panelWidths.left - rightPanelWidth - gaps * gapCount;
        const narrowThreshold = SCREEN_WIDTH * (610 / 1920);
        if (mainWidth < narrowThreshold) {
            mainContent.classList.add('narrow');
            mainContent.classList.add('hide-queue-btn');
        } else {
            mainContent.classList.remove('narrow');
            mainContent.classList.remove('hide-queue-btn');
        }
    }
}

function initPanelResize(panelId, options = {}) {
    const {
        handleSide = 'right',
        minWidth = SCREEN_WIDTH * (285 / 1920),
        maxWidth = SCREEN_WIDTH * (400 / 1920)
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
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
    }

    function doResize(e) {
        if (!isResizing) return;
        e.preventDefault();
        let delta = e.clientX - startX;
        if (handleSide === 'left') delta = -delta;
        const newWidth = startWidth + delta;

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
        document.documentElement.style.setProperty('--right-panel-width', panelWidths.right + 'px');
    }

    function stopResize() {
        if (!isResizing) return;
        isResizing = false;
        document.body.classList.remove('no-select');
        document.body.style.cursor = '';
        document.removeEventListener('mousemove', doResize);
        document.removeEventListener('mouseup', stopResize);
    }

    resizeHandle.addEventListener('mousedown', startResize);
}

// ==============================================================================
// Tracklist scroll effect — ported from src/js/99-player.js.
// Adds .scrolled to .tracklist-header when the header reaches the top of
// .content, which changes its background (--bg-card) and stretches the
// bottom border to the full width of the panel.
// ==============================================================================
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

// ==============================================================================
// Panel collapse — ported from src/js/99-player.js's collapseLeftPanel and
// src/js/08a-panel-layout.js's collapseRightPanel. Toggles the .collapsed class and
// updates panel widths so the app's collapse CSS applies to the placeholders.
// ==============================================================================
function collapseLeftPanel() {
    leftPanelCollapsed = true;
    const leftPanel = document.getElementById('left-panel');
    const collapseBtn = document.getElementById('collapse-panel-btn');
    const collapseIcon = document.getElementById('collapse-panel-icon');

    leftPanel.classList.add('collapsed');
    if (collapseBtn) collapseBtn.classList.add('active');
    if (collapseIcon) collapseIcon.textContent = 'left_panel_open';

    panelWidths.left = COLLAPSED_WIDTH;
    recalcLayoutWidths();
}

function expandLeftPanel() {
    leftPanelCollapsed = false;
    const leftPanel = document.getElementById('left-panel');
    const collapseBtn = document.getElementById('collapse-panel-btn');
    const collapseIcon = document.getElementById('collapse-panel-icon');

    leftPanel.classList.remove('collapsed');
    if (collapseBtn) collapseBtn.classList.remove('active');
    if (collapseIcon) collapseIcon.textContent = 'left_panel_close';

    panelWidths.left = SCREEN_WIDTH * (400 / 1920);
    recalcLayoutWidths();
}

function toggleLeftPanelCollapse() {
    if (leftPanelCollapsed) expandLeftPanel();
    else collapseLeftPanel();
}

function collapseRightPanel() {
    rightPanelCollapsed = true;
    const rightPanel = document.getElementById('right-panel');
    rightPanel.classList.add('collapsed');
    recalcLayoutWidths();
}

function expandRightPanel() {
    rightPanelCollapsed = false;
    const rightPanel = document.getElementById('right-panel');
    rightPanel.classList.remove('collapsed');
    recalcLayoutWidths();
}

function toggleRightPanelCollapse() {
    if (rightPanelCollapsed) expandRightPanel();
    else collapseRightPanel();
}

// ==============================================================================
// Boot
// ==============================================================================
document.addEventListener('DOMContentLoaded', () => {
    buildLeftPanelList();
    buildSongList();

    initExternalScrollbar('left-panel-main-content', 'left-panel-scrollbar', 'left-panel-scrollbar-thumb');
    initExternalScrollbar('main-content', 'external-scrollbar', 'external-scrollbar-thumb');
    initExternalScrollbar('right-panel-content', 'right-panel-scrollbar', 'right-panel-scrollbar-thumb');

    initTracklistScrollEffect();

    const minPanelWidth = SCREEN_WIDTH * (285 / 1920);
    const maxPanelWidth = SCREEN_WIDTH * (400 / 1920);
    initPanelResize('left-panel', {
        handleSide: 'right',
        minWidth: minPanelWidth,
        maxWidth: maxPanelWidth
    });
    initPanelResize('right-panel', {
        handleSide: 'left',
        minWidth: minPanelWidth,
        maxWidth: maxPanelWidth
    });

    recalcLayoutWidths();
    window.addEventListener('resize', () => {
        recalcLayoutWidths();
        syncAlbumPlaceholderAlignment();
    });
    requestAnimationFrame(syncAlbumPlaceholderAlignment);
});