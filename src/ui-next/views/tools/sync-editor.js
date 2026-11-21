// The Sync editor: time the lines of a song's lyrics against the audio and save them as synced lyrics (LRC).
//
// It stands on its own. It has a workspace of songs (added by dropping audio files on it, "Open files", "Use playing song" or the same
// "Add songs from" picker the Batch page has), its own audio element (the player keeps playing nothing while this plays), and one session per
// song that survives leaving the page, so several songs can be worked on in turn. A song from the library saves into the library as a new
// synced version; any other file saves an .lrc next to the audio. The logic is in sync-model.js; the engine and the desktop shell are reached
// only through adapter/sync-bridge.js.

import { el, iconEl, button, iconButton, emptyState, openMenu, openDialog, confirmDialog } from '../../components/index.js';
import * as bridge from '../../adapter/sync-bridge.js';
import { sources, loadSource } from '../../adapter/tag-sheet-bridge.js';
import { defaultCover } from '../../adapter/default-cover.js';
import { notify } from '../../shell/notify.js';
import { sourceButton } from './source-picker.js';
import * as model from './sync-model.js';

const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.mp4', '.aac', '.ogg', '.opus', '.wma', '.wav', '.aiff', '.aif', '.ape', '.wv'];
const MAX_ADD = 200; // songs one "Add songs from" may put in the workspace
const NUDGES = [-1, -0.5, -0.1, 0.1, 0.5, 1];
const SPEEDS = [0.5, 1, 2];
const VOLUME_KEY = 'xplayer.ui-next.sync-volume';

// ---------------------------------------------------------------------------------------------------------------------------- workspace
// Kept outside the page, so leaving Lyrics and coming back finds the same songs, lines and undo history.
export const workspace = { sessions: new Map(), active: '' };
let live = null; // the mounted editor, so a song can be sent to it from outside (tool window)
let waiting = []; // songs sent while it was not mounted

export function resetSyncWorkspace() {
    workspace.sessions.clear();
    workspace.active = '';
    waiting = [];
}

/** A library song id, or a track, to add to the workspace (the editor may not be showing yet). */
export function sendToSync(songId) {
    const song = bridge.librarySong(songId);
    const track = song && model.trackFromSong(song, { library: true });
    if (!track) return false;
    if (live) live.add([track]);
    else waiting.push(track);
    return true;
}

/** True while the editor is on screen (the Lyrics tab asks before it leaves with unsaved work). */
export const syncMounted = () => live !== null;

/** The titles of the songs whose lines have changes that are not saved. */
export function syncUnsaved() {
    return [...workspace.sessions.values()].filter((session) => session.dirty).map((session) => session.track.title);
}

/** Drops the unsaved changes: each changed song starts again from what is saved for it. The songs stay in the list. */
export function discardSyncChanges() {
    for (const [key, session] of workspace.sessions) if (session.dirty) workspace.sessions.set(key, startSession(session.track));
}

/** The library song the editor is working on, '' for a file that is not in the library, undefined when it has no song (the window button's choice of song). */
export function activeSyncSongId() {
    const session = workspace.sessions.get(workspace.active);
    return session ? (session.track.library ? session.track.id : '') : undefined;
}

/** A session starts with what a library song already has (its saved synced lyrics, else its plain lyrics), read as the song is added, so the song list shows how many lines are timed before the song is opened. */
function startSession(track) {
    const session = model.createSession(track);
    session.pending = false;
    if (track.library) readSaved(session);
    return session;
}

function readSaved(session) {
    const { track } = session;
    session.pending = false;
    const saved = bridge.variants(track.id);
    const version = saved.find((v) => v.active) || saved[saved.length - 1];
    const entries = version && bridge.parse(version.text);
    if (entries) {
        session.lines = model.linesFromEntries(entries);
        session.offset = version.offset;
        session.source = version.name;
    } else if (bridge.plainLyrics(track.id).trim()) {
        session.lines = model.linesFromText(bridge.plainLyrics(track.id));
        session.source = 'Plain lyrics';
    }
    session.focus = session.lines.length ? Math.max(0, model.nextToStamp(session.lines, -1)) : -1;
}

function trackOf(song) {
    if (!song) return null;
    const inLibrary = bridge.librarySong(song.id) || (song.url && bridge.libraryByUrl(song.url));
    return model.trackFromSong(inLibrary || song, { library: Boolean(inLibrary) });
}

// ---------------------------------------------------------------------------------------------------------------------------- page
function coverImage(src, className) {
    const fallback = defaultCover('song');
    const image = el('img', { src: src || fallback, alt: '', loading: 'lazy', draggable: 'false' });
    image.addEventListener('error', () => image.getAttribute('src') !== fallback && image.setAttribute('src', fallback));
    return el('span', { class: className }, image);
}

const isTyping = (target) => target instanceof Element && Boolean(target.closest('input, textarea, select, [contenteditable="true"], dialog'));
const isAudioFile = (file) => AUDIO_EXTENSIONS.includes(`.${String(file.name).split('.').pop().toLowerCase()}`);

function readVolume() {
    try {
        const value = Number(localStorage.getItem(VOLUME_KEY));
        return Number.isFinite(value) && localStorage.getItem(VOLUME_KEY) !== null ? Math.min(1, Math.max(0, value)) : 0.8;
    } catch (error) {
        return 0.8;
    }
}

/**
 * Draws the editor into `host` (replacing what was there). options.fromPlayer: add the song that is playing when the workspace is empty.
 * Returns a function that stops it (the audio is paused and let go; the workspace stays).
 */
export function mountSyncEditor(host, options = {}) {
    host.replaceChildren();
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.volume = readVolume();
    let follow = true;
    let nowIndex = -1;
    let frame = 0;
    let loadedKey = '';
    let audioError = '';
    let dragDepth = 0;
    let speed = 1; // playback speed (0.5, 1 or 2): the stamps are taken from the song's own time, so they stay right at any speed
    let ticksTotal = -1; // the duration the marks on the scrubber were drawn for
    let railQuery = ''; // what is typed in the song list's search

    const current = () => workspace.sessions.get(workspace.active) || null;
    const duration = () => (Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : current()?.track.duration || 0);

    // ------------------------------------------------------------------------------------------------------------------ pieces of the page
    const sourceBtn = sourceButton({ list: sources, label: 'Add songs from', onPick: (id) => addFromSource(id), className: 'btn btn--outline btn--sm sync-rail__add' });
    const head = el(
        'header',
        { class: 'sync-head' },
        el(
            'div',
            { class: 'sync-head__titles' },
            el('span', { class: 'sync-head__eyebrow' }, 'Sync'),
            el('h1', { class: 'sync-head__title' }, 'Time your lyrics'),
            el('p', { class: 'sync-head__text' }, 'Play a song and press F1 as each line begins. Drop any audio file here to work on it.')
        )
    );
    const busy = el('p', { class: 'sync-busy', role: 'status', hidden: true }, 'Reading files…');

    // The song list: a title with the count and a search button, the search field (opened by the button), the songs, and the ways to add more.
    const railCount = el('span', { class: 'sync-rail__count' }, '0');
    const railList = el('ul', { class: 'sync-rail__list', role: 'list' });
    const searchInput = el('input', { class: 'sync-rail__search-input', type: 'text', placeholder: 'Search songs', 'aria-label': 'Search the songs in the editor', spellcheck: 'false', autocomplete: 'off' });
    const searchRow = el('div', { class: 'sync-rail__search', hidden: true }, iconEl('search', { size: 16 }), searchInput);
    const searchToggle = iconButton({ icon: 'search', label: 'Search songs', size: 'sm', onClick: () => toggleRailSearch() });
    const moreAdd = iconButton({
        icon: 'ellipsis',
        label: 'More ways to add songs',
        size: 'sm',
        tooltip: false,
        onClick: (event) =>
            openMenu({
                anchor: event.currentTarget,
                items: [
                    { label: 'Open audio files…', icon: 'folder', onSelect: () => openFiles() },
                    { label: 'Use the playing song', icon: 'play', onSelect: () => usePlaying() },
                    ...(workspace.sessions.size ? [{ type: 'separator' }, { label: 'Remove all songs', icon: 'trash-2', onSelect: () => removeAll() }] : [])
                ]
            })
    });
    const rail = el(
        'aside',
        { class: 'sync-rail', 'aria-label': 'Songs in the editor' },
        el('div', { class: 'sync-rail__head' }, el('h2', {}, 'Songs'), railCount, el('span', { class: 'sync-tools__spacer' }), searchToggle, sourceBtn, moreAdd),
        searchRow,
        railList
    );
    // The add button is a "+" with an arrow (its words are the tooltip and the accessible name), so it sits beside the search in the narrow header.
    sourceBtn.setAttribute('aria-label', 'Add songs from…');
    sourceBtn.title = 'Add songs from…';
    searchInput.addEventListener('input', () => ((railQuery = searchInput.value), paintRail()));
    searchInput.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        toggleRailSearch(false);
    });
    function toggleRailSearch(open = searchRow.hidden) {
        searchRow.hidden = !open;
        searchToggle.setAttribute('aria-pressed', String(open));
        if (open) searchInput.focus();
        else {
            searchInput.value = '';
            railQuery = '';
            paintRail();
        }
    }
    const stage = el('section', { class: 'sync-stage' });
    const dropVeil = el('div', { class: 'sync-veil', hidden: true }, el('div', { class: 'sync-veil__box' }, iconEl('folder', { size: 28 }), el('strong', {}, 'Drop to add'), el('span', {}, 'Audio files open in the editor. Nothing is added to your library.')));
    const root = el('div', { class: 'sync', 'data-file-drop': 'sync' }, head, busy, el('div', { class: 'sync-body' }, rail, stage), dropVeil);
    host.append(root);

    // Parts of the stage that are updated while the song plays, found again after every repaint.
    let parts = {};

    // ------------------------------------------------------------------------------------------------------------------ the workspace
    function activate(key) {
        if (!workspace.sessions.has(key)) return;
        if (workspace.active !== key) audio.pause();
        workspace.active = key;
        paint();
    }

    function add(tracks) {
        let first = '';
        for (const track of tracks.filter(Boolean)) {
            if (!workspace.sessions.has(track.key)) workspace.sessions.set(track.key, startSession(track));
            first = first || track.key;
        }
        if (first) activate(first);
        else paint();
    }

    async function addFromSource(id) {
        const rows = loadSource(id);
        const wanted = rows.slice(0, MAX_ADD);
        const found = bridge.librarySongs(wanted.map((row) => row.id));
        const songs = wanted.map((row, at) => found[at] || row);
        if (!songs.length) return void notify({ title: 'Nothing to add', detail: 'That list has no songs.', kind: 'info', where: 'toast' });
        add(songs.map((song) => model.trackFromSong(song, { library: true })));
        if (rows.length > MAX_ADD) notify({ title: `Added the first ${MAX_ADD} songs`, kind: 'info', where: 'toast' });
    }

    function addScanned(result) {
        if (result?.canceled) return;
        const songs = result?.songs || [];
        if (!songs.length) return void notify({ title: 'No audio to open', detail: result?.error || 'No supported audio files were found.', kind: 'warning', where: 'toast' });
        add(songs.map(trackOf));
    }

    // Reading the tags of many files takes a moment: say so, and do not start a second read meanwhile.
    async function reading(work) {
        if (root.dataset.busy === 'true') return;
        root.dataset.busy = 'true';
        busy.hidden = false;
        try {
            addScanned(await work());
        } finally {
            root.dataset.busy = 'false';
            busy.hidden = true;
        }
    }
    const openFiles = () => reading(() => bridge.pickFiles());

    function usePlaying() {
        const track = trackOf(bridge.playing());
        if (!track) return void notify({ title: 'Nothing is playing', detail: 'Start a song in the player first, or open a file.', kind: 'info', where: 'toast' });
        add([track]);
    }

    async function removeSong(key) {
        const session = workspace.sessions.get(key);
        if (!session) return;
        if (session.dirty && !(await confirmDialog({ title: 'Remove this song?', message: `"${session.track.title}" has changes that are not saved. They will be lost.`, confirmLabel: 'Remove', destructive: true }))) return;
        const keys = [...workspace.sessions.keys()];
        const at = keys.indexOf(key);
        workspace.sessions.delete(key);
        if (workspace.active === key) {
            audio.pause();
            workspace.active = keys[at + 1] || keys[at - 1] || '';
        }
        paint();
    }

    async function removeAll() {
        const unsaved = [...workspace.sessions.values()].filter((session) => session.dirty);
        if (unsaved.length && !(await confirmDialog({ title: 'Remove all songs?', message: unsaved.length === 1 ? `"${unsaved[0].track.title}" has changes that are not saved. They will be lost.` : `${unsaved.length} songs have changes that are not saved. They will be lost.`, confirmLabel: 'Remove all', destructive: true }))) return;
        audio.pause();
        workspace.sessions.clear();
        workspace.active = '';
        paint();
    }

    // ------------------------------------------------------------------------------------------------------------------ loading lyrics
    async function confirmReplace() {
        const session = current();
        if (!session.dirty || !session.lines.length) return true;
        return confirmDialog({ title: 'Replace the lines?', message: 'The lines in the editor have changes that are not saved. Loading will replace them (Undo brings them back).', confirmLabel: 'Replace', destructive: true });
    }

    async function loadLines(lines, label, offset = 0) {
        if (!(await confirmReplace())) return;
        model.load(current(), lines, label, offset);
        paint();
    }

    async function loadVariant(version) {
        const entries = bridge.parse(version.text);
        if (!entries) return void notify({ title: 'Could not read that version', kind: 'warning', where: 'toast' });
        await loadLines(model.linesFromEntries(entries), version.name, version.offset);
    }

    async function importFile() {
        const result = await bridge.readLrcFile();
        if (!result?.success || typeof result.contents !== 'string') return;
        const entries = bridge.parse(result.contents);
        await loadLines(entries ? model.linesFromEntries(entries) : model.linesFromText(result.contents), entries ? 'Imported .lrc' : 'Imported text');
    }

    async function pasteText() {
        const area = el('textarea', { class: 'sync-paste', rows: '12', placeholder: 'Paste lyrics here, one line per sung line. Pasted .lrc text keeps its times.', spellcheck: 'false' });
        const answer = await openDialog({
            title: 'Paste lyrics',
            body: area,
            wide: true,
            actions: [
                { label: 'Cancel', value: false },
                { label: 'Use these lines', value: true, variant: 'primary' }
            ]
        });
        if (answer !== true || !area.value.trim()) return;
        const entries = bridge.parse(area.value);
        await loadLines(entries && entries.length > 1 ? model.linesFromEntries(entries) : model.linesFromText(area.value), 'Pasted text');
    }

    function loadMenu(anchor) {
        const session = current();
        const saved = session.track.library ? bridge.variants(session.track.id) : [];
        const plain = session.track.library ? bridge.plainLyrics(session.track.id).trim() : '';
        const items = [];
        if (saved.length) {
            items.push({ type: 'heading', label: 'Saved synced lyrics' });
            for (const version of saved) items.push({ label: version.name, icon: 'clock', checked: session.source === version.name ? true : undefined, onSelect: () => loadVariant(version) });
            items.push({ type: 'separator' });
        }
        items.push(
            { label: 'Plain lyrics of this song', icon: 'text-align-start', disabled: !plain, onSelect: () => loadLines(model.linesFromText(plain), 'Plain lyrics') },
            { label: 'Import an .lrc or text file…', icon: 'download', onSelect: importFile },
            { label: 'Paste lyrics…', icon: 'pencil', onSelect: pasteText },
        );
        openMenu({ anchor, items });
    }

    // ------------------------------------------------------------------------------------------------------------------ playback
    function loadAudio() {
        const session = current();
        const key = session ? session.track.key : '';
        if (key === loadedKey) return;
        loadedKey = key;
        audioError = '';
        audio.pause();
        if (session) {
            audio.src = session.track.url;
            audio.load();
            audio.playbackRate = speed;
        } else audio.removeAttribute('src');
        nowIndex = -1;
    }

    function seek(time) {
        if (!current()) return;
        const top = duration();
        audio.currentTime = Math.max(0, top ? Math.min(top, time) : time);
        tick();
    }

    function togglePlay() {
        if (!current()) return;
        if (audio.paused) {
            bridge.pausePlayer();
            audio.play().catch((error) => {
                audioError = error && error.name === 'NotSupportedError' ? 'This file cannot be played here.' : 'Could not play this file.';
                paintPlayer();
            });
        } else audio.pause();
    }

    function playFrom(index) {
        const line = current()?.lines[index];
        if (!line || !Number.isFinite(line.time)) return;
        seek(line.time);
        if (audio.paused) togglePlay();
    }

    function setSpeed(rate) {
        speed = rate;
        audio.defaultPlaybackRate = rate; // loading another song keeps it
        audio.playbackRate = rate;
        paintPlayer();
    }

    function setVolume(value) {
        audio.volume = Math.min(1, Math.max(0, value));
        audio.muted = false;
        try {
            localStorage.setItem(VOLUME_KEY, String(audio.volume));
        } catch (error) {
            // the volume is simply not remembered
        }
        paintPlayer();
    }

    audio.addEventListener('play', () => {
        bridge.pausePlayer();
        loop();
        paintPlayer();
    });
    for (const name of ['pause', 'ended', 'loadedmetadata', 'durationchange', 'seeked', 'timeupdate']) audio.addEventListener(name, () => tick());
    audio.addEventListener('pause', () => paintPlayer());
    audio.addEventListener('error', () => {
        audioError = audio.error && audio.error.code === 4 ? 'This file cannot be played here.' : 'Could not load this file.';
        paintPlayer();
    });
    const stopWatchingPlayer = bridge.onPlayerPlaying(() => audio.pause());

    function loop() {
        cancelAnimationFrame(frame);
        if (!audio.paused && !audio.ended && host.isConnected) frame = requestAnimationFrame(() => (tick(), loop()));
    }

    // ------------------------------------------------------------------------------------------------------------------ painting
    function paint() {
        loadAudio();
        paintRail();
        paintStage();
    }

    function paintRail() {
        const all = [...workspace.sessions.values()];
        const words = railQuery.toLowerCase().split(/\s+/).filter(Boolean);
        const sessions = words.length ? all.filter((session) => words.every((word) => `${session.track.title} ${session.track.artist} ${session.track.album}`.toLowerCase().includes(word))) : all;
        root.dataset.empty = String(all.length === 0);
        root.dataset.count = String(Math.min(all.length, 2));
        railCount.textContent = words.length ? `${sessions.length}/${all.length}` : String(all.length);
        searchToggle.disabled = all.length === 0;
        railList.replaceChildren(
            ...(sessions.length ? [] : [el('li', { class: 'sync-rail__empty' }, all.length ? 'No song matches' : 'No songs yet')]),
            ...sessions.map((session) => {
                    const { timed, total } = model.progress(session.lines);
                    const done = total > 0 && timed === total;
                    const open = el(
                        'button',
                        { type: 'button', class: 'sync-song', 'aria-current': session.track.key === workspace.active ? 'true' : null, onclick: () => activate(session.track.key) },
                        coverImage(session.track.cover, 'sync-song__cover'),
                        el('span', { class: 'sync-song__text' }, el('span', { class: 'sync-song__title', dir: 'auto' }, session.track.title), el('span', { class: 'sync-song__artist', dir: 'auto' }, session.track.artist || (session.track.library ? 'Library' : 'Audio file'))),
                        el('span', { class: `sync-song__status${done ? ' is-done' : ''}${session.dirty ? ' is-dirty' : ''}`, title: session.dirty ? 'Unsaved changes' : '' }, total ? `${timed}/${total}` : '')
                    );
                    const close = iconButton({ icon: 'x', label: `Remove ${session.track.title}`, size: 'sm', tooltip: false, onClick: () => removeSong(session.track.key), className: 'sync-song__remove' });
                    return el('li', { class: 'sync-song-item' }, open, close);
            })
        );
    }

    function paintStage() {
        const session = current();
        if (session && session.pending) readSaved(session);
        parts = {};
        if (!session) return void stage.replaceChildren(emptyWorkspace());
        const { track } = session;
        const { timed, total } = model.progress(session.lines);
        const follower = button({ label: 'Follow', icon: 'clock', variant: 'ghost', size: 'sm', pressed: follow, onClick: (event) => ((follow = !follow), event.currentTarget.setAttribute('aria-pressed', String(follow))) });
        follower.title = 'Keep the playing line in view';
        const toolbar = el(
            'div',
            { class: 'sync-tools' },
            button({ label: 'Load lyrics', icon: 'list-music', size: 'sm', onClick: (event) => loadMenu(event.currentTarget) }),
            (parts.stampTool = stampButton()),
            el('span', { class: 'sync-tools__spacer' }),
            follower,
            el('span', { class: 'sync-tools__divider', 'aria-hidden': 'true' }),
            (parts.undo = button({ label: 'Undo', variant: 'ghost', size: 'sm', disabled: session.history.length === 0, onClick: () => change(() => model.undo(session)) })),
            (parts.redo = button({ label: 'Redo', variant: 'ghost', size: 'sm', disabled: session.future.length === 0, onClick: () => change(() => model.redo(session)) }))
        );
        parts.list = el('div', { class: 'sync-lines', role: 'list', 'aria-label': 'Lyric lines' });
        const linesCard = el('div', { class: 'sync-card sync-card--lines' }, toolbar, session.lines.length ? parts.list : noLines());
        const player = playerCard();
        const footer = footerBar(session, timed, total);
        stage.replaceChildren(el('div', { class: 'sync-work' }, linesCard, player), footer);
        if (session.lines.length) paintLines();
        paintPlayer();
        tick(true);
    }

    function emptyWorkspace() {
        return emptyState({
            icon: 'waveform',
            title: 'Drop a song to start',
            text: 'Drag audio files onto this page, open one, or take the song that is playing. Each song keeps its own lines and undo history while you work on the others.',
            actions: [
                { label: 'Open files', icon: 'folder', onClick: () => openFiles() },
                { label: 'Use playing song', onClick: () => usePlaying() }
            ]
        });
    }

    function noLines() {
        const session = current();
        const plain = session.track.library && bridge.plainLyrics(session.track.id).trim();
        return emptyState({
            icon: 'text-align-start',
            title: 'No lyrics to time yet',
            text: 'Load the words of the song, then stamp each line as you hear it.',
            actions: [
                plain ? { label: 'Use plain lyrics', onClick: () => loadLines(model.linesFromText(plain), 'Plain lyrics') } : { label: 'Paste lyrics', onClick: pasteText },
                { label: 'Import a file', icon: 'download', onClick: importFile },
                { label: 'More…', onClick: (event) => loadMenu(event.currentTarget) }
            ]
        });
    }

    function playerCard() {
        parts.now = el('span', { class: 'sync-clock__now' }, '00:00.00');
        parts.total = el('span', { class: 'sync-clock__total' }, '00:00.00');
        parts.fill = el('span', { class: 'sync-scrub__fill' });
        parts.knob = el('span', { class: 'sync-scrub__knob' });
        parts.ticks = el('span', { class: 'sync-scrub__ticks', 'aria-hidden': 'true' });
        parts.scrub = el('div', { class: 'sync-scrub', role: 'slider', tabindex: '0', 'aria-label': 'Position', 'aria-valuemin': '0' }, parts.ticks, parts.fill, parts.knob);
        scrubbing(parts.scrub);
        parts.play = iconButton({ icon: 'play', label: 'Play', variant: 'solid', tooltip: false, onClick: togglePlay });
        const skip = (label, by) => el('button', { type: 'button', class: 'sync-skip', onclick: () => seek(audio.currentTime + by), 'aria-label': `${by < 0 ? 'Back' : 'Forward'} ${Math.abs(by)} seconds` }, label);
        // In the slim layout the toolbar scrolls away with the lines, so the player bar keeps its own Stamp button (hidden otherwise).
        parts.stamp = el('button', { type: 'button', class: 'sync-stamp', onclick: () => doStamp() }, el('span', { class: 'sync-stamp__label' }, iconEl('clock', { size: 18 }), 'Stamp line', el('kbd', {}, 'F1')), (parts.next = el('span', { class: 'sync-stamp__next', dir: 'auto' })));
        parts.error = el('p', { class: 'sync-error', role: 'alert', hidden: true });
        parts.mute = iconButton({ icon: 'volume-2', label: 'Mute', size: 'sm', tooltip: false, onClick: () => ((audio.muted = !audio.muted), paintPlayer()) });
        parts.volume = el('input', { type: 'range', class: 'sync-volume', min: '0', max: '1', step: '0.01', 'aria-label': 'Volume', oninput: (event) => setVolume(Number(event.target.value)) });
        parts.speed = el('button', { type: 'button', class: 'sync-speed', onclick: () => setSpeed(SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length]) }); // one button: each click is the next speed, 0.5x, 1x, 2x, and round
        parts.preview = el('textarea', { class: 'sync-preview', readonly: true, spellcheck: 'false', placeholder: 'The timed lines appear here as .lrc text.', 'aria-label': 'LRC preview' });
        return el(
            'aside',
            { class: 'sync-card sync-player' },
            el('div', { class: 'sync-clock' }, parts.now, parts.total, parts.speed),
            parts.scrub,
            el('div', { class: 'sync-transport' }, skip('−5s', -5), skip('−1s', -1), parts.play, skip('+1s', 1), skip('+5s', 5)),
            parts.stamp,
            parts.error,
            el('div', { class: 'sync-aux' }, parts.mute, parts.volume),
            el('section', { class: 'sync-preview-box', 'aria-label': 'LRC preview' }, el('div', { class: 'sync-preview-head' }, el('span', {}, 'LRC preview'), button({ label: 'Copy', variant: 'ghost', size: 'sm', onClick: (event) => copyPreview(event) })), parts.preview)
        );
    }

    function stampButton() {
        const node = button({ label: 'Stamp line', icon: 'clock', variant: 'primary', size: 'sm', className: 'sync-stamp-btn', onClick: () => doStamp() });
        node.append(el('kbd', { class: 'sync-kbd' }, 'F1'));
        node.title = 'Give the selected line the playing time (F1)';
        return node;
    }

    function footerBar(session, timed, total) {
        parts.status = el('span', { class: 'sync-foot__status' });
        const library = session.track.library;
        return el(
            'footer',
            { class: 'sync-foot' },
            // Clear stamps lives here, far from the buttons used while stamping, so it is hard to hit by mistake.
            (parts.clear = button({ label: 'Clear stamps', variant: 'ghost', size: 'sm', disabled: timed === 0, onClick: () => clearAll() })),
            parts.status,
            el('span', { class: 'sync-tools__spacer' }),
            button({ label: 'Save as .txt', variant: 'ghost', size: 'sm', onClick: () => saveAs('txt') }),
            button({ label: library ? 'Save as .lrc' : 'Save .lrc', variant: library ? 'outline' : 'primary', icon: library ? undefined : 'download', size: 'sm', onClick: () => saveAs('lrc') }),
            library ? button({ label: 'Save to library', variant: 'primary', size: 'sm', onClick: () => saveToLibrary() }) : ''
        );
    }

    function paintLines() {
        const session = current();
        if (!session || !parts.list) return;
        parts.list.replaceChildren(...session.lines.map((line, index) => lineRow(session, line, index)));
        paintFocus(false);
        paintNow();
        paintStatus();
        paintPreview();
    }

    function lineRow(session, line, index) {
        const blank = !line.instrumental && !line.text.trim();
        const stamped = Number.isFinite(line.time);
        const time = el('button', { type: 'button', class: 'sync-line__time', title: 'Click to type a time', onclick: (event) => (event.stopPropagation(), editTime(index, event.currentTarget)) }, model.formatTime(line.time));
        const text = el('span', { class: 'sync-line__text', dir: 'auto', ondblclick: (event) => editText(index, event.currentTarget) }, line.instrumental ? '♪ Instrumental' : line.text || 'Empty line');
        const more = iconButton({ icon: 'ellipsis', label: 'Line options', size: 'sm', tooltip: false, onClick: (event) => (event.stopPropagation(), lineMenu(index, event.currentTarget)) });
        const play = iconButton({ icon: 'play', label: 'Play from this line', size: 'sm', tooltip: false, disabled: !stamped, onClick: (event) => (event.stopPropagation(), playFrom(index)) });
        const nudges = el(
            'div',
            { class: 'sync-line__nudge', role: 'group', 'aria-label': 'Nudge the time' },
            ...NUDGES.map((by) => el('button', { type: 'button', class: 'sync-nudge', onclick: (event) => (event.stopPropagation(), change(() => model.nudge(session, index, by), index)) }, `${by < 0 ? '−' : '+'}${String(Math.abs(by)).replace(/^0/, '')}s`))
        );
        return el(
            'div',
            { class: `sync-line${blank ? ' is-blank' : ''}${stamped ? ' has-time' : ''}${line.instrumental ? ' is-instrumental' : ''}`, role: 'listitem', 'data-index': String(index), onclick: () => focusLine(index) },
            el('span', { class: 'sync-line__marker', 'aria-hidden': 'true' }, iconEl('play', { size: 12, filled: true })),
            time,
            text,
            el('span', { class: 'sync-line__actions' }, play, more),
            nudges
        );
    }

    function paintFocus(reveal = true) {
        const session = current();
        if (!session || !parts.list) return;
        parts.list.querySelectorAll('.sync-line').forEach((node, index) => node.classList.toggle('is-current', index === session.focus));
        const focused = parts.list.children[session.focus];
        if (reveal && focused) focused.scrollIntoView({ block: 'nearest' });
        paintNext();
    }

    function paintNext() {
        const session = current();
        if (!session || !parts.next) return;
        const line = session.lines[session.focus];
        parts.next.textContent = line ? (line.instrumental ? '♪ Instrumental' : line.text || 'Empty line') : 'Pick a line to stamp';
        if (parts.stamp) parts.stamp.disabled = !line;
        if (parts.stampTool) parts.stampTool.disabled = !line;
    }

    function paintNow() {
        const session = current();
        if (!session || !parts.list) return;
        const index = model.activeLineAt(session.lines, audio.currentTime);
        if (index === nowIndex) return;
        parts.list.children[nowIndex]?.classList.remove('is-now');
        nowIndex = index;
        const node = parts.list.children[index];
        if (!node) return;
        node.classList.add('is-now');
        if (follow && !audio.paused) node.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }

    function paintStatus() {
        const session = current();
        if (!session || !parts.status) return;
        const { timed, total } = model.progress(session.lines);
        const from = session.source ? ` · ${session.source}` : ''; // where the lines came from: a saved version, plain lyrics, a file
        parts.status.textContent = total ? `${timed} of ${total} lines timed${from}${session.dirty ? ' · unsaved changes' : ''}` : session.dirty ? 'Unsaved changes' : 'No lines yet';
        parts.status.dataset.dirty = String(session.dirty);
    }

    function paintPreview() {
        const session = current();
        if (!session || !parts.preview) return;
        parts.preview.value = lrcText();
        paintTicks();
    }

    // The marks on the scrubber: one small tick for every place a line starts, and ticks closer than half a percent of the song share one,
    // so a song with many lines shows a light dotted line and not a wall.
    function paintTicks() {
        const session = current();
        if (!session || !parts.ticks) return;
        const total = duration();
        ticksTotal = total;
        const spots = new Set();
        if (total) for (const line of session.lines) if (Number.isFinite(line.time)) spots.add(Math.round(Math.min(1, line.time / total) * 200));
        parts.ticks.replaceChildren(...[...spots].map((spot) => el('i', { style: `left:${spot / 2}%` })));
    }

    function paintPlayer() {
        if (!parts.play) return;
        const playing = !audio.paused && !audio.ended;
        parts.play.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        parts.play.replaceChildren(iconEl(playing ? 'pause' : 'play', { size: 20, filled: true }));
        parts.error.hidden = !audioError;
        parts.error.textContent = audioError;
        parts.mute.replaceChildren(iconEl(audio.muted || audio.volume === 0 ? 'volume-x' : 'volume-2', { size: 16 }));
        parts.volume.value = String(audio.muted ? 0 : audio.volume);
        parts.volume.style.setProperty('--hi', String(audio.muted ? 0 : audio.volume));
        parts.speed.textContent = `${speed}\u00d7`;
        parts.speed.dataset.rate = String(speed);
        parts.speed.title = parts.speed.ariaLabel = `Playback speed ${speed}\u00d7 (click to change)`;
        root.dataset.playing = String(playing);
        tick(true);
    }

    function tick(force = false) {
        if (!parts.now) return;
        const time = audio.currentTime || 0;
        const total = duration();
        parts.now.textContent = model.formatTime(time);
        parts.total.textContent = model.formatTime(total || null).replace('--:--.--', '00:00.00');
        const ratio = total ? Math.min(1, time / total) : 0;
        parts.fill.style.width = `${ratio * 100}%`;
        parts.knob.style.left = `${ratio * 100}%`;
        parts.scrub.setAttribute('aria-valuemax', String(Math.round(total)));
        parts.scrub.setAttribute('aria-valuenow', String(Math.round(time)));
        if (parts.ticks && (force || total !== ticksTotal)) paintTicks(); // the song's length became known, or the player was drawn again
        paintNow();
    }

    // ------------------------------------------------------------------------------------------------------------------ actions
    const lrcText = () => {
        const session = current();
        return session ? model.toLrc(session.lines, session.track) : '';
    };

    /** Redraws one row from the model (a long lyric is not redrawn for a change to one line). */
    function replaceRow(index) {
        const session = current();
        const old = parts.list && parts.list.children[index];
        if (!session || !old || !session.lines[index]) return paintLines();
        if (index === nowIndex) nowIndex = -1;
        old.replaceWith(lineRow(session, session.lines[index], index));
        paintFocus(false);
        paintNow();
    }

    /** Runs a change to the session and repaints what it touches: `touched` is the one line that changed, when only one did. */
    function change(action, touched) {
        const session = current();
        if (!session) return;
        const before = session.dirty;
        const hadLines = session.lines.length > 0;
        const result = action();
        if (result === false) return;
        if ((session.lines.length > 0) !== hadLines) {
            // the first line appeared or the last one went (Undo after "Start blank", deleting the only line): the stage swaps between the list and its empty state
            paintStage();
            return refreshChrome(false);
        }
        if (typeof touched === 'number') {
            replaceRow(touched);
            paintStatus();
            paintPreview();
        } else paintLines();
        refreshChrome(before !== session.dirty);
    }

    function refreshChrome(dirtyChanged) {
        const session = current();
        paintRail();
        if (dirtyChanged) paintStage();
        else {
            parts.undo.disabled = session.history.length === 0;
            parts.redo.disabled = session.future.length === 0;
            parts.clear.disabled = model.progress(session.lines).timed === 0;
        }
    }

    function focusLine(index) {
        const session = current();
        model.setFocus(session, index);
        paintFocus();
    }

    function doStamp() {
        const session = current();
        if (!session || session.focus < 0) return;
        if (audio.paused && audio.currentTime === 0) {
            notify({ title: 'Play the song first', detail: 'Press Space, then F1 as each line begins.', kind: 'info', where: 'toast', key: 'sync-play-first' });
        }
        const at = session.focus;
        change(() => model.stamp(session, audio.currentTime) !== -1, at);
        paintFocus();
    }

    async function clearAll() {
        const session = current();
        if (!(await confirmDialog({ title: 'Clear all stamps?', message: 'Every line loses its time. The words stay, and Undo brings the times back.', confirmLabel: 'Clear stamps', destructive: true }))) return;
        change(() => model.clearStamps(session));
        paintStage();
    }

    function editInline(node, index, value, commit, className = '') {
        const input = el('input', { class: `sync-inline ${className}`.trim(), value, spellcheck: 'false', 'aria-label': 'Edit' });
        let settled = false;
        const finish = (save) => {
            if (settled) return;
            settled = true;
            if (save) commit(input.value);
            replaceRow(index);
        };
        input.addEventListener('keydown', (event) => {
            event.stopPropagation();
            if (event.key === 'Enter') finish(true);
            else if (event.key === 'Escape') finish(false);
        });
        input.addEventListener('blur', () => finish(true));
        input.addEventListener('click', (event) => event.stopPropagation());
        node.replaceWith(input);
        input.focus();
        input.select();
    }

    function editTime(index, node) {
        const session = current();
        focusLine(index);
        editInline(node, index, Number.isFinite(session.lines[index].time) ? model.formatTime(session.lines[index].time) : '', (value) => {
            if (!value.trim()) return change(() => model.setTime(session, index, null), index);
            const parsed = model.parseTime(value);
            if (parsed === null) return notify({ title: 'Not a time', detail: 'Type it as 1:23.45 or 83.5.', kind: 'warning', where: 'toast', key: 'sync-bad-time' });
            change(() => model.setTime(session, index, parsed), index);
        }, 'is-time');
    }

    function editText(index, node) {
        const session = current();
        focusLine(index);
        editInline(node, index, session.lines[index].text, (value) => change(() => model.setText(session, index, value), index));
    }

    function lineMenu(index, anchor) {
        const session = current();
        const line = session.lines[index];
        openMenu({
            anchor,
            items: [
                { label: 'Insert a line below', icon: 'plus', onSelect: () => (change(() => model.insertAfter(session, index) >= 0), paintFocus()) },
                { label: 'Join with the line above', icon: 'arrow-up-down', disabled: index === 0, onSelect: () => change(() => model.joinWithPrevious(session, index)) },
                { label: line.instrumental ? 'Make it a sung line' : 'Mark as instrumental ♪', icon: 'list-music', onSelect: () => change(() => model.toggleInstrumental(session, index), index) },
                { label: 'Remove its time', icon: 'clock', disabled: !Number.isFinite(line.time), onSelect: () => change(() => model.setTime(session, index, null), index) },
                { type: 'separator' },
                { label: 'Delete the line', icon: 'trash-2', danger: true, onSelect: () => change(() => model.removeLine(session, index)) }
            ]
        });
    }

    async function copyPreview(event) {
        event.preventDefault();
        event.stopPropagation();
        try {
            await navigator.clipboard.writeText(lrcText());
            notify({ title: 'Copied', kind: 'success', where: 'toast', key: 'sync-copied' });
        } catch (error) {
            parts.preview.select();
        }
    }

    async function saveAs(extension) {
        const session = current();
        const { track } = session;
        const contents = extension === 'txt' ? model.toPlainText(session.lines) : lrcText();
        if (!contents.trim()) return void notify({ title: 'Nothing to save', detail: extension === 'lrc' ? 'No line has a time yet.' : 'There are no lines yet.', kind: 'warning', where: 'toast' });
        const beside = extension === 'lrc' ? model.lrcPathBesideAudio(track.url) : '';
        const result = await bridge.saveFile(beside || model.lyricsFileName(track, extension), contents);
        if (!result?.success) return;
        if (!track.library && extension === 'lrc') {
            model.markSaved(session);
            paintStage();
            paintRail();
        }
        notify({ title: 'Saved', detail: result.filePath || '', kind: 'success', where: 'toast', key: 'sync-saved' });
    }

    async function saveToLibrary() {
        const session = current();
        const { timed, total } = model.progress(session.lines);
        if (timed === 0) return void notify({ title: 'No lines have been timed yet', kind: 'warning', where: 'toast', key: 'sync-none-timed' });
        if (timed < total && !(await confirmDialog({ title: 'Some lines have no time', message: `${total - timed} of ${total} lines have not been stamped. They are left out of the saved lyrics.`, confirmLabel: 'Save anyway' }))) return;
        const saved = bridge.saveVariant(session.track.id, lrcText(), session.offset);
        if (!saved) return void notify({ title: 'Could not save', kind: 'error', where: 'toast' });
        session.source = saved.name;
        model.markSaved(session);
        paintStage();
        paintRail();
        notify({ title: `Saved as ${saved.name}`, detail: `${session.track.title} now shows these synced lyrics.`, kind: 'success', where: 'toast', key: 'sync-saved' });
    }

    // ------------------------------------------------------------------------------------------------------------------ scrubber
    function scrubbing(node) {
        const at = (event) => {
            const box = node.getBoundingClientRect();
            return Math.min(1, Math.max(0, (event.clientX - box.left) / (box.width || 1))) * duration();
        };
        node.addEventListener('pointerdown', (event) => {
            if (!duration()) return;
            node.setPointerCapture(event.pointerId);
            node.dataset.dragging = 'true';
            seek(at(event));
        });
        node.addEventListener('pointermove', (event) => node.dataset.dragging === 'true' && seek(at(event)));
        const end = () => delete node.dataset.dragging;
        node.addEventListener('pointerup', end);
        node.addEventListener('pointercancel', end);
    }

    // ------------------------------------------------------------------------------------------------------------------ keys and drops
    function onKey(event) {
        if (!host.isConnected || !current() || document.querySelector('dialog[open]')) return;
        const typing = isTyping(event.target);
        const session = current();
        const ctrl = event.ctrlKey || event.metaKey;
        if (event.key === 'F1') {
            event.preventDefault();
            return doStamp();
        }
        if (ctrl && event.key.toLowerCase() === 's') {
            event.preventDefault();
            return session.track.library ? saveToLibrary() : saveAs('lrc');
        }
        if (typing) return;
        if (ctrl && event.key.toLowerCase() === 'z') {
            event.preventDefault();
            return change(() => (event.shiftKey ? model.redo(session) : model.undo(session)));
        }
        if (ctrl && event.key.toLowerCase() === 'y') {
            event.preventDefault();
            return change(() => model.redo(session));
        }
        if (ctrl || event.altKey) return;
        const steps = { ArrowLeft: -1, ArrowRight: 1 };
        if (event.key in steps) {
            event.preventDefault();
            seek(audio.currentTime + steps[event.key] * (event.shiftKey ? 5 : 1));
        } else if (event.key === ' ') {
            if (event.target instanceof Element && event.target.closest('button, summary, [role="slider"]')) return;
            event.preventDefault();
            togglePlay();
        } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            focusLine(Math.min(session.lines.length - 1, Math.max(0, session.focus + (event.key === 'ArrowDown' ? 1 : -1))));
        } else if (event.key === 'Delete' && session.focus >= 0) {
            event.preventDefault();
            change(() => model.setTime(session, session.focus, null), session.focus);
        }
    }
    document.addEventListener('keydown', onKey);

    const hasFiles = (event) => Array.from(event.dataTransfer?.types || []).includes('Files');
    root.addEventListener('dragenter', (event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        dragDepth += 1;
        dropVeil.hidden = false;
    });
    root.addEventListener('dragover', (event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
    });
    root.addEventListener('dragleave', (event) => {
        if (!hasFiles(event)) return;
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) dropVeil.hidden = true;
    });
    root.addEventListener('drop', async (event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        dragDepth = 0;
        dropVeil.hidden = true;
        const files = Array.from(event.dataTransfer.files).filter(isAudioFile);
        if (!files.length) return void notify({ title: 'No audio files found', detail: 'Drop mp3, flac, m4a, wav, ogg or another audio file.', kind: 'warning', where: 'toast', key: 'sync-no-audio' });
        reading(() => bridge.scanFiles(files));
    });

    // ------------------------------------------------------------------------------------------------------------------ start and stop
    live = { add: (tracks) => add(tracks) };
    const arrived = waiting.splice(0);
    if (arrived.length) add(arrived);
    else if (options.songId !== undefined && options.songId !== null && sendToSyncNow(options.songId)) paint();
    else {
        if (!workspace.sessions.size && options.fromPlayer) usePlayingQuietly();
        paint();
    }

    function sendToSyncNow(songId) {
        const song = bridge.librarySong(songId);
        if (!song) return false;
        add([model.trackFromSong(song, { library: true })]);
        return true;
    }

    function usePlayingQuietly() {
        const track = trackOf(bridge.playing());
        if (track) add([track]);
    }

    return function stop() {
        cancelAnimationFrame(frame);
        audio.pause();
        audio.removeAttribute('src');
        audio.load();
        document.removeEventListener('keydown', onKey);
        stopWatchingPlayer();
        live = null;
        host.replaceChildren();
    };
}
