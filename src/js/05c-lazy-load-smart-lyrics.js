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
