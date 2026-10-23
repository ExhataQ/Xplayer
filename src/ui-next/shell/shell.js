// ui-next shell behavior (task A-03): logo menu, nav rail, panel host, empty views.
//
// Phase 1 has no real views yet (they come from tasks B, C and D), so each rail item shows an empty view that says
// what is planned. This file never touches an engine element: the engine's elements all live in the adapter's slots
// (adapter/legacy-dom-adapter.js).

import { icon } from '../icons/icons.js';
import { attachTooltip, iconButton, iconEl, openMenu, emptyState } from '../components/index.js';
import { logo as logoMark } from '../startup/logo.js';
import { showEngineView, showEnginePanel, releaseEngineView, syncAccentFromEngine, connectEngineViewBridge } from '../adapter/engine-view.js';
import { switchView } from '../adapter/actions.js';
import { getCurrentView } from '../adapter/store.js';
import { whenLibraryReady } from '../adapter/library-bridge.js';
import { mountLibraryPanel } from '../views/library/library-panel.js';
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

// Rail order follows decision D4.
const VIEWS = [
    { id: 'home', label: 'Home', icon: 'house', note: 'Pick up where you left off.', own: true, mount: mountHomeView, leave: leaveHome },
    { id: 'library', label: 'Library', icon: 'library', note: 'Your songs.', panel: 'library', engine: 'all-songs', songlist: true },
    { id: 'search', label: 'Search', icon: 'search', note: 'Find songs by title, artist or album.', panel: 'search', engine: 'all-songs', songlist: true, search: true },
    { id: 'recent', label: 'Recently played', icon: 'clock', note: 'The songs you played lately.', panel: 'recent', engine: 'history', songlist: true },
    { id: 'lyrics', label: 'Lyrics', icon: 'text-align-start', note: 'Lyrics of the song that is playing.', end: true, engine: 'lyrics', mount: mountLyricsModes, leave: leaveLyrics },
    { id: 'metadata', label: 'Metadata', icon: 'tag', note: 'Tags and cover of the song that is playing.', end: true, enginePanel: 'metadata', mount: mountMetadata, leave: leaveMetadata },
    { id: 'settings', label: 'Settings', icon: 'sliders-horizontal', note: 'Playback, library, backup and appearance.', engine: 'settings', end: true, mount: mountAppearanceSettings },
    // The AI chat is a main view without a rail item: the top bar button, the menu and the hotkey open it (shell/ai-slots.js).
    { id: AI_VIEW_ID, label: 'AI chat', icon: 'sparkles', note: 'Ask for a playlist, a tidy-up or a shuffle.', own: true, rail: false, mount: mountAiChat, leave: leaveAiChat }
];

// Home belongs to the shell: no engine view sits behind it. A song card plays the song. A playlist, album or artist card goes to
// Library first (so the engine's list is back in the host and the rail follows) and then opens that item, which also works
// when the engine is already on that item: showView('library') moves it to all-songs, so the second switch is never a no-op.
let home = null;

function openHomeCard(item) {
    if (item.kind !== 'song') showView('library');
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

    const bell = iconButton({ icon: 'bell', label: 'Notifications', size: 'sm' });
    mountNotifications(bell); // toasts, the bell's dot and the notification center (task A-07)

    const bar = $('.titlebar');
    bar.prepend(logo);
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
        rail.append(button);
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
    $('.panel-host__header').append(toggle);
    return {
        setCollapsible(value) {
            collapsible = Boolean(value);
            paint();
        }
    };
}

let panelToggle = null;
let panelItem = null; // the rail item whose panel is in the slot
let songList = null;
let searchView = null;
let engineReady = false;
let pendingEngineView = null;
let leaving = false; // true while a view's leave() runs, so the engine events it causes do not navigate
let returnTo = 'library'; // where the metadata editor goes back to when the engine closes it (Save, Cancel, Back)

// Returns true when the view was handled here (shown, or the user chose to stay), so selectView does not also ask the engine.
// options.fromEngine: the engine did this itself (it opened or closed a page), so a view does not ask the engine again.
function showView(id, options = {}) {
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
    for (const button of document.querySelectorAll('.rail-btn')) {
        if (button.dataset.view === view.id) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    }
    // A panel item owns the panel; a main-view item (Home, Lyrics, Metadata, Settings) leaves it as it is (DP2).
    if (view.panel) showPanelFor(view);
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
        if (view.search) searchView = mountSearchView(host);
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

// The panel slot: the item's registered panel when there is one, otherwise a title and the item's note.
function showPanelFor(view) {
    panelItem = view.id;
    $('.panel-host__title').textContent = view.label;
    const body = $('.panel-host__body');
    const note = body.querySelector('.panel-note') || body.appendChild(el('div', 'panel-note'));
    const shown = showPanel(view.panel, body);
    note.hidden = shown.registered;
    note.textContent = shown.registered ? '' : view.note;
    if (panelToggle) panelToggle.setCollapsible(shown.collapsible);
    setPanelClosed(false);
}

function setPanelClosed(closed) {
    const panel = $('.panel-host');
    if (closed) panel.dataset.closed = '';
    else delete panel.dataset.closed;
}

function selectView(id) {
    const view = VIEWS.find((v) => v.id === id);
    // Choosing the panel item that is already showing closes its panel; choosing it again opens it (PA-04).
    if (view?.panel && panelItem === id && $('.view-host').dataset.view === id) {
        setPanelClosed($('.panel-host').dataset.closed === undefined);
        return;
    }
    if (view?.panel && $('.panel-host').dataset.closed !== undefined) setPanelClosed(false);
    const engineView = ENGINE_VIEWS[id] || (id === 'settings' ? 'settings' : null);
    const engineViewShown = showView(id);
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
    for (const button of document.querySelectorAll('.rail-btn')) {
        if (button.dataset.view === railView) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    }
}

function init() {
    startBoot(); // the startup view, until the app is ready (task A-09)
    installTooltips(); // before the engine runs, so its titles never reach its own tooltip (A-08)
    installSpaceRule();
    const panel = $('.panel-host');
    buildTitlebar();
    tooltipTitlebarButtons();
    setNotificationNavigator((view) => showView(view)); // a notification can point at a rail view (PA-06)
    syncAccentFromEngine();
    buildRail(selectView);
    panelToggle = buildPanelToggle(panel);
    buildPanelResizer(panel); // drag the panel's edge, or use the arrow keys (task A-10)
    registerAi(); // Agent E's screens plug in here (views/ai/register.js)
    registerPanel('library', { mount: mountLibraryPanel, collapsible: true }); // Search and Recents register theirs the same way (PB-02)
    showView('library');
    mountPlayback(); // player controls, waveform seek bar, queue and cover viewer (tasks C-01 to C-04)
    whenLibraryReady(() => {
        engineReady = true;
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
