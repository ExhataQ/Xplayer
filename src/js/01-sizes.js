let SCREEN_WIDTH = window.screen.width;

const COLLAPSED_WIDTH = 74;
const RIGHT_COLLAPSED_WIDTH = 40;
const COLLAPSE_THRESHOLD = SCREEN_WIDTH * (1020 / 1920);
const MIN_PANEL_WIDTH = SCREEN_WIDTH * (285 / 1920);
const COLLAPSE_RESIZE_THRESHOLD = MIN_PANEL_WIDTH + 60;
const LYRICS_NARROW_THRESHOLD = SCREEN_WIDTH * (1280 / 1920);
const LYRICS_VERY_NARROW_THRESHOLD = SCREEN_WIDTH * (1000 / 1920);

const panelWidths = (function () {
    const saved = localStorage.getItem('panelWidths');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            if (parsed.left && parsed.right) return parsed;
        } catch (e) {}
    }
    return {
        left: SCREEN_WIDTH * (400 / 1920),
        right: SCREEN_WIDTH * (400 / 1920)
    };
})();

let lastWindowWidth = 0;
let lastRightPanelCollapsed = null;
let lastNonMaximizedWidths = null;

function updateScreenWidth() {
    SCREEN_WIDTH = window.screen.width;
    const maxPanelWidth = SCREEN_WIDTH * (400 / 1920);
    const minPanelWidth = SCREEN_WIDTH * (285 / 1920);
    panelWidths.left = Math.min(Math.max(panelWidths.left, minPanelWidth), maxPanelWidth);
    panelWidths.right = Math.min(Math.max(panelWidths.right, minPanelWidth), maxPanelWidth);
    initLeftPanelResize();
    lastWindowWidth = 0;
    recalcLayoutWidths();
    updateContextMenuWidth();
    updateLyricsTextScale();
}

let CONTEXT_MENU_WIDTH = SCREEN_WIDTH * (235 / 1920);

function updateContextMenuWidth() {
    CONTEXT_MENU_WIDTH = SCREEN_WIDTH * (235 / 1920);
    document.documentElement.style.setProperty('--context-menu-width', CONTEXT_MENU_WIDTH + 'px');
}

function saveNonMaximizedWidths() {
    lastNonMaximizedWidths = {
        left: panelWidths.left,
        right: panelWidths.right,
        windowWidth: window.innerWidth
    };
}

function restoreNonMaximizedWidths() {
    if (lastNonMaximizedWidths) {
        panelWidths.left = lastNonMaximizedWidths.left;
        panelWidths.right = lastNonMaximizedWidths.right;
        lastWindowWidth = 0;
        applyPanelWidths();
    }
}

function applyPanelWidths() {
    const leftPanel = document.getElementById('left-panel');
    const rightPanel = document.getElementById('right-panel');

    if (leftPanel) {
        leftPanel.style.width = panelWidths.left + 'px';
    }
    if (rightPanel) {
        if (rightPanelCollapsed) {
            // Remove inline styles to let CSS handle the width
            rightPanel.style.removeProperty('width');
            rightPanel.style.removeProperty('min-width');
            rightPanel.style.removeProperty('max-width');
            rightPanel.style.marginRight = '0';
            // Add a class that CSS can target
            rightPanel.classList.add('collapsed');
        } else {
            rightPanel.style.width = panelWidths.right + 'px';
            rightPanel.style.minWidth = '';
            rightPanel.style.maxWidth = '';
            rightPanel.style.marginRight = '';
            rightPanel.classList.remove('collapsed');
        }
        document.documentElement.style.setProperty('--right-panel-width', panelWidths.right + 'px');
    }

    const maxImageViewerSize = SCREEN_WIDTH * (645 / 1920);
    const minImageViewerSize = SCREEN_WIDTH * (370 / 1920);
    const widthBasedSize = Math.min(Math.max(maxImageViewerSize, minImageViewerSize), maxImageViewerSize);
    const heightCap = Math.round(window.innerHeight * 0.74);
    const imageViewerSize = Math.min(widthBasedSize, heightCap);
    document.documentElement.style.setProperty('--image-viewer-max-size', imageViewerSize + 'px');
    document.documentElement.style.setProperty('--image-viewer-close-size', imageViewerSize * (40 / 500) + 'px');
    document.documentElement.style.setProperty('--image-viewer-close-font', imageViewerSize * (20 / 500) + 'px');
    document.documentElement.style.setProperty('--image-viewer-close-bottom', imageViewerSize * (-50 / 500) + 'px');
    document.documentElement.style.setProperty('--image-viewer-margin-bottom', imageViewerSize * (40 / 500) + 'px');

    applyFooterWidths();

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
            rightPanelWidth = 40;
        } else if (rightPanelVisible) {
            gapCount = 3;
            rightPanelWidth = panelWidths.right;
        } else {
            gapCount = 2;
            rightPanelWidth = 0;
        }

        const container = document.querySelector('.container');
        if (container && rightPanelCollapsed) {
            container.style.marginRight = '0';
        } else if (container) {
            container.style.marginRight = '';
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

    localStorage.setItem(
        'panelWidths',
        JSON.stringify({
            left: panelWidths.left,
            right: panelWidths.right
        })
    );
    updateSettingsMargins();
    updateLibraryLocationsLayout();
}

function recalcLayoutWidths() {
    const rightPanel = document.getElementById('right-panel');
    const rightPanelActive = rightPanel && rightPanel.classList.contains('active') && !rightPanelCollapsed;
    const gapSize = 7;
    const rightPanelVisible = rightPanel && rightPanel.classList.contains('active') && !rightPanelCollapsed;
    let totalGaps;
    if (rightPanelCollapsed) {
        totalGaps = gapSize * 1;
    } else if (rightPanelVisible) {
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

    const isMaximized = window.innerWidth >= window.screen.width - 50;

    if (isMaximized && lastNonMaximizedWidths === null) {
        saveNonMaximizedWidths();
    } else if (!isMaximized && lastNonMaximizedWidths !== null) {
        restoreNonMaximizedWidths();
        lastNonMaximizedWidths = null;
        lastWindowWidth = window.innerWidth;
        applyPanelWidths();
        return;
    }

    if (lastWindowWidth === 0) {
        const maxPanelWidth = SCREEN_WIDTH * (400 / 1920);
        const minPanelWidth = SCREEN_WIDTH * (285 / 1920);

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

        lastWindowWidth = document.documentElement.clientWidth;
        applyPanelWidths();
        return;
    }

    const collapseStateChanged = lastRightPanelCollapsed !== null && lastRightPanelCollapsed !== rightPanelCollapsed;
    lastRightPanelCollapsed = rightPanelCollapsed;

    if (collapseStateChanged) {
        lastWindowWidth = window.innerWidth;
        applyPanelWidths();
        return;
    }

    const delta = newTotalAvailable - (lastWindowWidth - totalGaps);
    if (Math.abs(delta) < 1) return;

    const previousTotalPanels =
        panelWidths.left + (rightPanelActive ? panelWidths.right : rightPanelCollapsed ? RIGHT_COLLAPSED_WIDTH : 0);

    if (delta > 0) {
        const mainWidth =
            newTotalAvailable -
            panelWidths.left -
            (rightPanelActive ? panelWidths.right : rightPanelCollapsed ? RIGHT_COLLAPSED_WIDTH : 0);
        let remaining = delta;

        if (mainWidth < MIN_MAIN_WIDTH) {
            const mainGrow = Math.min(remaining, MIN_MAIN_WIDTH - mainWidth);
            remaining -= mainGrow;
        }

        if (remaining > 0 && previousTotalPanels > 0) {
            const leftCanGrow = Math.max(0, maxPanelWidth - panelWidths.left);
            const rightCanGrow = rightPanelActive ? Math.max(0, maxPanelWidth - panelWidths.right) : 0;
            const totalCanGrow = leftCanGrow + rightCanGrow;

            if (totalCanGrow > 0) {
                const grow = Math.min(remaining, totalCanGrow);
                if (rightPanelActive) {
                    panelWidths.left += (leftCanGrow / totalCanGrow) * grow;
                    panelWidths.right += (rightCanGrow / totalCanGrow) * grow;
                } else {
                    panelWidths.left += grow;
                }
            }
        }
    } else if (previousTotalPanels > 0) {
        let reductionNeeded = -delta;
        const leftCanShrink = Math.max(0, panelWidths.left - minPanelWidth);
        const rightCanShrink = rightPanelActive ? Math.max(0, panelWidths.right - minPanelWidth) : 0;
        const totalCanShrink = leftCanShrink + rightCanShrink;

        if (totalCanShrink > 0 && reductionNeeded > 0) {
            const shrink = Math.min(reductionNeeded, totalCanShrink);
            if (rightPanelActive) {
                panelWidths.left -= (leftCanShrink / totalCanShrink) * shrink;
                panelWidths.right -= (rightCanShrink / totalCanShrink) * shrink;
            } else {
                panelWidths.left -= shrink;
            }
        }
    }

    lastWindowWidth = window.innerWidth;
    applyPanelWidths();
    updateSettingsMargins();
    updateLibraryLocationsLayout();
    updateLyricsTextScale();
}

function adjustHeroTitleSize() {
    const title = document.getElementById('hero-title');
    const info = title ? title.closest('.playlist-hero-info') : null;
    if (!title || !info) {
        return;
    }

    const containerWidth = info.clientWidth;
    const steps = [84, 56, 36, 24];
    let newSize = 24;

    title.style.fontSize = '24px';

    const text = title.textContent;
    const measurer = document.createElement('span');
    measurer.style.position = 'absolute';
    measurer.style.visibility = 'hidden';
    measurer.style.whiteSpace = 'nowrap';
    measurer.style.fontWeight = '900';
    measurer.style.letterSpacing = '-2px';
    measurer.style.lineHeight = '1.1';
    document.body.appendChild(measurer);

    for (let i = 0; i < steps.length; i++) {
        measurer.style.fontSize = steps[i] + 'px';
        measurer.textContent = text;
        if (measurer.offsetWidth <= containerWidth - 20) {
            newSize = steps[i];
            break;
        }
    }

    measurer.remove();
    title.style.fontSize = newSize + 'px';
    title.classList.add('sized');

    if (newSize === 24) {
        title.style.textOverflow = 'ellipsis';
        title.style.overflow = 'hidden';
    } else {
        title.style.textOverflow = 'clip';
        title.style.overflow = 'visible';
    }
}

function initLeftPanelResize() {
    const minPanelWidth = SCREEN_WIDTH * (285 / 1920);
    const maxPanelWidth = SCREEN_WIDTH * (400 / 1920);

    function onAnyPanelResize() {
        if (typeof adjustHeroTitleSize === 'function') {
            adjustHeroTitleSize();
        }
        if (typeof recalcLayoutWidths === 'function') {
            recalcLayoutWidths();
        }
        if (typeof updateExternalScrollbar === 'function') {
            updateExternalScrollbar();
        }
        if (typeof updateSettingsMargins === 'function') {
            updateSettingsMargins();
        }
    }

    initPanelResize('left-panel', {
        handleSide: 'right',
        minWidth: minPanelWidth,
        maxWidth: maxPanelWidth,
        onResize: onAnyPanelResize
    });

    initPanelResize('right-panel', {
        handleSide: 'left',
        minWidth: minPanelWidth,
        maxWidth: maxPanelWidth,
        onResize: (width) => {
            document.documentElement.style.setProperty('--right-panel-width', width + 'px');
            onAnyPanelResize();
        }
    });

    recalcLayoutWidths();
}

// ==============================================================================
// FOOTER PLAYER RESIZE
// ==============================================================================
function applyFooterWidths() {
    const playerContainer = document.querySelector('.player-container');
    const leftSection = document.querySelector('.player-left-section');
    const centerSection = document.querySelector('.player-center-section');
    const rightSection = document.querySelector('.player-right-section');

    if (!playerContainer || !leftSection || !centerSection || !rightSection) return;

    const containerWidth = playerContainer.clientWidth;
    const maxLeftWidth = SCREEN_WIDTH * (256 / 1920);
    const minLeftWidth = SCREEN_WIDTH * (180 / 1920);
    const maxRightWidth = SCREEN_WIDTH * (256 / 1920);
    const centerMinWidth = SCREEN_WIDTH * (280 / 1920);
    const centerMaxWidth = SCREEN_WIDTH * (600 / 1920);
    const centerPaddingRight = SCREEN_WIDTH * (20 / 1920);

    leftSection.style.width = maxLeftWidth + 'px';
    leftSection.style.maxWidth = maxLeftWidth + 'px';
    rightSection.style.width = maxRightWidth + 'px';
    rightSection.style.maxWidth = maxRightWidth + 'px';
    centerSection.style.maxWidth = centerMaxWidth + 'px';
    centerSection.style.minWidth = centerMinWidth + 'px';

    const sectionsWidth =
        leftSection.getBoundingClientRect().width +
        centerSection.getBoundingClientRect().width +
        rightSection.getBoundingClientRect().width;

    if (sectionsWidth > containerWidth) {
        playerContainer.style.justifyContent = 'flex-start';

        let overflow = sectionsWidth - containerWidth + centerPaddingRight;

        const centerCurrentWidth = centerSection.getBoundingClientRect().width;
        const centerCanShrink = centerCurrentWidth - centerMinWidth;
        const centerShrink = Math.min(overflow, centerCanShrink);
        centerSection.style.maxWidth = centerCurrentWidth - centerShrink + 'px';

        overflow -= centerShrink;

        if (overflow > 0) {
            const leftCurrentWidth = leftSection.getBoundingClientRect().width;
            const leftCanShrink = leftCurrentWidth - minLeftWidth;
            const leftReduce = Math.min(overflow, leftCanShrink);
            const newLeftWidth = leftCurrentWidth - leftReduce;
            leftSection.style.width = newLeftWidth + 'px';
            leftSection.style.maxWidth = newLeftWidth + 'px';

            const shrinkRatio = leftReduce / leftCanShrink;
            const newPadding = Math.round(centerPaddingRight * (1 - shrinkRatio));
            centerSection.style.paddingRight = newPadding + 'px';
        }
    } else {
        playerContainer.style.justifyContent = 'space-between';
        centerSection.style.paddingRight = centerPaddingRight + 'px';
    }
}

function updateSettingsMargins() {
    const settingsContent = document.querySelector('.settings-panel-content');
    if (!settingsContent) return;

    settingsContent.style.paddingLeft = '5%';
    settingsContent.style.paddingRight = '5%';
}

function updateLibraryLocationsLayout() {
    const threshold = SCREEN_WIDTH * (1020 / 1920);
    const items = document.querySelectorAll('.library-location-item');

    if (window.innerWidth < threshold) {
        items.forEach((item) => {
            item.style.gridTemplateColumns = '2fr 3fr';
            const songCount = item.querySelector('.library-location-song-count');
            if (songCount) songCount.style.display = 'none';
        });
    } else {
        items.forEach((item) => {
            item.style.gridTemplateColumns = '';
            const songCount = item.querySelector('.library-location-song-count');
            if (songCount) songCount.style.display = '';
        });
    }
}

function updateLyricsTextScale() {
    const root = document.documentElement;
    const w = document.documentElement.clientWidth;

    let fontSize;
    let lineHeight;

    if (w < LYRICS_VERY_NARROW_THRESHOLD) {
        fontSize = Math.round(SCREEN_WIDTH * (26 / 1920));
        lineHeight = 1.5;
    } else if (w < LYRICS_NARROW_THRESHOLD) {
        fontSize = Math.round(SCREEN_WIDTH * (32 / 1920));
        lineHeight = 1.65;
    } else {
        fontSize = Math.round(SCREEN_WIDTH * (40 / 1920));
        lineHeight = 1.8;
    }

    root.style.setProperty('--lyrics-font-size', fontSize + 'px');
    root.style.setProperty('--lyrics-line-height', String(lineHeight));
}
