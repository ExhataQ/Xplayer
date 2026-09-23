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
    const song = getSongById(songId);
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
        const song = getSongById(songId);

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
    const song = getSongById(songId);
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

