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
    const saved = localStorage.getItem(STORAGE_KEYS.VIRTUAL_SCROLL_THRESHOLD);
    const parsed = parseInt(saved, 10);
    if (!isNaN(parsed) && parsed >= MIN_VIRTUAL_SCROLL_THRESHOLD && parsed <= MAX_VIRTUAL_SCROLL_THRESHOLD) {
        return snapVirtualScrollThreshold(parsed);
    }
    return DEFAULT_VIRTUAL_SCROLL_THRESHOLD;
})();

function setVirtualScrollThreshold(value) {
    const v = snapVirtualScrollThreshold(value);
    VIRTUAL_SCROLL_THRESHOLD = v;
    localStorage.setItem(STORAGE_KEYS.VIRTUAL_SCROLL_THRESHOLD, String(v));

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
// MAIN LIST ROW POSITIONING (absolute + transform, not flow + spacers)
// Only the main song list uses these - the left panel and smart-lyrics list keep using
// the flow+spacer primitives above unchanged. Rows are positioned with `transform:
// translateY()` inside a `.song-list--virtual` container of a fixed, JS-set height, so
// adding/removing a row at the edge of the window never reflows sibling rows the way
// inserting/removing a normal-flow child would - the browser only has to composite the
// moved row, not re-lay-out the list.
// ------------------------------------------------------------------------------
function createVirtualRowElement(html) {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    const element = tempDiv.firstElementChild;
    if (element) element.style.flexShrink = '0';
    return element;
}

function positionVirtualRow(element, index, itemHeight) {
    element.style.transform = `translateY(${index * itemHeight}px)`;
}

function setVirtualListHeight(list, count, itemHeight) {
    const height = count * itemHeight + 'px';
    if (list.style.height !== height) list.style.height = height;
}

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
    setVirtualListHeight(songList, state.currentSongs.length, ITEM_HEIGHT);

    if (showPlaceholders) {
        // Placeholders are on screen for ~150ms before the real rows land: start decoding the
        // destination thumbs now so they are ready the instant the rows are built.
        prewarmSongCovers(state.currentSongs, startIndex, endIndex);

        songList.innerHTML = '';

        for (let i = startIndex; i <= endIndex; i++) {
            const element = createVirtualRowElement(buildPlaceholderHTML(i));
            if (!element) continue;
            positionVirtualRow(element, i, ITEM_HEIGHT);
            songList.appendChild(element);
        }

        // Sentinel, not the real window: placeholder rows are never recycled into real
        // rows, so this forces the next real-content render to hit the full-rebuild
        // branch below instead of the no-op guard at the top of this function.
        state.visibleItems = [];
        state.firstVisibleIndex = -1;
        state.lastVisibleIndex = -1;
        state.lastRenderedStart = startIndex;
        state.lastRenderedEnd = endIndex;
    } else if (
        state.visibleItems.length === 0 ||
        startIndex > state.lastVisibleIndex ||
        endIndex < state.firstVisibleIndex
    ) {
        // Non-overlapping jump (thumb dropped far away, etc.): nothing to reuse, rebuild
        // the window from scratch.
        songList.innerHTML = '';
        state.visibleItems = [];

        for (let i = startIndex; i <= endIndex; i++) {
            const html = buildSongItemAt(i, state.currentListId);
            if (!html) continue;
            const element = createVirtualRowElement(html);
            if (!element) continue;
            positionVirtualRow(element, i, ITEM_HEIGHT);
            songList.appendChild(element);
            state.visibleItems.push({ element, index: i });
        }

        state.firstVisibleIndex = startIndex;
        state.lastVisibleIndex = endIndex;
    } else {
        // Overlapping window shift (normal scrolling): drop the rows that scrolled out,
        // append the rows that scrolled in. Because every row is positioned with
        // `transform` rather than document order, this never has to reflow the rest of
        // the list the way the old insertBefore/spacer-resize approach did - inserting or
        // removing an absolutely positioned element only repaints, it doesn't re-lay-out
        // its siblings.
        while (state.visibleItems.length && state.visibleItems[0].index < startIndex) {
            state.visibleItems.shift().element.remove();
        }
        while (state.visibleItems.length && state.visibleItems[state.visibleItems.length - 1].index > endIndex) {
            state.visibleItems.pop().element.remove();
        }

        if (startIndex < state.firstVisibleIndex) {
            for (let i = state.firstVisibleIndex - 1; i >= startIndex; i--) {
                const html = buildSongItemAt(i, state.currentListId);
                if (!html) continue;
                const element = createVirtualRowElement(html);
                if (!element) continue;
                positionVirtualRow(element, i, ITEM_HEIGHT);
                songList.appendChild(element);
                state.visibleItems.unshift({ element, index: i });
            }
        }

        if (endIndex > state.lastVisibleIndex) {
            for (let i = state.lastVisibleIndex + 1; i <= endIndex; i++) {
                const html = buildSongItemAt(i, state.currentListId);
                if (!html) continue;
                const element = createVirtualRowElement(html);
                if (!element) continue;
                positionVirtualRow(element, i, ITEM_HEIGHT);
                songList.appendChild(element);
                state.visibleItems.push({ element, index: i });
            }
        }

        state.firstVisibleIndex = startIndex;
        state.lastVisibleIndex = endIndex;
    }

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

    const songListEl = document.getElementById('song-list');
    if (songListEl) songListEl.classList.add('song-list--virtual');

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
    const songListEl = document.getElementById('song-list');
    if (songListEl) {
        songListEl.classList.remove('song-list--virtual');
        songListEl.style.height = '';
    }

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
