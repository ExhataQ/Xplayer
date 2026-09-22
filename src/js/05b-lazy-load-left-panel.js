// ==============================================================================
// VIRTUAL SCROLL - LEFT PANEL
// ==============================================================================
const LEFT_ITEM_HEIGHT = 59;
const LEFT_OVERSCAN_COUNT = 5;

let leftPanelVirtualState = {
    enabled: false,
    currentItems: [],
    visibleItems: [],
    firstVisibleIndex: 0,
    lastVisibleIndex: 0,
    lastRenderedStart: -1,
    lastRenderedEnd: -1,
    scrollSettleTimeout: null,
    spacerDiv: null,
    container: null,
    lastScrollTop: 0
};

function buildLeftPanelItemAt(index, currentOpenFolderId) {
    const items = leftPanelVirtualState.currentItems;
    if (!items[index]) return '';

    const item = items[index];
    const isFolderCurrent =
        item.type === 'folder' && typeof currentOpenFolderId !== 'undefined' && currentOpenFolderId === item.id;
    const isActive = currentView === item.viewId || isFolderCurrent;
    const currentItem =
        typeof currentQueueIndex !== 'undefined' &&
        currentQueueIndex >= 0 &&
        typeof playbackQueue !== 'undefined' &&
        playbackQueue[currentQueueIndex]
            ? playbackQueue[currentQueueIndex]
            : null;
    const currentListId = currentItem ? currentItem.listId || 'all-songs' : null;
    const isPlaying = !!(currentItem && currentListId === item.viewId);
    const isPaused = isPlaying && typeof audioElement !== 'undefined' && audioElement.paused;

    let coverContent = '';
    let subtitleText = '';

    if (item.type === 'all-songs') {
        coverContent = `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
            <rect width="400" height="400" rx="8" fill="var(--accent)"/>
            <circle cx="200" cy="200" r="70" fill="none" stroke="#000000" stroke-width="12"/>
            <polygon points="180,160 180,240 240,200" fill="#000000"/>
        </svg>`;
        subtitleText = `<span>Playlist</span><span class="main-item-dot">•</span><span class="main-item-count">${
            item.count
        } ${item.count === 1 ? 'song' : 'songs'}</span>`;
    } else if (item.type === 'favorites') {
        coverContent = `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
            <defs><linearGradient id="likedGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#450af5"/><stop offset="100%" style="stop-color:#c4efd9"/>
            </linearGradient></defs>
            <rect width="400" height="400" rx="8" fill="url(#likedGradient)"/>
            <path d="M200 290 L170 260 C140 230 110 200 110 170 C110 140 135 115 165 115 C180 115 195 125 200 135 C205 125 220 115 235 115 C265 115 290 140 290 170 C290 200 260 230 230 260 L200 290Z" fill="#ffffff" stroke="none" transform="scale(0.6) translate(135, 100)"/>
        </svg>`;
        subtitleText = `<span>Playlist</span><span class="main-item-dot">•</span><span class="main-item-count">${
            item.count
        } ${item.count === 1 ? 'song' : 'songs'}</span>`;
    } else if (item.type === 'playlist') {
        coverContent = item.cover
            ? `<img class="main-item-cover-img album-cover-img" src="${item.cover}" alt="" style="width: 45px; height: 45px; border-radius: 8px; object-fit: cover;">`
            : `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                <rect width="400" height="400" rx="8" fill="#2a2a2a"/>
                <rect x="140" y="140" width="120" height="30" rx="6" fill="var(--accent)"/>
                <rect x="140" y="185" width="120" height="30" rx="6" fill="var(--accent)" opacity="0.7"/>
                <rect x="140" y="230" width="120" height="30" rx="6" fill="var(--accent)" opacity="0.4"/>
            </svg>`;
        subtitleText = `<span>Playlist</span><span class="main-item-dot">•</span><span class="main-item-count">${item.count}</span>`;
    } else if (item.type === 'album') {
        coverContent = item.cover
            ? `<img class="main-item-cover-img album-cover-img" src="${item.cover}" alt="">`
            : `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                <rect width="400" height="400" rx="8" fill="#1a1a1a"/>
                <circle cx="200" cy="200" r="115" fill="none" stroke="#fff" stroke-width="8"/>
                <circle cx="200" cy="200" r="30" fill="#fff"/>
                <circle cx="200" cy="200" r="10" fill="#1a1a1a"/>
            </svg>`;
        subtitleText = `<span>Album</span><span class="main-item-dot">•</span><span class="main-item-count">${
            item.count
        } ${item.count === 1 ? 'song' : 'songs'}</span>`;
    } else if (item.type === 'artist') {
        coverContent = item.cover
            ? `<img class="main-item-cover-img artist-cover-img" src="${item.cover}" alt="">`
            : `<svg class="main-item-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
                <rect width="400" height="400" rx="200" fill="#2a2a2a"/>
                <circle cx="200" cy="155" r="70" fill="var(--accent)"/>
                <ellipse cx="200" cy="320" rx="110" ry="45" fill="var(--accent)"/>
            </svg>`;
        subtitleText = `<span>Artist</span><span class="main-item-dot">•</span><span class="main-item-count">${
            item.count
        } ${item.count === 1 ? 'song' : 'songs'}</span>`;
    } else if (item.type === 'folder') {
        coverContent = `<svg class="main-item-cover-svg folder-cover-svg" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="50" height="50">
            <rect class="folder-cover-bg" width="400" height="400" rx="8"/>
            <path d="M108 173 L108 148 Q108 130 126 130 L172 130 Q180 130 186 136 L200 150 Q206 155 214 155 L274 155 Q292 155 292 173 L292 272 Q292 290 274 290 L126 290 Q108 290 108 272 Z" fill="#212121" stroke="none"/>
            <path d="M108 173 L108 148 Q108 130 126 130 L172 130 Q180 130 186 136 L200 150 Q206 155 214 155 L274 155 Q292 155 292 173 L292 272 Q292 290 274 290 L126 290 Q108 290 108 272 Z" fill="none" stroke="#c0c0c0" stroke-width="18" stroke-linejoin="round" stroke-linecap="round"/>
        </svg>`;
        subtitleText = `<span>Folder</span><span class="main-item-dot">•</span><span class="main-item-count">${
            item.countText || 'Empty'
        }</span>`;
    }

    const activeClass = isActive ? 'active' : '';
    const playingClass = isPlaying ? 'playing' : '';
    const pausedClass = isPaused ? 'paused' : '';
    const pinIndicator = item.isPinned ? '<i class="fas fa-thumbtack pinned-indicator"></i>' : '';
    const shortcutIndicator = item.isShortcut
        ? '<span class="shortcut-indicator" title="Shortcut">&#128279;</span>'
        : '';

    let onclickAttr = '';
    if (item.type === 'playlist') onclickAttr = `openPlaylist('${item.id}')`;
    else if (item.type === 'album') onclickAttr = `openAlbum('${item.id}')`;
    else if (item.type === 'artist') onclickAttr = `openArtist('${item.id}')`;
    else if (item.type === 'folder') onclickAttr = `openFolder('${item.id}')`;
    else if (item.type === 'all-songs') onclickAttr = `switchView('all-songs')`;
    else if (item.type === 'favorites') onclickAttr = `switchView('favorites')`;

    let contextMenuFn = '';
    if (item.type === 'playlist') contextMenuFn = `showPlaylistContextMenu(event, '${item.id}')`;
    else if (item.type === 'album') contextMenuFn = `showAlbumContextMenu(event, '${item.id}')`;
    else if (item.type === 'artist') contextMenuFn = `showArtistContextMenu(event, '${item.id}')`;
    else if (item.type === 'folder') contextMenuFn = `showFolderContextMenu(event, '${item.id}')`;
    else contextMenuFn = `showSpecialItemContextMenu(event, '${item.viewId}', '${escapeHtml(item.title)}')`;

    const indentPx = Math.min(item.depth || 0, 5) * 15;
    let chevronHTML = '';
    if (item.type === 'folder' && (item.childCount > 0 || item.isExpanded)) {
        const icon = item.isExpanded ? 'expand_less' : 'expand_more';
        chevronHTML = `<button class="folder-chevron ${item.isExpanded ? 'expanded' : ''}" data-folder-key="${
            item.parentKey
        }/${item.id}" onclick="event.stopPropagation(); toggleFolderExpandedFromUI('${item.parentKey}', '${
            item.id
        }')" aria-label="${
            item.isExpanded ? 'Collapse folder' : 'Expand folder'
        }"><span class="material-symbols-outlined">${icon}</span></button>`;
    }

    const isCoverPause = isPlaying && !isPaused;
    const coverBtnLabel = isCoverPause ? 'Pause' : 'Play';
    const playBtnHTML = `<button class="left-panel-cover-play-btn${isCoverPause ? ' is-pause' : ''}" data-view="${
        item.viewId
    }" onmousedown="event.stopPropagation()" aria-label="${coverBtnLabel}"></button>`;

    return `<li class="left-panel-main-item ${activeClass} ${playingClass} ${pausedClass}" 
            onclick="${onclickAttr}"
            oncontextmenu="event.preventDefault(); ${contextMenuFn}; return false;"
            data-view="${item.viewId}"
            data-pin-id="${item.pinId}"
            data-depth="${item.depth || 0}"
            data-parent-folder="${item.parentKey || 'root'}"
            tabindex="0"
            style="--indent: ${indentPx}px;">
        <div class="subfolder-row" style="padding-left: ${indentPx + 10}px;">
            <div class="main-item-cover-wrapper">${coverContent}${playBtnHTML}</div>
            <div class="main-item-info">
                <span class="main-item-title">${escapeHtml(item.title)}</span>
                <span class="main-item-subtitle">
                    ${pinIndicator}
                    ${shortcutIndicator}
                    ${subtitleText}
                </span>
            </div>
            <span class="left-panel-playing-icon"><span class="material-symbols-outlined">volume_up</span></span>
            ${chevronHTML}
        </div>
    </li>`;
}

function buildLeftPanelPlaceholderHTML(index) {
    return `<li class="left-panel-main-item lazy-skeleton" style="min-height: 59px; height: 59px; max-height: 59px; box-sizing: border-box;">
        <div class="subfolder-row" style="display: flex; align-items: center; gap: 12px; width: 100%; height: 100%; box-sizing: border-box;">
            <div class="main-item-cover-wrapper">
                <div class="ph-left-cover-skeleton"></div>
            </div>
            <div class="main-item-info">
                <div class="skeleton-bar ph-left-title"></div>
                <div class="skeleton-bar ph-left-subtitle"></div>
            </div>
        </div>
    </li>`;
}

function renderLeftPanelVisibleItems(showPlaceholders) {
    const state = leftPanelVirtualState;
    if (!state.enabled || !state.container) return;
    if (typeof currentOpenFolderId !== 'undefined' && currentOpenFolderId) return;

    const win = computeVirtualWindow(
        state.container.scrollTop,
        state.container.clientHeight,
        LEFT_ITEM_HEIGHT,
        LEFT_OVERSCAN_COUNT,
        state.currentItems.length
    );

    const songList = document.querySelector('.left-panel-main-list');
    if (!songList) return;

    const rebuilt = rebuildVirtualWindow(songList, win, LEFT_ITEM_HEIGHT, (i) =>
        showPlaceholders ? buildLeftPanelPlaceholderHTML(i) : buildLeftPanelItemAt(i, currentOpenFolderId)
    );
    state.spacerDiv = rebuilt.spacer;
    appendVirtualBottomSpacer(songList, win, LEFT_ITEM_HEIGHT, state.currentItems.length, false);

    if (showPlaceholders) {
        state.firstVisibleIndex = -1;
        state.lastVisibleIndex = -1;
        state.visibleItems = [];
    } else {
        state.firstVisibleIndex = win.start;
        state.lastVisibleIndex = win.end;
    }

    clearTimeout(state._scrollbarTimeout);
    state._scrollbarTimeout = setTimeout(() => {
        updateScrollbarById('left-panel-main-content');
    }, 16);
}

function initLeftPanelLazyLoading() {
    const content = document.getElementById('left-panel-main-content');
    if (!content) {
        setTimeout(() => initLeftPanelLazyLoading(), 100);
        return;
    }

    teardownLeftPanelLazyLoading();

    const items = getLeftPanelItemsArray();
    if (!items || items.length === 0) {
        return;
    }

    leftPanelVirtualState.enabled = true;
    leftPanelVirtualState.currentItems = items;
    leftPanelVirtualState.container = content;
    leftPanelVirtualState.firstVisibleIndex = 0;
    leftPanelVirtualState.lastVisibleIndex = 0;
    leftPanelVirtualState.visibleItems = [];
    leftPanelVirtualState.lastScrollTop = 0;
    leftPanelVirtualState.lastRenderedStart = -1;
    leftPanelVirtualState.lastRenderedEnd = -1;

    function doRender() {
        const { start: startIndex, end: endIndex } = computeVirtualWindow(
            content.scrollTop,
            content.clientHeight,
            LEFT_ITEM_HEIGHT,
            LEFT_OVERSCAN_COUNT,
            leftPanelVirtualState.currentItems.length
        );

        if (startIndex === leftPanelVirtualState.lastRenderedStart && endIndex === leftPanelVirtualState.lastRenderedEnd) return;

        const isNonOverlapping =
            startIndex > leftPanelVirtualState.lastRenderedEnd || endIndex < leftPanelVirtualState.lastRenderedStart;

        if (isNonOverlapping) {
            renderLeftPanelVisibleItems(true);
            clearTimeout(leftPanelVirtualState.scrollSettleTimeout);
            leftPanelVirtualState.scrollSettleTimeout = setTimeout(() => {
                leftPanelVirtualState.scrollSettleTimeout = null;
                renderLeftPanelVisibleItems(false);
                leftPanelVirtualState.lastRenderedStart = leftPanelVirtualState.firstVisibleIndex;
                leftPanelVirtualState.lastRenderedEnd = leftPanelVirtualState.lastVisibleIndex;
            }, VIRTUAL_SCROLL_SETTLE_MS);
        } else {
            renderLeftPanelVisibleItems(false);
            leftPanelVirtualState.lastRenderedStart = startIndex;
            leftPanelVirtualState.lastRenderedEnd = endIndex;
        }
    }

    const scrollHandle = attachRafScroll(content, doRender, () => {
        if (leftPanelVirtualState.enabled && leftPanelVirtualState.container) {
            renderLeftPanelVisibleItems(false);
            leftPanelVirtualState.lastRenderedStart = leftPanelVirtualState.firstVisibleIndex;
            leftPanelVirtualState.lastRenderedEnd = leftPanelVirtualState.lastVisibleIndex;
        }
    });
    leftPanelVirtualState._resizeObserver = scrollHandle.resizeObserver;
    const removeWheelSync = attachWheelPlaceholderSync(content);

    leftPanelVirtualState._scrollCleanup = () => {
        scrollHandle.detach();
        removeWheelSync();
        clearTimeout(leftPanelVirtualState.scrollSettleTimeout);
    };

    renderLeftPanelVisibleItems(false);
    leftPanelVirtualState.lastRenderedStart = leftPanelVirtualState.firstVisibleIndex;
    leftPanelVirtualState.lastRenderedEnd = leftPanelVirtualState.lastVisibleIndex;
}

function teardownLeftPanelLazyLoading() {
    if (leftPanelVirtualState._scrollCleanup) {
        leftPanelVirtualState._scrollCleanup();
        leftPanelVirtualState._scrollCleanup = null;
    }
    if (leftPanelVirtualState._resizeObserver) {
        leftPanelVirtualState._resizeObserver.disconnect();
        leftPanelVirtualState._resizeObserver = null;
    }
    clearTimeout(leftPanelVirtualState.scrollSettleTimeout);
    clearTimeout(leftPanelVirtualState._scrollbarTimeout);

    leftPanelVirtualState.enabled = false;
    leftPanelVirtualState.currentItems = [];
    leftPanelVirtualState.visibleItems = [];
    leftPanelVirtualState.spacerDiv = null;
}

function refreshLeftPanelLazy() {
    if (!leftPanelVirtualState.enabled) {
        initLeftPanelLazyLoading();
    } else {
        const newItems = getLeftPanelItemsArray();
        leftPanelVirtualState.currentItems = newItems;
        renderLeftPanelVisibleItems(false);
        leftPanelVirtualState.lastRenderedStart = leftPanelVirtualState.firstVisibleIndex;
        leftPanelVirtualState.lastRenderedEnd = leftPanelVirtualState.lastVisibleIndex;
    }
}

function getLeftPanelItemsArray() {
    const pinnedIds = getPinnedItems();
    const allItemsData = collectAllLeftPanelItems();

    const pinnedItems = allItemsData.filter((item) => pinnedIds.includes(item.pinId));
    const unpinnedItems = allItemsData.filter((item) => !pinnedIds.includes(item.pinId));

    pinnedItems.sort((a, b) => pinnedIds.indexOf(a.pinId) - pinnedIds.indexOf(b.pinId));

    const base = [...pinnedItems, ...unpinnedItems];
    const flat = [];
    flattenLeftPanelItems(base, 0, 'root', flat, new Set());
    return flat;
}
