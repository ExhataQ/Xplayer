// ui-next shell behavior (task A-03): logo menu, nav rail, panel host, empty views.
//
// Phase 1 has no real views yet (they come from tasks B, C and D), so each rail item shows an empty view that says
// what is planned. This file never touches an engine element: the engine's elements all live in the adapter's slots
// (adapter/legacy-dom-adapter.js).

import { icon } from '../icons/icons.js';
import { attachTooltip, iconButton, iconEl, openMenu, emptyState } from '../components/index.js';
import { logo as logoMark } from '../startup/logo.js';
import { showEngineView, showEnginePanel, releaseEngineView, syncAccentFromEngine, connectEngineViewBridge } from '../adapter/engine-view.js';
import { switchView, playSongFromList } from '../adapter/actions.js';
import { getCurrentView } from '../adapter/store.js';
import { whenLibraryReady } from '../adapter/library-bridge.js';
import { mountLibraryPanel, LIBRARY_HEADER_ACTION } from '../views/library/library-panel.js';
import { mountSearchPanel } from '../views/library/search-panel.js';
import { mountSongPage } from '../views/library/song-page.js';
import { openSong, registerSongOpeners } from '../adapter/song-open.js';
import { mountRecentsPanel } from '../views/library/recents-panel.js';
import { registerPanel, showPanel } from './panels.js';
import { mountRightPanelSlot } from './right-panel.js';
import { mountAiChrome } from './ai-chrome.js';
import { appMenuGroups, toMenuItems, installMenuHotkeys } from './app-menu.js';
import { AI_VIEW_ID, mountAiChat, leaveAiChat } from './ai-slots.js';
import { registerAi } from '../views/ai/register.js';
import { attachSongList } from '../views/library/song-list.js';
import { mountSearchView } from '../views/library/search-view.js';
import { viewsReady, whenViewsReady } from '../adapter/songlist-bridge.js';
import { mountHome } from '../views/home/home.js';
import { showPlayFromUrl } from '../adapter/menu-bridge.js';
import { openHomeItem } from '../adapter/home-bridge.js';
import { mountLyricsModes, leaveLyrics } from '../views/tools/lyrics.js';
import { mountMetadata, leaveMetadata } from '../views/tools/metadata.js';
import { engineEvent, engineView as currentEngineViewName, watchLyricsEditors } from '../adapter/engine-api.js';
import { mountPlayback } from '../views/playback/playback.js';
import { mountNotifications } from './notification-center.js';
import { setNotificationNavigator } from './notify.js';
import { mountAppearanceSettings } from './appearance-settings.js';
import { buildPanelResizer } from './panel-resizer.js';
import { startBoot } from '../startup/boot.js';
import { installTooltips } from './tooltips.js';
import { installSpaceRule } from './space-key.js';
import { createNavHistory, installMouseNavigation } from './nav-history.js';

// Rail order follows decision D4.
const VIEWS = [
    { id: 'home', label: 'Home', icon: 'rail-house', solo: true, note: 'Pick up where you left off.', own: true, mount: mountHomeView, leave: leaveHome },
    { id: 'library', label: 'Library', icon: 'library', note: 'Your songs.', panel: 'library', engine: 'all-songs', songlist: true },
    { id: 'search', label: 'Search', icon: 'search', note: 'Find songs by title, artist or album.', panel: 'search', panelOnly: true, engine: 'all-songs', songlist: true, search: true },
    { id: 'recent', label: 'Recently played', icon: 'clock', note: 'The songs you played lately.', panel: 'recent', panelOnly: true, engine: 'history', songlist: true },
    { id: 'lyrics', label: 'Lyrics', icon: 'waveform', note: 'Make or edit synced lyrics (LRC) for the song that is playing.', end: true, engine: 'lyrics', mount: mountLyricsModes, leave: leaveLyrics },
    { id: 'metadata', label: 'Metadata', icon: 'tag', note: 'Tags and cover of the song that is playing.', end: true, enginePanel: 'metadata', mount: mountMetadata, leave: leaveMetadata },
    { id: 'settings', label: 'Settings', icon: 'gear', note: 'Playback, library, backup and appearance.', engine: 'settings', end: true, mount: mountAppearanceSettings },
    // The AI chat is a main view without a rail item: the top bar button, the menu and the hotkey open it (shell/ai-slots.js).
    // One song that is in no album (PB-17): a main view without a rail item, opened by adapter/song-open.js.
    { id: 'song', label: 'Song', icon: 'list-music', note: 'One song.', own: true, rail: false, mount: mountSongPage },
    { id: AI_VIEW_ID, label: 'AI chat', icon: 'sparkles', note: 'Ask for a playlist, a tidy-up or a shuffle.', own: true, rail: false, mount: mountAiChat, leave: leaveAiChat }
];

// Home belongs to the shell: no engine view sits behind it. A song card plays the song. A playlist, album or artist card goes to
// Library first (so the engine's list is back in the host and the rail follows) and then opens that item, which also works
// when the engine is already on that item: showView('library') moves it to all-songs, so the second switch is never a no-op.
let home = null;

function openHomeCard(item) {
    if (item.kind === 'song') return void openSong(item.id); // its album, or its own page (PB-17)
    showView('library');
    openHomeItem(item);
}

function mountHomeView(host) {
    home = mountHome(host, { open: openHomeCard });
}

function leaveHome() {
    if (home) home.destroy();
    home = null;
}

const ENGINE_VIEWS = Object.freeze({
    library: 'all-songs',
    search: 'search',
    recent: 'recent',
    lyrics: 'lyrics'
});

const RAIL_BY_ENGINE_VIEW = Object.freeze({
    'all-songs': 'library',
    favorites: 'library',
    playlists: 'library',
    albums: 'library',
    artists: 'library',
    history: 'recent',
    recent: 'recent',
    search: 'search',
    'search-items': 'search',
    lyrics: 'lyrics',
    'online-lyrics': 'lyrics',
    'smart-lyrics': 'lyrics',
    settings: 'settings',
    'settings-advanced': 'settings'
});

let aiChrome = null;

// The application menu and its hotkeys live in shell/app-menu.js; the AI entries come from shell/ai-chrome.js.
const toggleQueue = () => document.querySelector('[aria-controls="queue-panel"]')?.click();
const menuGroups = () => appMenuGroups({ goTo: (id) => selectView(id), toggleQueue, ai: aiChrome ? aiChrome.menu() : {} });

const NARROW_WINDOW = 1000; // below this the panel gives its space to the view (the minimum window is 800)
const PANEL_KEY = 'xplayer.ui-next.panel';

const $ = (selector) => document.querySelector(selector);

function readPanelState() {
    try {
        return localStorage.getItem(PANEL_KEY) === 'compact' ? 'compact' : 'expanded';
    } catch (_) {
        return 'expanded';
    }
}

function savePanelState(value) {
    try {
        localStorage.setItem(PANEL_KEY, value);
    } catch (_) {
        /* the panel just opens expanded next time */
    }
}

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
    bar.querySelector('.titlebar__spacer').after(urlButton); // first of the tools; the right panel, AI and bell buttons follow it
    bar.querySelector('.titlebar__window').before(bell);
    // The right panel's button sits before the bell. It stays hidden until a provider registers (shell/right-panel.js, PA-16).
    mountRightPanelSlot({ host: $('.right-host'), button: bell, leftPanel: $('.panel-host') });
    installMenuHotkeys(menuGroups);
    aiChrome = mountAiChrome({ bell, goTo: (id) => selectView(id), current: () => $('.view-host').dataset.view });
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

function buildPanelToggle(panel) {
    // The saved choice is the user's. A narrow window collapses the panel without touching it, so widening the window
    // brings the saved choice back. Toggling inside a narrow window lasts until the window changes size class.
    const narrow = window.matchMedia(`(max-width: ${NARROW_WINDOW}px)`);
    let saved = readPanelState();
    let narrowCompact = narrow.matches;
    let collapsible = true; // only a panel that asks for it (Library) can collapse
    const shown = () => (!collapsible ? 'expanded' : narrow.matches ? (narrowCompact ? 'compact' : 'expanded') : saved);
    const toggle = iconButton({
        icon: 'chevron-left',
        label: 'Collapse panel',
        size: 'sm',
        pressed: true,
        onClick: () => {
            const next = shown() === 'compact' ? 'expanded' : 'compact';
            if (narrow.matches) narrowCompact = next === 'compact';
            else {
                saved = next;
                savePanelState(saved);
            }
            paint();
        }
    });
    // A toggle: aria-pressed says whether the panel is open, the label stays the same (APG toggle button).
    function paint() {
        const state = shown();
        const open = state !== 'compact';
        panel.dataset.panel = state;
        toggle.replaceChildren(iconEl(open ? 'chevron-left' : 'chevron-right', { size: 18 }));
        toggle.setAttribute('aria-pressed', String(open));
        toggle.hidden = !collapsible;
        toggle.tooltip.update({ state: open ? 'Open' : 'Collapsed' });
    }
    narrow.addEventListener('change', () => {
        narrowCompact = narrow.matches;
        paint();
    });
    paint();
    // One optional icon button before the arrow (PB-06). Each panel's action keeps its own button, so its tooltip stays right.
    const actions = el('div', 'panel-host__actions');
    actions.append(toggle);
    $('.panel-host__header').append(actions);
    const actionButtons = new Map();
    return {
        setCollapsible(value) {
            collapsible = Boolean(value);
            paint();
        },
        setAction(spec) {
            if (spec && !actionButtons.has(spec)) {
                const node = iconButton({ icon: spec.icon, label: spec.label, size: 'sm', onClick: () => spec.onClick() });
                node.classList.add('panel-host__action');
                actions.prepend(node);
                actionButtons.set(spec, node);
            }
            for (const [key, node] of actionButtons) node.hidden = key !== spec;
        }
    };
}

let panelToggle = null;
let panelItem = null; // the rail item whose panel is in the slot
let mainRail = null; // the rail item the main view belongs to
let songList = null;
let searchView = null;
let engineReady = false;
let pendingEngineView = null;
let leaving = false; // true while a view's leave() runs, so the engine events it causes do not navigate
let returnTo = 'library'; // where the metadata editor goes back to when the engine closes it (Save, Cancel, Back)

// Returns true when the view was handled here (shown, or the user chose to stay), so selectView does not also ask the engine.
// options.fromEngine: the engine did this itself (it opened or closed a page), so a view does not ask the engine again.
function showViewNow(id, options = {}) {
    const host = $('.view-host');
    const here = VIEWS.find((v) => v.id === host.dataset.view);
    if (here && here.id === id && here.leave) return true; // choosing the view you are on must not rebuild a form that holds unsaved text
    if (here && here.id !== id && here.leave && !options.fromEngine) {
        leaving = true;
        const stay = here.leave() === false;
        leaving = false;
        if (stay) return true;
    }
    const view = VIEWS.find((v) => v.id === id) || VIEWS[0];
    if (view.id === 'metadata' && here?.id !== 'metadata') returnTo = here?.id || 'library';
    mainRail = view.id;
    // A panel item owns the panel; a main-view item (Home, Lyrics, Metadata, Settings) leaves it as it is (DP2).
    if (view.panel && !options.keepPanel) showPanelFor(view);
    markRail();
    host.dataset.view = view.id;
    if (aiChrome) aiChrome.sync();
    if (searchView) searchView.detach();
    searchView = null;
    if (songList) songList.detach();
    songList = null;
    releaseEngineView(host); // the engine's content must be back in its host before anything else is drawn here
    leaveHome(); // also when the engine moved us away (fromEngine skips leave())
    leaveAiChat();
    host.replaceChildren();
    if (view.engine && showEngineView(host, view.engine)) {
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
    if (view.engine && !viewsReady()) whenViewsReady(() => host.dataset.view === view.id && showView(view.id));
    const section = el('section', 'empty-view');
    section.setAttribute('aria-label', view.label);
    section.append(emptyState({ icon: view.icon, title: view.label, text: view.note }));
    host.append(section);
    return false;
}

function showView(id, options = {}) {
    const shown = showViewNow(id, options);
    navHistory.record(true);
    return shown;
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
    restore: (entry) => {
        const here = $('.view-host').dataset.view;
        if (here !== entry.view || (entry.view === 'song' && $('.view-host').dataset.song !== String(entry.song ?? ''))) {
            showViewNow(entry.view, { keepPanel: true, songId: entry.song });
            if ($('.view-host').dataset.view !== entry.view) return false; // the view asked to stay (unsaved text)
        }
        if (entry.engine && engineReady && entry.engine !== getCurrentView()) openEnginePlace(entry.engine);
        return true;
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
    if (panelToggle) {
        panelToggle.setCollapsible(shown.collapsible);
        panelToggle.setAction(shown.headerAction);
    }
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

function selectView(id) {
    const view = VIEWS.find((v) => v.id === id);
    // Search and Recents are panel items only (PB-02): they fill the panel and leave the main view as it is (DP2).
    if (view?.panelOnly) {
        if (panelItem === id) setPanelClosed($('.panel-host').dataset.closed === undefined);
        else showPanelFor(view);
        return;
    }
    // Choosing the panel item that is already showing closes its panel; choosing it again opens it (PA-04).
    if (view?.panel && panelItem === id && $('.view-host').dataset.view === id) {
        setPanelClosed($('.panel-host').dataset.closed === undefined);
        return;
    }
    if (view?.panel && $('.panel-host').dataset.closed !== undefined) setPanelClosed(false);
    const engineView = ENGINE_VIEWS[id] || (id === 'settings' ? 'settings' : null);
    const engineViewShown = showView(id, { chosen: true }); // chosen: the person picked this item (the Lyrics item then opens Sync, PC-07)
    if (!engineView || engineViewShown) return;
    if (engineReady) switchView(engineView);
    else pendingEngineView = { id, view: engineView };
}

function syncRailSelection(engineView) {
    // The Search view shows the engine's all-songs list under its own field, so all-songs does not mean Library there.
    const current = VIEWS.find((v) => v.id === $('.view-host').dataset.view);
    if (current?.search && engineView === 'all-songs') return;
    const isDetailView =
        typeof engineView === 'string' &&
        (engineView.startsWith('playlist-') ||
            engineView.startsWith('folder-') ||
            (engineView.startsWith('a') && engineView.length === 13) ||
            (engineView.startsWith('r') && engineView.length === 13));
    const railView = RAIL_BY_ENGINE_VIEW[engineView] || (isDetailView ? 'library' : null);
    if (!railView) return;
    mainRail = railView;
    markRail();
}

function init() {
    startBoot(); // the startup view, until the app is ready (task A-09)
    installTooltips(); // before the engine runs, so its titles never reach its own tooltip (A-08)
    installSpaceRule();
    installMouseNavigation(navHistory);
    const panel = $('.panel-host');
    buildTitlebar();
    tooltipTitlebarButtons();
    setNotificationNavigator((view) => showView(view)); // a notification can point at a rail view (PA-06)
    syncAccentFromEngine();
    buildRail(selectView);
    panelToggle = buildPanelToggle(panel);
    buildPanelResizer(panel); // drag the panel's edge, or use the arrow keys (task A-10)
    registerAi(); // Agent E's screens plug in here (views/ai/register.js)
    // A panel opens a playlist in the main view (Library, with the panel kept) or plays a song from the whole library.
    registerSongOpeners({ library: () => showView('library', { keepPanel: true }), page: (songId) => showView('song', { keepPanel: true, songId }) });
    const panelCtx = {
        open: (item) => {
            showView('library', { keepPanel: true });
            openHomeItem(item);
        },
        play: (songId) => playSongFromList(songId, 'all-songs'),
        openSong
    };
    registerPanel('search', { mount: (body) => mountSearchPanel(body, panelCtx) });
    registerPanel('recent', { mount: (body) => mountRecentsPanel(body, panelCtx) });
    registerPanel('library', { mount: mountLibraryPanel, collapsible: true, headerAction: LIBRARY_HEADER_ACTION }); // Search and Recents register theirs the same way (PB-02)
    showView('library');
    mountPlayback(); // player controls, waveform seek bar, queue and cover viewer (tasks C-01 to C-04)
    whenLibraryReady(() => {
        engineReady = true;
        navHistory.refresh();
        connectEngineViewBridge(syncRailSelection);
        if (pendingEngineView) {
            const pending = pendingEngineView;
            pendingEngineView = null;
            if (pending.id === 'settings') showView(pending.id);
            else switchView(pending.view);
        } else {
            syncRailSelection(getCurrentView());
        }
    });
    // The engine can open its lyrics page by itself (the lyrics button in the player bar does). The page only exists inside the
    // Lyrics view, so the shell goes there too. showView sets the host's view before it asks the engine, so this cannot loop.
    engineEvent('view:changed', () => {
        if (currentEngineViewName() === 'lyrics' && $('.view-host').dataset.view !== 'lyrics') showView('lyrics');
        navHistory.change(); // after the line above, so the engine's lyrics page is not recorded as a Library place
    });
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
