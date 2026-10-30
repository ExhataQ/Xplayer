// ai-bridge (Agent E, tasks PE-03 and PE-04, page side; counted in the new DP9 budget of 300 lines).
//
// Carries out an approved AI plan with the engine's own functions (the ones the old screen uses for
// playlists, folders, the queue and tags), and records one journal entry so the whole plan can be undone.
// The plan has already been checked and previewed by electron/ai/ (main process); this file never talks
// to the AI service and never runs anything that is not in the fixed action list.
//
//   collectSongs(fields, { includeLyrics }) -> light song copies for planning, the whole library with the playing, queued, selected and
//                                              playlist songs first (only the fields the main process allows)
//   collectContext()                        -> the queue, the playlists and the folders, as real ids and names (the main process turns the
//                                              ids into song numbers)
//   runPlan(plan, summary)                  -> { ok, applied, failure, warnings, entryId }
//   undoEntry(id)                           -> { ok, failures }
//   canRun(type)                            -> true when this file can carry out that action type
//   getStatus, setSettings, setKey, clearKey, listModels, keyInfo, describePrivacy, plan, translate, cancel, journalList,
//   currentLyrics, selectedCount, libraryCount  -> what the AI screens in views/ai/ call

import { createPlaylistNamed, createFolderNamed } from './library-create.js';

const engine = () => window;
// The engine's VIEWS.ALL_SONGS (ui/07-views.js); VIEWS itself is not on window.
const ALL_SONGS_VIEW = 'all-songs';
const ai = () => window.desktopApi.ai;
const same = (a, b) => String(a).trim().toLowerCase() === String(b).trim().toLowerCase();
const refresh = (event) => typeof engine().emit === 'function' && engine().emit(event);

/** The song now playing (a song object) or null. */
export function playingSong() {
    const { currentQueueIndex: index, playbackQueue: queue } = engine();
    const item = index >= 0 && queue ? queue[index] : null;
    return item ? item.song || item : null;
}

/** Plain or synced lyrics text of a song (synced first; it still has its [mm:ss] stamps), or ''. */
export function lyricsFor(song) {
    const read = (fn) => (typeof engine()[fn] === 'function' ? String(engine()[fn](song) || '').trim() : '');
    return read('getSyncedLyricsForSong') || read('getLyricsForSong');
}

// The assistant sees everything at once: the whole library, with the song playing now, the queue, the selected songs and the playlist
// songs first (the main process cuts the table at a size limit, and the end of the list is the part that can be cut), and flags that say
// which are playing, selected and favorites. With includeLyrics the first LYRICS_SONGS songs of that order carry their lyrics.
const LYRICS_SONGS = 40;
const queuedSongs = () => (engine().playbackQueue || []).map((item) => (item ? item.song || item : null)).filter(Boolean);

function prioritized(all, now, picked) {
    const byId = new Map(all.map((s) => [s.id, s]));
    const order = [];
    const seen = new Set();
    const take = (id) => {
        if (seen.has(id) || !byId.has(id)) return;
        seen.add(id);
        order.push(byId.get(id));
    };
    if (now) take(now.id);
    for (const song of queuedSongs()) take(song.id);
    for (const id of picked || []) take(id);
    for (const playlist of typeof engine().getPlaylists === 'function' ? engine().getPlaylists() : []) for (const id of playlist.songs || []) take(id);
    for (const song of all) take(song.id);
    return order;
}

export function collectSongs(fields, { includeLyrics = false, focus = null } = {}) {
    const all = engine().SONGS_DATA || [];
    const picked = new Set([...(engine().selectedSongIds || []), ...(focus || [])]); // `focus`: songs a contextual button is about
    const now = playingSong();
    const list = prioritized(all, now, picked);
    const favorites = new Set(typeof engine().getFavorites === 'function' ? engine().getFavorites() : []);
    return list.map((s, i) => {
        const copy = { id: s.id, duration: s.duration, favorite: favorites.has(s.id), playing: Boolean(now && now.id === s.id), selected: Boolean(picked && picked.has(s.id)) };
        for (const field of fields) if (!(field in copy)) copy[field] = s[field];
        if (includeLyrics && i < LYRICS_SONGS) copy.lyrics = lyricsFor(s);
        return copy;
    });
}

/** The queue (in play order, with the position of the song playing), every playlist with its songs, and the folders with the playlists inside. Real ids and names; electron/ai/privacy.js turns the ids into numbers. */
export function collectContext() {
    const playlists = typeof engine().getPlaylists === 'function' ? engine().getPlaylists() : [];
    const nameOf = new Map(playlists.map((p) => [p.id, p.name]));
    const folders = typeof engine().getFolders === 'function' ? engine().getFolders() : [];
    return {
        queue: queuedSongs().map((s) => s.id),
        queueIndex: typeof engine().currentQueueIndex === 'number' ? engine().currentQueueIndex : -1,
        playlists: playlists.map((p) => ({ name: p.name, songs: [...(p.songs || [])] })),
        folders: folders.map((f) => ({ name: f.name, playlists: (f.children || []).filter((c) => c.type === 'playlist' && nameOf.has(c.id)).map((c) => nameOf.get(c.id)) }))
    };
}

// ---- the calls the AI screens make (views never touch window.desktopApi themselves) ----

// The shell starts before the engine has loaded window.desktopApi: resolves when it is there, or when the page has finished loading.
export const whenBridgeReady = () => (window.desktopApi || document.readyState === 'complete' ? Promise.resolve() : new Promise((resolve) => window.addEventListener('load', resolve, { once: true })));

export const getStatus = () => ai().aiGetStatus();
export const setSettings = (patch) => ai().aiSetSettings(patch);
export const setKey = (key) => ai().aiSetKey(key);
export const clearKey = () => ai().aiClearKey();
export const listModels = (freeOnly = true) => ai().aiListModels({ freeOnly });
export const keyInfo = () => ai().aiKeyInfo();
export const describePrivacy = () => ai().aiDescribePrivacy();
export const cancel = () => ai().aiCancel();
export const journalList = () => ai().aiJournalList();
export const translate = (lyrics, targetLanguage) => ai().aiTranslateLyrics({ lyrics, targetLanguage });

/** Title and artist for song ids, in the order given (ids not in the library are skipped). */
export function describeSongs(ids) {
    const library = new Map((engine().SONGS_DATA || []).map((s) => [s.id, s]));
    return ids.filter((id) => library.has(id)).map((id) => ({ id, title: String(library.get(id).title || 'Untitled'), artist: String(library.get(id).artist || '') }));
}

export const selectedCount = () => (engine().selectedSongIds ? engine().selectedSongIds.size : 0);
export const hasPlayingSong = () => Boolean(playingSong());
export const libraryCount = () => (engine().SONGS_DATA || []).length;

/** Asks for a plan. Only the fields the main process allows are copied out of the library. */
export async function plan({ request, useWeb = false, includeLyrics = false, history = [], focus = null }) {
    const status = await getStatus();
    const songs = collectSongs(status.songFields || [], { includeLyrics, focus });
    const result = await ai().aiPlan({ request, useWeb, includeLyrics, history, songs, context: collectContext() });
    return { ...result, libraryTotal: songs.length };
}

/** The song now playing and its lyrics (synced first), or null. */
export function currentLyrics() {
    const song = playingSong();
    if (!song) return null;
    return { id: song.id, title: String(song.title || ''), artist: String(song.artist || ''), lyrics: lyricsFor(song) };
}

function findPlaylist(name) {
    const match = engine().getPlaylists().find((p) => same(p.name, name));
    if (!match) throw new Error(`Playlist "${name}" does not exist`);
    return match;
}

function findFolder(name) {
    const match = engine().getFolders().find((f) => same(f.name, name));
    if (!match) throw new Error(`Folder "${name}" does not exist`);
    return match;
}

const folderHolding = (playlistId) => engine().getFolders().find((f) => f.children.some((c) => c.id === playlistId && c.type === 'playlist' && !c.shortcut)) || null;

// Actions that need the shell (open a screen) are added by views/ai/register.js through registerHandler.
const click = (id) => document.getElementById(id)?.click();
export const registerHandler = (type, fn) => { HANDLERS[type] = fn; };

const HANDLERS = {
    player_control({ command }) {
        const audio = engine().audioElement;
        const playing = Boolean(audio && !audio.paused && !audio.ended);
        if (command === 'next') click('next-btn');
        else if (command === 'previous') click('prev-btn');
        else if (command === 'toggle' || (command === 'play' && !playing) || (command === 'pause' && playing)) click('play-btn');
        return {};
    },
    create_playlist({ name }) {
        const made = createPlaylistNamed(name);
        return { undo: made.created ? { playlistId: made.id } : { reused: true } };
    },
    create_folder({ name }) {
        const made = createFolderNamed(name);
        return { undo: made.created ? { folderId: made.id } : { reused: true } };
    },
    add_to_playlist({ playlist, songs }) {
        const target = findPlaylist(playlist);
        const added = songs.filter((id) => engine().addSongToPlaylist(id, target.id));
        return { undo: { playlistId: target.id, songIds: added } };
    },
    remove_from_playlist({ playlist, songs }) {
        const target = findPlaylist(playlist);
        const removed = songs.filter((id) => engine().removeSongFromPlaylist(id, target.id));
        return { undo: { playlistId: target.id, songIds: removed } };
    },
    put_playlist_in_folder({ playlist, folder }) {
        const target = findPlaylist(playlist);
        const destination = findFolder(folder);
        const before = folderHolding(target.id);
        engine().addToFolder(destination.id, target.id, 'playlist', false);
        refresh('folder:listChanged');
        return { undo: { playlistId: target.id, folderId: destination.id, previousFolderId: before ? before.id : null } };
    },
    play_next({ songs }) {
        const library = new Set((engine().SONGS_DATA || []).map((s) => s.id));
        const wanted = songs.filter((id) => library.has(id));
        if (!wanted.length) throw new Error('None of those songs are in the library');
        // Each song goes right after the one playing, so adding them last to first keeps the order the plan gave.
        for (const id of [...wanted].reverse()) engine().addSongToQueueNext(id);
        if (typeof engine().updateQueueDisplay === 'function') engine().updateQueueDisplay();
        return {};
    },
    set_play_order({ songs }) {
        const library = new Map((engine().SONGS_DATA || []).map((s) => [s.id, s]));
        const items = songs.filter((id) => library.has(id)).map((id, i) => ({ song: library.get(id), listId: ALL_SONGS_VIEW, ghostSlot: i }));
        if (!items.length) throw new Error('None of those songs are in the library');
        engine().setPlaybackQueue(items);
        engine().setCurrentQueueIndex(0);
        engine().updateQueueDisplay();
        engine().playSongFromQueue(0);
        return {};
    },
    async set_tags({ songs, tags }) {
        const library = new Map((engine().SONGS_DATA || []).map((s) => [s.id, s]));
        const targets = songs.map((id) => library.get(id)).filter((song) => song && song.url);
        if (!targets.length) throw new Error('None of those songs are in the library');
        const results = await saveMany(targets.map((song) => ({ fileUrl: song.url, metadata: tags })));
        const keys = Object.keys(tags);
        const changed = [];
        const failed = [];
        for (const result of results) {
            if (!result.success) {
                const song = targets.find((s) => s.url === result.fileUrl);
                failed.push(`${(song && song.title) || result.fileUrl}: ${result.error}`);
                continue;
            }
            // `previous` is what the file held before the write (tag service), so undo is exact.
            const previous = {};
            for (const key of keys) previous[key] = result.previous && result.previous[key] != null ? flat(result.previous[key]) : '';
            changed.push({ fileUrl: result.fileUrl, previous });
        }
        // One song failing must not lose the undo data of the ones that were written.
        if (!changed.length) throw new Error(failed[0] || 'The tags could not be saved');
        return { undo: { changed }, warnings: failed };
    }
};

const flat = (value) => (Array.isArray(value) ? value.join(', ') : value);

// The tag sheet's save: one call for many files, each result carries the old values (electron/tag-service.js).
// Also updates every in-memory copy of a written file (library and queue), as the metadata editor does.
async function saveMany(items) {
    const response = await window.desktopApi.metadata.saveAudioMetadataMany(items);
    if (!response || !response.success) throw new Error((response && response.error) || 'The tags could not be saved');
    for (const result of response.results) {
        if (!result.success) continue;
        const saved = result.metadata || {};
        const copies = [...(engine().SONGS_DATA || []), ...(engine().playbackQueue || []).map((q) => q && (q.song || q))].filter((s) => s && s.url === result.fileUrl);
        for (const copy of copies) {
            for (const key of Object.keys(saved)) if (key !== 'cover' && key !== 'otherTags') copy[key] = flat(saved[key]);
        }
    }
    return response.results;
}

const UNDO = {
    create_playlist: (u) => u.playlistId && engine().deletePlaylist(u.playlistId),
    create_folder: (u) => u.folderId && engine().deleteFolder(u.folderId, false),
    add_to_playlist: (u) => u.songIds.forEach((id) => engine().removeSongFromPlaylist(id, u.playlistId)),
    remove_from_playlist: (u) => u.songIds.forEach((id) => engine().addSongToPlaylist(id, u.playlistId)), // they come back at the end of the playlist
    put_playlist_in_folder(u) {
        engine().removeItemFromFolder(u.folderId, u.playlistId, 'playlist');
        if (u.previousFolderId) engine().addToFolder(u.previousFolderId, u.playlistId, 'playlist', false);
        refresh('folder:listChanged');
    },
    async set_tags(u) {
        const results = await saveMany(u.changed.map(({ fileUrl, previous }) => ({ fileUrl, metadata: previous })));
        const bad = results.filter((r) => !r.success);
        if (bad.length) throw new Error(`${bad.length} song(s) could not be restored: ${bad[0].error}`);
    }
};

export const canRun = (type) => typeof HANDLERS[type] === 'function';

export async function runPlan(plan, summary) {
    const done = [];
    const warnings = [];
    let failure = null;
    for (let i = 0; i < plan.actions.length; i++) {
        const { type, args } = plan.actions[i];
        try {
            if (!canRun(type)) throw new Error(`Cannot carry out ${type}`);
            const result = (await HANDLERS[type](args)) || {};
            if (result.undo !== undefined) done.push({ type, undo: result.undo });
            if (result.warnings) warnings.push(...result.warnings);
        } catch (error) {
            failure = { index: i, type, message: error.message };
            break;
        }
    }
    let entryId = null;
    if (done.length) {
        const recorded = await ai().aiJournalRecord({ kind: 'ai-plan', summary: summary || plan.summary, changes: done });
        entryId = recorded && recorded.ok ? recorded.entry.id : null;
    }
    return { ok: !failure, applied: done.length, failure, warnings, entryId };
}

export async function undoEntry(id) {
    const entry = await ai().aiJournalGet(id);
    if (!entry) return { ok: false, failures: [{ message: 'That entry no longer exists' }] };
    if (entry.status === 'undone') return { ok: false, failures: [{ message: 'Already undone' }] };
    const failures = [];
    for (let i = entry.changes.length - 1; i >= 0; i--) {
        const change = entry.changes[i];
        try {
            if (!UNDO[change.type]) throw new Error(`Cannot undo ${change.type}`);
            await UNDO[change.type](change.undo);
        } catch (error) {
            failures.push({ index: i, type: change.type, message: error.message });
        }
    }
    if (!failures.length) await ai().aiJournalMarkUndone(id);
    return { ok: failures.length === 0, failures };
}
