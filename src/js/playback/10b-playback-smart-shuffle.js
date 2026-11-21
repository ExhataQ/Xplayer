// ==============================================================================
// SMART SHUFFLE — ARTIST-CHAIN GENERATOR
// ==============================================================================
import { resetShuffle, clearShuffle, getSongDurationSeconds } from './10a-playback-shuffle.js';

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

function shuffleArtistCloseness(a, b, genreRarity) {
    if (a.name === b.name) return 1;
    const lang = shuffleLanguageCloseness(a.language, b.language);
    const year = (a.year && b.year) ? shuffleYearCloseness(a.year, b.year) : 0.5;
    let genreNorm = 0.5; // no genre on one side: neutral
    const ga = a.genresArray;
    if (ga.length && b.genresArray.length) {
        let score = 0;
        for (let i = 0; i < ga.length; i++) {
            const g = ga[i];
            if (b.genres.has(g)) score += genreRarity[g];
        }
        genreNorm = Math.min(1, score / Math.max(ga.length, b.genresArray.length, 1) * 2);
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
    const weight = {}; // what a shared genre is worth: rare ones count more
    for (const g of Object.keys(genreRarity)) weight[g] = 1 / Math.log(2 + genreRarity[g]);
    // Done for every artist against every other: 4000 artists is 16 million pairs, which froze the app for seconds each time the journey was
    // rebuilt. So only the best topK of each artist are kept as the pairs are scored (no sort of the whole list), and the finished graph is
    // kept between journeys (see shuffleArtistModel).
    // An artist in the same language always scores at least 0.55 and one in a language with no tie at most 0.45 (the language is 0.55 of the score), so
    // when enough artists share the language only they, the neighbouring languages and the undetected ones can make the top: the others are not scored.
    const byLanguage = new Map();
    for (const name of names) {
        const language = profiles.get(name).language;
        if (!byLanguage.has(language)) byLanguage.set(language, []);
        byLanguage.get(language).push(name);
    }
    const poolFor = (language) => {
        const same = byLanguage.get(language) || [];
        if (language === 'undetected' || same.length <= topK) return names;
        const pool = [...same];
        for (const [other, list] of byLanguage) {
            if (other !== language && (other === 'undetected' || shuffleLanguagesAreNeighbors(language, other))) pool.push(...list);
        }
        return pool;
    };
    const pools = new Map();
    for (const a of names) {
        const pa = profiles.get(a);
        if (!pools.has(pa.language)) pools.set(pa.language, poolFor(pa.language));
        const best = []; // sorted, at most topK, best first
        for (const b of pools.get(pa.language)) {
            if (a === b) continue;
            const score = shuffleArtistCloseness(pa, profiles.get(b), weight);
            if (!(score > 0)) continue;
            if (best.length === topK && score <= best[topK - 1].score) continue;
            let at = best.length;
            while (at > 0 && best[at - 1].score < score) at--;
            best.splice(at, 0, { name: b, score });
            if (best.length > topK) best.pop();
        }
        graph.set(a, best);
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
    return a === b;
}

function shuffleBuildGroup(anchorArtist, graph, profiles, availableSongIds, config, libraryById) {
    const groupSongs = [];
    const artistsUsed = new Set();
    const usedSongIds = new Set();
    let currentArtist = anchorArtist;
    let totalMinutes = 0;
    const groupLanguage = profiles.get(anchorArtist).language;
    // An artist whose songs were all skipped (too long for the group, or the wrong language) is never in artistsUsed, so it used to stay
    // eligible and two such artists sent the walk back and forth for ever: the app froze. Every artist is visited once, so the walk ends.
    const visited = new Set([anchorArtist]);

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
            const shuffled = typeof songsInShuffleOrder === 'function'
                ? songsInShuffleOrder(artistSongs) // random, or leaning to higher ratings when the rating system is on (library/03h-ratings.js)
                : [...artistSongs].sort(() => Math.random() - 0.5);
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
            .filter(n => !artistsUsed.has(n.name) && !visited.has(n.name))
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
        visited.add(next);
    }

    if (groupSongs.length < config.minSongs || artistsUsed.size < config.minArtists) {
        return null;
    }

    return {
        songs: groupSongs,
        artistsUsed: [...artistsUsed],
        totalMinutes,
        groupLanguage
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

// The profiles and the graph depend only on what the songs say about themselves (artist, language, genre, year), so they are kept until one of those
// changes. Nothing below changes them: the walk keeps its own "available" and "used" sets.
let modelKey = '';
let model = null;
function shuffleArtistModel(available) {
    let hash = 2166136261 >>> 0;
    for (const song of available) {
        const text = `${song.id}|${song.artist || ''}|${song._detectedLanguage || song.language || ''}|${song.instrumental === true ? 1 : 0}|${song.genre || ''}|${song.year || ''}`;
        for (let i = 0; i < text.length; i++) hash = Math.imul(hash ^ text.charCodeAt(i), 16777619) >>> 0;
    }
    const key = `${available.length}:${hash}`;
    if (key !== modelKey || !model) {
        const profiles = buildShuffleArtistProfiles(available);
        model = { profiles, graph: buildShuffleArtistGraph(profiles, buildShuffleGenreRarity(available)) };
        modelKey = key;
    }
    return model;
}

export function generateSmartShuffleJourney(songs, excludeSongId = null, sourceId = currentView, deps = {}) {
    const {
        settings = getSmartShuffleSettings(),
        isDeleted = (id) => deletedSongIds.has(id),
        setSourceId = setSmartShuffleSourceId,
        setPreviousSong = setSmartShufflePreviousSong
    } = deps;
    let available = songs.filter((song) => song && !isDeleted(song.id) && song.id !== excludeSongId);

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

    const { profiles, graph } = shuffleArtistModel(available);
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

    // Songs that fit no group (very long tracks, a language of one) must not leave the journey short or empty: top it up in random order.
    if (journey.length < journeySize) {
        const inJourney = new Set(journey);
        const rest = available.map((s) => s.id).filter((id) => !inJourney.has(id));
        for (let i = rest.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [rest[i], rest[j]] = [rest[j], rest[i]];
        }
        journey.push(...rest.slice(0, journeySize - journey.length));
    }

    setSourceId(sourceId);
    setPreviousSong(null);

    return journey;
}

export function resetSmartShuffle(songs = null, excludeSongId = null, sourceId = currentView) {
    const sourceSongs = songs || getSongsForList(sourceId);

    // Ensure language detection has run for songs that don't have it yet.
    if (typeof ensureShuffleLanguages === 'function') {
        ensureShuffleLanguages(sourceSongs);
    }

    const journey = generateSmartShuffleJourney(sourceSongs, excludeSongId, sourceId);
    if (journey === null) return false;
    setSmartShuffleJourney(journey);
    setSmartShuffleJourneyIndex(0);
    setSmartShuffleSourceId(sourceId);
    return smartShuffleJourney.length > 0;
}

export function getNextSmartShuffledSong() {
    if (repeatFunctionalityActive && repeatMode === 2) return null;

    const sourceId = smartShuffleSourceId || currentView;
    const sourceSongs = getSongsForList(sourceId);
    if (smartShuffleJourneyIndex >= smartShuffleJourney.length && !resetSmartShuffle(sourceSongs, null, sourceId)) return null;

    const songId = smartShuffleJourney[smartShuffleJourneyIndex];
    setSmartShuffleJourneyIndex(smartShuffleJourneyIndex + 1);
    const song = getSongById(songId);
    if (!song || deletedSongIds.has(song.id)) return getNextSmartShuffledSong();

    return { song, listId: sourceId, ghostSlot: null };
}

export function getNextShuffledSong() {
    if (repeatFunctionalityActive && repeatMode === 2) return null;

    if (shuffleMode === 'smart') return getNextSmartShuffledSong();

    if (shuffleSourceId === null) {
        resetShuffle();
    }

    while (shuffleIndex < shuffleOrder.length) {
        const songId = shuffleOrder[shuffleIndex];
        setShuffleIndex(shuffleIndex + 1);
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

    const songId = shuffleOrder[shuffleIndex];
    setShuffleIndex(shuffleIndex + 1);
    const song = getSongById(songId);
    if (!song || deletedSongIds.has(song.id)) return getNextShuffledSong();

    return {
        song: song,
        listId: shuffleSourceId,
        ghostSlot: null
    };
}

export function startSmartShuffleFromCurrentView() {
    const songs = getSongsForList(currentView);
    if (songs.length <= 50) {
        showNotification('Smart Shuffle needs more than 50 songs in this list', 'warning', 3000);
        return false;
    }

    // Only prepare the shuffle: build the smart list and put it in the queue, the way normal shuffle does.
    // Nothing starts playing; whatever is playing now stays as the first queue item.
    const currentItem = currentQueueIndex >= 0 ? playbackQueue[currentQueueIndex] : null;
    const currentSongId = currentItem ? (currentItem.song || currentItem).id : null;
    const inList = currentSongId !== null && songs.some((s) => s.id === currentSongId);

    setShuffleMode('smart');
    setIsShuffled(false);
    clearShuffle();
    if (!resetSmartShuffle(songs, inList ? currentSongId : null, currentView)) {
        setShuffleMode('normal');
        return false;
    }
    toggleNormalShuffle(); // turns shuffle on and fills the queue from getNextShuffledSong (smart branch); does not play
    shuffleButton.setAttribute('aria-label', 'Smart Shuffle on');
    return true;
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        generateSmartShuffleJourney,
        resetSmartShuffle,
        getNextSmartShuffledSong,
        getNextShuffledSong,
        startSmartShuffleFromCurrentView
    });
}
