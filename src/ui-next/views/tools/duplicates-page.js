// Duplicates (the duplicate finder's page): groups of songs that look like the same recording, each with its copies side by side, the one the
// app suggests keeping marked, and the person's choices: hide the others, say "not duplicates", or send the others to the Recycle Bin.
// Nothing happens until a button is pressed. Hiding is reversible (the "Hidden" tab) and removes nothing: the files and the playlists stay.
// The thinking is in adapter/duplicates-core.js, the saving in library/duplicates-hidden.js (the engine), the glue in adapter/duplicates-bridge.js.

import { el, button, iconButton, segmented, tabs, emptyState, confirmDialog } from '../../components/index.js';
import { findDuplicateGroups, rankSongs, secondsOf } from './duplicates-core.js';
import * as bridge from '../../adapter/duplicates-bridge.js';
import { defaultCover } from '../../adapter/default-cover.js';
import { playSongFromList } from '../../adapter/actions.js';
import { notify } from '../../shell/notify.js';

const COVER = defaultCover('song');
const REASON = { file: 'Same file size and length', recording: 'Same MusicBrainz track', tags: 'Same title, artist and length' };
const CONFIDENCE = { same: 'Same recording', likely: 'Very likely the same', possible: 'Possibly the same' };
// How strict the search is: what the page lists. "Possible" are matches by tags alone where the albums differ (a single and its album, a compilation).
const LEVELS = [
    { value: 'same', label: 'Exact copies', shows: ['same'] },
    { value: 'likely', label: 'Same song', shows: ['same', 'likely'] },
    { value: 'possible', label: 'Also possible', shows: ['same', 'likely', 'possible'] }
];

const minutes = (seconds) => {
    const total = Math.max(0, Math.round(seconds));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};
const megabytes = (bytes) => (bytes > 0 ? `${(bytes / 1048576).toFixed(bytes < 10485760 ? 1 : 0)} MB` : '');
const formatOf = (url) => (/\.([a-z0-9]+)(?:[?#].*)?$/i.exec(String(url || '')) || [, ''])[1].toUpperCase();
const folderOf = (url) => {
    const path = decodeURIComponent(String(url || '').replace(/^file:\/\/\//, ''));
    const cut = path.lastIndexOf('/');
    return cut > 0 ? path.slice(0, cut) : path;
};
const count = (n, one, many) => `${n} ${n === 1 ? one : many}`;

let stopWatching = null;

/** Called when another view replaces the page: stops listening to the engine. Never stops the person from leaving. */
export function leaveDuplicates() {
    if (stopWatching) stopWatching();
    stopWatching = null;
    return true;
}

export function mountDuplicatesPage(host, options = {}) {
    leaveDuplicates();
    const state = { tab: options.tab === 'hidden' ? 'hidden' : 'review', level: 'likely', keepers: new Map(), computed: null };
    host.dataset.duplicates = 'true';
    const page = el('section', { class: 'dup-page', 'aria-label': 'Duplicates' });
    const head = el('header', { class: 'dup-page__head' });
    const body = el('div', { class: 'dup-page__body' });
    page.append(head, body);
    host.append(page);

    function compute() {
        const songs = bridge.librarySongs();
        const saved = bridge.decisions();
        const live = songs.filter((s) => !s.hidden);
        const groups = findDuplicateGroups(live, { ignored: new Set(saved.notDuplicates) });
        const byId = new Map(live.map((s) => [s.id, s]));
        const usage = bridge.usageOf(live);
        state.computed = {
            saved,
            hidden: songs.filter((s) => s.hidden),
            groups: groups.map((group) => ({ group, ranked: rankSongs(group.songIds.map((id) => byId.get(id)).filter(Boolean), usage) })).filter((g) => g.ranked.length > 1)
        };
    }

    const visibleGroups = () => state.computed.groups.filter(({ group }) => LEVELS.find((l) => l.value === state.level).shows.includes(group.confidence));
    const keeperOf = ({ group, ranked }) => {
        const chosen = state.keepers.get(group.id);
        return ranked.find((r) => r.song.id === chosen) ? chosen : ranked[0].song.id;
    };

    // The title and the toolbar stay where they are on both tabs; only what is under them changes.
    function drawHead() {
        const review = visibleGroups();
        const level = segmented({ items: LEVELS.map(({ value, label }) => ({ value, label })), value: state.level, label: 'How strict the search is', onChange: (value) => { state.level = value; draw(); } });
        const tab = tabs({ label: 'Duplicates', items: [{ id: 'review', label: `To review${review.length ? ` (${review.length})` : ''}` }, { id: 'hidden', label: `Hidden${state.computed.hidden.length ? ` (${state.computed.hidden.length})` : ''}` }], value: state.tab, onChange: (id) => { state.tab = id; draw(); } });
        level.el.style.visibility = state.tab === 'review' ? '' : 'hidden';
        head.replaceChildren(
            el('h1', { class: 'dup-page__title' }, 'Duplicates'),
            el('div', { class: 'dup-page__tools' }, tab.el, el('div', { class: 'dup-page__tools-end' }, level.el, iconButton({ icon: 'refresh-cw', label: 'Search again', size: 'sm', onClick: () => { compute(); draw(); } })))
        );
    }

    // The line above the list: what is shown, and the buttons that act on all of it.
    const bar = (text, ...buttons) => el('div', { class: 'dup-bar' }, el('span', { class: 'dup-bar__text' }, text), el('div', { class: 'dup-bar__buttons' }, ...buttons));

    function songRow(entry, group, keeperId) {
        const { song } = entry;
        const keep = song.id === keeperId;
        const seconds = secondsOf(song.duration);
        const cover = el('img', { class: 'dup-song__cover', src: song.cover || COVER, alt: '', loading: 'lazy' });
        cover.addEventListener('error', () => cover.setAttribute('src', COVER));
        const facts = [formatOf(song.url), Number(song.bitrate) ? `${song.bitrate} kbps` : '', Number(song.sampleRate) ? `${(Number(song.sampleRate) / 1000).toFixed(1).replace(/\.0$/, '')} kHz` : '', megabytes(Number(song.size)), seconds ? minutes(seconds) : ''].filter(Boolean);
        const radio = el('input', { type: 'radio', class: 'dup-song__radio', name: `keep-${group.id}`, 'aria-label': `Keep ${song.title || 'this song'}` });
        radio.checked = keep;
        radio.addEventListener('change', () => { state.keepers.set(group.id, song.id); draw(); });
        const why = keep && entry.why.length ? el('span', { class: 'dup-song__why' }, entry.why.join(' · ')) : '';
        const row = el(
            'div',
            { class: `dup-song${keep ? ' dup-song--keep' : ''}`, role: 'listitem' },
            radio,
            cover,
            el('div', { class: 'dup-song__text' }, el('div', { class: 'dup-song__title', dir: 'auto' }, String(song.title || 'Untitled'), keep ? el('span', { class: 'dup-song__badge' }, 'Keep') : ''), el('div', { class: 'dup-song__line', dir: 'auto' }, [song.artist, song.album].filter(Boolean).join(' — ')), el('div', { class: 'dup-song__path', title: folderOf(song.url) }, folderOf(song.url))),
            el('div', { class: 'dup-song__facts' }, el('span', { class: 'dup-song__format' }, facts.join(' · ')), why),
            el('div', { class: 'dup-song__actions' }, iconButton({ icon: 'play', label: `Play ${song.title || 'song'}`, size: 'sm', onClick: () => playSongFromList(song.id, 'all-songs') }), iconButton({ icon: 'folder', label: 'Show in folder', size: 'sm', onClick: () => bridge.showInFolder(song) }))
        );
        return row;
    }

    async function hideOthers(item) {
        const keeper = keeperOf(item);
        const others = item.ranked.map((r) => r.song).filter((s) => s.id !== keeper);
        const changed = bridge.moveToKept(others.map((s) => ({ from: s.id, to: keeper })));
        bridge.hideSongs(others.map((s) => s.url));
        notify({ kind: 'success', title: `${count(others.length, 'copy', 'copies')} hidden`, detail: changed ? `${count(changed, 'playlist', 'playlists')} now use the kept song. Show them again in Duplicates > Hidden.` : 'Show them again in Duplicates > Hidden.', where: 'toast' });
    }

    async function trashOthers(item) {
        const keeper = keeperOf(item);
        const others = item.ranked.map((r) => r.song).filter((s) => s.id !== keeper);
        const ok = await confirmDialog({
            title: 'Move to the Recycle Bin',
            message: `Move ${count(others.length, 'file', 'files')} to the Recycle Bin and keep "${item.ranked.find((r) => r.song.id === keeper).song.title}"? You can restore them from there.`,
            confirmLabel: 'Move to Recycle Bin',
            destructive: true
        });
        if (!ok) return;
        bridge.moveToKept(others.map((s) => ({ from: s.id, to: keeper })));
        const sent = await bridge.trashSongs(others.map((s) => s.id));
        notify({ kind: sent ? 'success' : 'error', title: sent ? `${count(sent, 'file', 'files')} moved to the Recycle Bin` : 'Could not move the files', where: 'toast' });
    }

    // Hides the extra copies of many groups at once. The kept song of each group is the one the page shows as "Keep" (the suggested one, or the one
    // the person picked). Playlists and favourites that held a hidden copy get the kept song.
    async function hideMany(items) {
        const extras = items.reduce((n, item) => n + item.ranked.length - 1, 0);
        const ok = await confirmDialog({
            title: `Hide ${count(extras, 'copy', 'copies')}?`,
            message: `The best copy of each of ${count(items.length, 'group', 'groups')} stays. The others are hidden, not deleted. You can show them again in Hidden.`,
            confirmLabel: 'Hide them'
        });
        if (!ok) return;
        const urls = [];
        const moves = [];
        for (const item of items) {
            const keeper = keeperOf(item);
            for (const { song } of item.ranked) if (song.id !== keeper) {
                urls.push(song.url);
                moves.push({ from: song.id, to: keeper });
            }
        }
        const changed = bridge.moveToKept(moves);
        bridge.hideSongs(urls);
        notify({ kind: 'success', title: `${count(urls.length, 'copy', 'copies')} hidden`, detail: changed ? `${count(changed, 'playlist', 'playlists')} now use the kept song.` : '', where: 'toast' });
    }

    function groupCard(item) {
        const { group } = item;
        const keeper = keeperOf(item);
        const menuTrash = button({ label: 'Move others to Recycle Bin', icon: 'trash-2', variant: 'ghost', size: 'sm', onClick: () => trashOthers(item) });
        return el(
            'article',
            { class: 'dup-group', 'data-confidence': group.confidence },
            el('header', { class: 'dup-group__head' }, el('span', { class: 'dup-group__confidence' }, CONFIDENCE[group.confidence]), el('span', { class: 'dup-group__reason' }, group.reasons.map((r) => REASON[r]).join(' and ')), el('span', { class: 'dup-group__count' }, count(item.ranked.length, 'copy', 'copies'))),
            el('div', { class: 'dup-group__songs', role: 'list' }, ...item.ranked.map((entry) => songRow(entry, group, keeper))),
            el('footer', { class: 'dup-group__actions' }, button({ label: 'Hide the others', icon: 'eye-off', variant: 'primary', size: 'sm', onClick: () => hideOthers(item) }), button({ label: 'Not duplicates', icon: 'x', variant: 'outline', size: 'sm', onClick: () => { bridge.notDuplicates(group.signature); } }), menuTrash)
        );
    }

    function drawReview() {
        const groups = visibleGroups();
        if (!groups.length) {
            const more = state.computed.groups.length > 0;
            body.replaceChildren(emptyState({ icon: 'copy', title: more ? 'Nothing at this strictness' : 'No duplicates found', actions: more ? [{ label: 'Also possible', variant: 'outline', onClick: () => { state.level = 'possible'; draw(); } }] : [] }));
            return;
        }
        const extras = groups.reduce((n, g) => n + g.ranked.length - 1, 0);
        const exact = groups.filter(({ group }) => group.confidence === 'same');
        const exactAll = state.computed.groups.filter(({ group }) => group.confidence === 'same');
        const auto = [];
        if (exactAll.length) auto.push(button({ label: `Hide all exact copies (${exactAll.reduce((n, g) => n + g.ranked.length - 1, 0)})`, icon: 'eye-off', variant: 'primary', size: 'sm', onClick: () => hideMany(exactAll) }));
        if (groups.length > exact.length) auto.push(button({ label: `Hide all shown (${extras})`, icon: 'eye-off', variant: 'outline', size: 'sm', onClick: () => hideMany(groups) }));
        body.replaceChildren(bar(`${count(groups.length, 'group', 'groups')}, ${count(extras, 'extra copy', 'extra copies')}`, ...auto), ...groups.map(groupCard));
    }

    function drawHidden() {
        const hidden = state.computed.hidden;
        if (!hidden.length) {
            body.replaceChildren(emptyState({ icon: 'eye', title: 'Nothing is hidden' }));
            return;
        }
        const rows = hidden.map((song) => {
            const cover = el('img', { class: 'dup-song__cover', src: song.cover || COVER, alt: '', loading: 'lazy' });
            cover.addEventListener('error', () => cover.setAttribute('src', COVER));
            return el('div', { class: 'dup-song', role: 'listitem' }, cover, el('div', { class: 'dup-song__text' }, el('div', { class: 'dup-song__title', dir: 'auto' }, String(song.title || 'Untitled')), el('div', { class: 'dup-song__line', dir: 'auto' }, [song.artist, song.album].filter(Boolean).join(' \u2014 ')), el('div', { class: 'dup-song__path', title: folderOf(song.url) }, folderOf(song.url))), el('div', { class: 'dup-song__actions' }, button({ label: 'Show again', icon: 'eye', variant: 'outline', size: 'sm', onClick: () => bridge.showSongs([song.url]) }), iconButton({ icon: 'trash-2', label: 'Move to Recycle Bin', size: 'sm', onClick: () => trashHidden([song]) })));
        });
        body.replaceChildren(
            bar(count(hidden.length, 'hidden song', 'hidden songs'), button({ label: 'Show all', icon: 'eye', variant: 'outline', size: 'sm', onClick: () => bridge.showSongs() }), button({ label: 'Move all to Recycle Bin', icon: 'trash-2', variant: 'ghost', size: 'sm', onClick: () => trashHidden(hidden) })),
            el('div', { class: 'dup-group dup-group--hidden' }, el('div', { class: 'dup-group__songs', role: 'list' }, ...rows))
        );
    }

    async function trashHidden(songs) {
        const ok = await confirmDialog({ title: 'Move to the Recycle Bin', message: `Move ${count(songs.length, 'file', 'files')} to the Recycle Bin? You can restore them from there.`, confirmLabel: 'Move to Recycle Bin', destructive: true });
        if (!ok) return;
        const sent = await bridge.trashSongs(songs.map((s) => s.id));
        notify({ kind: sent ? 'success' : 'error', title: sent ? `${count(sent, 'file', 'files')} moved to the Recycle Bin` : 'Could not move the files', where: 'toast' });
    }

    function draw() {
        drawHead();
        if (state.tab === 'review') drawReview();
        else drawHidden();
    }

    compute();
    draw();
    stopWatching = bridge.onDuplicatesChanged(() => {
        if (!host.isConnected) return leaveDuplicates();
        compute();
        draw();
    });
}
