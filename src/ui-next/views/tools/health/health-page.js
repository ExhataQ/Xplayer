// Library health: one page that looks at the whole library and lists what is worth fixing, a card per kind of problem.
// Nothing changes until a button is pressed, and everything it does is reversible: songs are hidden (Duplicates > Hidden shows them again) or
// sent to the Recycle Bin. A card opens its list (rows are built only while on screen: virtual-rows.js); the Duplicates card opens the
// duplicate finder (views/tools/duplicates-page.js). What the checks are: health-checks.js. The safe one-click clean-ups: auto-clean.js.

import { el, button, iconButton, emptyState, confirmDialog, iconEl } from '../../../components/index.js';
import { mountDuplicatesPage, leaveDuplicates } from '../duplicates-page.js';
import { CHECKS, GROUPS, checkById, runChecks } from './health-checks.js';
import { mountVirtualRows } from './virtual-rows.js';
import { planAutoClean, applyAutoClean } from './auto-clean.js';
import * as bridge from '../../../adapter/duplicates-bridge.js';
import { defaultCover } from '../../../adapter/default-cover.js';
import { playSongFromList } from '../../../adapter/actions.js';
import { notify } from '../../../shell/notify.js';
import { setPlace, onGoPlace } from '../../../shell/places.js';
import { on as onEngineEvent } from '../../../adapter/events.js';

const COVER = defaultCover('song');
const ICONS = { duplicates: 'copy', 'missing-title': 'tag', 'missing-artist': 'tag', 'missing-album': 'tag', 'no-cover': 'image', 'file-name-as-title': 'text-align-start', 'tiny-files': 'triangle-alert', 'low-quality': 'volume-x' };
const count = (n, one, many) => `${n.toLocaleString('en-US')} ${n === 1 ? one : many}`;
const folderOf = (url) => {
    const path = decodeURIComponent(String(url || '').replace(/^file:\/\/\//, ''));
    const cut = path.lastIndexOf('/');
    return cut > 0 ? path.slice(0, cut) : path;
};

/** The small "Beta" mark: Library health is new and its checks will grow. */
export const betaBadge = () => el('span', { class: 'beta-badge', title: 'Library health is new: more checks and fixes are coming' }, 'Beta');

// What the last run found. Coming back to the page (the rail button again, Back, another view and return) shows it at once; it is checked again
// quietly only when the library changed since (`version` moves on every change the engine reports), and the cards swap when the new answer is in.
let cache = null; // { results: Map, checked, version }
let version = 0;
let watching = false;
function watchLibrary() {
    if (watching) return;
    watching = true;
    for (const name of ['songs:changed', 'library:rebuilt', 'duplicates:changed', 'data:imported']) {
        try {
            onEngineEvent(name, () => { version++; });
        } catch (error) {
            watching = false; // the engine is not ready yet: try again at the next mount
        }
    }
}

let pending = null; // the check to open on the next mount (the Duplicates button in Settings asks for 'duplicates')
let stopWatching = null;
let cancelRun = null;
let stopKeys = null;
let stopPlaces = null;

/** Asks for a check (and, for Duplicates, its tab) to be open the next time the page is mounted. */
export function openHealthCheck(id, tab) {
    pending = { id, tab };
}

/** Called when another view replaces the page. Never stops the person from leaving. */
export function leaveHealth() {
    if (cancelRun) cancelRun();
    cancelRun = null;
    if (stopWatching) stopWatching();
    stopWatching = null;
    if (stopKeys) stopKeys();
    stopKeys = null;
    if (stopPlaces) stopPlaces();
    stopPlaces = null;
    leaveDuplicates();
    return true;
}

export function mountHealthPage(host, options = {}) {
    leaveHealth();
    watchLibrary();
    const state = { results: new Map(), open: null, checked: 0, running: false, selected: new Set(), anchor: -1, list: null, items: [], byId: new Map(), view: null };
    host.dataset.health = 'true';
    const page = el('section', { class: 'health-page', 'aria-label': 'Library health' });
    host.append(page);
    let run = 0;

    const liveSongs = () => bridge.librarySongs().filter((s) => !s.hidden);
    const contextFor = () => ({ notDuplicates: bridge.decisions().notDuplicates });

    // ---------- running the checks ----------
    // start(): show the last answer when the library has not changed; when it has, show the last answer anyway and check again quietly.
    // start(true) (the Check again button) clears the cards and checks from scratch.
    function start(force = false) {
        if (cancelRun) cancelRun();
        const mine = ++run;
        const stamp = version;
        if (!force && cache && cache.version === stamp) {
            state.results = cache.results;
            state.checked = cache.checked;
            state.running = false;
            cancelRun = () => { run++; };
            drawOverview();
            return;
        }
        const songs = liveSongs();
        const quiet = !force && Boolean(cache); // an older answer is on screen: swap it when the new one is whole
        const next = new Map();
        state.checked = quiet ? cache.checked : songs.length;
        state.results = quiet ? cache.results : next;
        state.running = !quiet;
        cancelRun = () => { run++; };
        drawOverview();
        runChecks(songs, contextFor(), (check, items) => {
            if (mine !== run) return;
            next.set(check.id, items);
            if (!quiet && !state.open) drawCards();
        }, () => mine !== run).then(({ done }) => {
            if (mine !== run || !done) return;
            cache = { results: next, checked: songs.length, version: stamp };
            state.results = next;
            state.checked = songs.length;
            state.running = false;
            if (!state.open) drawCards();
        });
    }

    const found = () => [...state.results.values()].filter((items) => items.length).length;
    const plan = () => (state.running ? [] : planAutoClean(state.results, liveSongs()));

    // ---------- the overview ----------
    function drawOverview() {
        page.replaceChildren(el('div', { class: 'health-hero', 'data-state': 'running' }), el('div', { class: 'health-page__body' }));
        drawCards();
    }

    function drawHero() {
        const hero = page.querySelector('.health-hero');
        if (!hero) return;
        const problems = found();
        const steps = plan();
        const stateName = state.running ? 'running' : problems ? 'attention' : 'clear';
        hero.dataset.state = stateName;
        const headline = state.running ? `Checking ${count(state.checked, 'song', 'songs')}…` : problems ? `${count(problems, 'thing', 'things')} to look at` : 'Everything looks good';
        const sub = state.running ? 'Looking for copies, missing tags and broken files.' : `${count(state.checked, 'song', 'songs')} checked across ${CHECKS.length} checks.`;
        const actions = [];
        if (steps.length) {
            const total = steps.reduce((n, s) => n + s.count, 0);
            actions.push(button({ label: `Clean up automatically (${total.toLocaleString('en-US')})`, icon: 'check', variant: 'primary', onClick: () => autoClean(steps) }));
        }
        actions.push(iconButton({ icon: 'refresh-cw', label: 'Check again', onClick: () => start(true) }));
        hero.replaceChildren(
            el('div', { class: 'health-hero__mark' }, iconEl('heart-pulse', { size: 28 })),
            el('div', { class: 'health-hero__text' }, el('div', { class: 'health-hero__title' }, el('h1', {}, 'Library health'), betaBadge()), el('div', { class: 'health-hero__headline' }, headline), el('div', { class: 'health-hero__sub' }, sub)),
            el('div', { class: 'health-hero__actions' }, ...actions)
        );
    }

    async function autoClean(steps) {
        const parts = steps.map((s) => count(s.count, s.noun[0], s.noun[1]));
        const sentence = parts.length > 1 ? `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]}` : parts[0];
        const ok = await confirmDialog({
            title: 'Clean up automatically?',
            message: `Hide ${sentence}: the best copy of each exact duplicate stays, and tiny files are set aside. Nothing is deleted; show them again in Hidden.`,
            confirmLabel: 'Hide them'
        });
        if (!ok) return;
        const hidden = applyAutoClean(steps);
        notify({ kind: 'success', title: `${count(hidden, 'song', 'songs')} hidden`, detail: 'Show them again in Duplicates > Hidden.', where: 'toast' });
    }

    function card(check, step) {
        const items = state.results.get(check.id);
        const known = Boolean(items);
        const n = known ? items.length : 0;
        const clear = known && n === 0;
        const status = !known ? '' : check.detail === 'custom' ? count(n, 'group', 'groups') : count(n, 'song', 'songs');
        const open = el('button', { type: 'button', class: 'health-card__open', 'aria-label': `${check.title}: ${known ? (clear ? 'all good' : status) : 'checking'}`, disabled: clear && check.detail !== 'custom' });
        open.addEventListener('click', () => openCheck(check.id));
        const node = el(
            'article',
            { class: `health-card${clear ? ' health-card--clear' : ''}${known ? '' : ' health-card--loading'}`, 'data-check': check.id, 'data-count': known ? String(n) : '' },
            el('div', { class: 'health-card__icon' }, iconEl(ICONS[check.id] || 'info', { size: 20 })),
            el('div', { class: 'health-card__main' }, el('div', { class: 'health-card__title' }, check.title), el('div', { class: 'health-card__hint' }, check.hint)),
            el('div', { class: 'health-card__count' }, clear ? iconEl('check', { size: 18 }) : known ? el('span', { class: 'health-card__number' }, status.split(' ')[0]) : '', el('span', { class: 'health-card__unit' }, clear ? 'All good' : known ? status.split(' ').slice(1).join(' ') : 'Checking…')),
            open
        );
        if (step) {
            const auto = button({ label: `${step.label} (${step.count.toLocaleString('en-US')})`, variant: 'outline', size: 'sm', onClick: () => autoClean([step]) });
            auto.classList.add('health-card__auto');
            node.append(auto);
        }
        return node;
    }

    function drawCards() {
        const body = page.querySelector('.health-page__body');
        if (!body) return;
        const steps = new Map(plan().map((s) => [s.id, s]));
        const sections = GROUPS.map((group) => {
            const checks = CHECKS.filter((c) => c.group === group.id);
            // Inside a group the ones with something to fix come first and the clear ones last.
            const rank = (c) => (state.results.get(c.id)?.length ? 0 : state.results.has(c.id) ? 2 : 1);
            checks.sort((a, b) => rank(a) - rank(b));
            return el('section', { class: 'health-group' }, el('h2', { class: 'health-group__title' }, group.label), el('div', { class: 'health-group__cards' }, ...checks.map((c) => card(c, steps.get(c.id)))));
        });
        const hidden = bridge.decisions().hidden.length;
        if (hidden) sections.push(el('div', { class: 'health-hidden' }, iconEl('eye', { size: 16 }), el('span', {}, `${count(hidden, 'song', 'songs')} hidden`), button({ label: 'Review hidden', variant: 'outline', size: 'sm', onClick: () => openCheck('duplicates', 'hidden') })));
        body.replaceChildren(...sections);
        drawHero();
    }

    // ---------- a card's list ----------
    function openCheck(id, tab) {
        const check = checkById(id);
        if (!check) return;
        state.open = id;
        setPlace(host, id);
        state.selected = new Set();
        state.anchor = -1;
        const back = el('div', { class: 'health-detail__bar' }, button({ label: 'Library health', icon: 'chevron-left', variant: 'ghost', size: 'sm', onClick: closeCheck }));
        const content = el('div', { class: 'health-detail__content' });
        page.replaceChildren(el('div', { class: 'health-detail' }, back, content));
        if (check.detail === 'custom') {
            mountDuplicatesPage(content, { tab: tab || 'review' });
            return;
        }
        drawList(check, content);
    }

    // Closing a card before another one opens: the list goes, nothing is recorded or checked again.
    function closeCheckQuietly() {
        if (state.list) state.list.destroy();
        state.list = null;
        if (stopKeys) stopKeys();
        stopKeys = null;
        leaveDuplicates();
        state.open = null;
    }

    function closeCheck() {
        if (state.list) state.list.destroy();
        state.list = null;
        if (stopKeys) stopKeys();
        stopKeys = null;
        leaveDuplicates();
        state.open = null;
        setPlace(host, null);
        start();
    }

    async function trash(songs) {
        const ok = await confirmDialog({ title: 'Move to the Recycle Bin', message: `Move ${count(songs.length, 'file', 'files')} to the Recycle Bin? You can restore them from there.`, confirmLabel: 'Move to Recycle Bin', destructive: true });
        if (!ok) return;
        const sent = await bridge.trashSongs(songs.map((s) => s.id));
        notify({ kind: sent ? 'success' : 'error', title: sent ? `${count(sent, 'file', 'files')} moved to the Recycle Bin` : 'Could not move the files', where: 'toast' });
    }

    async function hide(songs) {
        if (songs.length > 1 && !(await confirmDialog({ title: `Hide ${count(songs.length, 'song', 'songs')}?`, message: 'They are hidden, not deleted. Show them again in Hidden.', confirmLabel: 'Hide them' }))) return;
        bridge.hideSongs(songs.map((s) => s.url));
    }

    function rowFor(index, check) {
        const item = state.items[index];
        const song = item && state.byId.get(item.songId);
        if (!song) return null;
        const selected = state.selected.has(song.id);
        const cover = el('img', { class: 'hrow__cover', src: song.cover || COVER, alt: '', loading: 'lazy', draggable: 'false' });
        cover.addEventListener('error', () => cover.setAttribute('src', COVER));
        const box = el('input', { type: 'checkbox', class: 'hrow__check', 'aria-label': `Select ${song.title || 'song'}` });
        box.checked = selected;
        const act = (name, icon, label) => { const b = iconButton({ icon, label, size: 'sm', onClick: () => {} }); b.dataset.act = name; return b; };
        const row = el(
            'div',
            { class: `hrow${selected ? ' hrow--selected' : ''}`, role: 'listitem', 'data-index': String(index), 'data-song-id': String(song.id) },
            el('div', { class: 'hrow__lead' }, box, el('div', { class: 'hrow__art' }, cover, act('play', 'play', `Play ${song.title || 'song'}`))),
            el('div', { class: 'hrow__text' }, el('div', { class: 'hrow__title', dir: 'auto' }, String(song.title || 'Untitled')), el('div', { class: 'hrow__line', dir: 'auto' }, [song.artist, song.album].filter(Boolean).join(' — ') || ' ')),
            el('div', { class: 'hrow__path', title: folderOf(song.url) }, folderOf(song.url)),
            item.note ? el('span', { class: 'hrow__note' }, item.note) : el('span', {}),
            el('div', { class: 'hrow__actions' }, act('folder', 'folder', 'Show in folder'), ...(check.fixes.includes('hide') ? [act('hide', 'eye-off', 'Hide')] : []), ...(check.fixes.includes('trash') ? [act('trash', 'trash-2', 'Move to Recycle Bin')] : []))
        );
        return row;
    }

    function drawList(check, content) {
        if (state.list) state.list.destroy();
        content.replaceChildren();
        // Opened straight from the history before any run: this one check is answered here.
        if (!state.results.has(check.id)) state.results.set(check.id, check.find(liveSongs(), contextFor()));
        const refreshItems = () => {
            state.byId = new Map(liveSongs().map((s) => [s.id, s]));
            state.items = (state.results.get(check.id) || []).filter((item) => state.byId.has(item.songId));
            for (const id of [...state.selected]) if (!state.byId.has(id)) state.selected.delete(id);
        };
        refreshItems();

        const head = el('div', { class: 'health-list__head' });
        const toolbar = el('div', { class: 'health-list__tools' });
        const listHost = el('div', { class: 'health-list__rows', role: 'list' });
        content.append(head, toolbar, listHost);

        const selectedSongs = () => state.items.filter((i) => state.selected.has(i.songId)).map((i) => state.byId.get(i.songId));

        function drawToolbar() {
            const n = state.selected.size;
            const all = el('input', { type: 'checkbox', class: 'health-list__all', 'aria-label': 'Select every song in this list' });
            all.checked = n > 0 && n === state.items.length;
            all.indeterminate = n > 0 && n < state.items.length;
            all.addEventListener('change', () => {
                state.selected = all.checked ? new Set(state.items.map((i) => i.songId)) : new Set();
                state.anchor = -1;
                state.list.refresh();
                drawToolbar();
            });
            const label = n ? `${count(n, 'song', 'songs')} selected` : `${count(state.items.length, 'song', 'songs')}`;
            const buttons = [];
            if (n) {
                if (check.fixes.includes('hide')) buttons.push(button({ label: 'Hide', icon: 'eye-off', variant: 'outline', size: 'sm', onClick: () => hide(selectedSongs()) }));
                if (check.fixes.includes('trash')) buttons.push(button({ label: 'Move to Recycle Bin', icon: 'trash-2', variant: 'outline', size: 'sm', onClick: () => trash(selectedSongs()) }));
                buttons.push(button({ label: 'Clear selection', variant: 'ghost', size: 'sm', onClick: () => { state.selected = new Set(); state.list.refresh(); drawToolbar(); } }));
            }
            toolbar.dataset.selecting = n ? 'true' : 'false';
            toolbar.replaceChildren(all, el('span', { class: 'health-list__count' }, label), el('div', { class: 'health-list__buttons' }, ...buttons));
        }

        head.replaceChildren(el('h1', { class: 'health-page__title' }, check.title), el('p', { class: 'health-list__hint' }, check.hint));

        if (!state.items.length) {
            listHost.replaceWith(emptyState({ icon: 'heart-pulse', title: 'All good' }));
            toolbar.remove();
            return;
        }

        state.list = mountVirtualRows({ scroller: content, host: listHost, count: () => state.items.length, build: (i) => rowFor(i, check) });
        drawToolbar();

        // One handler for every row: the list never has more than a screenful of them.
        listHost.addEventListener('click', (event) => {
            const row = event.target.closest('.hrow');
            if (!row) return;
            const index = Number(row.dataset.index);
            const item = state.items[index];
            const song = item && state.byId.get(item.songId);
            if (!song) return;
            const actBtn = event.target.closest('[data-act]');
            if (actBtn) {
                const name = actBtn.dataset.act;
                if (name === 'play') playSongFromList(song.id, 'all-songs');
                else if (name === 'folder') bridge.showInFolder(song);
                else if (name === 'hide') bridge.hideSongs([song.url]);
                else if (name === 'trash') trash([song]);
                return;
            }
            if (event.shiftKey && state.anchor >= 0) {
                const [a, b] = [Math.min(state.anchor, index), Math.max(state.anchor, index)];
                for (let i = a; i <= b; i++) state.selected.add(state.items[i].songId);
            } else {
                if (state.selected.has(song.id)) state.selected.delete(song.id);
                else state.selected.add(song.id);
                state.anchor = index;
            }
            state.list.refresh();
            drawToolbar();
        });

        const onKey = (event) => {
            if (state.open !== check.id || event.target.closest?.('input[type="text"], textarea')) return;
            if (event.key === 'Escape' && state.selected.size) {
                state.selected = new Set();
                state.list.refresh();
                drawToolbar();
                event.stopPropagation();
            } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
                event.preventDefault();
                state.selected = new Set(state.items.map((i) => i.songId));
                state.list.refresh();
                drawToolbar();
            }
        };
        document.addEventListener('keydown', onKey);
        stopKeys = () => document.removeEventListener('keydown', onKey);

        state.view = { check, content, redraw() { refreshItems(); if (!state.items.length) return drawList(check, content); state.list.refresh(); drawToolbar(); } };
    }

    // Back and Forward (shell/places.js) land on another screen of this page.
    stopPlaces = onGoPlace((place) => {
        if (!host.isConnected) return;
        if (place && checkById(place)) {
            if (state.open) closeCheckQuietly();
            openCheck(place);
        } else if (state.open) closeCheck();
    });

    // Songs hidden, shown again or sent to the Recycle Bin change what every check finds.
    stopWatching = bridge.onDuplicatesChanged(() => {
        if (!host.isConnected) return leaveHealth();
        const check = checkById(state.open);
        if (state.open && check && check.detail !== 'custom') {
            state.results.set(check.id, check.find(liveSongs(), contextFor()));
            if (state.view) state.view.redraw();
        } else if (!state.open) start();
    });

    const want = pending || (options.place ? { id: options.place } : null);
    pending = null;
    if (want && checkById(want.id)) {
        if (!state.results.size && cache) state.results = cache.results;
        openCheck(want.id, want.tab);
    } else start();
}
