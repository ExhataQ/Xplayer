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

                const songsToDelete = idsToDelete.map((id) => getSongById(id)).filter((s) => s);
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
