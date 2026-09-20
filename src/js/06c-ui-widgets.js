// ==============================================================================
// EXTERNAL SCROLLBAR FUNCTIONALITY
// ==============================================================================

function updateScrollbarById(contentId) {
    setTimeout(() => {
        if (!window.scrollbarInstances) return;
        const scrollbarInstance = window.scrollbarInstances.find((instance) => instance.content?.id === contentId);
        if (scrollbarInstance?.updateScrollbar) {
            scrollbarInstance.updateScrollbar();
        }
    }, 50);
}

window.addEventListener('beforeunload', function () {
    if (window.scrollbarInstances) {
        window.scrollbarInstances.forEach((instance) => {
            if (instance.content) {
                instance.content.removeEventListener('scroll', instance.scheduleScrollbarUpdate);
                instance.content.removeEventListener('mouseenter', instance.handleMouseEnter);
                instance.content.removeEventListener('mouseleave', instance.handleMouseLeave);
                window.removeEventListener('resize', instance.updateScrollbar);
            }
        });
    }
});

let lastMouseX = 0;
let lastMouseY = 0;

document.addEventListener(
    'mousemove',
    (e) => {
        lastMouseX = e.clientX;
        lastMouseY = e.clientY;
    },
    { passive: true, capture: true }
);

function initExternalScrollbar(contentId, scrollbarId, thumbId) {
    const content = document.getElementById(contentId);
    const externalScrollbar = document.getElementById(scrollbarId);
    const scrollbarThumb = document.getElementById(thumbId);

    if (!content || !externalScrollbar || !scrollbarThumb) return;

    let scrollbarUpdateRAF = null;
    function scheduleScrollbarUpdate() {
        if (scrollbarUpdateRAF) return;
        scrollbarUpdateRAF = requestAnimationFrame(() => {
            scrollbarUpdateRAF = null;
            updateScrollbar();
        });
    }

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

        const topOffset = contentId === 'main-content' ? 52 : 0;
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

    if (contentId === 'main-content') {
        updateExternalScrollbar = updateScrollbar;
    }

    content.addEventListener('scroll', scheduleScrollbarUpdate);

    window.addEventListener('resize', updateScrollbar);

    updateScrollbar();

    if (content.scrollHeight > content.clientHeight) {
        externalScrollbar.classList.add('visible');
    }

    const checkMouseOver = () => {
        const rect = content.getBoundingClientRect();
        if (
            lastMouseX >= rect.left &&
            lastMouseX <= rect.right &&
            lastMouseY >= rect.top &&
            lastMouseY <= rect.bottom &&
            content.scrollHeight > content.clientHeight
        ) {
            externalScrollbar.classList.add('visible');
        }
    };
    setTimeout(checkMouseOver, 200);
    setTimeout(checkMouseOver, 500);
    setTimeout(checkMouseOver, 800);

    let hideTimeout = null;
    let isDragging = false;
    let isDraggingTrack = false;

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
        if (isDraggingTrack) return;
        if (hideTimeout) {
            clearTimeout(hideTimeout);
        }
        hideTimeout = setTimeout(() => {
            externalScrollbar.classList.remove('visible');
            hideTimeout = null;
        }, 750);
    }

    function handleMouseEnter() {
        showScrollbar();
    }

    function handleMouseLeave() {
        hideScrollbarAfterDelay();
    }

    content.addEventListener('mouseenter', handleMouseEnter);
    content.addEventListener('mouseleave', handleMouseLeave);

    scrollbarThumb.addEventListener('mouseenter', showScrollbar);
    scrollbarThumb.addEventListener('mouseleave', hideScrollbarAfterDelay);

    externalScrollbar.addEventListener('mouseenter', showScrollbar);
    externalScrollbar.addEventListener('mouseleave', hideScrollbarAfterDelay);

    if (!window.scrollbarInstances) {
        window.scrollbarInstances = [];
    }
    window.scrollbarInstances.push({
        content: content,
        updateScrollbar: updateScrollbar,
        scheduleScrollbarUpdate: scheduleScrollbarUpdate,
        handleMouseEnter: handleMouseEnter,
        handleMouseLeave: handleMouseLeave
    });

    scrollbarThumb.addEventListener('mousedown', (e) => {
        e.preventDefault();
        showScrollbar();
        isDragging = true;
        document.body.classList.add('no-select');
        document.body.classList.add('dragging-scrollbar');
        document.body.classList.add('scrollbar-holding');
        if (contentId === 'left-panel-main-content') {
            document.body.classList.add('dragging-left-scrollbar');
        }
        scrollbarThumb.classList.add('dragging');
        externalScrollbar.classList.add('visible');

        const startY = e.clientY;
        // parseFloat, not parseInt: truncating the thumb's fractional top makes the list
        // jump by several rows the moment the thumb is grabbed on a big list.
        const startTop = parseFloat(scrollbarThumb.style.top) || 0;
        const contentHeight = content.scrollHeight;
        const visibleHeight = content.clientHeight;
        const thumbHeight = parseInt(scrollbarThumb.style.height) || 30;
        const topOffset = contentId === 'main-content' ? 52 : 0;
        const bottomGap = 6;
        const trackHeight = externalScrollbar.clientHeight - topOffset - bottomGap;
        const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
        const maxScrollTop = contentHeight - visibleHeight;

        function onMouseMove(e) {
            const deltaY = e.clientY - startY;
            let newTop = startTop + deltaY;
            newTop = Math.max(topOffset, Math.min(topOffset + maxThumbTop, newTop));
            const scrollPercent = maxScrollTop > 0 ? (newTop - topOffset) / maxThumbTop : 0;
            content.scrollTop = scrollPercent * maxScrollTop;
            scrollbarThumb.style.top = newTop + 'px';

            if (typeof syncPlaceholdersForJump === 'function') {
                syncPlaceholdersForJump(content);
            }
        }

        function onMouseUp(e) {
            isDragging = false;
            document.body.classList.remove('no-select');
            document.body.classList.remove('dragging-scrollbar');
            document.body.classList.remove('scrollbar-holding');
            document.body.classList.remove('dragging-left-scrollbar');
            scrollbarThumb.classList.remove('dragging');
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (typeof hideHoverHighlight === 'function') {
                hideHoverHighlight();
                hoveredSongIndex = -1;
            }

            if (typeof settleVirtualScrollAfterThumbRelease === 'function') {
                settleVirtualScrollAfterThumbRelease(content);
            }

            const mouseX = e.clientX;
            const mouseY = e.clientY;
            const rect = content.getBoundingClientRect();
            if (mouseX >= rect.left && mouseX <= rect.right && mouseY >= rect.top && mouseY <= rect.bottom) {
                externalScrollbar.classList.add('visible');
            } else {
                hideScrollbarAfterDelay();
            }
        }

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    let trackHoldTarget = null;
    let stepAnimationId = null;
    let isFirstStep = true;
    isDraggingTrack = false;

    externalScrollbar.addEventListener('mousedown', (e) => {
        if (e.target === scrollbarThumb) return;

        e.preventDefault();
        e.stopPropagation();
        isDraggingTrack = true;
        document.body.classList.add('no-select');
        document.body.style.userSelect = 'none';
        externalScrollbar.classList.add('visible');

        const rect = externalScrollbar.getBoundingClientRect();
        const thumbHeight = parseInt(scrollbarThumb.style.height) || 30;
        const topOffset = contentId === 'main-content' ? 52 : 0;
        const bottomGap = 6;
        const trackHeight = externalScrollbar.clientHeight - topOffset - bottomGap;
        const maxThumbTop = Math.max(0, trackHeight - thumbHeight);
        const maxScrollTop = content.scrollHeight - content.clientHeight;
        const visibleHeight = content.clientHeight;

        function updateTarget(clientY) {
            const clickY = clientY - rect.top;
            let newTop = clickY - thumbHeight / 2;
            newTop = Math.max(topOffset, Math.min(topOffset + maxThumbTop, newTop));
            const scrollPercent = maxThumbTop > 0 ? (newTop - topOffset) / maxThumbTop : 0;
            trackHoldTarget = scrollPercent * maxScrollTop;
        }

        updateTarget(e.clientY);
        isFirstStep = true;

        function doStep() {
            if (trackHoldTarget === null) return;

            const direction = Math.sign(trackHoldTarget - content.scrollTop);
            const remaining = Math.abs(trackHoldTarget - content.scrollTop);
            const firstJumpDistance = Math.min(visibleHeight * 1.4, remaining * 0.3);
            const stepDistance = isFirstStep ? firstJumpDistance : visibleHeight * 1.4;
            const duration = isFirstStep ? 200 : 50;
            const delay = isFirstStep ? 200 : 0;

            const targetStep = content.scrollTop + direction * stepDistance;

            const finalTarget =
                Math.abs(trackHoldTarget - content.scrollTop) < stepDistance ? trackHoldTarget : targetStep;

            const startScrollTop = content.scrollTop;
            const distance = finalTarget - startScrollTop;
            const startTime = performance.now();

            function animateStep(currentTime) {
                const elapsed = currentTime - startTime;
                const progress = Math.min(elapsed / duration, 1);
                const eased = 1 - Math.pow(1 - progress, 3);
                content.scrollTop = startScrollTop + distance * eased;

                if (progress < 1) {
                    stepAnimationId = requestAnimationFrame(animateStep);
                } else if (trackHoldTarget !== null && Math.abs(trackHoldTarget - content.scrollTop) > 1) {
                    if (isFirstStep) {
                        isFirstStep = false;
                        setTimeout(() => doStep(), delay);
                    } else {
                        doStep();
                    }
                }
            }

            stepAnimationId = requestAnimationFrame(animateStep);
        }

        doStep();

        const onMouseMove = (e) => updateTarget(e.clientY);
        const onMouseUp = () => {
            trackHoldTarget = null;
            if (stepAnimationId) cancelAnimationFrame(stepAnimationId);
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });
}

// ==============================================================================
// GLOBAL TOOLTIP SYSTEM
// ==============================================================================
let tooltip = null;
let tooltipTimeout = null;

function temporarilySuppressTooltip(element, duration = 200) {
    if (!element) return;

    if (tooltip) {
        tooltip.style.opacity = '0';
        clearTimeout(tooltipTimeout);
        tooltipTimeout = null;
    }

    element.classList.add('tooltip-suppressed');

    if (element._tooltipSuppressTimeout) {
        clearTimeout(element._tooltipSuppressTimeout);
    }

    element._tooltipSuppressTimeout = setTimeout(() => {
        if (element) {
            element.classList.remove('tooltip-suppressed');
            element._tooltipSuppressTimeout = null;
        }
    }, duration);
}

function createTooltipElement() {
    const el = document.createElement('div');
    el.className = 'custom-tooltip';
    return el;
}

function positionTooltip(target) {
    const rect = target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();

    let left = rect.left + rect.width / 2;
    let top = rect.top - 6;

    if (left - tooltipRect.width / 2 < 6) {
        left = tooltipRect.width / 2 + 6;
    }

    if (left + tooltipRect.width / 2 > window.innerWidth - 6) {
        left = window.innerWidth - tooltipRect.width / 2 - 6;
    }

    if (top - tooltipRect.height < 6) {
        top = rect.bottom + 6;
        tooltip.style.transform = 'translate(-50%, 0)';
    } else {
        tooltip.style.transform = 'translate(-50%, -100%)';
    }

    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

document.addEventListener('mouseover', function (e) {
    const target = e.target.closest('[title], [data-original-title]');
    if (!target) return;

    if (document.body.classList.contains('suppress-tooltips')) return;

    if (target.classList && target.classList.contains('tooltip-suppressed')) return;

    if (target.disabled || target.style.opacity === '0.5') {
        target.removeAttribute('title');
        target.removeAttribute('data-original-title');
        return;
    }

    const titleText = target.getAttribute('title') || target.getAttribute('data-original-title');
    if (!titleText) return;

    if (!tooltip) {
        tooltip = createTooltipElement();
        document.body.appendChild(tooltip);
    }

    clearTimeout(tooltipTimeout);
    tooltip.style.opacity = '0';

    tooltipTimeout = setTimeout(() => {
        tooltip.textContent = titleText;

        if (target.hasAttribute('title')) {
            target.setAttribute('data-original-title', titleText);
            target.removeAttribute('title');
        }

        positionTooltip(target);
        tooltip.style.opacity = '1';
    }, 300);

    target.addEventListener(
        'mouseleave',
        function hideTooltip() {
            clearTimeout(tooltipTimeout);
            if (tooltip) {
                tooltip.style.opacity = '0';
            }
            target.removeEventListener('mouseleave', hideTooltip);
        },
        {
            once: true
        }
    );
});

document.addEventListener('click', function () {
    if (tooltip && !tooltip.classList.contains('progress-tooltip')) {
        tooltip.style.opacity = '0';
    }
});

// ==============================================================================
// TOOLTIP TITLES
// ==============================================================================
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[title]').forEach((el) => {
        const titleText = el.getAttribute('title');
        if (titleText) {
            el.setAttribute('data-original-title', titleText);
            el.removeAttribute('title');
        }
    });

    const backBtn = document.getElementById('back-btn');
    if (backBtn) backBtn.setAttribute('data-original-title', 'Go back');

    const forwardBtn = document.getElementById('forward-btn');
    if (forwardBtn) forwardBtn.setAttribute('data-original-title', 'Go forward');

    const queueToggleBtn = document.querySelector('.queue-toggle-btn');
    if (queueToggleBtn) queueToggleBtn.setAttribute('data-original-title', 'Queue');

    const subheroPlayBtnTooltip = document.getElementById('subhero-play-btn');
    if (subheroPlayBtnTooltip) subheroPlayBtnTooltip.setAttribute('data-original-title', 'Play all songs');

    const subheroShuffleBtnTooltip = document.getElementById('subhero-shuffle-btn');
    if (subheroShuffleBtnTooltip) subheroShuffleBtnTooltip.setAttribute('data-original-title', 'Shuffle');

    const shuffleBtnTooltip = document.getElementById('shuffle-btn');
    if (shuffleBtnTooltip) shuffleBtnTooltip.setAttribute('data-original-title', 'Shuffle');

    const repeatBtnTooltip = document.getElementById('repeat-btn');
    if (repeatBtnTooltip) repeatBtnTooltip.setAttribute('data-original-title', 'Repeat');

    const prevBtnTooltip = document.getElementById('prev-btn');
    if (prevBtnTooltip) prevBtnTooltip.setAttribute('data-original-title', 'Previous');

    const nextBtnTooltip = document.getElementById('next-btn');
    if (nextBtnTooltip) nextBtnTooltip.setAttribute('data-original-title', 'Next');

    const playBtnTooltip = document.getElementById('play-btn');
    if (playBtnTooltip) playBtnTooltip.setAttribute('data-original-title', 'Play');

    const createPlaylistBtn = document.querySelector('.create-playlist-header-btn');
    if (createPlaylistBtn) createPlaylistBtn.setAttribute('data-original-title', 'Create Playlist');

    const subheroSearchIcon = document.getElementById('subhero-search-icon');
    if (subheroSearchIcon) subheroSearchIcon.setAttribute('data-original-title', 'Search in All Songs');

    const collapsePanelBtn = document.getElementById('collapse-panel-btn');
    if (collapsePanelBtn) {
        if (!collapsePanelBtn.hasAttribute('data-original-title')) {
            collapsePanelBtn.setAttribute('data-original-title', 'Collapse your library');
        }
    }
});

// ==============================================================================
// DRAG & DROP - SONGS TO LEFT PANEL / QUEUE
// ==============================================================================
function initSongDragToLeftPanel() {
    const songList = document.getElementById('song-list');
    if (!songList) return;

    let dragSongId = null;
    let dragGhost = null;
    let dropTargetIndicator = null;

    songList.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const songItem = e.target.closest('.song-item');
        if (!songItem || songItem.classList.contains('lazy-skeleton')) return;

        const songIdAttr = songItem.getAttribute('data-song-id');
        if (songIdAttr === null || songIdAttr === undefined) return;
        const songId = parseInt(songIdAttr);
        if (isNaN(songId)) return;

        let hasMoved = false;
        let startX = e.clientX;
        let startY = e.clientY;

        const onMouseMove = (e) => {
            if (!hasMoved && (Math.abs(e.clientX - startX) > 5 || Math.abs(e.clientY - startY) > 5)) {
                hasMoved = true;
                const isMultiDrag =
                    songItem.classList.contains('selected') &&
                    typeof selectedSongIds !== 'undefined' &&
                    selectedSongIds.size > 1;
                dragSongId = isMultiDrag ? Array.from(selectedSongIds) : songId;
                if (isMultiDrag) {
                    dragGhost = document.createElement('div');
                    dragGhost.className = 'drag-song-tooltip';
                    dragGhost.innerHTML = `<span class="drag-song-title">${dragSongId.length} items</span>`;
                } else {
                    const songTitle = songItem.querySelector('.song-title')?.textContent || '';
                    const songArtist = songItem.querySelector('.song-artist')?.textContent || '';
                    dragGhost = document.createElement('div');
                    dragGhost.className = 'drag-song-tooltip';
                    dragGhost.innerHTML = `<span class="drag-song-title">${escapeHtml(
                        songTitle
                    )}</span><span class="drag-song-artist">${escapeHtml(songArtist)}</span>`;
                }
                dragGhost.style.position = 'fixed';
                dragGhost.style.zIndex = '100000';
                dragGhost.style.pointerEvents = 'none';
                dragGhost.style.left = e.clientX + 14 + 'px';
                dragGhost.style.top = e.clientY + 14 + 'px';
                document.body.appendChild(dragGhost);
                document.body.classList.add('no-select');
                document.body.classList.add('dragging-song');
                document.body.style.cursor = 'not-allowed';

                document.querySelectorAll('.left-panel-main-item').forEach((item) => {
                    const targetView = item.getAttribute('data-view');
                    const targetPinId = item.getAttribute('data-pin-id');
                    const isValid =
                        targetView === 'favorites' ||
                        targetPinId === 'favorites' ||
                        (targetView && targetView.startsWith('playlist-')) ||
                        (targetPinId && targetPinId.startsWith('playlist-'));
                    if (!isValid) {
                        item.classList.add('drag-invalid');
                    }
                });

                document.querySelectorAll('#recently-played-list .queue-item').forEach((item) => {
                    item.classList.add('drag-invalid');
                });
            }

            if (hasMoved && dragGhost) {
                dragGhost.style.left = e.clientX + 14 + 'px';
                dragGhost.style.top = e.clientY + 14 + 'px';

                document
                    .querySelectorAll('.left-panel-main-item.drag-hover')
                    .forEach((el) => el.classList.remove('drag-hover'));
                document.querySelectorAll('.queue-item.drag-hover').forEach((el) => el.classList.remove('drag-hover'));
                if (dropTargetIndicator) {
                    dropTargetIndicator.remove();
                    dropTargetIndicator = null;
                }

                const leftPanel = leftPanelElement;
                const isOverLeftPanel =
                    leftPanel && document.elementFromPoint(e.clientX, e.clientY)?.closest('#left-panel');

                if (isOverLeftPanel) {
                    leftPanel.classList.add('drag-panel-hover');
                } else {
                    leftPanel.classList.remove('drag-panel-hover');
                }

                const leftPanelItem = document.elementFromPoint(e.clientX, e.clientY)?.closest('.left-panel-main-item');
                const droppableLeftPanelItem =
                    leftPanelItem && !leftPanelItem.classList.contains('drag-invalid') ? leftPanelItem : null;
                if (droppableLeftPanelItem) {
                    leftPanel.classList.remove('drag-panel-hover');
                    droppableLeftPanelItem.classList.add('drag-hover');
                } else if (isOverLeftPanel) {
                    leftPanel.classList.add('drag-panel-hover');
                } else {
                    const elUnderCursor = document.elementFromPoint(e.clientX, e.clientY);
                    const queueItem = elUnderCursor?.closest('#queue-list .queue-item');
                    const isOverQueue = elUnderCursor?.closest('#queue-list');

                    if (queueItem && isOverQueue) {
                        const rect = queueItem.getBoundingClientRect();
                        const midY = rect.top + rect.height / 2;
                        const insertBefore = e.clientY < midY;
                        const queueList = document.getElementById('queue-list');

                        dropTargetIndicator = document.createElement('div');
                        dropTargetIndicator.style.cssText =
                            'height: 2px; background: var(--accent); width: calc(100% - 14px); margin: -1px 7px; border-radius: 1px; pointer-events: none;';

                        if (insertBefore) {
                            queueList.insertBefore(dropTargetIndicator, queueItem);
                        } else {
                            queueList.insertBefore(dropTargetIndicator, queueItem.nextSibling);
                        }
                    }
                }
            }
        };

        const onMouseUp = (e) => {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);

            if (hasMoved && dragGhost) {
                dragGhost.remove();
                dragGhost = null;

                const leftPanel = leftPanelElement;
                const elUnder = document.elementFromPoint(e.clientX, e.clientY);
                const rawTargetItem = elUnder?.closest('.left-panel-main-item');
                const targetItem =
                    rawTargetItem && !rawTargetItem.classList.contains('drag-invalid') ? rawTargetItem : null;
                const isOverLeftPanel = !!(leftPanel && elUnder && leftPanel.contains(elUnder));
                leftPanel?.classList.remove('drag-panel-hover');
                document
                    .querySelectorAll('.left-panel-main-item.drag-hover')
                    .forEach((el) => el.classList.remove('drag-hover'));
                document
                    .querySelectorAll('.left-panel-main-item.drag-invalid')
                    .forEach((el) => el.classList.remove('drag-invalid'));
                document
                    .querySelectorAll('#recently-played-list .queue-item.drag-invalid')
                    .forEach((el) => el.classList.remove('drag-invalid'));

                if (targetItem && dragSongId !== null && dragSongId !== undefined) {
                    const targetView = targetItem.getAttribute('data-view');
                    const targetPinId = targetItem.getAttribute('data-pin-id');

                    if (targetView === 'favorites' || targetPinId === 'favorites') {
                        const ids = Array.isArray(dragSongId) ? dragSongId : [dragSongId];
                        let addedCount = 0;
                        ids.forEach((id) => {
                            if (!isFavorite(id)) {
                                saveFavorite(id);
                                addedCount++;
                            }
                        });
                        if (addedCount > 0) {
                            syncAllUIState();
                            showNotification(`Added ${addedCount} item(s) to Liked Songs`, 'heart', 2000);
                        }
                    } else if (targetView && targetView.startsWith('folder-')) {
                        const folderId = targetView.replace('folder-', '');
                        showNotification(
                            'Songs cannot be added directly to folders. Drag a playlist instead.',
                            'warning',
                            3000
                        );
                    } else if (targetPinId && targetPinId.startsWith('folder-')) {
                        const folderId = targetPinId.replace('folder-', '');
                        showNotification(
                            'Songs cannot be added directly to folders. Drag a playlist instead.',
                            'warning',
                            3000
                        );
                    } else if (targetView && targetView.startsWith('playlist-')) {
                        const playlistId = targetView.replace('playlist-', '');
                        const ids = Array.isArray(dragSongId) ? dragSongId : [dragSongId];
                        let addedCount = 0;
                        ids.forEach((id) => {
                            if (addSongToPlaylist(id, playlistId)) addedCount++;
                        });
                        if (addedCount > 0) {
                            const playlists = getPlaylists();
                            const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
                            showNotification(
                                `Added ${addedCount} item(s) to ${playlist ? playlist.name : 'playlist'}`,
                                'success',
                                2000
                            );
                            if (currentView === targetView) {
                                renderPlaylistDetailView(playlistId);
                            }
                            renderLeftPanelMainList();
                        } else {
                            showNotification('Already in playlist', 'warning', 2000);
                        }
                    } else if (targetPinId && targetPinId.startsWith('playlist-')) {
                        const playlistId = targetPinId.replace('playlist-', '');
                        const ids = Array.isArray(dragSongId) ? dragSongId : [dragSongId];
                        let addedCount = 0;
                        ids.forEach((id) => {
                            if (addSongToPlaylist(id, playlistId)) addedCount++;
                        });
                        if (addedCount > 0) {
                            const playlists = getPlaylists();
                            const playlist = playlists.find((p) => p.id == playlistId || p.id === playlistId);
                            showNotification(
                                `Added ${addedCount} item(s) to ${playlist ? playlist.name : 'playlist'}`,
                                'success',
                                2000
                            );
                            if (currentView === `playlist-${playlistId}`) {
                                renderPlaylistDetailView(playlistId);
                            }
                            renderLeftPanelMainList();
                        } else {
                            showNotification('Already in playlist', 'warning', 2000);
                        }
                    }
                } else if (isOverLeftPanel && dragSongId) {
                    const ids = Array.isArray(dragSongId) ? dragSongId : [dragSongId];
                    let addedCount = 0;
                    ids.forEach((id) => {
                        if (!isFavorite(id)) {
                            saveFavorite(id);
                            addedCount++;
                        }
                    });
                    if (addedCount > 0) {
                        syncAllUIState();
                        showNotification(`Added ${addedCount} item(s) to Liked Songs`, 'heart', 2000);
                    }
                } else if (dropTargetIndicator && dragSongId) {
                    const queueList = document.getElementById('queue-list');
                    const allQueueItems = Array.from(queueList.querySelectorAll('.queue-item'));
                    let indicatorIdx = allQueueItems.indexOf(dropTargetIndicator);

                    let insertIndex;
                    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
                        const nowPlayingItem = allQueueItems.find((item) => {
                            const title = item.querySelector('.queue-item-title');
                            return title && title.style.color === 'var(--accent)';
                        });
                        const nowPlayingIdx = nowPlayingItem ? allQueueItems.indexOf(nowPlayingItem) : -1;

                        if (indicatorIdx <= nowPlayingIdx) {
                            insertIndex = currentQueueIndex + 1;
                        } else {
                            const manualItemsBefore = allQueueItems.slice(0, indicatorIdx).filter((item) => {
                                const section = item.closest('.added-to-queue-section');
                                return section !== null;
                            }).length;
                            const autoItemsBefore = allQueueItems.slice(0, indicatorIdx).filter((item) => {
                                const section = item.closest('.next-songs-section');
                                return section !== null;
                            }).length;
                            insertIndex = currentQueueIndex + 1 + manualItemsBefore + autoItemsBefore;
                        }
                    } else {
                        insertIndex = Math.max(0, indicatorIdx);
                    }

                    const ids = Array.isArray(dragSongId) ? dragSongId : [dragSongId];
                    let addedCount = 0;
                    ids.forEach((id, i) => {
                        if (addSongToQueueAt(id, insertIndex + i)) addedCount++;
                    });
                    if (addedCount > 0) {
                        showNotification(`Added ${addedCount} item(s) to queue`, 'success', 2000);
                    }
                }

                if (dropTargetIndicator) {
                    dropTargetIndicator.remove();
                    dropTargetIndicator = null;
                }

                dragSongId = null;
            }

            document.body.classList.remove('no-select');
            document.body.classList.remove('dragging-song');
            document.body.style.cursor = '';
        };

        const onBlurCleanup = () => {
            if (!hasMoved) return;
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('blur', onBlurCleanup);
            if (dragGhost) {
                dragGhost.remove();
                dragGhost = null;
            }
            if (dropTargetIndicator) {
                dropTargetIndicator.remove();
                dropTargetIndicator = null;
            }
            document
                .querySelectorAll('.left-panel-main-item.drag-hover, .left-panel-main-item.drag-invalid')
                .forEach((el) => {
                    el.classList.remove('drag-hover', 'drag-invalid');
                });
            document.querySelectorAll('#recently-played-list .queue-item.drag-invalid').forEach((el) => {
                el.classList.remove('drag-invalid');
            });
            leftPanelElement.classList.remove('drag-panel-hover');
            document.body.classList.remove('no-select');
            document.body.classList.remove('dragging-song');
            document.body.style.cursor = '';
            dragSongId = null;
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        window.addEventListener('blur', onBlurCleanup, {
            once: true
        });
    });
}

// ==============================================================================
// DRAG & DROP - LEFT PANEL ITEMS
// ==============================================================================
function initLeftPanelDragAndDrop() {
    const leftPanelMainList = document.querySelector('.left-panel-main-list');
    if (!leftPanelMainList) return;

    let dragItem = null;
    let dragItemId = null;
    let dragItemType = null;
    let dragItemPinId = null;
    let dragGhost = null;
    let dropTargetEl = null;
    let dropMode = null;
    let dropAbove = false;
    let dropIndicator = null;
    let dragFolderId = null;

    function isFolderContext() {
        return typeof currentOpenFolderId !== 'undefined' && !!currentOpenFolderId;
    }

    function getFolderIdForElement(el) {
        if (isFolderContext()) return currentOpenFolderId;
        if (!el) return null;
        const parent = el.getAttribute('data-parent-folder');
        return parent && parent !== 'root' ? parent : null;
    }

    function getActivePinListForFolder(folderId) {
        return folderId ? getFolderPinnedItems(folderId) : getPinnedItems();
    }

    function saveActivePinListForFolder(folderId, list) {
        if (folderId) {
            const map = getFolderPinnedItemsMap();
            map[folderId] = list;
            saveFolderPinnedItemsMap(map);
        } else {
            savePinnedItems(list);
        }
    }

    function isActivePinned(pinId) {
        return getActivePinListForFolder(dragFolderId).includes(pinId);
    }

    function parseItemMetadata(item) {
        const view = item.getAttribute('data-view');
        if (!view) return null;
        if (view === 'all-songs')
            return {
                id: 'all-songs',
                type: 'special',
                pinId: 'all-songs'
            };
        if (view === 'favorites')
            return {
                id: 'favorites',
                type: 'special',
                pinId: 'favorites'
            };
        if (view.startsWith('playlist-'))
            return {
                id: view.replace('playlist-', ''),
                type: 'playlist',
                pinId: view
            };
        if (view.startsWith('folder-'))
            return {
                id: view.replace('folder-', ''),
                type: 'folder',
                pinId: view
            };
        if (view.startsWith('a') && view.length === 13)
            return {
                id: view,
                type: 'album',
                pinId: view
            };
        if (view.startsWith('r') && view.length === 13)
            return {
                id: view,
                type: 'artist',
                pinId: view
            };
        return null;
    }

    function isDescendantFolder(rootId, candidateId) {
        if (rootId === candidateId) return true;
        const folders = getFolders();
        const stack = [rootId];
        const seen = new Set();
        while (stack.length > 0) {
            const current = stack.pop();
            if (seen.has(current)) continue;
            seen.add(current);
            const folder = folders.find((f) => f.id === current);
            if (!folder) continue;
            for (const child of folder.children) {
                if (child.type !== 'folder') continue;
                if (child.id === candidateId) return true;
                stack.push(child.id);
            }
        }
        return false;
    }

    function clearDropState() {
        if (dropTargetEl) {
            dropTargetEl.classList.remove('drag-hover');
            dropTargetEl.classList.remove('drag-folder-hover');
        }
        dropTargetEl = null;
        dropMode = null;
        if (dropIndicator) {
            dropIndicator.remove();
            dropIndicator = null;
        }
    }

    function updateDropTarget(mouseX, mouseY) {
        clearDropState();

        const el = document.elementFromPoint(mouseX, mouseY);
        const targetItem = el ? el.closest('.left-panel-main-item') : null;
        if (!targetItem || targetItem === dragItem) return;

        const meta = parseItemMetadata(targetItem);
        if (!meta) return;

        if (meta.type === 'folder' && !dragFolderId) {
            if (isActivePinned(dragItemPinId)) return;
            if (dragItemType === 'folder' && isDescendantFolder(dragItemId, meta.id)) return;

            targetItem.classList.add('drag-folder-hover');
            dropTargetEl = targetItem;
            dropMode = 'folder';
            return;
        }

        if (isActivePinned(meta.pinId)) {
            dropTargetEl = targetItem;
            dropMode = 'pin';

            const rect = targetItem.getBoundingClientRect();
            dropAbove = mouseY < rect.top + rect.height / 2;

            dropIndicator = document.createElement('div');
            dropIndicator.className = 'pinned-drop-indicator';
            const parent = targetItem.parentNode;
            if (dropAbove) {
                parent.insertBefore(dropIndicator, targetItem);
            } else {
                parent.insertBefore(dropIndicator, targetItem.nextSibling);
            }
        }
    }

    function onMouseMove(e) {
        if (!dragGhost) return;
        dragGhost.style.left = e.clientX + 14 + 'px';
        dragGhost.style.top = e.clientY + 14 + 'px';
        updateDropTarget(e.clientX, e.clientY);
    }

    function onMouseUp(e) {
        const finalTarget = dropTargetEl;
        const finalMode = dropMode;
        const finalAbove = dropAbove;

        if (dragGhost) {
            dragGhost.remove();
            dragGhost = null;
        }

        const draggedId = dragItemId;
        const draggedType = dragItemType;
        const draggedPinId = dragItemPinId;

        if (dragItem) {
            dragItem.style.opacity = '';
            dragItem.style.cursor = '';
        }

        clearDropState();

        document.body.classList.remove('no-select');
        document.body.classList.remove('dragging-song');
        document.body.style.cursor = '';

        const draggedFolderId = dragFolderId;

        dragItem = null;
        dragItemId = null;
        dragItemType = null;
        dragItemPinId = null;
        dragFolderId = null;

        if (!finalTarget || !draggedId) return;

        const meta = parseItemMetadata(finalTarget);
        if (!meta) return;

        if (finalMode === 'folder') {
            if (isActivePinned(draggedPinId)) {
                showNotification('Unpin the item before moving it into a folder', 'warning', 2000);
                return;
            }

            const isMovable = draggedType === 'playlist' || draggedType === 'folder';
            const asShortcut = !isMovable;

            const applied = addToFolder(meta.id, draggedId, draggedType, asShortcut);
            if (applied) {
                const folder = getFolders().find((f) => f.id === meta.id);
                if (asShortcut) {
                    showNotification(
                        `Added ${CONTEXT_MENU_TYPE_LABELS[draggedType] || 'Item'} shortcut to "${
                            folder ? folder.name : 'folder'
                        }"`,
                        'success',
                        2000
                    );
                } else {
                    showNotification(
                        `Moved ${CONTEXT_MENU_TYPE_LABELS[draggedType] || 'Item'} to "${
                            folder ? folder.name : 'folder'
                        }"`,
                        'success',
                        2000
                    );
                }
                renderFoldersView();
                renderLeftPanelMainList();
                updateScrollbarById('left-panel-main-content');
                if (currentOpenFolderId) renderFolderContents(currentOpenFolderId);
            } else {
                showNotification('Item already in that folder', 'warning', 2000);
            }
            return;
        }

        if (finalMode === 'pin' && draggedPinId) {
            let pinned = [...getActivePinListForFolder(draggedFolderId)];
            const wasPinned = pinned.includes(draggedPinId);

            if (!wasPinned) {
                pinned.push(draggedPinId);
            }

            let reordered = pinned;
            if (draggedPinId !== meta.pinId) {
                reordered = pinned.filter((id) => id !== draggedPinId);
                const targetIndex = reordered.indexOf(meta.pinId);
                const insertAt = targetIndex === -1 ? reordered.length : finalAbove ? targetIndex : targetIndex + 1;
                reordered.splice(insertAt, 0, draggedPinId);
            }

            saveActivePinListForFolder(draggedFolderId, reordered);

            if (!wasPinned && dragItem) {
                const label = dragItem.querySelector('.main-item-title')?.textContent || 'Item';
                showNotification(`"${label}" pinned`, 'success', 2000);
            }

            if (draggedFolderId && currentOpenFolderId === draggedFolderId) {
                renderFolderContents(draggedFolderId);
            } else if (leftPanelVirtualState.enabled) {
                leftPanelVirtualState.currentItems = getLeftPanelItemsArray();
                renderLeftPanelVisibleItems(false);
            } else {
                renderLeftPanelMainList();
            }

            updateScrollbarById('left-panel-main-content');
        }
    }

    leftPanelMainList.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        const item = e.target.closest('.left-panel-main-item');
        if (!item) return;

        const meta = parseItemMetadata(item);
        if (!meta) return;

        let hasMoved = false;
        const startX = e.clientX;
        const startY = e.clientY;

        const onMove = (moveEvent) => {
            if (!hasMoved) {
                if (Math.abs(moveEvent.clientX - startX) < 5 && Math.abs(moveEvent.clientY - startY) < 5) return;
                hasMoved = true;

                dragItem = item;
                dragItemId = meta.id;
                dragItemType = meta.type;
                dragItemPinId = meta.pinId;
                dragFolderId = getFolderIdForElement(item);

                const titleText = item.querySelector('.main-item-title')?.textContent || 'Item';

                dragGhost = document.createElement('div');
                dragGhost.className = 'drag-song-tooltip';
                dragGhost.innerHTML = `<span class="drag-song-title">${escapeHtml(
                    titleText
                )}</span><span class="drag-song-artist">${escapeHtml(
                    CONTEXT_MENU_TYPE_LABELS[meta.type] || 'Item'
                )}</span>`;
                dragGhost.style.position = 'fixed';
                dragGhost.style.zIndex = '100000';
                dragGhost.style.pointerEvents = 'none';
                dragGhost.style.left = moveEvent.clientX + 14 + 'px';
                dragGhost.style.top = moveEvent.clientY + 14 + 'px';
                document.body.appendChild(dragGhost);

                item.style.opacity = '0.4';
                item.style.cursor = 'grabbing';
                document.body.classList.add('no-select');
                document.body.classList.add('dragging-song');
                document.body.style.cursor = 'not-allowed';

                const draggedIsPinned = isActivePinned(meta.pinId);
                const inFolder = !!dragFolderId;

                document.querySelectorAll('.left-panel-main-item').forEach((el) => {
                    if (el === item) return;
                    const elMeta = parseItemMetadata(el);
                    if (!elMeta) return;
                    const isFolder = elMeta.type === 'folder';
                    const isPinnedTarget = isActivePinned(elMeta.pinId);

                    if (draggedIsPinned) {
                        if (!isPinnedTarget) el.classList.add('drag-invalid');
                    } else if (inFolder) {
                        if (!isPinnedTarget) el.classList.add('drag-invalid');
                    } else {
                        if (!isFolder && !isPinnedTarget) el.classList.add('drag-invalid');
                    }
                });
            }

            onMouseMove(moveEvent);
        };

        const onUp = (upEvent) => {
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            window.removeEventListener('blur', onBlurCleanupLeft);

            if (!hasMoved) return;

            document
                .querySelectorAll('.left-panel-main-item.drag-invalid')
                .forEach((el) => el.classList.remove('drag-invalid'));
            onMouseUp(upEvent);
        };

        const onBlurCleanupLeft = () => {
            if (!hasMoved) return;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            if (dragGhost) {
                dragGhost.remove();
                dragGhost = null;
            }
            document
                .querySelectorAll('.left-panel-main-item.drag-invalid')
                .forEach((el) => el.classList.remove('drag-invalid'));
            document
                .querySelectorAll('.left-panel-main-item.drag-hover, .left-panel-main-item.drag-folder-hover')
                .forEach((el) => {
                    el.classList.remove('drag-hover', 'drag-folder-hover');
                });
            leftPanelElement.classList.remove('drag-panel-hover');
            document.body.classList.remove('no-select');
            document.body.classList.remove('dragging-song');
            document.body.style.cursor = '';
            dragItem = null;
            dragItemId = null;
            dragItemType = null;
            dragItemPinId = null;
        };

        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        window.addEventListener('blur', onBlurCleanupLeft, {
            once: true
        });
    });
}

// ==============================================================================
// FULLSCREEN IMAGE VIEWER
// ==============================================================================
function openImageViewer() {
    const viewer = document.getElementById('image-viewer');
    const viewerImage = document.getElementById('viewer-image');
    const albumArt = document.getElementById('album-art-image');

    if (albumArt && albumArt.src && albumArt.src !== PLACEHOLDER_IMAGE) {
        viewerImage.src = albumArt.src;
        viewer.classList.remove('closing');
        viewer.classList.add('active');

        viewerImage.addEventListener('mousemove', function (e) {
            viewerMouseX = e.clientX;
            viewerMouseY = e.clientY;
        });

        viewerImage.addEventListener('click', initZoomLens);

        document.addEventListener('keydown', imageViewerKeyHandler);
    }
}

let zoomLens = null;
let lensActive = false;
let viewerMouseX = 0;
let viewerMouseY = 0;

function initZoomLens(e) {
    if (lensActive) {
        deactivateZoomLens();
        return;
    }

    const viewerImage = document.getElementById('viewer-image');
    const viewer = document.getElementById('image-viewer');
    if (!viewerImage || !viewer) return;

    lensActive = true;
    viewerImage.style.cursor = 'none';

    if (!zoomLens) {
        zoomLens = document.createElement('div');
        zoomLens.className = 'image-viewer-zoom-lens';
        document.body.appendChild(zoomLens);
    }

    let zoomLensInner = zoomLens.querySelector('.image-viewer-zoom-lens-inner');
    if (!zoomLensInner) {
        zoomLensInner = document.createElement('div');
        zoomLensInner.className = 'image-viewer-zoom-lens-inner';
        zoomLens.appendChild(zoomLensInner);
    }

    const zoomLevel = 1.75;
    const imgRectInit = viewerImage.getBoundingClientRect();
    const bgDisplayW = imgRectInit.width * zoomLevel;
    const bgDisplayH = imgRectInit.height * zoomLevel;

    zoomLensInner.style.backgroundImage = `url(${viewerImage.src})`;
    zoomLensInner.style.backgroundSize = `${bgDisplayW}px ${bgDisplayH}px`;
    zoomLensInner.style.backgroundRepeat = 'no-repeat';
    zoomLensInner.style.backgroundColor = 'transparent';

    function moveLens(e) {
        const imgRect = viewerImage.getBoundingClientRect();

        const rawX = e.clientX - imgRect.left;
        const rawY = e.clientY - imgRect.top;

        if (rawX < 0 || rawY < 0 || rawX > imgRect.width || rawY > imgRect.height) {
            zoomLens.style.display = 'none';
            return;
        }

        const lensW = zoomLens.offsetWidth || 180;
        const lensH = zoomLens.offsetHeight || 180;

        const fx = rawX / imgRect.width;
        const fy = rawY / imgRect.height;

        const bgX = fx * bgDisplayW - lensW / 2;
        const bgY = fy * bgDisplayH - lensH / 2;

        zoomLens.style.left = e.clientX - lensW / 2 + 'px';
        zoomLens.style.top = e.clientY - lensH / 2 + 'px';
        zoomLens.style.display = 'block';
        zoomLensInner.style.backgroundPosition = `${-bgX}px ${-bgY}px`;
    }

    function hideLens() {
        if (zoomLens) zoomLens.style.display = 'none';
    }

    viewer.addEventListener('mousemove', moveLens);
    viewer.addEventListener('mouseleave', hideLens);

    moveLens({
        clientX: viewerMouseX,
        clientY: viewerMouseY
    });

    zoomLens._cleanup = function () {
        viewer.removeEventListener('mousemove', moveLens);
        viewer.removeEventListener('mouseleave', hideLens);
        if (zoomLens) zoomLens.style.display = 'none';
    };
}

function deactivateZoomLens() {
    lensActive = false;
    const viewerImage = document.getElementById('viewer-image');
    if (viewerImage) viewerImage.style.cursor = '';
    if (zoomLens && zoomLens._cleanup) {
        zoomLens._cleanup();
    }
}

function closeImageViewer() {
    deactivateZoomLens();
    const viewer = document.getElementById('image-viewer');
    viewer.classList.add('closing');

    setTimeout(() => {
        viewer.classList.remove('active', 'closing');
    }, 300);

    document.removeEventListener('keydown', imageViewerKeyHandler);
}

function imageViewerKeyHandler(e) {
    if (e.key === 'Escape') {
        closeImageViewer();
    }
}

// ==============================================================================
// THEME SWITCHER
// ==============================================================================
function initThemeButtons() {
    document.querySelectorAll('.settings-theme-btn').forEach((btn) => {
        btn.removeEventListener('click', themeClickHandler);
        btn.addEventListener('click', themeClickHandler);
    });
}

function themeClickHandler(e) {
    e.stopPropagation();
    const theme = this.getAttribute('data-theme');

    document.querySelectorAll('.settings-theme-btn').forEach((b) => {
        b.classList.remove('active');
    });
    this.classList.add('active');

    document.body.classList.remove('theme-pink', 'theme-purple', 'theme-yellow', 'theme-white');

    if (theme !== 'green') {
        document.body.classList.add(`theme-${theme}`);
    }

    this.setAttribute('aria-label', `${theme} theme active`);
}

// ==============================================================================
// NOTIFICATION SYSTEM
// ==============================================================================
function showNotification(message, type = 'success', duration) {
    notificationHistory.unshift({
        message: message,
        type: type,
        timestamp: Date.now()
    });

    if (notificationHistory.length > 50) {
        notificationHistory = notificationHistory.slice(0, 50);
    }

    renderNotificationPanel();

    if (!notificationPanelOpen) {
        const badge = document.getElementById('notification-badge');
        if (badge) {
            const unreadCount = notificationHistory.filter((n) => !n.isDownloadProgress && !n.isCoverProgress && !n._viewed).length;
            if (unreadCount > 0) {
                badge.style.display = 'flex';
                badge.textContent = unreadCount;
            }
        }
    }
}

let coverNotifyIndex = -1;

function showCoverProgressNotification(processed, total, found) {
    const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
    const message = `🖼️ Finding album art... ${found} found · ${processed}/${total} scanned`;

    if (coverNotifyIndex === -1) {
        notificationHistory.unshift({
            message: message,
            type: 'info',
            timestamp: Date.now(),
            isCoverProgress: true,
            percent: pct
        });
        coverNotifyIndex = 0;
    } else {
        notificationHistory[coverNotifyIndex].message = message;
        notificationHistory[coverNotifyIndex].percent = pct;
        notificationHistory[coverNotifyIndex].timestamp = Date.now();
    }

    if (notificationHistory.length > 50) {
        if (coverNotifyIndex >= 50) coverNotifyIndex = -1;
        notificationHistory = notificationHistory.slice(0, 50);
    }

    renderNotificationPanel();
}

function completeCoverProgressNotification() {
    if (coverNotifyIndex !== -1 && notificationHistory[coverNotifyIndex]) {
        notificationHistory[coverNotifyIndex].isCoverProgress = false;
        notificationHistory[coverNotifyIndex].message = '🖼️ Album art finished loading';
        notificationHistory[coverNotifyIndex].type = 'success';
        notificationHistory[coverNotifyIndex].timestamp = Date.now();
    }
    coverNotifyIndex = -1;
    renderNotificationPanel();

    if (!notificationPanelOpen) {
        const badge = document.getElementById('notification-badge');
        if (badge) {
            const unreadCount = notificationHistory.filter((n) => !n.isDownloadProgress && !n.isCoverProgress && !n._viewed).length;
            if (unreadCount > 0) {
                badge.style.display = 'flex';
                badge.textContent = unreadCount;
            }
        }
    }
}

let notificationPanelOpen = false;
let notificationHistory = [];

function toggleNotificationPanel() {
    const panel = document.getElementById('notification-panel');
    const btn = document.getElementById('notification-panel-btn');

    if (!panel || !btn) return;

    notificationPanelOpen = !notificationPanelOpen;

    if (notificationPanelOpen) {
        const btnRect = btn.getBoundingClientRect();
        const calculatedTop = btnRect.bottom + 4;
        const calculatedRight = window.innerWidth - btnRect.right;

        panel.style.top = calculatedTop + 'px';
        panel.style.right = calculatedRight + 'px';

        setTimeout(() => {
            const closeHandler = function (e) {
                if (!notificationPanelOpen) {
                    document.removeEventListener('click', closeHandler);
                    document.removeEventListener('mousedown', closeHandler);
                    return;
                }
                const panel = document.getElementById('notification-panel');
                const btn = document.getElementById('notification-panel-btn');
                if (!panel) return;
                if (panel.contains(e.target)) return;
                if (btn && btn.contains(e.target)) return;
                closeNotificationPanel();
                document.removeEventListener('click', closeHandler);
                document.removeEventListener('mousedown', closeHandler);
            };
            document.addEventListener('click', closeHandler);
            document.addEventListener('mousedown', closeHandler);
        }, 0);
        if (btn.hasAttribute('title')) {
            btn.setAttribute('data-notif-title', btn.getAttribute('title'));
            btn.removeAttribute('title');
        }

        panel.classList.add('active');
        btn.classList.add('active');
        const badge = document.getElementById('notification-badge');
        if (badge) {
            badge.style.display = 'none';
            badge.textContent = '0';
        }
        notificationHistory.forEach((n) => (n._viewed = true));
        document.body.classList.add('suppress-tooltips');
    } else {
        panel.classList.remove('active');
        btn.classList.remove('active');
        document.body.classList.remove('suppress-tooltips');

        if (btn.hasAttribute('data-notif-title')) {
            btn.setAttribute('title', btn.getAttribute('data-notif-title'));
            btn.removeAttribute('data-notif-title');
        }
    }
}

function closeNotificationPanel() {
    const panel = document.getElementById('notification-panel');
    const btn = document.getElementById('notification-panel-btn');

    if (panel) panel.classList.remove('active');
    if (btn) btn.classList.remove('active');
    notificationPanelOpen = false;
    document.body.classList.remove('suppress-tooltips');
}

function clearAllNotifications() {
    notificationHistory = [];
    downloadNotifyIndex = -1;
    renderNotificationPanel();
    const badge = document.getElementById('notification-badge');
    if (badge) {
        badge.style.display = 'none';
        badge.textContent = '0';
    }
    if (notificationPanelOpen) {
        closeNotificationPanel();
    }
}

function removeNotificationItem(index) {
    if (notificationHistory[index] && notificationHistory[index].isDownloadProgress) {
        downloadNotifyIndex = -1;
    } else if (downloadNotifyIndex > index) {
        downloadNotifyIndex--;
    }
    notificationHistory.splice(index, 1);
    renderNotificationPanel();
    updateNotificationBadge();
}

function updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
    if (!badge) return;
    if (notificationPanelOpen) {
        badge.style.display = 'none';
        badge.textContent = '0';
        return;
    }
    const unreadCount = notificationHistory.filter((n) => !n.isDownloadProgress && !n._viewed).length;
    if (unreadCount > 0) {
        badge.style.display = 'flex';
        badge.textContent = unreadCount;
    } else {
        badge.style.display = 'none';
        badge.textContent = '0';
    }
}

function renderNotificationPanel() {
    const list = document.getElementById('notification-panel-list');
    if (!list) return;

    if (notificationHistory.length === 0) {
        list.innerHTML = `
            <div class="notification-empty">
                <i class="fas fa-bell-slash"></i>
                <span>No notifications</span>
            </div>`;
        return;
    }

    const icons = {
        success: 'fa-check',
        error: 'fa-trash-alt',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle',
        heart: 'fa-heart'
    };

    list.innerHTML = notificationHistory
        .map((notif, index) => {
            const time = new Date(notif.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            let progressBarHTML = '';
            if (notif.isDownloadProgress) {
                const pct = Math.round(notif.percent || 0);
                progressBarHTML = `
                <div style="width: 100%; height: 3px; background: #444; border-radius: 2px; overflow: hidden; margin-top: 6px;">
                    <div style="width: ${pct}%; height: 100%; background: #1db954; border-radius: 2px; transition: width 0.3s ease;"></div>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 3px;">${escapeHtml(
                    notif.status || ''
                )}</div>`;
            } else if (notif.isCoverProgress) {
                const pct = Math.round(notif.percent || 0);
                progressBarHTML = `
                <div style="width: 100%; height: 3px; background: #444; border-radius: 2px; overflow: hidden; margin-top: 6px;">
                    <div style="width: ${pct}%; height: 100%; background: #1db954; border-radius: 2px; transition: width 0.3s ease;"></div>
                </div>`;
            }

            return `
            <div class="notification-item">
                <div class="notification-item-icon ${notif.type}">
                    <i class="fas ${
                        notif.isDownloadProgress ? 'fa-download' : notif.isCoverProgress ? 'fa-image' : icons[notif.type] || 'fa-check'
                    }"></i>
                </div>
                <div class="notification-item-content">
                    <div class="notification-item-message">${escapeHtml(
                        notif.message.replace(/📥 Downloading... \d+% — /, '📥 ')
                    )}</div>
                    ${progressBarHTML}
                    <div class="notification-item-time">${time}</div>
                </div>
                ${
                    notif.isDownloadProgress || notif.isCoverProgress
                        ? ''
                        : `<button class="notification-item-close" onclick="event.stopPropagation(); removeNotificationItem(${index})" title="Dismiss">
                    <i class="fas fa-times"></i>
                </button>`
                }
            </div>`;
        })
        .join('');
}

// ==============================================================================
// KEYBOARD SHORTCUTS & MOUSE NAVIGATION
// ==============================================================================
document.addEventListener('keydown', function (e) {
    if (typeof syncEditorState !== 'undefined' && syncEditorState.open) {
        return;
    }

    const activeElement = document.activeElement;
    if (
        activeElement &&
        (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA' || activeElement.isContentEditable)
    ) {
        return;
    }

    switch (e.key) {
        case 'ArrowLeft':
            if (!e.ctrlKey && audioElement.src && audioElement.duration) {
                e.preventDefault();
                if (e.shiftKey) {
                    audioElement.currentTime = Math.max(0, audioElement.currentTime - 30);
                } else {
                    audioElement.currentTime = Math.max(0, audioElement.currentTime - 5);
                }
            }
            break;

        case 'ArrowRight':
            if (!e.ctrlKey && audioElement.src && audioElement.duration) {
                e.preventDefault();
                if (e.shiftKey) {
                    audioElement.currentTime = Math.min(audioElement.duration, audioElement.currentTime + 30);
                } else {
                    audioElement.currentTime = Math.min(audioElement.duration, audioElement.currentTime + 5);
                }
            }
            break;

        case 'ArrowUp':
            if (e.ctrlKey) {
                e.preventDefault();
                audioElement.volume = Math.min(1, audioElement.volume + 0.1);
                updateVolume(audioElement.volume);
            }
            break;

        case 'ArrowDown':
            if (e.ctrlKey) {
                e.preventDefault();
                audioElement.volume = Math.max(0, audioElement.volume - 0.1);
                updateVolume(audioElement.volume);
            }
            break;

        case 'PageUp':
            e.preventDefault();
            const content = document.querySelector('.content');
            if (content) {
                content.scrollBy(0, -200);
            }
            break;

        case 'PageDown':
            e.preventDefault();
            const content2 = document.querySelector('.content');
            if (content2) {
                content2.scrollBy(0, 200);
            }
            break;

        case 'Home':
            e.preventDefault();
            const content3 = document.querySelector('.content');
            if (content3) {
                content3.scrollTop = 0;
            }
            break;

        case 'End':
            e.preventDefault();
            const content4 = document.querySelector('.content');
            if (content4) {
                content4.scrollTop = content4.scrollHeight;
            }
            break;

        case ' ':
        case 'Spacebar':
            e.preventDefault();
            if (audioElement.src) {
                if (audioElement.paused) {
                    audioElement.play();
                } else {
                    audioElement.pause();
                }
            } else if (playbackQueue.length === 0 && currentQueueIndex === -1) {
                if (isShuffled) {
                    resetShuffle(SONGS_DATA, null, 'all-songs');
                    const newQueue = [];
                    for (let i = 0; i < 20; i++) {
                        const nextSong = getNextShuffledSong();
                        if (!nextSong) break;
                        newQueue.push(nextSong);
                    }
                    playbackQueue = newQueue;
                    currentQueueIndex = 0;
                    playSongFromQueue(0);
                } else {
                    createQueueFromSongList(SONGS_DATA, 0);
                }
            }
            break;

        case 'm':
        case 'M':
            e.preventDefault();
            toggleMute();
            break;

        case 's':
        case 'S':
            e.preventDefault();
            if (typeof shuffleButton !== 'undefined') shuffleButton.click();
            break;

        case 'r':
        case 'R':
            e.preventDefault();
            if (typeof repeatButton !== 'undefined') repeatButton.click();
            break;

        case 'l':
        case 'L':
            e.preventDefault();
            if (typeof switchToLyrics === 'function') switchToLyrics();
            break;

        case 'a':
        case 'A':
            break;

        case 'd':
        case 'D':
            if (e.ctrlKey || e.metaKey) {
                e.preventDefault();
                const idsToDelete =
                    selectedSongIds.size > 0 ? [...selectedSongIds] : selectedSongId !== null ? [selectedSongId] : [];

                if (idsToDelete.length === 0) break;

                const songsToDelete = idsToDelete.map((id) => SONGS_DATA.find((s) => s.id === id)).filter((s) => s);
                if (songsToDelete.length === 0) break;

                if (
                    !confirm(
                        `Delete ${songsToDelete.length} song(s) from your computer?\n\nThis will move them to the Recycle Bin.`
                    )
                )
                    break;

                songsToDelete.forEach((song) => {
                    let filePath = song.url.replace('file:///', '');
                    let windowsPath = filePath.replace(/\//g, '\\');

                    markSongAsDeleted(song.id);

                    const favorites = getFavorites();
                    if (favorites.includes(song.id)) {
                        removeFavorite(song.id);
                    }

                    const playlists = getPlaylists();
                    let playlistChanged = false;
                    playlists.forEach((p) => {
                        if (p.songs.includes(song.id)) {
                            p.songs = p.songs.filter((id) => id !== song.id);
                            playlistChanged = true;
                        }
                    });
                    if (playlistChanged) {
                        savePlaylists(playlists);
                    }

                    if (window.electronAPI && window.electronAPI.deleteFile) {
                        window.electronAPI.deleteFile(windowsPath);
                    }
                });

                for (const listId in activeSlotHighlights) {
                    activeSlotHighlights[listId] = null;
                }

                onSongsChanged();

                if (typeof clearAllSelections === 'function') {
                    clearAllSelections();
                }

                if (typeof refreshCurrentViewAfterMutation === 'function') {
                    refreshCurrentViewAfterMutation();
                }
            }
            break;
    }
});

document.addEventListener('mousedown', function (e) {
    if (e.button === 3) {
        e.preventDefault();
        if (typeof goBack === 'function' && typeof canGoBack === 'function' && canGoBack()) {
            goBack();
        }
    } else if (e.button === 4) {
        e.preventDefault();
        if (typeof goForward === 'function' && typeof canGoForward === 'function' && canGoForward()) {
            goForward();
        }
    }
});

function initMarqueeOnHover(element, options = {}) {
    if (!element) return;
    if (element.dataset.marqueeInit === '1') return;
    element.dataset.marqueeInit = '1';

    const SPEED = options.speed || 20;
    const END_PAUSE = options.endPause !== undefined ? options.endPause : 1500;
    const AUTO_START_DELAY = options.autoStartDelay !== undefined ? options.autoStartDelay : 800;

    let inner = null;
    let rafId = null;
    let timeoutId = null;
    let active = false;
    let paused = false;
    let menuPaused = false;
    let distance = 0;
    let duration = 0;
    let wrapping = false;

    let phase = 'forward';
    let progress = 0;
    let lastTs = null;

    function wrap() {
        const current = element.innerHTML;
        wrapping = true;
        element.innerHTML = '';
        inner = document.createElement('span');
        inner.className = 'marquee-inner';
        inner.innerHTML = current;
        element.appendChild(inner);
        wrapping = false;
    }

    function clear() {
        if (rafId) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
        if (timeoutId) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
    }

    function applyTransform() {
        if (!inner) return;
        const raw = phase === 'forward' ? -distance * progress : -distance * (1 - progress);
        inner.style.transform = `translateX(${raw}px)`;
        const midMotion = progress > 0 && progress < 1;
        element.classList.toggle('marquee-masked', midMotion);
    }

    function finish() {
        clear();
        active = false;
        paused = false;
        phase = 'forward';
        progress = 0;
        lastTs = null;
        element.classList.remove('marquee-active');
        element.classList.remove('marquee-masked');
        if (inner) inner.style.transform = '';
    }

    function tick(ts) {
        if (!active) return;
        if (paused || menuPaused) {
            lastTs = null;
            rafId = null;
            return;
        }
        if (lastTs === null) lastTs = ts;
        const dt = ts - lastTs;
        lastTs = ts;
        progress += dt / duration;
        if (progress >= 1) {
            progress = 1;
            applyTransform();
            if (phase === 'forward') {
                phase = 'back';
                progress = 0;
                timeoutId = setTimeout(() => {
                    if (active && !paused && !menuPaused) {
                        lastTs = null;
                        rafId = requestAnimationFrame(tick);
                    }
                }, END_PAUSE);
            } else {
                finish();
            }
            return;
        }
        applyTransform();
        rafId = requestAnimationFrame(tick);
    }

    function measure() {
        if (!inner) return 0;
        element.classList.add('marquee-active');
        inner.style.transform = '';
        const cs = getComputedStyle(element);
        const padLeft = parseFloat(cs.paddingLeft) || 0;
        const padRight = parseFloat(cs.paddingRight) || 0;
        void element.offsetWidth;
        const overflow = inner.offsetWidth - (element.clientWidth + padLeft + padRight);
        element.classList.remove('marquee-active');
        void element.offsetWidth;
        return overflow > 0 ? overflow : 0;
    }

    function runOnce() {
        clear();
        if (!inner) return;
        distance = measure();
        if (distance <= 0) return;
        element.classList.add('marquee-active');
        duration = (distance / SPEED) * 1000;
        phase = 'forward';
        progress = 0;
        lastTs = null;
        active = true;
        paused = false;
        applyTransform();
        rafId = requestAnimationFrame(tick);
    }

    element.addEventListener('mouseenter', () => {
        if (!active) return;
        paused = true;
        clear();
    });

    element.addEventListener('mouseleave', () => {
        if (active) {
            paused = false;
            if (menuPaused) return;
            lastTs = null;
            rafId = requestAnimationFrame(tick);
        } else {
            runOnce();
        }
    });

    let autoTimeoutId = null;

    function scheduleAutoStart() {
        if (autoTimeoutId) clearTimeout(autoTimeoutId);
        autoTimeoutId = setTimeout(() => {
            autoTimeoutId = null;
            if (active || paused || menuPaused) return;
            runOnce();
        }, AUTO_START_DELAY);
    }

    const observer = new MutationObserver(() => {
        if (wrapping) return;
        if (element.querySelector('.marquee-inner')) return;
        finish();
        wrap();
        scheduleAutoStart();
    });
    observer.observe(element, {
        childList: true,
        characterData: true,
        subtree: true
    });

    const menuObserver = new MutationObserver(() => {
        const menuOpen = !!document.getElementById('context-menu');
        if (menuOpen === menuPaused) return;
        menuPaused = menuOpen;
        if (menuPaused) {
            clear();
        } else if (active && !paused) {
            lastTs = null;
            rafId = requestAnimationFrame(tick);
        }
    });
    menuObserver.observe(document.body, {
        childList: true
    });

    wrap();
    scheduleAutoStart();

    element._marqueeRestart = runOnce;
    element._marqueeStop = finish;
}
