// ui-next shell behavior (task A-03): logo menu, nav rail, panel host, empty views.
//
// Phase 1 has no real views yet (they come from tasks B, C and D), so each rail item shows an empty view that says
// what is planned. This file never touches an engine element: the engine's elements all live in the adapter's slots
// (adapter/legacy-dom-adapter.js).

import { icon } from '../icons/icons.js';
import { attachTooltip, iconButton, iconEl, openMenu, emptyState } from '../components/index.js';
import { logo as logoMark } from '../startup/logo.js';
import { showEngineView, showEnginePanel, releaseEngineView, syncAccentFromEngine } from '../adapter/engine-view.js';
import { switchView, playSongFromList } from '../adapter/actions.js';
import { getCurrentView } from '../adapter/store.js';
import { whenLibraryReady } from '../adapter/library-bridge.js';
import { mountLibraryPanel, LIBRARY_HEADER_ACTION } from '../views/library/library-panel.js';
import { mountSearchPanel } from '../views/library/search-panel.js';
import { mountSongPage } from '../views/library/song-page.js';
import { openSong, registerSongOpeners } from '../adapter/song-open.js';
import { installShuffleMenu } from '../adapter/shuffle-menu.js';
import { mountRecentsPanel } from '../views/library/recents-panel.js';
import { registerPanel, showPanel } from './panels.js';
import { mountRightPanelSlot } from './right-panel.js';
import { openLeft } from './panel-layout.js';
import { mountAiChrome } from './ai-chrome.js';
import { appMenuGroups, toMenuItems, installMenuHotkeys } from './app-menu.js';
import { AI_VIEW_ID, mountAiChat, leaveAiChat, hasAiChat, openAiChat } from './ai-slots.js';
import { registerAi } from '../views/ai/register.js';
import { attachSongList } from '../views/library/song-list.js';
import { mountSearchView } from '../views/library/search-view.js';
import { viewsReady, whenViewsReady } from '../adapter/songlist-bridge.js';
import { mountHome } from '../views/home/home.js';
import { showPlayFromUrl, showNewPlaylist } from '../adapter/menu-bridge.js';
import { openHomeItem } from '../adapter/home-bridge.js';
import { mountLyricsModes, leaveLyrics } from '../views/tools/lyrics.js';
import { mountMetadata, leaveMetadata } from '../views/tools/metadata.js';
import { engineAction, engineEvent, engineView as currentEngineViewName, watchLyricsEditors } from '../adapter/engine-api.js';
import { startToolWindow } from './tool-popout.js';
import { mountPlayback } from '../views/playback/playback.js';
import { mountNotifications } from './notification-center.js';
import { setNotificationNavigator } from './notify.js';
import { mountAppearanceSettings } from './appearance-settings.js';
import { buildPanelResizer } from './panel-resizer.js';
import { startBoot } from '../startup/boot.js';
import { installTooltips } from './tooltips.js';
import { installSpaceRule } from './space-key.js';
import { installCatScrollbar } from './cat-scrollbar.js';
import { createNavHistory, installMouseNavigation } from './nav-history.js';
import { createViewRegistry, showsEnginePage } from './view-registry.js';
import { createRouter } from './view-router.js';

// The engine's own page names, by the view that shows them (engineViews in view-registry.js). When the engine changes page by itself
// the shell follows to the view that owns the new page, and the rail marks it.
const isDetailPage = (name) => name.startsWith('playlist-') || name.startsWith('folder-') || ((name.startsWith('a') || name.startsWith('r')) && name.length === 13);
const LIBRARY_PAGES = ['all-songs', 'favorites', 'playlists', 'albums', 'artists', isDetailPage];
const LYRICS_PAGES = ['lyrics', 'online-lyrics', 'smart-lyrics'];
const SETTINGS_PAGES = ['settings', 'settings-advanced'];

// The AI chat needs the screens Agent E registers; without them the view would be a blank page, so the person is sent to Settings.
const aiChatAvailable = () => (hasAiChat() ? true : { redirect: 'settings' });

// Rail order follows decision D4. One line per view; what every field means is in view-registry.js, and adding a view is in shell/VIEWS.md.
const VIEWS = [
    { id: 'home', label: 'Home', icon: 'rail-house', solo: true, note: 'Pick up where you left off.', own: true, mount: mountHomeView, leave: leaveHome },
    { id: 'library', label: 'Library', icon: 'library', note: 'Your songs.', panel: 'library', panelOnly: true, hostedBy: 'library', engine: 'all-songs', songlist: true, engineViews: LIBRARY_PAGES },
    { id: 'search', label: 'Search', icon: 'search', note: 'Find songs by title, artist or album.', panel: 'search', panelOnly: true, hostedBy: 'library', engine: 'all-songs', songlist: true, search: true, engineViews: ['search', 'search-items'] },
    { id: 'recent', label: 'Recently played', icon: 'clock', note: 'The songs you played lately.', panel: 'recent', panelOnly: true, hostedBy: 'library', engine: 'history', songlist: true, engineViews: ['history', 'recent'] },
    { id: 'lyrics', label: 'Lyrics', icon: 'waveform', note: 'Make or edit synced lyrics (LRC) for the song that is playing.', end: true, engine: 'lyrics', mount: mountLyricsModes, leave: leaveLyrics, engineViews: LYRICS_PAGES },
    { id: 'metadata', label: 'Metadata', icon: 'tag', note: 'Tags and cover of the song that is playing.', end: true, enginePanel: 'metadata', mount: mountMetadata, leave: leaveMetadata },
    { id: 'settings', label: 'Settings', icon: 'gear', note: 'Playback, library, backup and appearance.', engine: 'settings', end: true, mount: mountAppearanceSettings, engineViews: SETTINGS_PAGES },
    // The AI chat is a main view without a rail item: the top bar button, the menu and the hotkey open it (shell/ai-slots.js).
    // One song that is in no album (PB-17): a main view without a rail item, opened by adapter/song-open.js.
    { id: 'song', label: 'Song', icon: 'list-music', note: 'One song.', own: true, rail: false, mount: mountSongPage },
    { id: AI_VIEW_ID, label: 'AI chat', icon: 'sparkles', note: 'Ask for a playlist, a tidy-up or a shuffle.', own: true, rail: false, mount: mountAiChat, leave: leaveAiChat, canEnter: aiChatAvailable }
];

const registry = createViewRegistry(VIEWS);

// Home belongs to the shell: no engine view sits behind it. A song card plays the song. A playlist, album or artist card goes to
// Library first (so the engine's list is back in the host and the rail follows) and then opens that item, which also works
// when the engine is already on that item: showView('library') moves it to all-songs, so the second switch is never a no-op.
let home = null;

function openHomeCard(item) {
    if (item.kind === 'song') return void openSong(item.id); // its album, or its own page (PB-17)
    showView('library', { after: () => openHomeItem(item) });
}

// What the empty Home offers (PB-23). The music folders are in Settings, Library; the AI chat is offered only when it is there.
function homeActions() {
    return {
        newPlaylist: () => showNewPlaylist(),
        playFromUrl: () => showPlayFromUrl(),
        askAi: hasAiChat() ? () => openAiChat() : null,
        folders: () => selectView('settings')
    };
}

function mountHomeView(host) {
    home = mountHome(host, { open: openHomeCard, actions: homeActions() });
}

function leaveHome() {
    if (home) home.destroy();
    home = null;
}

let aiChrome = null;

// The application menu and its hotkeys live in shell/app-menu.js; the AI entries come from shell/ai-chrome.js.
const toggleQueue = () => document.querySelector('[aria-controls="queue-panel"]')?.click();
const menuGroups = () => appMenuGroups({ goTo: (id) => selectView(id), toggleQueue, ai: aiChrome ? aiChrome.menu() : {} });

const $ = (selector) => document.querySelector(selector);

function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
}

// ---------- logo menu ----------

function buildTitlebar() {
    const logo = el('button', 'logo-btn', logoMark('x', { size: 20 })); // the approved X mark (D19)
    logo.type = 'button';
    logo.setAttribute('aria-label', 'Application menu');
    logo.setAttribute('aria-haspopup', 'menu');
    logo.setAttribute('aria-expanded', 'false');
    attachTooltip(logo, { name: 'Application menu' });

    logo.addEventListener('click', () => {
        const open = openMenu({ anchor: logo, items: toMenuItems(menuGroups()), onClose: () => logo.setAttribute('aria-expanded', 'false') });
        if (open) logo.setAttribute('aria-expanded', 'true');
    });

    const bell = iconButton({ icon: 'bell', label: 'Notifications', size: 'sm', className: 'bell-btn' });
    mountNotifications(bell); // toasts, the bell's dot and the notification center (task A-07)

    // Play from URL (PA-08): opens the engine's own dialog, the one the File menu and Home use.
    const urlButton = iconButton({ icon: 'link', label: 'Play from URL', size: 'sm', className: 'url-btn', onClick: () => showPlayFromUrl() });

    const bar = $('.titlebar');
    bar.prepend(logo);
    mountLeftPanelToggle(bar);
    bar.querySelector('.titlebar__spacer').after(urlButton); // first of the tools; the right panel, AI and bell buttons follow it
    bar.querySelector('.titlebar__window').before(bell);
    // The right panel's button sits before the bell. It stays hidden until a provider registers (shell/right-panel.js, PA-16).
    mountRightPanelSlot({ host: $('.right-host'), button: bell, leftPanel: $('.panel-host') });
    installMenuHotkeys(menuGroups);
    aiChrome = mountAiChrome({ bell, goTo: goToMainView, current: () => $('.view-host').dataset.view });
}

// The left panel's button, between the X logo and Back / Forward (the right panel has its own at the other end). It shows the panel's state the same
// way: the left window is filled while the panel is open. In a narrow window where the right panel took the place, a click brings it back.
function mountLeftPanelToggle(bar) {
    const toggle = iconButton({ icon: 'panel-left', label: 'Left panel', size: 'sm', pressed: false, className: 'left-panel-btn' });
    bar.querySelector('.titlebar__nav').before(toggle); // between the X logo and Back / Forward
    const panel = $('.panel-host');
    const root = document.documentElement;
    const shown = () => panel.dataset.closed === undefined && !root.hasAttribute('data-left-disabled');
    function paint() {
        const on = shown();
        toggle.setAttribute('aria-pressed', String(on));
        toggle.replaceChildren(iconEl(on ? 'panel-left-filled' : 'panel-left', { size: 18 }));
    }
    toggle.addEventListener('click', () => {
        if (root.hasAttribute('data-left-disabled')) {
            setPanelClosed(false);
            openLeft();
        } else if (panel.dataset.closed === undefined) setPanelClosed(true);
        else if (panelItem) setPanelClosed(false);
        else selectView('library'); // nothing was ever shown in the panel: open it on the Library
        paint();
    });
    const watch = new MutationObserver(paint);
    watch.observe(panel, { attributes: true, attributeFilter: ['data-closed'] });
    watch.observe(root, { attributes: true, attributeFilter: ['data-left-disabled'] });
    paint();
}

// The engine buttons in the title bar are built by the adapter and only carry an aria-label: give them the same tooltip as
// every other button. The player's own controls get theirs in views/playback/transport.js; the engine's other controls
// get theirs from shell/tooltips.js.
function tooltipTitlebarButtons() {
    // The minimize, maximize and close buttons have no tooltip on purpose (their icons are the Windows convention).
    for (const node of document.querySelectorAll('.titlebar .nav-btn')) {
        attachTooltip(node, () => ({ name: node.getAttribute('aria-label') || '' }));
    }
}

// ---------- rail, panel host, view host ----------

/** The rail's hover motion starts after a short pause (so passing over an icon does nothing) and then always finishes, even when the
 *  pointer has left: the button carries data-play while its motion runs (shell/rail.css). */
function playOnHover(button, delay = 160) {
    let wait = 0;
    const stop = () => button.removeAttribute('data-play');
    button.addEventListener('pointerenter', (event) => {
        if (event.pointerType === 'touch' || button.hasAttribute('data-play')) return;
        clearTimeout(wait);
        wait = setTimeout(() => {
            button.setAttribute('data-play', '');
            setTimeout(stop, 1500); // when motion is off nothing ends: do not leave the mark behind
        }, delay);
    });
    button.addEventListener('pointerleave', () => clearTimeout(wait)); // left before the pause is over: nothing plays
    button.addEventListener('animationend', stop);
}

function buildRail(onSelect) {
    const rail = $('.rail');
    let endStarted = false; // the items marked `end` form the bottom group; the first one carries the space above it
    for (const view of VIEWS) {
        if (view.rail === false) continue;
        const startsEnd = view.end && !endStarted;
        endStarted ||= Boolean(view.end);
        const button = el('button', `rail-btn${startsEnd ? ' rail-btn--end' : ''}`, icon(view.icon, { size: 20 }));
        button.type = 'button';
        button.dataset.view = view.id;
        if (view.panel) button.dataset.dynamic = ''; // Library, Search, Recents fill the panel; Home, Lyrics, Metadata, Settings take the main view
        button.setAttribute('aria-label', view.label);
        attachTooltip(button, { name: view.label }, { placement: 'right' });
        button.addEventListener('click', () => onSelect(view.id));
        playOnHover(button);
        rail.append(button);
        if (view.solo) {
            const rule = el('div', 'rail-sep');
            rule.setAttribute('aria-hidden', 'true');
            rail.append(rule); // Home is not a place in the library: a short rule sets it apart (brief 2.3)
        }
    }
}

// The panel header's one optional icon button (PB-06). Each panel's action keeps its own button, so its tooltip stays right.
function buildPanelActions() {
    const actions = el('div', 'panel-host__actions');
    $('.panel-host__header').append(actions);
    const actionButtons = new Map();
    return {
        setAction(spec) {
            if (spec && !actionButtons.has(spec)) {
                const node = iconButton({ icon: spec.icon, label: spec.label, size: 'sm', onClick: () => spec.onClick(node) }); // a panel's action may open a menu under its own button
                node.classList.add('panel-host__action');
                actions.prepend(node);
                actionButtons.set(spec, node);
            }
            for (const [key, node] of actionButtons) node.hidden = key !== spec;
        }
    };
}

let panelActions = null;
let panelItem = null; // the rail item whose panel is in the slot
let mainRail = null; // the rail item the main view belongs to
let songList = null;
let searchView = null;
let engineReady = false;
let pendingEngineView = null;
let leaving = false; // true while a view's leave() runs, so the engine events it causes do not navigate
let returnTo = 'library'; // where the metadata editor goes back to when the engine closes it (Save, Cancel, Back)

// Every view keeps its own state on the one shared view host as data-* attributes (the Lyrics mode, the Metadata form, the song page's id)
// and the CSS reads them. A view that left one behind changed how the next view looked: data-lyrics-mode="sync" kept hiding the engine's
// content, so Library and Settings came back blank after Sync had been open once. So the host starts clean for every view, whatever the
// view that was on screen did or forgot to do when it left. Only data-view survives: it is the shell's.
function resetHost(host, viewId) {
    for (const key of Object.keys(host.dataset)) delete host.dataset[key];
    host.dataset.view = viewId;
}

// Draws `view` in the view host. The router (shell/view-router.js) calls this after it has asked the view on screen whether it may be
// left, so everything here may assume the old view is gone; if anything here throws, the router calls recoverView().
// Returns false when the view could not be drawn yet (the engine is loading): an empty page is up and it is drawn again when ready.
// options.fromEngine: the engine did this itself (it opened or closed a page), so a view does not ask the engine again.
function enterView(view, options = {}) {
    const host = $('.view-host');
    const here = registry.get(host.dataset.view);
    if (view.id === 'metadata' && here?.id !== 'metadata') returnTo = here?.id || 'library';
    mainRail = view.id;
    // A panel item owns the panel; a main-view item (Home, Lyrics, Metadata, Settings) leaves it as it is (DP2).
    if (view.panel && !options.keepPanel) showPanelFor(view);
    markRail();
    resetHost(host, view.id);
    if (aiChrome) aiChrome.sync();
    if (searchView) searchView.detach();
    searchView = null;
    if (songList) songList.detach();
    songList = null;
    releaseEngineView(host); // the engine's content must be back in its host before anything else is drawn here
    leaveHome(); // also when the engine moved us away (fromEngine skips leave())
    leaveAiChat();
    host.replaceChildren();
    if (view.engine && showEngineView(host, view.engine, options.enginePage)) {
        if (view.songlist) songList = attachSongList(host, { toolbar: !view.search });
        if (view.search) searchView = mountSearchView(host, options.query || '');
        if (view.mount) view.mount(host, options);
        return true;
    }
    if (view.enginePanel && showEnginePanel(host, view.enginePanel)) {
        if (view.mount) view.mount(host, options);
        return true;
    }
    if (view.own) {
        view.mount(host, options); // a view the shell draws itself (Home)
        return true;
    }
    // The engine loads after the shell, so on the first call its views cannot be drawn yet: try again once it is there.
    if (view.engine && !viewsReady()) whenViewsReady(() => host.dataset.view === view.id && showView(view.id, { ...options, rebuild: true }));
    host.append(emptyView(view, view.note));
    return false;
}

function emptyView(view, text, title = view.label) {
    const section = el('section', 'empty-view');
    section.setAttribute('aria-label', view.label);
    section.append(emptyState({ icon: view.icon, title, text }));
    return section;
}

// A view threw while it was being drawn (or the engine did, under it). Put the shell back in a state the person can leave: whatever was
// moved into the host goes home, and a plain page says what happened. Choosing the same view again draws it again (the router knows it is broken).
function recoverView(view) {
    const host = $('.view-host');
    for (const undo of [() => releaseEngineView(host), () => songList && songList.detach(), () => searchView && searchView.detach(), leaveHome, leaveAiChat]) {
        try {
            undo();
        } catch (error) {
            console.error('[views] cleanup after a failed view', error);
        }
    }
    songList = null;
    searchView = null;
    mainRail = view.id;
    resetHost(host, view.id);
    host.replaceChildren(emptyView(view, 'Something went wrong while opening it. Choose another view, or choose this one again to retry.', `${view.label} could not be shown`));
    markRail();
    if (aiChrome) aiChrome.sync();
}

const router = createRouter({
    registry,
    env: {
        current: () => $('.view-host').dataset.view || null,
        enter: enterView,
        recover: recoverView,
        // The engine tells the shell about the metadata editor closing while a view is left: those events are ours, not the person's.
        willLeave: () => {
            leaving = true;
        },
        didLeave: () => {
            leaving = false;
        },
        committed: (view, options) => {
            if (!options.fromHistory) navHistory.record(true); // history restores must not add entries
        },
        report: (phase, view, error) => console.error(`[views] ${phase} failed for "${view && view.id}"`, error)
    }
});

/** Shows a view by id through the router. Returns 'shown', 'unavailable', 'stayed', 'refused', 'failed' or 'queued' (or a Promise of one when
 *  the view on screen is asking the person first). options.after runs once the view is shown, also after an answer. */
function showView(id, options = {}) {
    return router.go(id, options);
}

// Mouse back and forward (PA-13): the shell's own history, because the engine's does not know Home, Lyrics, Metadata or the AI chat.
const DETAIL_OPENERS = [['playlist-', 'playlist'], ['a', 'album'], ['r', 'artist']];

function openEnginePlace(name) {
    const detail = DETAIL_OPENERS.find(([prefix]) => name.startsWith(prefix) && (prefix.length > 1 || name.length === 13));
    if (detail) openHomeItem({ kind: detail[1], id: detail[0] === 'playlist-' ? name.slice(9) : name });
    else switchView(name);
}

const navHistory = createNavHistory({
    read: () => {
        const id = $('.view-host').dataset.view;
        return { view: id, song: id === 'song' ? $('.view-host').dataset.song || null : null, engine: engineReady && VIEWS.find((v) => v.id === id)?.songlist ? getCurrentView() : null };
    },
    // Returns true, false (the view asked to stay: unsaved text, "Keep editing") or a Promise of one of them when the view on screen asks
    // first in a dialog that answers later (the Sync editor's "Discard Sync?"). nav-history waits for it and ignores presses meanwhile.
    restore: (entry) => {
        const host = $('.view-host');
        const settle = () => {
            if (entry.engine && engineReady && entry.engine !== getCurrentView()) openEnginePlace(entry.engine);
            return true;
        };
        if (host.dataset.view === entry.view && !(entry.view === 'song' && host.dataset.song !== String(entry.song ?? ''))) return settle();
        const outcome = showView(entry.view, { keepPanel: true, songId: entry.song, fromHistory: true });
        const done = (result) => (result !== 'stayed' && result !== 'refused' && host.dataset.view === entry.view ? settle() : false);
        return outcome && typeof outcome.then === 'function' ? outcome.then(done) : done(outcome);
    }
});

// The panel slot: the item's registered panel when there is one, otherwise a title and the item's note.
function showPanelFor(view) {
    panelItem = view.id;
    $('.panel-host__title').textContent = view.label;
    const body = $('.panel-host__body');
    const note = body.querySelector('.panel-note') || body.appendChild(el('div', 'panel-note'));
    const shown = showPanel(view.panel, body);
    note.hidden = shown.registered;
    note.textContent = shown.registered ? '' : view.note;
    if (panelActions) panelActions.setAction(shown.headerAction);
    setPanelClosed(false);
}

function setPanelClosed(closed) {
    const panel = $('.panel-host');
    if (closed) panel.dataset.closed = '';
    else delete panel.dataset.closed;
    markRail();
}

// The rail marks what is really showing (PB-22): the main view's item, and the open panel's item (DP2, so Home and Search can both
// show). The Library item is not marked when the main view only happens to be the library list (a playlist opened from Search):
// then the open panel's item is the one that is active.
function markRail() {
    const closed = $('.panel-host').dataset.closed !== undefined;
    const libraryListOnly = mainRail === 'library' && panelItem && panelItem !== 'library' && !closed;
    for (const button of document.querySelectorAll('.rail-btn')) {
        const id = button.dataset.view;
        if (id === mainRail && !libraryListOnly) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
        if (!closed && id === panelItem) button.dataset.panelCurrent = '';
        else delete button.dataset.panelCurrent;
    }
}

// A way back to a main view by name (the AI chat's Back, its navigator). The Library rail item only opens its panel now, so the view
// itself is shown directly, with the panel as it is.
function goToMainView(id) {
    if (VIEWS.find((v) => v.id === id)?.panelOnly) showView(id, { keepPanel: true });
    else selectView(id);
}

function selectView(id) {
    const view = VIEWS.find((v) => v.id === id);
    // PA-19: a narrow window can hide the left panel while it is "open" (the right panel took its place). Choosing a panel item then
    // brings the left panel back, in the right panel's place, instead of closing a panel nobody can see.
    const hidden = document.documentElement.hasAttribute('data-left-disabled');
    // Search and Recents are panel items only (PB-02): they fill the panel and leave the main view as it is (DP2).
    if (view?.panelOnly) {
        if (panelItem === id) {
            if (hidden) openLeft();
            else setPanelClosed($('.panel-host').dataset.closed === undefined);
        } else {
            showPanelFor(view);
            if (hidden) openLeft();
        }
        return;
    }
    // Choosing the panel item that is already showing closes its panel; choosing it again opens it (PA-04).
    if (view?.panel && panelItem === id && $('.view-host').dataset.view === id) {
        if (hidden) openLeft();
        else setPanelClosed($('.panel-host').dataset.closed === undefined);
        return;
    }
    if (view?.panel && hidden) openLeft();
    if (view?.panel && $('.panel-host').dataset.closed !== undefined) setPanelClosed(false);
    const engineView = view?.engine || null;
    const engineViewShown = showView(id, { chosen: true }) !== 'unavailable'; // chosen: the person picked this item (the Lyrics item then opens Sync, PC-07)
    if (!engineView || engineViewShown) return;
    if (engineReady) switchView(engineView);
    else pendingEngineView = { id, view: engineView };
}

// The rail marks the view that owns the engine's page. It only follows while that page is on screen: Home, the AI chat, Metadata and the
// song page hide the engine, and whatever it does behind them must not move the rail.
function syncRailSelection(engineView) {
    const current = registry.get($('.view-host').dataset.view);
    // The Search view shows the engine's all-songs list under its own field, so all-songs does not mean Library there.
    if (current?.search && engineView === 'all-songs') return;
    if (current && !showsEnginePage(current)) return;
    const owner = registry.forEngine(engineView);
    if (!owner) return;
    mainRail = owner.id;
    markRail();
}

// The engine changed page. Mostly that is the shell's own doing (the router is drawing a view: nothing to follow). When the engine did it
// by itself (the lyrics button in the player bar, "go to the playing song", the end of a song, its own Back button) the shell follows to the
// view that owns the new page, so the toolbar, the view's own styles and the rail never describe a different page than the one on screen.
function followEngine(name) {
    if (!engineReady || router.drawing() || router.asking()) return;
    const current = registry.get($('.view-host').dataset.view);
    const owner = registry.hostFor(name);
    // Follow when the page that was on screen has been replaced (the Library toolbar must not stay over Settings), or when it is the
    // lyrics page (the player bar's lyrics button works from every view, even those that hide the engine).
    if (owner && current && owner.id !== current.id && (showsEnginePage(current) || owner.id === 'lyrics')) {
        showView(owner.id, { keepPanel: true, followEngine: true, enginePage: name });
    }
    syncRailSelection(name);
    navHistory.change(); // after the follow above, so a page the engine opened for another view is not recorded as a place of this one
}

// A click on a row of the Library panel opens that page in the engine. When the engine is already on it (hidden behind Home, Metadata, the AI
// chat or the song page) it has nothing to change and says nothing, so the shell would never learn that the person asked to see it.
// Looking at what the click left behind covers that: the view that owns the engine's page comes to the front. A click that did not
// open a page (the play button, a field) leaves the view alone.
function showPageOfPanelRow(event) {
    if (!event.target.closest('.left-panel-main-item') || event.target.closest('button, input, .left-panel-cover-play-btn')) return;
    setTimeout(() => {
        if (!engineReady || router.drawing() || router.asking()) return;
        const page = getCurrentView();
        const owner = registry.hostFor(page);
        const current = registry.get($('.view-host').dataset.view);
        if (owner && current && owner.id !== current.id) showView(owner.id, { keepPanel: true, followEngine: true, enginePage: page });
    }, 0);
}

function init() {
    startBoot(); // the startup view, until the app is ready (task A-09)
    installTooltips(); // before the engine runs, so its titles never reach its own tooltip (A-08)
    installSpaceRule();
    installCatScrollbar(); // the optional cat scroll thumb (Settings > Appearance > Cat scrollbar)
    installMouseNavigation(navHistory);
    const panel = $('.panel-host');
    buildTitlebar();
    tooltipTitlebarButtons();
    setNotificationNavigator((view) => showView(view)); // a notification can point at a rail view (PA-06)
    syncAccentFromEngine();
    buildRail(selectView);
    panel.addEventListener('click', showPageOfPanelRow);
    panelActions = buildPanelActions();
    buildPanelResizer(panel); // drag the panel's edge, or use the arrow keys (task A-10)
    registerAi(); // Agent E's screens plug in here (views/ai/register.js)
    // A panel opens a playlist in the main view (Library, with the panel kept) or plays a song from the whole library.
    // They return the router's outcome (a Promise when the view on screen is still asking), so openSong waits before it drives the engine.
    registerSongOpeners({ library: () => showView('library', { keepPanel: true }), page: (songId) => showView('song', { keepPanel: true, songId }) });
    const panelCtx = {
        open: (item) => {
            showView('library', { keepPanel: true, after: () => openHomeItem(item) });
        },
        play: (songId) => playSongFromList(songId, 'all-songs'),
        openSong
    };
    registerPanel('search', { mount: (body) => mountSearchPanel(body, panelCtx) });
    registerPanel('recent', { mount: (body) => mountRecentsPanel(body, panelCtx) });
    registerPanel('library', { mount: mountLibraryPanel, headerAction: LIBRARY_HEADER_ACTION }); // Search and Recents register theirs the same way (PB-02)
    showView('library');
    mountPlayback(); // player controls, waveform seek bar, queue and cover viewer (tasks C-01 to C-04)
    whenLibraryReady(() => {
        engineReady = true;
        engineAction('applyStoredInstrumentalFlags'); // songs the finder found to be instrumental are marked again after a restart
        installShuffleMenu(); // the shuffle button opens a floating menu, not the engine's dialog (PB-07)
        navHistory.refresh();
        if (pendingEngineView) {
            const pending = pendingEngineView;
            pendingEngineView = null;
            if (pending.id === 'settings') showView(pending.id);
            else switchView(pending.view);
        } else {
            syncRailSelection(getCurrentView());
        }
        startToolWindow(showView); // in a Metadata or Sync window: start its song and show only that tool
    });
    // The engine can change page by itself (the lyrics button in the player bar, the end of a song, its own Back button): followEngine.
    engineEvent('view:changed', (detail) => followEngine((detail && detail.view) || currentEngineViewName()));
    // And when it opens a lyrics editor (a song's menu does): the editors are modes of the Lyrics page.
    watchLyricsEditors(({ write, sync }) => {
        if ((write || sync) && $('.view-host').dataset.view !== 'lyrics') showView('lyrics', { fromEngine: true });
    });
    // The same for the metadata editor, which the engine opens from a song's menu and closes on Save, Cancel and Back.
    engineEvent('rightPanel:tabChanged', ({ tab }) => {
        if (leaving) return;
        const onMetadata = $('.view-host').dataset.view === 'metadata';
        if (tab === 'metadata' && !onMetadata) showView('metadata', { fromEngine: true });
        else if (tab !== 'metadata' && onMetadata) showView(returnTo, { fromEngine: true });
    });
}

init();
