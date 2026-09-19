// ==============================================================================
// PLAYBACK - SHUFFLE STATE
// ==============================================================================
let shuffleOrder = [];
let shuffleIndex = 0;
let shuffleSourceId = null;
let smartShuffleJourney = [];
let smartShuffleJourneyIndex = 0;
let smartShuffleSourceId = null;
let smartShufflePreviousSong = null;

// ==============================================================================
// PLAYBACK - SHUFFLE SYSTEM
// ==============================================================================
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function createShuffleOrder(songs, excludeSongId = null) {
    let ids = songs
        .filter((song) => song && !deletedSongIds.has(song.id))
        .map((song) => song.id);

    if (excludeSongId !== null && ids.length > 1) {
        ids = ids.filter((id) => id !== excludeSongId);
    }

    return shuffleArray(ids);
}

function resetShuffle(songs = null, excludeSongId = null, sourceId = currentView) {
    const sourceSongs = songs || getSongsForList(sourceId);
    shuffleOrder = createShuffleOrder(sourceSongs, excludeSongId);
    shuffleIndex = 0;
    shuffleSourceId = sourceId;
}

function clearShuffle() {
    shuffleOrder = [];
    shuffleIndex = 0;
    shuffleSourceId = null;
    smartShuffleJourney = [];
    smartShuffleJourneyIndex = 0;
    smartShuffleSourceId = null;
    smartShufflePreviousSong = null;
}

function getSongDurationSeconds(song) {
    const parts = String(song?.duration || '0:00').split(':').map(Number);
    return parts.length === 2 && parts.every(Number.isFinite) ? parts[0] * 60 + parts[1] : 0;
}

// ==============================================================================
// SMART SHUFFLE — ARTIST-CHAIN GENERATOR
// ==============================================================================

const SHUFFLE_LANGUAGE_NEIGHBORS = {
    'fa|ar': 0.6, 'ar|fa': 0.6,
    'ja|ko': 0.6, 'ko|ja': 0.6,
    'en|es': 0.5, 'es|en': 0.5,
    'en|fr': 0.5, 'fr|en': 0.5,
    'en|de': 0.5, 'de|en': 0.5,
    'en|it': 0.5, 'it|en': 0.5,
    'en|pt': 0.5, 'pt|en': 0.5,
    'en|nl': 0.5, 'nl|en': 0.5,
    'es|pt': 0.7, 'pt|es': 0.7,
    'es|it': 0.6, 'it|es': 0.6,
    'fr|it': 0.6, 'it|fr': 0.6,
    'de|nl': 0.6, 'nl|de': 0.6
};

const SHUFFLE_ESCAPE_RATE = 0.2;

function shuffleLanguageCloseness(a, b) {
    if (!a || !b) return 0;
    if (a === 'undetected' || b === 'undetected') return 0.5;
    if (a === b) return 1.0;
    return SHUFFLE_LANGUAGE_NEIGHBORS[a + '|' + b] || 0;
}

function shuffleLanguagesAreNeighbors(a, b) {
    if (!a || !b || a === b) return false;
    return (SHUFFLE_LANGUAGE_NEIGHBORS[a + '|' + b] || 0) > 0;
}

function shuffleYearCloseness(a, b) {
    const ya = parseInt(a, 10);
    const yb = parseInt(b, 10);
    if (!Number.isFinite(ya) || !Number.isFinite(yb)) return 0.5;
    const diff = Math.abs(ya - yb);
    return Math.max(0, 1 - diff / 40);
}

function shuffleGenresOf(song) {
    return String(song?.genre || '')
        .toLowerCase()
        .split(/[;,/|]/)
        .map((genre) => genre.trim())
        .filter(Boolean);
}

function shuffleGenreCloseness(genresA, genresB, genreRarity) {
    if (!genresA.length || !genresB.length) return { score: 0, neutral: true };
    const setB = new Set(genresB);
    let score = 0;
    for (const g of genresA) {
        if (setB.has(g)) {
            score += 1 / Math.log(2 + (genreRarity[g] || 1));
        }
    }
    return { score, neutral: false };
}

function shuffleArtistCloseness(a, b, genreRarity) {
    if (a.name === b.name) return 1;
    const lang = shuffleLanguageCloseness(a.language, b.language);
    const year = (a.year && b.year) ? shuffleYearCloseness(a.year, b.year) : 0.5;
    const genreResult = shuffleGenreCloseness(a.genresArray, b.genresArray, genreRarity);
    let genreNorm;
    if (genreResult.neutral) {
        genreNorm = 0.5;
    } else {
        const maxPossible = Math.max(a.genresArray.length, b.genresArray.length, 1);
        genreNorm = Math.min(1, genreResult.score / maxPossible * 2);
    }
    return 0.55 * lang + 0.30 * genreNorm + 0.15 * year;
}

function buildShuffleArtistProfiles(songs) {
    const profiles = new Map();
    for (const song of songs) {
        const artist = song.artist || 'Unknown Artist';
        if (!profiles.has(artist)) {
            profiles.set(artist, {
                name: artist,
                languageCounts: {},
                genres: new Set(),
                yearSum: 0,
                yearCount: 0,
                songIds: []
            });
        }
        const p = profiles.get(artist);
        const detected = song._detectedLanguage || song.language || 'undetected';
        const langForCounting = song.instrumental === true ? 'instrumental' : detected;
        p.languageCounts[langForCounting] = (p.languageCounts[langForCounting] || 0) + 1;
        for (const g of shuffleGenresOf(song)) p.genres.add(g);
        const y = parseInt(song.year, 10);
        if (Number.isFinite(y)) { p.yearSum += y; p.yearCount++; }
        p.songIds.push(song.id);
    }
    for (const p of profiles.values()) {
        const entries = Object.entries(p.languageCounts).sort((a, b) => b[1] - a[1]);
        p.language = entries.length ? entries[0][0] : 'undetected';
        p.year = p.yearCount ? Math.round(p.yearSum / p.yearCount) : null;
        p.genresArray = [...p.genres];
        delete p.languageCounts;
        delete p.yearSum;
        delete p.yearCount;
    }
    return profiles;
}

function buildShuffleGenreRarity(songs) {
    const rarity = {};
    for (const song of songs) {
        for (const g of shuffleGenresOf(song)) {
            rarity[g] = (rarity[g] || 0) + 1;
        }
    }
    return rarity;
}

function buildShuffleArtistGraph(profiles, genreRarity, topK = 8) {
    const names = [...profiles.keys()];
    const graph = new Map();
    for (const a of names) {
        const pa = profiles.get(a);
        const scored = [];
        for (const b of names) {
            if (a === b) continue;
            const pb = profiles.get(b);
            const score = shuffleArtistCloseness(pa, pb, genreRarity);
            if (score > 0) scored.push({ name: b, score });
        }
        scored.sort((x, y) => y.score - x.score);
        graph.set(a, scored.slice(0, topK));
    }
    return graph;
}

function shuffleWeightedPick(candidates) {
    if (!candidates.length) return null;
    const total = candidates.reduce((s, c) => s + c.score, 0);
    if (total <= 0) return candidates[Math.floor(Math.random() * candidates.length)].name;
    let r = Math.random() * total;
    for (const c of candidates) {
        r -= c.score;
        if (r <= 0) return c.name;
    }
    return candidates[candidates.length - 1].name;
}

function shuffleLanguageCompatible(a, b) {
    if (a === b) return true;
    if (a === 'undetected' && b === 'undetected') return true;
    return false;
}

function shuffleBuildGroup(anchorArtist, graph, profiles, availableSongIds, config, libraryById) {
    const groupSongs = [];
    const artistsUsed = new Set();
    const usedSongIds = new Set();
    const artistChain = [];
    let currentArtist = anchorArtist;
    let totalMinutes = 0;
    const groupLanguage = profiles.get(anchorArtist).language;
    const allowedLanguages = new Set([groupLanguage]);

    while (true) {
        const artistLang = profiles.get(currentArtist).language;
        const allowNeighbor = shuffleLanguagesAreNeighbors(artistLang, groupLanguage);
        const artistSongs = profiles.get(currentArtist).songIds
            .filter(id => availableSongIds.has(id))
            .filter(id => !usedSongIds.has(id))
            .map(id => libraryById.get(id))
            .filter(s => {
                const sLang = s.instrumental === true
                    ? 'instrumental'
                    : (s._detectedLanguage || s.language || 'undetected');
                if (shuffleLanguageCompatible(sLang, groupLanguage)) return true;
                if (allowNeighbor && shuffleLanguageCompatible(sLang, artistLang)) return true;
                return false;
            });

        let tookAny = false;
        if (artistSongs.length > 0) {
            const takeCount = Math.min(1 + Math.floor(Math.random() * 3), artistSongs.length);
            const shuffled = [...artistSongs].sort(() => Math.random() - 0.5);
            for (let i = 0; i < takeCount; i++) {
                const s = shuffled[i];
                if (
                    totalMinutes + getSongDurationSeconds(s) / 60 > config.maxMinutes &&
                    totalMinutes >= config.minMinutes
                ) {
                    continue;
                }
                groupSongs.push(s);
                usedSongIds.add(s.id);
                totalMinutes += getSongDurationSeconds(s) / 60;
                artistChain.push(s.artist);
                tookAny = true;
            }
            if (tookAny) artistsUsed.add(currentArtist);
        }

        const canStop =
            groupSongs.length >= config.minSongs &&
            artistsUsed.size >= config.minArtists &&
            totalMinutes >= config.minMinutes;
        const mustStop =
            groupSongs.length >= config.maxSongs ||
            artistsUsed.size >= config.maxArtists ||
            totalMinutes >= config.maxMinutes;

        if (mustStop) break;
        if (canStop && Math.random() < 0.4) break;

        const neighbors = graph.get(currentArtist) || [];
        const allEligible = neighbors
            .filter(n => !artistsUsed.has(n.name))
            .filter(n => {
                const p = profiles.get(n.name);
                return p.songIds.some(id => availableSongIds.has(id) && !usedSongIds.has(id));
            });

        let candidates = allEligible.filter(n =>
            shuffleLanguageCompatible(profiles.get(n.name).language, groupLanguage)
        );

        if (candidates.length === 0) {
            candidates = allEligible.filter(n => {
                const lang = profiles.get(n.name).language;
                return shuffleLanguageCompatible(lang, groupLanguage) ||
                       shuffleLanguagesAreNeighbors(lang, groupLanguage);
            });
        }

        if (!candidates.length) break;

        const top = candidates.slice(0, 5);
        const next = shuffleWeightedPick(top);
        if (!next) break;
        currentArtist = next;
        const nextLang = profiles.get(currentArtist).language;
        if (nextLang && nextLang !== 'undetected') {
            allowedLanguages.add(nextLang);
        }
    }

    if (groupSongs.length < config.minSongs || artistsUsed.size < config.minArtists) {
        return null;
    }

    return {
        songs: groupSongs,
        artistChain,
        artistsUsed: [...artistsUsed],
        totalMinutes,
        groupLanguage,
        allowedLanguages
    };
}

function shuffleSplitIntoRuns(songs) {
    const runs = [];
    for (const s of songs) {
        const lastRun = runs[runs.length - 1];
        if (lastRun && lastRun[0].artist === s.artist) {
            lastRun.push(s);
        } else {
            runs.push([s]);
        }
    }
    return runs;
}

function shuffleInterleaveRuns(runs) {
    const result = [];
    let carry = [];
    let i = 0;
    while (i < runs.length || carry.length) {
        const current = carry.length ? carry : (i < runs.length ? runs[i++].slice() : []);
        const next = (i < runs.length) ? runs[i++].slice() : [];
        if (next.length === 0) {
            result.push(...current);
            carry = [];
            continue;
        }
        const maxPair = Math.min(current.length, next.length);
        for (let k = 0; k < maxPair; k++) {
            result.push(current[k]);
            result.push(next[k]);
        }
        carry = current.slice(maxPair).concat(next.slice(maxPair));
    }
    return result;
}

function shuffleOrderGroupWithDurationVariety(songs) {
    const runs = shuffleSplitIntoRuns(songs);
    const interleaved = shuffleInterleaveRuns(runs);
    const subRuns = shuffleSplitIntoRuns(interleaved);
    const result = [];
    for (const sub of subRuns) {
        if (sub.length === 1) {
            result.push(sub[0]);
            continue;
        }
        const sorted = [...sub].sort((a, b) => getSongDurationSeconds(b) - getSongDurationSeconds(a));
        let lo = 0;
        let hi = sorted.length - 1;
        let takeHigh = true;
        while (lo <= hi) {
            result.push(takeHigh ? sorted[hi--] : sorted[lo++]);
            takeHigh = !takeHigh;
        }
    }
    return result;
}

function generateSmartShuffleJourney(songs, excludeSongId = null, sourceId = currentView) {
    const settings = getSmartShuffleSettings();
    let available = songs.filter((song) => song && !deletedSongIds.has(song.id) && song.id !== excludeSongId);

    if (available.length < 1) return [];
    if (available.length <= 50) return null;

    const journeySize = Math.min(Math.max(1, Number(settings.journeySize) || 50), available.length);
    const config = {
        minSongs: 4,
        maxSongs: 10,
        minArtists: 2,
        maxArtists: 4,
        minMinutes: 15,
        maxMinutes: 45
    };

    const profiles = buildShuffleArtistProfiles(available);
    const genreRarity = buildShuffleGenreRarity(available);
    const graph = buildShuffleArtistGraph(profiles, genreRarity);
    const libraryById = new Map(available.map(s => [s.id, s]));

    const availableSongIds = new Set(available.map(s => s.id));
    const journey = [];
    let previousTailArtist = null;

    let safety = 0;
    while (journey.length < journeySize && safety < 200) {
        safety++;

        let anchor;
        if (previousTailArtist && Math.random() >= SHUFFLE_ESCAPE_RATE) {
            const neighbors = (graph.get(previousTailArtist) || [])
                .filter(n => profiles.get(n.name).songIds.some(id => availableSongIds.has(id)));
            if (neighbors.length) {
                anchor = shuffleWeightedPick(neighbors.slice(0, 4));
            }
        }
        if (!anchor) {
            const prevLanguage = previousTailArtist ? profiles.get(previousTailArtist).language : null;
            const allRemaining = [...profiles.keys()]
                .filter(a => profiles.get(a).songIds.some(id => availableSongIds.has(id)));
            const crossLanguage = allRemaining.filter(a => profiles.get(a).language !== prevLanguage);
            const pool = crossLanguage.length ? crossLanguage : allRemaining;
            if (!pool.length) break;
            anchor = pool[Math.floor(Math.random() * pool.length)];
        }

        const group = shuffleBuildGroup(anchor, graph, profiles, availableSongIds, config, libraryById);
        if (!group) {
            for (const s of profiles.get(anchor).songIds) availableSongIds.delete(s);
            continue;
        }

        const orderedSongs = shuffleOrderGroupWithDurationVariety(group.songs);
        for (const s of orderedSongs) {
            availableSongIds.delete(s.id);
            journey.push(s.id);
            if (journey.length >= journeySize) break;
        }

        previousTailArtist = orderedSongs.length ? orderedSongs[orderedSongs.length - 1].artist : null;
    }

    smartShuffleSourceId = sourceId;
    smartShufflePreviousSong = null;

    // Dev diagnostic — comment out to silence the console dump.
    try {
        logSmartShuffleJourney(journey, profiles, available);
    } catch (e) {
        console.warn('[smart-shuffle] diagnostic failed:', e);
    }

    return journey;
}

function logSmartShuffleJourney(journeyIds, profiles, songs) {
    if (!Array.isArray(journeyIds) || journeyIds.length === 0) {
        console.log('%c[smart-shuffle] empty journey', 'color:#ffb400;font-weight:bold');
        return null;
    }

    const byId = new Map(songs.map(s => [s.id, s]));
    const resolved = journeyIds.map(id => byId.get(id)).filter(Boolean);

    // Group boundaries: a new group starts when the artist changes AND
    // the previous song is not simply a repeat. We approximate by
    // re-detecting boundaries from the artist chain of the emitted order.
    // The real groups were chosen inside generateSmartShuffleJourney, but
    // for diagnostic purposes we can reconstruct approximate groups by
    // looking at the run structure of the emitted artist sequence.
    const runs = [];
    for (const s of resolved) {
        const last = runs[runs.length - 1];
        if (last && last.artist === s.artist) {
            last.songs.push(s);
        } else {
            runs.push({ artist: s.artist, songs: [s] });
        }
    }

    const totalMinutes = resolved.reduce((sum, s) => sum + getSongDurationSeconds(s) / 60, 0);
    const artistCounts = {};
    const languageCounts = {};
    const genreCounts = {};

    for (const s of resolved) {
        artistCounts[s.artist || 'Unknown Artist'] = (artistCounts[s.artist || 'Unknown Artist'] || 0) + 1;
        const lang = s._detectedLanguage || s.language || 'undetected';
        languageCounts[lang] = (languageCounts[lang] || 0) + 1;
        for (const g of shuffleGenresOf(s)) genreCounts[g] = (genreCounts[g] || 0) + 1;
    }

    const topArtists = Object.entries(artistCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([artist, count]) => ({ artist, count }));

    const languages = Object.entries(languageCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([language, count]) => ({ language, count }));

    const topGenres = Object.entries(genreCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15)
        .map(([genre, count]) => ({ genre, count }));

    console.group(
        `%c[smart-shuffle] journey of ${resolved.length} songs (${totalMinutes.toFixed(1)} min, ${runs.length} artist runs)`,
        'color:#1db954;font-weight:bold;font-size:13px'
    );

    console.log('Summary:', {
        journeySize: resolved.length,
        totalMinutes: Number(totalMinutes.toFixed(1)),
        distinctArtists: Object.keys(artistCounts).length,
        distinctLanguages: languages.length,
        artistRuns: runs.length
    });

    console.log('Languages in journey:');
    console.table(languages);

    console.log('Top 15 artists:');
    console.table(topArtists);

    console.log('Top 15 genres:');
    console.table(topGenres);

    console.log('Full ordered journey:');
    console.table(
        resolved.map((s, i) => ({
            '#': i + 1,
            title: s.title || '',
            artist: s.artist || '',
            lang: s._detectedLanguage || s.language || 'undetected',
            genre: s.genre || '',
            year: s.year || '',
            duration: s.duration || ''
        }))
    );

    console.groupEnd();

    return {
        journeySize: resolved.length,
        totalMinutes: Number(totalMinutes.toFixed(1)),
        distinctArtists: Object.keys(artistCounts).length,
        languages,
        topArtists,
        topGenres,
        ordered: resolved
    };
}

function resetSmartShuffle(songs = null, excludeSongId = null, sourceId = currentView) {
    const sourceSongs = songs || getSongsForList(sourceId);

    // Ensure language detection has run for songs that don't have it yet.
    if (typeof ensureShuffleLanguages === 'function') {
        ensureShuffleLanguages(sourceSongs);
    }

    const journey = generateSmartShuffleJourney(sourceSongs, excludeSongId, sourceId);
    if (journey === null) return false;
    smartShuffleJourney = journey;
    smartShuffleJourneyIndex = 0;
    smartShuffleSourceId = sourceId;
    return smartShuffleJourney.length > 0;
}

function getNextSmartShuffledSong() {
    if (repeatFunctionalityActive && repeatMode === 2) return null;

    const sourceId = smartShuffleSourceId || currentView;
    const sourceSongs = getSongsForList(sourceId);
    if (smartShuffleJourneyIndex >= smartShuffleJourney.length && !resetSmartShuffle(sourceSongs, null, sourceId)) return null;

    const songId = smartShuffleJourney[smartShuffleJourneyIndex++];
    const song = SONGS_DATA.find((item) => item.id === songId);
    if (!song || deletedSongIds.has(song.id)) return getNextSmartShuffledSong();

    return { song, listId: sourceId, ghostSlot: null };
}

function getNextShuffledSong() {
    if (repeatFunctionalityActive && repeatMode === 2) return null;

    if (shuffleMode === 'smart') return getNextSmartShuffledSong();

    if (shuffleSourceId === null) {
        resetShuffle();
    }

    while (shuffleIndex < shuffleOrder.length) {
        const songId = shuffleOrder[shuffleIndex++];
        const song = SONGS_DATA.find((s) => s.id === songId);

        if (song && !deletedSongIds.has(song.id)) {
            return {
                song: song,
                listId: shuffleSourceId,
                ghostSlot: null
            };
        }
    }

    const currentSongId =
        currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]
            ? (playbackQueue[currentQueueIndex].song || playbackQueue[currentQueueIndex]).id
            : null;

    const sourceSongs = getSongsForList(shuffleSourceId || currentView);
    resetShuffle(sourceSongs, currentSongId, shuffleSourceId || currentView);

    if (shuffleOrder.length === 0) return null;

    const songId = shuffleOrder[shuffleIndex++];
    const song = SONGS_DATA.find((s) => s.id === songId);
    if (!song || deletedSongIds.has(song.id)) return getNextShuffledSong();

    return {
        song: song,
        listId: shuffleSourceId,
        ghostSlot: null
    };
}

function startSmartShuffleFromCurrentView() {
    const songs = getSongsForList(currentView);
    if (songs.length <= 50) {
        showNotification('Smart Shuffle needs more than 50 songs in this list', 'warning', 3000);
        return false;
    }

    shuffleMode = 'smart';
    isShuffled = true;
    shuffleButton.classList.add('active');
    updateSubheroShuffleButton();
    shuffleButton.setAttribute('aria-label', 'Smart Shuffle on');
    clearShuffle();
    playCurrentViewFromStart();
    return true;
}

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
    const song = SONGS_DATA.find((s) => s.id === songId);
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
    const song = SONGS_DATA.find((s) => s.id === songId);
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

// ==============================================================================
// PLAYBACK - SONG PLAYBACK
// ==============================================================================
function playSongFromQueue(queueIndex) {
    if (queueIndex < 0 || queueIndex >= playbackQueue.length) return;

    saveCurrentPlaybackState();

    const previousQueueIndex = currentQueueIndex;
    currentQueueIndex = queueIndex;
    const queueItem = playbackQueue[queueIndex];
    const song = queueItem.song || queueItem;
    const listId = queueItem.listId || currentView;
    const ghostSlot = queueItem.ghostSlot !== undefined ? queueItem.ghostSlot : null;

    if (listId === 'search' && searchQuery) {
        queueItem.searchQuery = searchQuery;
    }

    const playbackSettings = getAudioPlaybackSettings();
    const previousSong = previousQueueIndex >= 0 && playbackQueue[previousQueueIndex]
        ? playbackQueue[previousQueueIndex].song || playbackQueue[previousQueueIndex]
        : null;
    const isTrackSwitch = !!audioElement.src && !audioElement.paused && previousQueueIndex >= 0 && previousSong && previousSong.id !== song.id;
    const isSameSong = previousSong && previousSong.id === song.id;

    if (playbackSettings.gaplessEnabled && isTrackSwitch) {
        if (pendingCrossfadeTimer) {
            clearTimeout(pendingCrossfadeTimer);
            pendingCrossfadeTimer = null;
        }

        const usedPreloadedTrack = usePreloadedGaplessTrack(song);

        if (!usedPreloadedTrack) {
            audioElement.src = song.url;
            audioElement.currentTime = 0;
            audioElement.volume = getTargetTrackVolume(song);
            audioElement.play().catch(() => {});
        } else {
            audioElement.volume = getTargetTrackVolume(song);
            audioElement.play().catch(() => {});
        }
    } else if (playbackSettings.crossfadeEnabled && isTrackSwitch) {
        scheduleCrossfadeTransition(song);
    } else {
        audioElement.src = song.url;
        audioElement.currentTime = 0;
        audioElement.play().catch(() => {});
        startFadeIn(song, (Number(playbackSettings.fadeInDuration) || 1) * 1000);
    }

    pushToHistoryStack(song);

    document.querySelector('.player-song-info').classList.add('has-song');
    document.getElementById('player-title').textContent = song.title;
    document.getElementById('player-artist').innerHTML = buildPlayerArtistHTML(song.artist);
    const songCover = typeof song.cover === 'string' && song.cover.trim() !== '' ? song.cover : PLACEHOLDER_IMAGE;
    document.getElementById('player-cover').src = songCover;
    document.getElementById('player-cover').alt = `Cover for ${song.title}`;

    playButton.innerHTML = '<i class="fas fa-pause"></i>';
    playButton.setAttribute('aria-label', 'Pause');
    playButton.setAttribute('title', 'Pause');
    updateSubheroPlayButton(isCurrentViewPlaying());

    const lyricsToggleBtnEl = document.getElementById('lyrics-toggle-btn');
    if (lyricsToggleBtnEl) {
        const hasLyrics = typeof getLyricsForSong === 'function' && String(getLyricsForSong(song) || '').trim() !== '';
        lyricsToggleBtnEl.disabled = false;
        lyricsToggleBtnEl.setAttribute('data-original-title', hasLyrics ? 'Lyrics' : 'No lyrics for this song');
    }

    const progressBar = document.getElementById('progress-bar');
    const progressKnob = document.getElementById('progress-knob');
    if (progressBar) progressBar.style.width = '0%';
    if (progressKnob) progressKnob.style.left = '0%';

    totalTimeDisplay.textContent = song.duration;
    updateTimeDisplay();

    updateAlbumArt();

    if (isShuffled) {
        while (playbackQueue.length - currentQueueIndex < 20) {
            const nextSong = getNextShuffledSong();
            if (nextSong) {
                playbackQueue.push(nextSong);
            } else {
                break;
            }
        }
        cleanupPlaybackQueue();
    }

    updateQueueDisplay();

    if (currentQueueIndex >= 0 && playbackQueue[currentQueueIndex]) {
        const currentItem = playbackQueue[currentQueueIndex];
        const currentSong = currentItem.song || currentItem;
        const currentListId = currentItem.listId || currentView;
        const currentGhostSlot = currentItem.ghostSlot !== undefined ? currentItem.ghostSlot : null;

        movePlayedItemToTop(currentListId);
        updatePlayingHighlight(currentSong.id, currentListId, currentGhostSlot);
    }

    if (playbackSettings.gaplessEnabled) {
        prepareGaplessNextTrack();
    }
}

function createQueueFromSongList(songList, startIndex = 0, listId = 'all-songs') {
    queueDisplayLimit = 50;
    playbackQueue = songList.map((song, idx) => ({
        song: song,
        listId: listId,
        ghostSlot: idx
    }));
    currentQueueIndex = startIndex;

    updateQueueDisplay();

    if (playbackQueue.length > 0 && currentQueueIndex >= 0 && currentQueueIndex < playbackQueue.length) {
        playSongFromQueue(currentQueueIndex);
    }
}

function playSongFromList(songId, listId = null, clickedIndex = null) {
    const activeListId = listId || currentView;
    lastPlaybackListId = activeListId;

    const existingItem =
        currentQueueIndex >= 0 && playbackQueue[currentQueueIndex] ? playbackQueue[currentQueueIndex] : null;
    const existingSong = existingItem ? existingItem.song || existingItem : null;
    if (existingSong && existingSong.id === songId && audioElement.src) {
        if (audioElement.paused) {
            audioElement.play();
        }
        return;
    }

    saveCurrentPlaybackState();

    isPrevNavigation = false;
    isManualPlay = true;
    const song = SONGS_DATA.find((s) => s.id === songId);
    if (!song) return;

    const songList = getSongsForList(activeListId);

    if (activeListId === 'search-items' || activeListId === 'search') {
        ghostLists['search-items'] = [];
        for (let i = 0; i < songList.length; i++) {
            ghostLists['search-items'].push(`SearchItem${String(i + 1).padStart(5, '0')}`);
        }
        nextSearchItemSlotId = songList.length + 1;
    } else if (activeListId === 'favorites') {
        ghostLists['favorites'] = [];
        for (let i = 0; i < songList.length; i++) {
            ghostLists['favorites'].push(`Favorites${String(i + 1).padStart(5, '0')}`);
        }
        nextFavoriteSlotId = songList.length + 1;
    } else if (activeListId && activeListId.startsWith('playlist-')) {
        const playlistId = activeListId.replace('playlist-', '');
        initGhostSlots(activeListId, songList, `Playlist${playlistId}`);
    } else if (activeListId && activeListId.startsWith('a') && activeListId.length === 13) {
        initGhostSlots(activeListId, songList, `Album-${activeListId}`);
    } else if (activeListId && activeListId.startsWith('r') && activeListId.length === 13) {
        initGhostSlots(activeListId, songList, `Artist-${activeListId}`);
    }

    const startIndex = songList.findIndex((s) => s.id === songId);
    if (startIndex === -1) return;

    const ghostSlotIndex = clickedIndex !== null ? clickedIndex : startIndex;

    if (isShuffled) {
        const currentListSongs = getSongsForList(activeListId);

        playbackQueue = [
            {
                song: song,
                listId: activeListId,
                ghostSlot: ghostSlotIndex
            }
        ];

        currentQueueIndex = 0;
        if (shuffleMode === 'smart') {
            resetSmartShuffle(currentListSongs, song.id, activeListId);
        } else {
            resetShuffle(currentListSongs, song.id, activeListId);
        }

        while (playbackQueue.length < 20) {
            const nextSong = getNextShuffledSong();
            if (!nextSong) break;
            playbackQueue.push(nextSong);
        }

        playSongFromQueue(0);
    } else {
        const queueItems = songList.map((s, idx) => ({
            song: s,
            listId: activeListId,
            ghostSlot: idx
        }));
        playbackQueue = queueItems;
        currentQueueIndex = startIndex;

        updateQueueDisplay();

        if (playbackQueue.length > 0 && currentQueueIndex >= 0) {
            playSongFromQueue(currentQueueIndex);
        }
    }

    movePlayedItemToTop(activeListId);
    updatePlayingHighlight(songId, activeListId, ghostSlotIndex);
}

function playSongFromHistory(songId) {
    const song = SONGS_DATA.find((s) => s.id === songId);
    if (!song || deletedSongIds.has(song.id)) return;

    if (isShuffled) {
        const currentListSongs = getActiveSongs();

        playbackQueue = [
            {
                song: song,
                listId: 'all-songs',
                ghostSlot: null
            }
        ];

        currentQueueIndex = 0;
        if (shuffleMode === 'smart') {
            resetSmartShuffle(currentListSongs, songId, 'all-songs');
        } else {
            resetShuffle(currentListSongs, songId, 'all-songs');
        }
        playSongFromQueue(0);
    } else {
        playbackQueue = SONGS_DATA.map((s, idx) => ({
            song: s,
            listId: 'all-songs',
            ghostSlot: idx
        }));
        currentQueueIndex = SONGS_DATA.findIndex((s) => s.id === songId);

        updateQueueDisplay();

        if (playbackQueue.length > 0 && currentQueueIndex >= 0) {
            playSongFromQueue(currentQueueIndex);
        }
    }
}

function playAllFromCurrentView() {
    const currentItem =
        currentQueueIndex >= 0 && playbackQueue[currentQueueIndex] ? playbackQueue[currentQueueIndex] : null;
    const currentListId = currentItem ? currentItem.listId || 'all-songs' : null;
    const isSameViewPaused = currentItem && currentListId === currentView && audioElement.paused;

    if (isSameViewPaused) {
        audioElement.play();
        return;
    }

    if (!audioElement.src && currentQueueIndex < 0 && lastPlaybackListId && lastPlaybackListId !== 'all-songs') {
        playCurrentViewFromStart(lastPlaybackListId);
        return;
    }

    playCurrentViewFromStart();
}

function playOrResumeCurrentView() {
    if (audioElement.src && !audioElement.paused) {
        audioElement.pause();
        return;
    }

    playAllFromCurrentView();
}

function playCurrentViewFromStart(targetListId = currentView) {
    saveCurrentPlaybackState();
    queueDisplayLimit = 50;

    isPrevNavigation = false;
    isManualPlay = true;

    let songsToPlay = [];
    let listId = targetListId || currentView;
    lastPlaybackListId = listId;

    if (currentView === 'all-songs') {
        songsToPlay = [...SONGS_DATA];
    } else if (currentView === 'favorites') {
        const favorites = getFavorites();
        songsToPlay = favorites.map((id) => SONGS_DATA.find((s) => s.id === id)).filter((s) => s);
    } else if (currentView === 'history') {
        const history = getPlayHistory();
        songsToPlay = history.map((entry) => SONGS_DATA.find((s) => s.id === entry.id)).filter((s) => s);
    } else if (currentView === 'search-items' || currentView === 'search') {
        songsToPlay = getSongsForList('search-items');
    } else if (currentView && currentView.startsWith('playlist-')) {
        const playlistId = currentView.replace('playlist-', '');
        songsToPlay = getPlaylistSongs(playlistId);
    } else if (currentView && currentView.startsWith('a') && currentView.length === 13) {
        songsToPlay = getAlbumSongs(currentView);
    } else if (currentView && currentView.startsWith('r') && currentView.length === 13) {
        songsToPlay = getArtistSongs(currentView);
    } else {
        songsToPlay = getActiveSongs();
    }

    if (songsToPlay.length === 0) {
        showNotification('No songs to play', 'warning', 2000);
        return;
    }

    if (repeatFunctionalityActive && repeatMode === 2) {
        isShuffled = false;
        shuffleButton.classList.remove('active');
        playbackQueue = [
            {
                song: songsToPlay[0],
                listId: listId,
                ghostSlot: 0
            }
        ];
        currentQueueIndex = 0;
        audioElement.loop = true;
    } else if (isShuffled) {
        let firstSong;
        let randomIndex = 0;

        if (shuffleMode === 'smart') {
            if (!resetSmartShuffle(songsToPlay, null, listId)) {
                showNotification('Smart Shuffle needs more than 50 songs in this list', 'warning', 3000);
                isShuffled = false;
                shuffleMode = 'normal';
                shuffleButton.classList.remove('active');
                updateSubheroShuffleButton();
                return;
            }
            const firstItem = getNextSmartShuffledSong();
            if (!firstItem) return;
            firstSong = firstItem.song;
            randomIndex = songsToPlay.findIndex((song) => song.id === firstSong.id);
        } else {
            randomIndex = Math.floor(Math.random() * songsToPlay.length);
            firstSong = songsToPlay[randomIndex];
            resetShuffle(songsToPlay, firstSong.id, listId);
        }

        playbackQueue = [
            {
                song: firstSong,
                listId: listId,
                ghostSlot: randomIndex
            }
        ];
        currentQueueIndex = 0;
    } else {
        playbackQueue = songsToPlay.map((s, idx) => ({
            song: s,
            listId: listId,
            ghostSlot: idx
        }));
        currentQueueIndex = 0;
    }

    movePlayedItemToTop(listId);
    updateQueueDisplay();
    playSongFromQueue(0);
}

function isCurrentViewPlaying() {
    if (currentQueueIndex < 0 || !playbackQueue[currentQueueIndex]) return false;
    const currentItem = playbackQueue[currentQueueIndex];
    const currentListId = currentItem.listId || 'all-songs';
    return currentListId === currentView && !audioElement.paused;
}

function togglePlayAllFromCurrentView() {
    const btn = document.getElementById('subhero-play-btn');
    if (btn) temporarilySuppressTooltip(btn);

    if (isCurrentViewPlaying()) {
        audioElement.pause();
    } else {
        playAllFromCurrentView();
    }
}
