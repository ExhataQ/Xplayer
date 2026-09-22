// ==============================================================================
// VIRTUAL SCROLL - MAIN SONG LIST
// ==============================================================================
const DEFAULT_VIRTUAL_SCROLL_THRESHOLD = 200;
const MIN_VIRTUAL_SCROLL_THRESHOLD = 0;
const MAX_VIRTUAL_SCROLL_THRESHOLD = 2000;
const LOW_STEP_LIMIT = 500;
const LOW_STEP = 50;
const HIGH_STEP = 100;

function snapVirtualScrollThreshold(value) {
    const v = parseInt(value, 10);
    if (isNaN(v)) return DEFAULT_VIRTUAL_SCROLL_THRESHOLD;
    let snapped;
    if (v < LOW_STEP_LIMIT) {
        snapped = Math.round(v / LOW_STEP) * LOW_STEP;
    } else {
        snapped = Math.round(v / HIGH_STEP) * HIGH_STEP;
    }
    snapped = Math.max(MIN_VIRTUAL_SCROLL_THRESHOLD, Math.min(MAX_VIRTUAL_SCROLL_THRESHOLD, snapped));
    return snapped;
}

let VIRTUAL_SCROLL_THRESHOLD = (function () {
    const saved = localStorage.getItem('virtualScrollThreshold');
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= MIN_VIRTUAL_SCROLL_THRESHOLD && parsed <= MAX_VIRTUAL_SCROLL_THRESHOLD) {
        return snapVirtualScrollThreshold(parsed);
    }
    return DEFAULT_VIRTUAL_SCROLL_THRESHOLD;
})();

function setVirtualScrollThreshold(value) {
    const v = snapVirtualScrollThreshold(value);
    VIRTUAL_SCROLL_THRESHOLD = v;
    localStorage.setItem('virtualScrollThreshold', String(v));

    if (currentView === 'settings') return v;

    const songs = getSongsForList(currentView);
    if (!songs || songs.length === 0) return v;

    const shouldBeVirtual = shouldUseVirtualScroll(songs);
    const isVirtual = virtualScrollState.enabled && virtualScrollState.currentListId === currentView;

    if (shouldBeVirtual !== isVirtual) {
        renderSongsList(songs, currentView);
    }

    return v;
}

// Single source of truth for the song row height is the CSS variable --song-item-height
// (song-list.css). .song-item and placeholder rows both use it; JS reads it here so the
// scroll math can never disagree with what is rendered. 56 is only a fallback.
const ITEM_HEIGHT = (() => {
    try {
        const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--song-item-height'));
        return v > 0 ? v : 56;
    } catch (_) {
        return 56;
    }
})();

// The one rule for "does this list use virtual scrolling": strictly more songs than the
// Advanced Settings threshold. Every list (including All Songs) follows it.
function shouldUseVirtualScroll(songs) {
    return !!songs && songs.length > VIRTUAL_SCROLL_THRESHOLD;
}
// ==============================================================================
// SHARED VIRTUAL SCROLL PRIMITIVES
// The main song list, the left panel and the smart-lyrics list all use these, so the
// window math, spacer/rebuild DOM and scroll/resize lifecycle exist exactly once.
// ==============================================================================

// Which item indexes should be in the DOM for a given scroll position.
function computeVirtualWindow(scrollTop, viewportHeight, itemHeight, overscan, count) {
    return {
        start: Math.max(0, Math.floor(scrollTop / itemHeight) - overscan),
        end: Math.min(count - 1, Math.ceil((scrollTop + viewportHeight) / itemHeight) + overscan)
    };
}

function createVirtualSpacer(heightPx) {
    const spacer = document.createElement('div');
    spacer.style.height = heightPx + 'px';
    spacer.style.width = '100%';
    spacer.style.flexShrink = '0';
    return spacer;
}

// Clears `list`, then renders [top spacer] + items win.start..win.end. buildHTML(i) returns
// the row's HTML ('' skips the row). Returns the spacer and the rendered {element, index}s.
function rebuildVirtualWindow(list, win, itemHeight, buildHTML) {
    list.innerHTML = '';
    const spacer = createVirtualSpacer(win.start * itemHeight);
    list.appendChild(spacer);
    const items = [];
    for (let i = win.start; i <= win.end; i++) {
        const html = buildHTML(i);
        if (!html) continue;
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const element = tempDiv.firstElementChild;
        if (!element) continue;
        element.style.flexShrink = '0';
        list.appendChild(element);
        items.push({ element, index: i });
    }
    return { spacer, items };
}

// Bottom spacer so the scroll height equals count * itemHeight. Returns the element or null.
function appendVirtualBottomSpacer(list, win, itemHeight, count, alwaysAdd) {
    const height = Math.max(0, count * itemHeight - win.start * itemHeight - (win.end - win.start + 1) * itemHeight);
    if (height <= 0 && !alwaysAdd) return null;
    const spacer = createVirtualSpacer(height);
    list.appendChild(spacer);
    return spacer;
}

// rAF-coalesced scroll listener (+ optional ResizeObserver) with one detach().
function attachRafScroll(content, onFrame, onResize) {
    let rafId = null;
    function onScroll() {
        if (rafId) return;
        rafId = requestAnimationFrame(() => {
            rafId = null;
            onFrame();
        });
    }
    content.addEventListener('scroll', onScroll, { passive: true });
    let resizeObserver = null;
    if (onResize) {
        resizeObserver = new ResizeObserver(onResize);
        resizeObserver.observe(content);
    }
    return {
        resizeObserver,
        detach() {
            content.removeEventListener('scroll', onScroll);
            if (resizeObserver) resizeObserver.disconnect();
            if (rafId) {
                cancelAnimationFrame(rafId);
                rafId = null;
            }
        }
    };
}

const OVERSCAN_COUNT = 15;

// ------------------------------------------------------------------------------
// COVER PRELOAD CACHE
// Row images used to be created and decoded only at the moment the row entered the DOM, so
// during a scroll they painted in visible steps. Holding an already-decoded Image object per
// nearby URL makes Chromium paint the row's <img> from the decoded bitmap immediately.
// ------------------------------------------------------------------------------
const COVER_PRELOAD_LIMIT = 800;
const COVER_PREWARM_MARGIN = 60;
const coverPreloadCache = new Map(); // url -> { img, promise }; Map order doubles as LRU

function preloadCover(url) {
    if (!url) return Promise.resolve();
    const hit = coverPreloadCache.get(url);
    if (hit) {
        coverPreloadCache.delete(url);
        coverPreloadCache.set(url, hit);
        return hit.promise;
    }
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    const promise = (img.decode ? img.decode() : Promise.resolve()).catch(() => {});
    coverPreloadCache.set(url, { img, promise });
    if (coverPreloadCache.size > COVER_PRELOAD_LIMIT) {
        coverPreloadCache.delete(coverPreloadCache.keys().next().value);
    }
    return promise;
}

function prewarmSongCovers(songs, from, to) {
    if (!songs || songs.length === 0) return;
    const start = Math.max(0, from);
    const end = Math.min(songs.length - 1, to);
    for (let i = start; i <= end; i++) {
        const cover = songs[i] && songs[i].cover;
        if (cover) preloadCover(cover);
    }
}

let virtualScrollState = {
    enabled: false,
    currentListId: null,
    currentSongs: [],
    visibleItems: [],
    firstVisibleIndex: 0,
    lastVisibleIndex: 0,
    lastRenderedStart: -1,
    lastRenderedEnd: -1,
    scrollSettleTimeout: null,
    thumbHoldSettleTimeout: null,
    lastScrollTime: 0,
    lastScrollTop: 0,
    placeholderMode: false,
    spacerDiv: null,
    container: null
};

function buildSongItemAt(index, listId) {
    const song = virtualScrollState.currentSongs[index];
    if (!song) return '';
    return createSongItemHTML(song, index, listId);
}

function buildPlaceholderHTML(index) {
    return `
    <div class="song-item lazy-skeleton">
        <div class="song-number-item"><div class="ph-number-placeholder"></div></div>
        <div class="left-song-item">
            <div class="song-cover"></div>
            <div class="song-info">
                <div class="skeleton-bar title"></div>
                <div class="skeleton-bar artist"></div>
            </div>
        </div>
        <div class="song-album"><div class="skeleton-bar"></div></div>
        <div class="right-song-item">
            <div class="song-action-buttons"><div class="add-to-queue-btn ph-action-placeholder"></div><div class="favorite-btn ph-action-placeholder"></div></div>
            <div class="skeleton-bar duration"></div>
            <div class="more-info ph-more-placeholder" style="opacity: 0;">
                <span class="material-symbols-outlined">more_horiz</span>
            </div>
        </div>
    </div>`;
}

function renderVisibleItems(content, showPlaceholders) {
    if (currentView === 'settings') return;

    const state = virtualScrollState;
    const { start: startIndex, end: endIndex } = computeVirtualWindow(
        content.scrollTop,
        content.clientHeight,
        ITEM_HEIGHT,
        OVERSCAN_COUNT,
        state.currentSongs.length
    );

    if (
        !showPlaceholders &&
        startIndex === state.firstVisibleIndex &&
        endIndex === state.lastVisibleIndex &&
        state.visibleItems.length > 0
    )
        return;

    const songList = document.getElementById('song-list');
    if (!songList) return;

    if (typeof hideHoverHighlight === 'function') {
        hideHoverHighlight();
        hoveredSongIndex = -1;
    }

    state.placeholderMode = !!showPlaceholders;

    if (showPlaceholders) {
        // Placeholders are on screen for ~150ms before the real rows land: start decoding the
        // destination thumbs now so they are ready the instant the rows are built.
        prewarmSongCovers(state.currentSongs, startIndex, endIndex);

        state.firstVisibleIndex = -1;
        state.lastVisibleIndex = -1;
        state.visibleItems = [];

        state.lastRenderedStart = startIndex;
        state.lastRenderedEnd = endIndex;

        state.spacerDiv = rebuildVirtualWindow(
            songList,
            { start: startIndex, end: endIndex },
            ITEM_HEIGHT,
            buildPlaceholderHTML
        ).spacer;
    } else if (
        state.visibleItems.length === 0 ||
        startIndex > state.lastVisibleIndex ||
        endIndex < state.firstVisibleIndex
    ) {
        state.firstVisibleIndex = startIndex;
        state.lastVisibleIndex = endIndex;

        const rebuilt = rebuildVirtualWindow(
            songList,
            { start: startIndex, end: endIndex },
            ITEM_HEIGHT,
            (i) => buildSongItemAt(i, state.currentListId)
        );
        state.spacerDiv = rebuilt.spacer;
        state.visibleItems = rebuilt.items;
    } else {
        if (startIndex < state.firstVisibleIndex) {
            for (let i = state.firstVisibleIndex - 1; i >= startIndex; i--) {
                const html = buildSongItemAt(i, state.currentListId);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                const item = tempDiv.firstElementChild;
                if (state.spacerDiv && state.spacerDiv.nextSibling) {
                    songList.insertBefore(item, state.spacerDiv.nextSibling);
                } else if (songList.children.length > 0) {
                    songList.insertBefore(item, songList.children[1]);
                } else {
                    songList.appendChild(item);
                }
                state.visibleItems.unshift({
                    element: item,
                    index: i
                });
            }
        }

        if (endIndex > state.lastVisibleIndex) {
            const bottomSpacer = songList.lastElementChild;
            for (let i = state.lastVisibleIndex + 1; i <= endIndex; i++) {
                const html = buildSongItemAt(i, state.currentListId);
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html;
                const item = tempDiv.firstElementChild;
                if (bottomSpacer && bottomSpacer.style.height && parseInt(bottomSpacer.style.height) > 0) {
                    songList.insertBefore(item, bottomSpacer);
                } else {
                    songList.appendChild(item);
                }
                state.visibleItems.push({
                    element: item,
                    index: i
                });
            }
        }

        if (startIndex > state.firstVisibleIndex) {
            for (let i = state.firstVisibleIndex; i < startIndex; i++) {
                if (
                    state.spacerDiv &&
                    state.spacerDiv.nextSibling &&
                    state.spacerDiv.nextSibling !== songList.lastElementChild
                ) {
                    state.spacerDiv.nextSibling.remove();
                    state.visibleItems.shift();
                }
            }
        }

        if (endIndex < state.lastVisibleIndex) {
            for (let i = endIndex + 1; i <= state.lastVisibleIndex; i++) {
                const allChildren = songList.children;
                if (allChildren.length > 2) {
                    const beforeBottom = allChildren[allChildren.length - 2];
                    if (
                        beforeBottom &&
                        beforeBottom !== state.spacerDiv &&
                        beforeBottom.classList.contains('song-item')
                    ) {
                        beforeBottom.remove();
                        state.visibleItems.pop();
                    }
                }
            }
        }

        state.spacerDiv.style.height = startIndex * ITEM_HEIGHT + 'px';
        state.firstVisibleIndex = startIndex;
        state.lastVisibleIndex = endIndex;
    }

    const totalHeight = state.currentSongs.length * ITEM_HEIGHT;
    const renderedHeight = startIndex * ITEM_HEIGHT + (endIndex - startIndex + 1) * ITEM_HEIGHT;
    const bottomSpacerHeight = Math.max(0, totalHeight - renderedHeight);

    let bottomSpacer = songList.lastElementChild;
    if (bottomSpacer && (bottomSpacer === state.spacerDiv || bottomSpacer.classList.contains('song-item'))) {
        bottomSpacer = document.createElement('div');
        bottomSpacer.style.width = '100%';
        songList.appendChild(bottomSpacer);
    }
    if (!bottomSpacer || bottomSpacer.style.height === undefined) {
        bottomSpacer = document.createElement('div');
        bottomSpacer.style.width = '100%';
        songList.appendChild(bottomSpacer);
    }
    bottomSpacer.style.height = bottomSpacerHeight + 'px';

    if (!showPlaceholders) {
        prewarmSongCovers(state.currentSongs, startIndex - COVER_PREWARM_MARGIN, endIndex + COVER_PREWARM_MARGIN);
    }

    if (!showPlaceholders && currentView !== 'lyrics') {
        applyStoredHighlight(state.currentListId);
    }
}

function syncPlaceholdersForJump(content, topOverride) {
    if (virtualScrollState.enabled && virtualScrollState.container === content) {
        if (currentView === 'settings') return;

        const state = virtualScrollState;
        const top = typeof topOverride === 'number' ? topOverride : content.scrollTop;
        const win = computeVirtualWindow(top, content.clientHeight, ITEM_HEIGHT, OVERSCAN_COUNT, state.currentSongs.length);

        if (win.start > state.lastRenderedEnd || win.end < state.lastRenderedStart) {
            renderVisibleItems(content, true);
        }
        return;
    }

    if (leftPanelVirtualState.enabled && leftPanelVirtualState.container === content) {
        const state = leftPanelVirtualState;
        const top = typeof topOverride === 'number' ? topOverride : content.scrollTop;
        const win = computeVirtualWindow(top, content.clientHeight, LEFT_ITEM_HEIGHT, LEFT_OVERSCAN_COUNT, state.currentItems.length);

        if (win.start > state.lastRenderedEnd || win.end < state.lastRenderedStart) {
            renderLeftPanelVisibleItems(true);
        }
    }
}

function attachWheelPlaceholderSync(content) {
    function onWheel(e) {
        if (currentView === 'settings') return;
        if (!virtualScrollState.enabled) return;
        const maxTop = content.scrollHeight - content.clientHeight;
        if (maxTop <= 0) return;
        const delta = e.deltaMode === 1 ? e.deltaY * 18 : e.deltaMode === 2 ? e.deltaY * content.clientHeight : e.deltaY;
        const predictedTop = Math.max(0, Math.min(maxTop, content.scrollTop + delta));
        syncPlaceholdersForJump(content, predictedTop);
    }
    content.addEventListener('wheel', onWheel, { passive: true });
    return () => content.removeEventListener('wheel', onWheel);
}

const VIRTUAL_SCROLL_HIGHLIGHT_THROTTLE_MS = 80;
let virtualScrollHighlightThrottleTimer = null;
let virtualScrollHighlightTrailingPending = false;
let virtualScrollHighlightTrailingListId = null;

function scheduleVirtualScrollHighlightUpdate(listId) {
    virtualScrollHighlightTrailingListId = listId;
    if (virtualScrollHighlightThrottleTimer) {
        virtualScrollHighlightTrailingPending = true;
        return;
    }
    runVirtualScrollHighlightUpdate(listId);
    virtualScrollHighlightThrottleTimer = setTimeout(() => {
        virtualScrollHighlightThrottleTimer = null;
        if (virtualScrollHighlightTrailingPending) {
            virtualScrollHighlightTrailingPending = false;
            scheduleVirtualScrollHighlightUpdate(virtualScrollHighlightTrailingListId);
        }
    }, VIRTUAL_SCROLL_HIGHLIGHT_THROTTLE_MS);
}

function runVirtualScrollHighlightUpdate(listId) {
    reapplySelectionState();
    applyStoredHighlight(listId);
}

const VIRTUAL_SCROLL_SETTLE_MS = 150;

function scheduleVirtualScrollSettle(content) {
    const target = content || virtualScrollState.container;
    if (!target) return;

    clearTimeout(virtualScrollState.scrollSettleTimeout);
    virtualScrollState.scrollSettleTimeout = setTimeout(() => {
        virtualScrollState.scrollSettleTimeout = null;
        if (currentView === 'settings') return;
        if (!virtualScrollState.enabled) return;

        renderVisibleItems(target, false);
        virtualScrollState.lastRenderedStart = virtualScrollState.firstVisibleIndex;
        virtualScrollState.lastRenderedEnd = virtualScrollState.lastVisibleIndex;
        virtualScrollState.lastScrollTop = target.scrollTop;
        runVirtualScrollHighlightUpdate(virtualScrollState.currentListId);
        if (typeof scheduleHoverHighlightUpdate === 'function') {
            scheduleHoverHighlightUpdate();
        }
    }, VIRTUAL_SCROLL_SETTLE_MS);
}

function initLazyLoading(songs, listId) {
    if (currentView === 'settings') return;

    teardownLazyLoading();

    if (!songs || songs.length === 0) return;

    virtualScrollState.enabled = true;
    virtualScrollState.currentListId = listId;
    virtualScrollState.currentSongs = songs;
    virtualScrollState.firstVisibleIndex = 0;
    virtualScrollState.lastVisibleIndex = 0;
    virtualScrollState.visibleItems = [];
    virtualScrollState.scrollSettleTimeout = null;
    virtualScrollState.lastScrollTime = 0;

    const content = document.querySelector('.content');
    virtualScrollState.container = content;
    virtualScrollState.lastScrollTop = content ? content.scrollTop : 0;
    virtualScrollState.placeholderMode = false;

    let fastStreak = 0;
    virtualScrollState.lastRenderedStart = -1;
    virtualScrollState.lastRenderedEnd = -1;

    function doRender() {
        if (currentView === 'settings') return;
        const viewportTop = content.scrollTop;
        const viewportHeight = content.clientHeight;
        const { start: startIndex, end: endIndex } = computeVirtualWindow(
            viewportTop,
            viewportHeight,
            ITEM_HEIGHT,
            OVERSCAN_COUNT,
            virtualScrollState.currentSongs.length
        );

        const scrollDelta = Math.abs(viewportTop - virtualScrollState.lastScrollTop);
        virtualScrollState.lastScrollTop = viewportTop;

        const isHoldingThumb = document.body.classList.contains('dragging-scrollbar');

        const enterFastThreshold = viewportHeight * 0.75;
        const stayFastThreshold = viewportHeight * 0.25;
        const isFastFrame = virtualScrollState.placeholderMode
            ? scrollDelta > stayFastThreshold
            : scrollDelta > enterFastThreshold;

        // A thumb drag has to stay fast for a couple of frames before placeholders
        // appear, so grabbing the thumb and nudging it never flashes placeholders.
        fastStreak = isFastFrame ? fastStreak + 1 : 0;

        if (startIndex === virtualScrollState.lastRenderedStart && endIndex === virtualScrollState.lastRenderedEnd) {
            // Nothing new to draw. If placeholders are still showing (e.g. the thumb hit
            // the very top/bottom and no more scroll events will come), settle to real rows.
            if (virtualScrollState.placeholderMode && !virtualScrollState.scrollSettleTimeout) {
                scheduleVirtualScrollSettle(content);
            }
            return;
        }

        const isNonOverlapping =
            startIndex > virtualScrollState.lastRenderedEnd || endIndex < virtualScrollState.lastRenderedStart;

        const requiredStreak = isHoldingThumb && !virtualScrollState.placeholderMode ? 2 : 1;
        const isFastScroll = fastStreak >= requiredStreak;

        // While the thumb is held, ONLY the thumb-hold timer (scheduleThumbHoldSettle) may
        // render real rows. The normal 150ms scroll settle must not fire, or it wins the race
        // and the content loads long before the user has actually stopped.
        const stayInPlaceholderMode = isHoldingThumb && virtualScrollState.placeholderMode;

        if (isNonOverlapping || isFastScroll || stayInPlaceholderMode) {
            renderVisibleItems(content, true);
            if (isHoldingThumb) {
                clearTimeout(virtualScrollState.scrollSettleTimeout);
                virtualScrollState.scrollSettleTimeout = null;
            } else {
                scheduleVirtualScrollSettle(content);
            }
        } else if (isHoldingThumb) {
            // Slow frame while the thumb is held: keep placeholders up, do NOT render real
            // rows. The thumb-hold timer will draw them once the thumb has been still for
            // THUMB_HOLD_SETTLE_MS.
            renderVisibleItems(content, true);
            clearTimeout(virtualScrollState.scrollSettleTimeout);
            virtualScrollState.scrollSettleTimeout = null;
        } else {
            clearTimeout(virtualScrollState.scrollSettleTimeout);
            virtualScrollState.scrollSettleTimeout = null;
            renderVisibleItems(content, false);
            virtualScrollState.lastRenderedStart = startIndex;
            virtualScrollState.lastRenderedEnd = endIndex;
            runVirtualScrollHighlightUpdate(virtualScrollState.currentListId);
            if (typeof scheduleHoverHighlightUpdate === 'function') {
                scheduleHoverHighlightUpdate();
            }
        }
    }

    const scrollHandle = attachRafScroll(content, doRender, () => {
        if (currentView === 'settings') return;
        if (virtualScrollState.enabled && virtualScrollState.container) {
            renderVisibleItems(virtualScrollState.container, false);
            virtualScrollState.lastRenderedStart = virtualScrollState.firstVisibleIndex;
            virtualScrollState.lastRenderedEnd = virtualScrollState.lastVisibleIndex;
        }
    });
    virtualScrollState._resizeObserver = scrollHandle.resizeObserver;
    const removeWheelSync = attachWheelPlaceholderSync(content);

    virtualScrollState._scrollCleanup = () => {
        scrollHandle.detach();
        removeWheelSync();
        clearTimeout(virtualScrollState.scrollSettleTimeout);
    };

    renderVisibleItems(content, false);
    virtualScrollState.lastRenderedStart = virtualScrollState.firstVisibleIndex;
    virtualScrollState.lastRenderedEnd = virtualScrollState.lastVisibleIndex;
}

function renderVirtualScrollImmediate(content) {
    if (!virtualScrollState.enabled) return;
    if (currentView === 'settings') return;

    const target = content || virtualScrollState.container;
    if (!target) return;

    clearTimeout(virtualScrollState.scrollSettleTimeout);
    virtualScrollState.scrollSettleTimeout = null;

    virtualScrollState.visibleItems = [];
    virtualScrollState.firstVisibleIndex = -1;
    virtualScrollState.lastVisibleIndex = -1;

    renderVisibleItems(target, false);
    virtualScrollState.lastRenderedStart = virtualScrollState.firstVisibleIndex;
    virtualScrollState.lastRenderedEnd = virtualScrollState.lastVisibleIndex;
    virtualScrollState.lastScrollTop = target.scrollTop;

    if (typeof reapplySelectionState === 'function') {
        reapplySelectionState();
    }
    if (typeof applyStoredHighlight === 'function') {
        applyStoredHighlight(virtualScrollState.currentListId);
    }
}

const THUMB_HOLD_SETTLE_MS = 400;

function scheduleThumbHoldSettle(content) {
    if (!content) return;
    clearTimeout(virtualScrollState.thumbHoldSettleTimeout);
    virtualScrollState.thumbHoldSettleTimeout = setTimeout(() => {
        virtualScrollState.thumbHoldSettleTimeout = null;
        if (!virtualScrollState.enabled || virtualScrollState.container !== content) return;
        if (currentView === 'settings') return;
        renderVirtualScrollImmediate(content);
    }, THUMB_HOLD_SETTLE_MS);
}


function settleVirtualScrollAfterThumbRelease(content) {
    if (!content) return;

    if (virtualScrollState.enabled && virtualScrollState.container === content) {
        renderVirtualScrollImmediate(content);
        return;
    }

    if (leftPanelVirtualState.enabled && leftPanelVirtualState.container === content) {
        const state = leftPanelVirtualState;
        clearTimeout(state.scrollSettleTimeout);
        state.scrollSettleTimeout = null;
        state.firstVisibleIndex = -1;
        state.lastVisibleIndex = -1;
        renderLeftPanelVisibleItems(false);
        state.lastRenderedStart = state.firstVisibleIndex;
        state.lastRenderedEnd = state.lastVisibleIndex;
    }
}

function teardownLazyLoading() {
    if (virtualScrollState._scrollCleanup) {
        virtualScrollState._scrollCleanup();
        virtualScrollState._scrollCleanup = null;
    }
    if (virtualScrollState._resizeObserver) {
        virtualScrollState._resizeObserver.disconnect();
        virtualScrollState._resizeObserver = null;
    }
    clearTimeout(virtualScrollState.scrollSettleTimeout);
    virtualScrollState.scrollSettleTimeout = null;
    clearTimeout(virtualScrollState.thumbHoldSettleTimeout);
    virtualScrollState.thumbHoldSettleTimeout = null;

    virtualScrollState.enabled = false;
    virtualScrollState.currentListId = null;
    virtualScrollState.currentSongs = [];
    virtualScrollState.visibleItems = [];
    virtualScrollState.firstVisibleIndex = 0;
    virtualScrollState.lastVisibleIndex = 0;
    virtualScrollState.lastRenderedStart = -1;
    virtualScrollState.lastRenderedEnd = -1;
    virtualScrollState.lastScrollTop = 0;
    virtualScrollState.placeholderMode = false;
    virtualScrollState.spacerDiv = null;
}

function getLazyState() {
    return {
        enabled: virtualScrollState.enabled,
        renderedCount: virtualScrollState.visibleItems.length,
        totalItems: virtualScrollState.currentSongs.length,
        currentListId: virtualScrollState.currentListId,
        currentSongs: virtualScrollState.currentSongs,
        firstVisibleIndex: virtualScrollState.firstVisibleIndex,
        lastVisibleIndex: virtualScrollState.lastVisibleIndex
    };
}

function reapplySelectionState() {
    if (typeof currentView !== 'undefined' && currentView === 'lyrics') return;
    if (typeof selectedSongIds === 'undefined' || !selectedSongIds || selectedSongIds.size === 0) return;

    const songItems = document.querySelectorAll('#song-list .song-item:not(.lazy-skeleton)');
    songItems.forEach((item) => {
        const songId = parseInt(item.getAttribute('data-song-id'));
        if (!isNaN(songId) && selectedSongIds.has(songId)) {
            item.classList.add('selected');
            if (songId === selectedSongId) {
                item.classList.add('last-selected');
            }
        }
    });

    if (typeof updateSelectionHighlight === 'function') {
        updateSelectionHighlight();
    }
}

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


// ==============================================================================
// VIRTUAL SCROLL - SMART LYRICS FINDER LIST
// ==============================================================================
// Smart-lyrics rows are .song-item rows, so they share the main list's row height.
const SMART_LYRICS_ITEM_HEIGHT = ITEM_HEIGHT;
const SMART_LYRICS_OVERSCAN_COUNT = 12;

let smartLyricsVirtualState = {
    enabled: false,
    currentSongs: [],
    spacerDiv: null,
    bottomSpacerDiv: null,
    container: null,
    firstVisibleIndex: 0,
    lastVisibleIndex: 0,
    scrollSettleTimeout: null,
    lastScrollTop: 0
};

function buildSmartLyricsRowAt(index) {
    if (typeof buildSmartLyricsRowHTML !== 'function') return '';
    const song = smartLyricsVirtualState.currentSongs[index];
    if (!song) return '';
    return buildSmartLyricsRowHTML(song, index);
}

function renderSmartLyricsVisibleItems(showPlaceholders) {
    const state = smartLyricsVirtualState;
    if (!state.enabled || !state.container) return;

    const content = state.container;
    const list = document.getElementById('smart-lyrics-song-list');
    if (!list) return;

    const items = state.currentSongs;
    if (!items || items.length === 0) return;

    const listRect = list.getBoundingClientRect();
    const contentRect = content.getBoundingClientRect();
    const listTopInContent = listRect.top - contentRect.top + content.scrollTop;
    const viewportTop = Math.max(0, content.scrollTop - listTopInContent);
    const viewportHeight = content.clientHeight;

    const { start: startIndex, end: endIndex } = computeVirtualWindow(
        viewportTop,
        viewportHeight,
        SMART_LYRICS_ITEM_HEIGHT,
        SMART_LYRICS_OVERSCAN_COUNT,
        items.length
    );

    if (
        !showPlaceholders &&
        startIndex === state.firstVisibleIndex &&
        endIndex === state.lastVisibleIndex &&
        state.spacerDiv
    ) {
        return;
    }

    const win = { start: startIndex, end: endIndex };
    state.spacerDiv = rebuildVirtualWindow(list, win, SMART_LYRICS_ITEM_HEIGHT, (i) =>
        showPlaceholders ? '' : buildSmartLyricsRowAt(i)
    ).spacer;
    state.bottomSpacerDiv = appendVirtualBottomSpacer(list, win, SMART_LYRICS_ITEM_HEIGHT, items.length, true);

    state.firstVisibleIndex = startIndex;
    state.lastVisibleIndex = endIndex;
}

function initSmartLyricsVirtualScroll() {
    teardownSmartLyricsVirtualScroll();

    const content = document.querySelector('.content');
    if (!content) return;

    smartLyricsVirtualState.enabled = true;
    smartLyricsVirtualState.container = content;
    smartLyricsVirtualState.firstVisibleIndex = 0;
    smartLyricsVirtualState.lastVisibleIndex = 0;
    smartLyricsVirtualState.lastScrollTop = content.scrollTop;

    function doRender() {
        if (!smartLyricsVirtualState.enabled) return;
        renderSmartLyricsVisibleItems(false);
        smartLyricsVirtualState.lastScrollTop = content.scrollTop;
    }

    const scrollHandle = attachRafScroll(content, doRender, () => {
        if (smartLyricsVirtualState.enabled) {
            renderSmartLyricsVisibleItems(false);
        }
    });
    smartLyricsVirtualState._resizeObserver = scrollHandle.resizeObserver;
    smartLyricsVirtualState._scrollCleanup = () => scrollHandle.detach();

    renderSmartLyricsVisibleItems(false);
}

function teardownSmartLyricsVirtualScroll() {
    if (smartLyricsVirtualState._scrollCleanup) {
        smartLyricsVirtualState._scrollCleanup();
        smartLyricsVirtualState._scrollCleanup = null;
    }
    if (smartLyricsVirtualState._resizeObserver) {
        smartLyricsVirtualState._resizeObserver.disconnect();
        smartLyricsVirtualState._resizeObserver = null;
    }
    clearTimeout(smartLyricsVirtualState.scrollSettleTimeout);

    smartLyricsVirtualState.enabled = false;
    smartLyricsVirtualState.currentSongs = [];
    smartLyricsVirtualState.spacerDiv = null;
    smartLyricsVirtualState.bottomSpacerDiv = null;
    smartLyricsVirtualState.container = null;
    smartLyricsVirtualState.firstVisibleIndex = 0;
    smartLyricsVirtualState.lastVisibleIndex = 0;
}

function refreshSmartLyricsVirtualScroll(songs) {
    // init() calls teardown(), which clears currentSongs, so the songs must be assigned
    // AFTER init or the first render would see an empty list.
    if (!smartLyricsVirtualState.enabled) {
        initSmartLyricsVirtualScroll();
    }
    smartLyricsVirtualState.currentSongs = songs || [];
    smartLyricsVirtualState.firstVisibleIndex = -1;
    smartLyricsVirtualState.lastVisibleIndex = -1;
    renderSmartLyricsVisibleItems(false);
}
