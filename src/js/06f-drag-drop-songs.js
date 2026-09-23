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
