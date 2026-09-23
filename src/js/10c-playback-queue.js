// ==============================================================================
// PLAYBACK - QUEUE MANAGEMENT
// ==============================================================================
function updateQueueDisplay() {
    const queueList = document.getElementById('queue-list');

    if (typeof updateTrackNextBox === 'function') {
        updateTrackNextBox();
    }

    if (repeatFunctionalityActive && repeatMode === 2 && currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const currentSong = playbackQueue[currentQueueIndex];
        queueList.innerHTML = `
                                <div class="queue-lables"><span>Now Playing</span></div>
                                ${renderRightPanelItem(currentSong, {
                                    isNowPlaying: true,
                                    onClick: `playFromQueue(${currentQueueIndex})`,
                                    contextMenuArgs: `${currentSong.id}, {queueIndex: ${currentQueueIndex}}`
                                })}
                                <div class="empty-queue">
                                        <i class="fas fa-infinity"></i>
                                        <p>Repeating this song only</p>
                                        <small>Switch to repeat all to see queue</small>
                                </div>`;
        return;
    }

    if (!playbackQueue || playbackQueue.length === 0) {
        queueList.innerHTML = `
                                <div class="empty-queue">
                                        <i class="fas fa-music"></i>
                                        <p>Queue is empty</p>
                                        <small>Play songs to build your queue</small>
                                </div>`;
        return;
    }

    const maxDisplay = queueDisplayLimit;
    const windowStart = currentQueueIndex + 1;
    const upcomingSongs = playbackQueue.slice(windowStart);
    const manualQueueSongs = upcomingSongs.filter((item) => item.source === 'manual' || item.addedManually === true);
    const autoQueueSongs = upcomingSongs.filter((item) => !(item.source === 'manual' || item.addedManually === true));

    const manualWindowEnd = Math.min(manualQueueSongs.length, maxDisplay);
    const autoWindowEnd = Math.min(autoQueueSongs.length, maxDisplay - manualWindowEnd);

    let queueHTML = '';

    if (currentQueueIndex >= 0 && currentQueueIndex < playbackQueue.length) {
        const queueItem = playbackQueue[currentQueueIndex];
        const currentSong = queueItem.song || queueItem;
        queueHTML += `<div class="queue-lables"><span>Now Playing</span></div>`;
        queueHTML += renderRightPanelItem(currentSong, {
            isNowPlaying: true,
            onClick: `playFromQueue(${currentQueueIndex})`,
            contextMenuArgs: `${currentSong.id}, {queueIndex: ${currentQueueIndex}}`
        });
    }

    if (manualQueueSongs.length > 0) {
        queueHTML += `<div class="added-to-queue-section">
                                <div class="queue-lables"><span>Added to Queue</span></div>`;

        const displayManualSongs = manualQueueSongs.slice(0, manualWindowEnd);
        displayManualSongs.forEach((queueItem) => {
            const song = queueItem.song || queueItem;
            const originalIndex = playbackQueue.indexOf(queueItem);

            queueHTML += `
                                ${renderRightPanelItem(song, {
                                    onClick: `playFromQueue(${originalIndex})`,
                                    contextMenuArgs: `${song.id}, {queueIndex: ${originalIndex}}`
                                })}`;
        });

        if (manualWindowEnd < manualQueueSongs.length) {
            const remainingCount = manualQueueSongs.length - manualWindowEnd;
            queueHTML += `
                                        <div class="empty-queue" style="padding: 10px; margin: 5px 0;">
                                                <small>${remainingCount} more added song${
                remainingCount !== 1 ? 's' : ''
            }</small>
                                        </div>`;
        }

        queueHTML += `</div>`;
    }

    if (autoQueueSongs.length > 0) {
        queueHTML += `<div class="next-songs-section">
                                <div class="queue-lables"><span>Next Songs</span></div>`;

        const displayAutoSongs = autoQueueSongs.slice(0, autoWindowEnd);
        displayAutoSongs.forEach((queueItem, displayIndex) => {
            const song = queueItem.song || queueItem;
            const originalIndex = playbackQueue.indexOf(queueItem);
            const isNext = manualQueueSongs.length === 0 && displayIndex === 0;

            queueHTML += `
                                ${renderRightPanelItem(song, {
                                    onClick: `playFromQueue(${originalIndex})`,
                                    contextMenuArgs: `${song.id}, {queueIndex: ${originalIndex}}`,
                                    extraClass: isNext ? 'next-in-queue' : ''
                                })}`;
        });

        queueHTML += `</div>`;

        if (autoWindowEnd < autoQueueSongs.length) {
            const remainingCount = autoQueueSongs.length - autoWindowEnd;
            queueHTML += `
                                        <div class="empty-queue" style="padding: 15px; margin-top: 10px;">
                                                <i class="fas fa-ellipsis-h"></i>
                                                <p>${remainingCount} more song${remainingCount !== 1 ? 's' : ''}</p>
                                                <small>Scroll down to see more</small>
                                        </div>`;
        }
    }

    if (manualQueueSongs.length === 0 && autoQueueSongs.length === 0 && currentQueueIndex >= 0) {
        queueHTML += `
                                <div class="next-songs-section">
                                        <div class="empty-queue">
                                                <i class="fas fa-forward"></i>
                                                <p>No more songs in queue</p>
                                                <small>Add more songs to continue</small>
                                        </div>
                                </div>`;
    }

    const hasMoreQueueItems =
        (isShuffled && shuffleIndex < shuffleOrder.length) ||
        (!isShuffled && manualQueueSongs.length + autoQueueSongs.length > maxDisplay);

    if (hasMoreQueueItems) {
        queueHTML += `
                                <button class="queue-load-more-btn" type="button" onclick="loadMoreQueueItems()">
                                        Load more
                                </button>`;
    }

    queueList.innerHTML = queueHTML;
    updateScrollbarById('right-panel-content');
}

function loadMoreQueueItems() {
    queueDisplayLimit += queueDisplayPageSize;

    if (isShuffled) {
        const desiredUpcoming = queueDisplayLimit;
        let upcomingCount = 0;

        for (let i = currentQueueIndex + 1; i < playbackQueue.length; i++) {
            const item = playbackQueue[i];
            if (!(item.source === 'manual' || item.addedManually === true)) {
                upcomingCount++;
            }
        }

        while (upcomingCount < desiredUpcoming) {
            const nextSong = getNextShuffledSong();
            if (!nextSong) break;
            playbackQueue.push(nextSong);
            upcomingCount++;
        }
    }

    updateQueueDisplay();
}

function playFromQueue(queueIndex) {
    if (queueIndex >= 0 && queueIndex < playbackQueue.length) {
        playSongFromQueue(queueIndex);
    }
}

function removeFromQueue(queueIndex) {
    if (queueIndex >= 0 && queueIndex < playbackQueue.length) {
        if (queueIndex === currentQueueIndex) {
            saveCurrentPlaybackState();

            const nextIndex = queueIndex < playbackQueue.length - 1 ? queueIndex : queueIndex - 1;
            playbackQueue.splice(queueIndex, 1);

            if (playbackQueue.length > 0 && nextIndex >= 0) {
                playSongFromQueue(nextIndex);
            } else {
                audioElement.pause();
                audioElement.src = '';
                currentQueueIndex = -1;
                playButton.innerHTML = '<i class="fas fa-play"></i>';
                playButton.setAttribute('title', 'Play');
                document.querySelector('.player-song-info').classList.remove('has-song');
                document.getElementById('player-title').textContent = 'No song selected';
                document.getElementById('player-artist').textContent = '—';
            }
        } else {
            if (queueIndex < currentQueueIndex) {
                currentQueueIndex--;
            }
            playbackQueue.splice(queueIndex, 1);
        }

        updateQueueDisplay();
        if (currentView === 'recent') {
            renderRecentlyPlayed();
        } else if (currentView === 'all-songs') {
            renderSongsList(getSongsForList('all-songs'), 'all-songs');
        } else if (currentView === 'search' || currentView === 'search-items') {
            renderSongsList(getSongsForList('search-items'), 'search-items');
        }
    }
}

function cleanupPlaybackQueue() {
    if (playbackQueue.length > 50) {
        const keepFrom = Math.max(0, currentQueueIndex);
        playbackQueue = playbackQueue.slice(keepFrom);
        currentQueueIndex = 0;
    }
}

function addSongToQueueNext(songId) {
    const song = getSongById(songId);
    if (!song || deletedSongIds.has(song.id)) return;

    let insertPosition = currentQueueIndex + 1;
    if (currentQueueIndex === -1) {
        insertPosition = 0;
    }

    const queueItem = {
        song: song,
        listId: currentView,
        ghostSlot: null,
        source: 'manual',
        addedManually: true
    };

    playbackQueue.splice(insertPosition, 0, queueItem);

    updateQueueDisplay();

    const addButton = document.querySelector(`.add-to-queue-btn[onclick*="${songId}"]`);

    if (addButton) {
        addButton.classList.add('adding');

        setTimeout(() => {
            addButton.classList.remove('adding');
        }, 300);
    }
}

function addToQueueNextFromMenu() {
    if (currentContextSongId !== null) {
        addSongToQueueNext(currentContextSongId);
    }
}

function addPlaylistToQueue(playlistId) {
    const songs = getPlaylistSongs(playlistId);
    if (songs.length === 0) {
        showNotification('Playlist is empty', 'warning', 2000);
        return;
    }
    const insertAt = currentQueueIndex >= 0 ? currentQueueIndex + 1 : 0;
    songs.forEach((song, i) => {
        playbackQueue.splice(insertAt + i, 0, {
            song: song,
            listId: `playlist-${playlistId}`,
            ghostSlot: null,
            source: 'manual',
            addedManually: true
        });
    });
    updateQueueDisplay();
    showNotification(`Added ${songs.length} song(s) to queue`, 'success', 2000);
}

function addAlbumToQueue(albumId) {
    const songs = getAlbumSongs(albumId);
    if (songs.length === 0) {
        showNotification('Album is empty', 'warning', 2000);
        return;
    }
    const insertAt = currentQueueIndex >= 0 ? currentQueueIndex + 1 : 0;
    songs.forEach((song, i) => {
        playbackQueue.splice(insertAt + i, 0, {
            song: song,
            listId: albumId,
            ghostSlot: null,
            source: 'manual',
            addedManually: true
        });
    });
    updateQueueDisplay();
    showNotification(`Added ${songs.length} song(s) to queue`, 'success', 2000);
}

function addArtistToQueue(artistId) {
    const songs = getArtistSongs(artistId);
    if (songs.length === 0) {
        showNotification('Artist has no songs', 'warning', 2000);
        return;
    }
    const insertAt = currentQueueIndex >= 0 ? currentQueueIndex + 1 : 0;
    songs.forEach((song, i) => {
        playbackQueue.splice(insertAt + i, 0, {
            song: song,
            listId: artistId,
            ghostSlot: null,
            source: 'manual',
            addedManually: true
        });
    });
    updateQueueDisplay();
    showNotification(`Added ${songs.length} song(s) to queue`, 'success', 2000);
}

function addSongToQueueAt(songId, insertIndex) {
    const song = getSongById(songId);
    if (!song || deletedSongIds.has(song.id)) return false;

    if (insertIndex < 0) insertIndex = 0;
    if (insertIndex > playbackQueue.length) insertIndex = playbackQueue.length;

    const queueItem = {
        song: song,
        listId: currentView,
        ghostSlot: null,
        source: 'manual',
        addedManually: true
    };

    playbackQueue.splice(insertIndex, 0, queueItem);

    if (insertIndex <= currentQueueIndex) {
        currentQueueIndex++;
    }

    updateQueueDisplay();
    return true;
}

let gaplessPreloadedSongId = null;
let gaplessPreloadedUrl = null;

function clearGaplessPreload() {
    if (!gaplessAudioElement) return;

    gaplessAudioElement.pause();
    gaplessAudioElement.removeAttribute('src');
    gaplessAudioElement.load();

    gaplessPreloadedSongId = null;
    gaplessPreloadedUrl = null;
}

function getGaplessNextQueueIndex() {
    if (playbackQueue.length === 0 || currentQueueIndex < 0) {
        return -1;
    }

    if (currentQueueIndex < playbackQueue.length - 1) {
        return currentQueueIndex + 1;
    }

    if (repeatMode === 1 && playbackQueue.length > 0) {
        return 0;
    }

    return -1;
}

function preloadGaplessSong(song) {
    if (!getAudioPlaybackSettings().gaplessEnabled || !song || !song.url) {
        clearGaplessPreload();
        return;
    }

    if (
        gaplessPreloadedSongId === song.id &&
        gaplessPreloadedUrl === song.url
    ) {
        return;
    }

    gaplessAudioElement.pause();
    gaplessAudioElement.src = song.url;
    gaplessAudioElement.preload = 'auto';
    gaplessAudioElement.load();

    gaplessPreloadedSongId = song.id;
    gaplessPreloadedUrl = song.url;
}

function prepareGaplessNextTrack() {
    if (!getAudioPlaybackSettings().gaplessEnabled) {
        clearGaplessPreload();
        return;
    }

    if (repeatFunctionalityActive && repeatMode === 2) {
        clearGaplessPreload();
        return;
    }

    const nextQueueIndex = getGaplessNextQueueIndex();

    if (nextQueueIndex === -1) {
        clearGaplessPreload();
        return;
    }

    const nextQueueItem = playbackQueue[nextQueueIndex];
    const nextSong = nextQueueItem?.song || nextQueueItem;

    if (!nextSong) {
        clearGaplessPreload();
        return;
    }

    preloadGaplessSong(nextSong);
}

function usePreloadedGaplessTrack(song) {
    if (
        !song ||
        gaplessPreloadedSongId !== song.id ||
        gaplessPreloadedUrl !== song.url
    ) {
        return false;
    }

    const oldActiveAudio = audioElement;
    const nextAudio = gaplessAudioElement;

    gaplessActiveElement = nextAudio;
    audioElement = nextAudio;

    audioElement.volume = getTargetTrackVolume(song);
    audioElement.currentTime = 0;

    gaplessAudioElement = oldActiveAudio;

    gaplessAudioElement.pause();
    gaplessAudioElement.removeAttribute('src');
    gaplessAudioElement.load();

    gaplessPreloadedSongId = null;
    gaplessPreloadedUrl = null;

    return true;
}

