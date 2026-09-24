// ==============================================================================
// RIGHT PANEL - TOGGLE / COLLAPSE / EXPAND
// ==============================================================================
function toggleRightPanel() {
    const rightPanel = rightPanelElement;
    const playerToggleButton = document.querySelector('.queue-toggle-btn');
    const queueContent = document.getElementById('queue-content');
    const tagsContent = tagsContentElement;
    const recentlyPlayedContent = document.getElementById('recently-played-content');

    const isInQueueOrRecents =
        queueContent.classList.contains('active') || recentlyPlayedContent.classList.contains('active');
    const isInTags =
        tagsContent.classList.contains('active') ||
        document.getElementById('metadata-content')?.classList.contains('active');

    if (isInQueueOrRecents) {
        if (lastRightPanelStateBeforeQueue.wasTab === 'tags') {
            if (lastRightPanelStateBeforeQueue.wasCollapsed) {
                collapseRightPanel();
            } else {
                expandRightPanel();
            }
            switchRightPanelTab('tags');
            playerToggleButton.classList.remove('active');
            playerToggleButton.setAttribute('aria-label', 'Open right panel');
        } else {
            collapseRightPanel();
            playerToggleButton.classList.remove('active');
            playerToggleButton.setAttribute('aria-label', 'Open right panel');
        }
        return;
    }

    if (isInTags) {
        lastRightPanelStateBeforeQueue = {
            wasCollapsed: rightPanelCollapsed,
            wasTab: 'tags'
        };

        if (rightPanelCollapsed) {
            expandRightPanel();
        }
        if (!rightPanel.classList.contains('active')) {
            rightPanel.classList.add('active');
        }
        switchRightPanelTab('queue');
        playerToggleButton.classList.add('active');
        playerToggleButton.setAttribute('aria-label', 'Close right panel');
        updateAlbumArt();
        updateScrollbarById('right-panel-content');
        return;
    }

    if (rightPanelCollapsed || !rightPanel.classList.contains('active')) {
        lastRightPanelStateBeforeQueue = {
            wasCollapsed: true,
            wasTab: 'queue'
        };

        expandRightPanel();
        rightPanel.classList.add('active');
        switchRightPanelTab('queue');
        playerToggleButton.classList.add('active');
        playerToggleButton.setAttribute('aria-label', 'Close right panel');
        updateAlbumArt();
        updateScrollbarById('right-panel-content');
        return;
    }
}

function openTagsTab() {
    const rightPanel = rightPanelElement;
    const playerToggleButton = document.querySelector('.queue-toggle-btn');
    const queueContent = document.getElementById('queue-content');
    const recentlyPlayedContent = document.getElementById('recently-played-content');
    const tagsContent = tagsContentElement;

    const metadataContent = document.getElementById('metadata-content');
    const isInMetadata = metadataContent?.classList.contains('active');
    const isInQueueOrRecents =
        queueContent.classList.contains('active') || recentlyPlayedContent.classList.contains('active');

    if (isInMetadata) {
        switchRightPanelTab('tags');
        playerToggleButton.classList.remove('active');
        playerToggleButton.setAttribute('aria-label', 'Open right panel');
        updateScrollbarById('right-panel-content');
        return;
    }

    if (isInQueueOrRecents) {
        switchRightPanelTab('tags');
        playerToggleButton.classList.remove('active');
        playerToggleButton.setAttribute('aria-label', 'Open right panel');
        updateScrollbarById('right-panel-content');
        return;
    }

    if (rightPanelCollapsed || !rightPanel.classList.contains('active')) {
        expandRightPanel();
        rightPanel.classList.add('active');
        switchRightPanelTab('tags');
        playerToggleButton.classList.remove('active');
        playerToggleButton.setAttribute('aria-label', 'Open right panel');
        updateAlbumArt();
        updateScrollbarById('right-panel-content');
        return;
    }

    if (tagsContent.classList.contains('active') && rightPanel.classList.contains('active')) {
        collapseRightPanel();
        playerToggleButton.classList.remove('active');
        playerToggleButton.setAttribute('aria-label', 'Open right panel');
        return;
    }
}

function collapseRightPanel() {
    rightPanelCollapsed = true;
    const rightPanel = rightPanelElement;
    const collapseBtn = document.getElementById('right-panel-collapse-btn');
    const collapseIcon = document.getElementById('right-panel-collapse-icon');

    rightPanel.classList.add('collapsed');
    if (collapseBtn) collapseBtn.classList.add('active');
    if (collapseIcon) collapseIcon.textContent = 'left_panel_open';
    localStorage.setItem(STORAGE_KEYS.RIGHT_PANEL_COLLAPSED, 'true');

    document.querySelectorAll('.queue-toggle-btn').forEach((btn) => {
        btn.classList.remove('active');
    });

    const rightPanelContent = document.querySelector('.right-panel-content');
    if (rightPanelContent) {
        rightPanelContent.style.display = 'none';
    }

    let toggleBtn = document.getElementById('right-panel-expand-toggle');
    if (!toggleBtn) {
        toggleBtn = document.createElement('div');
        toggleBtn.id = 'right-panel-expand-toggle';
        toggleBtn.className = 'right-panel-expand-toggle';
        toggleBtn.innerHTML = '<span class="material-symbols-outlined" style="font-weight: 300;">chevron_left</span>';
        toggleBtn.setAttribute('data-original-title', 'Show now playing view');
        toggleBtn.onclick = function (e) {
            e.stopPropagation();
            temporarilySuppressTooltip(toggleBtn);
            expandRightPanel();
        };
        rightPanel.appendChild(toggleBtn);
        rightPanel.style.cursor = 'pointer';
        rightPanel.onclick = function (e) {
            if (e.target === rightPanel || e.target.closest('.right-panel-expand-toggle')) {
                expandRightPanel();
            }
        };
    }

    recalcLayoutWidths();
    setTimeout(function () {
        if (typeof updateSettingsMargins === 'function') updateSettingsMargins();
    }, 30);
}

function expandRightPanel() {
    rightPanelCollapsed = false;
    const rightPanel = rightPanelElement;
    const collapseBtn = document.getElementById('right-panel-collapse-btn');
    const collapseIcon = document.getElementById('right-panel-collapse-icon');

    rightPanel.classList.remove('collapsed');
    if (collapseBtn) collapseBtn.classList.remove('active');
    if (collapseIcon) collapseIcon.textContent = 'left_panel_close';
    localStorage.setItem(STORAGE_KEYS.RIGHT_PANEL_COLLAPSED, 'false');

    const rightPanelContent = document.querySelector('.right-panel-content');
    if (rightPanelContent) {
        rightPanelContent.style.display = '';
    }

    const toggleBtn = document.getElementById('right-panel-expand-toggle');
    if (toggleBtn) {
        toggleBtn.remove();
    }
    if (rightPanelElement) {
        rightPanelElement.style.cursor = '';
        rightPanelElement.onclick = null;
    }

    const queueToggleBtn = document.querySelector('.queue-toggle-btn');
    if (queueToggleBtn && tagsContentElement.classList.contains('active')) {
        queueToggleBtn.classList.remove('active');
    }

    recalcLayoutWidths();
    setTimeout(function () {
        if (typeof updateSettingsMargins === 'function') updateSettingsMargins();
    }, 30);
}

function toggleRightPanelCollapse() {
    const btn = document.getElementById('right-panel-collapse-btn');
    if (btn) temporarilySuppressTooltip(btn);

    if (rightPanelCollapsed) {
        expandRightPanel();
    } else {
        collapseRightPanel();
    }
}
