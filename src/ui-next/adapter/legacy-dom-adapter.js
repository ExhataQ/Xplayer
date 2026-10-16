// legacy-dom-adapter (task A-04, decision D10 amended by D11 to D13).
//
// The engine under src/js/ was written for the old page and looks up its elements by id and class when it loads.
// This module is the ONE place in ui-next that knows those names. It builds every element the engine needs and
// puts it in a slot the shell provides:
//
//   [data-legacy-slot="nav"]     back and forward buttons          (title bar)
//   [data-legacy-slot="window"]  minimize, maximize, close         (title bar)
//   [data-legacy-slot="player"]  transport, seek, volume, song info (player host, visible)
//   [data-legacy-slot="host"]    the old panels, hidden            (the engine renders lists and queues into them)
//
// Rules (full list, with measured evidence: .agent/ui-redesign/ENGINE-CONTRACT.md):
//   1. JavaScript outside this folder must not look up an id created here, and nothing outside it may mention
//      .song-item, .song-number-item or #song-list (L-01); views read state through the adapter surface instead.
//      CSS may style these elements through a wrapper selector (.player-host, .titlebar). Gate 13 checks both.
//   2. Names, tags and data-action attributes below are engine API. Do not rename or drop them.
//   3. Do not assign .onclick on the buttons here: the engine does (ENGINE-CONTRACT.md 5.4).
//   4. The engine rewrites the content of #play-btn, #volume-icon, #player-title and #player-artist. The shell may
//      style those elements but must not put children in them (5.1). Engine-written Font Awesome glyphs are mapped
//      to Lucide in legacy-icons.css (D12, L-02).
//   5. Budget: 250 lines of code in this file (D13). tools/tests/ui-next-shell.test.js checks it.
//
// mountLegacyDom() must run before js/main.js is evaluated (index.html orders the module scripts that way).

import { icon } from '../icons/icons.js';

const BLANK_IMAGE = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
const ICON_SIZE = 18;

/**
 * Tiny element builder. `selector` is "tag#id.class.class"; `attrs` become attributes, except `html` (innerHTML).
 * Children are nodes or strings.
 */
export function h(selector, attrs = {}, ...children) {
    const [, tag = 'div', id, classes = ''] = /^([a-z0-9]*)(?:#([\w-]+))?((?:\.[\w-]+)*)$/i.exec(selector) || [];
    const node = document.createElement(tag || 'div');
    if (id) node.id = id;
    for (const name of classes.split('.').filter(Boolean)) node.classList.add(name);
    for (const [key, value] of Object.entries(attrs)) {
        if (key === 'html') node.innerHTML = value;
        else if (value !== false && value != null) node.setAttribute(key, value === true ? '' : value);
    }
    node.append(...children.flat().filter((c) => c != null));
    return node;
}

// The engine calls these by name through core/legacy.js's delegated listener (data-action-<event> attributes).
const action = (name, event) => (event ? { [`data-action-${event}`]: name, [`data-args-${event}`]: '["$event"]' } : { 'data-action': name });
const svg = (name, extra = {}) => h('span', { class: 'xp-icon', ...extra, html: icon(name, { size: ICON_SIZE }) });

// ---------- title bar slots ----------

const navButtons = () => [
    h('button#back-btn.nav-btn', { ...action('goBack'), disabled: true, 'aria-label': 'Back' }, svg('chevron-left')),
    h('button#forward-btn.nav-btn', { ...action('goForward'), disabled: true, 'aria-label': 'Forward' }, svg('chevron-right'))
];

// 10x10 glyphs: window-controls.js rewrites the content of #maximize-icon when the window is maximized or restored.
const glyph = (inner, id = '') => `<svg ${id ? `id="${id}" ` : ''}xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">${inner}</svg>`;
const stroke = 'stroke="currentColor" stroke-width="1" fill="none" shape-rendering="crispEdges"';

const windowButtons = () => [
    h('button.window-control-btn', { ...action('minimizeApp'), 'aria-label': 'Minimize', html: glyph(`<path d="M0 5 L10 5" ${stroke}/>`) }),
    h('button#maximize-btn.window-control-btn', { ...action('maximizeApp'), 'aria-label': 'Maximize', html: glyph(`<rect x="0.5" y="0.5" width="9" height="9" ${stroke}/>`, 'maximize-icon') }),
    h('button.close-app-btn', { ...action('closeApp'), 'aria-label': 'Close app', html: glyph(`<path d="M0 0 L10 10 M10 0 L0 10" ${stroke}/>`) })
];

// ---------- player host (visible) ----------

const transportButton = (id, label, iconName, ...extra) => h(`button#${id}.player-btn`, { tabindex: 0, 'aria-label': label }, svg(iconName), ...extra);

const playerControls = () =>
    h(
        'div.player-controls',
        {},
        transportButton('shuffle-btn', 'Shuffle', 'shuffle'),
        transportButton('prev-btn', 'Previous song', 'skip-back'),
        // The engine replaces the content of #play-btn with <i class="fas fa-play|fa-pause"> (10c, 10d, 15e, 04i).
        h('button#play-btn.player-btn', { tabindex: 0, 'aria-label': 'Play/Pause', html: '<i class="fas fa-play"></i>' }),
        transportButton('next-btn', 'Next song', 'skip-forward'),
        transportButton('repeat-btn', 'Repeat mode', 'repeat', h('span#repeat-one.repeat-one', { style: 'display: none' }, '1'))
    );

const progressSection = () =>
    h(
        'div.progress-section',
        {},
        h('div#current-time.time-display', action('toggleTimeDisplay'), '0:00'),
        // Seek is wired by this attribute, not by the engine (ENGINE-CONTRACT.md 5.3). The engine looks the bar up by class.
        h('div.progress-container', action('startSeek', 'mousedown'), h('div#progress-bar'), h('div#progress-knob')),
        h('div#total-time.time-display', {}, '0:00')
    );

const songInfo = () =>
    h(
        'div.player-song-info',
        {},
        h('img#player-cover', { src: BLANK_IMAGE, alt: 'Album cover', ...action('openTagsTab'), 'data-action-error': 'useImagePlaceholder' }),
        // The engine fills these (and injects marquee wrappers). Leave them empty.
        h('div.player-text-info', {}, h('div#player-title', {}, 'No song selected'), h('div#player-artist', {}, '\u2014'))
    );

const rightControls = () =>
    h(
        'div.player-right-controls',
        {},
        h('button#lyrics-toggle-btn.lyrics-toggle-btn', { ...action('switchToLyrics'), 'aria-label': 'Show lyrics', disabled: true }, svg('text-align-start')),
        h(
            'div.volume-container',
            {},
            // The engine replaces the content of #volume-icon with <i class="fas fa-volume-up|fa-volume-mute"> (15g).
            h('div#volume-icon.volume-icon', { ...action('toggleMute'), 'aria-label': 'Volume', html: '<i class="fas fa-volume-up"></i>' }),
            h('div#volume-slider', { ...action('setVolume', 'mousedown'), 'aria-label': 'Volume slider' }, h('div#volume-fill'), h('div#volume-knob'))
        )
    );

// The three player columns deliberately do NOT use the old .player-left-section / -center- / -right-section classes.
// core/01-sizes.js applyFooterWidths() writes inline widths onto those classes for the old flex layout and does nothing
// when one is missing, so leaving them out keeps the new layout under the shell's control (ENGINE-CONTRACT.md L-07).
const playerHost = () => [
    h(
        'div.player-container',
        {},
        h('div.player-left', {}, songInfo()),
        h('div.player-center', {}, playerControls(), progressSection()),
        h('div.player-right', {}, rightControls())
    ),
    h('audio#audio')
];

// ---------- hidden host: the old panels the engine renders into ----------
// Boot-required nesting measured in ENGINE-CONTRACT.md section 3. Hidden with [hidden]; the new views do not read it.

const scrollContainer = (classes, id, ...children) => h(`div${id ? '#' + id : ''}${classes}`, {}, ...children);

const heroCover = () =>
    h('div.playlist-hero-cover', {
        html: ['hero-cover-svg', 'hero-cover-svg-heart', 'hero-cover-svg-history', 'hero-cover-svg-playlist'].map((id) => `<svg id="${id}" viewBox="0 0 24 24"></svg>`).join('') + `<img id="hero-cover-image" alt="" src="${BLANK_IMAGE}">`
    });

const legacyHost = () =>
    h(
        'div#legacy-host',
        { hidden: true, 'aria-hidden': 'true' },
        h('div.headerR', {}, h('div.header-center', {}, h('div.search-container', {}, h('div.search-box', {}, h('input#search-input', { type: 'text', tabindex: -1 }), h('button#search-btn.search-btn', { tabindex: -1, 'aria-label': 'Search' }))))),
        h(
            'div.container',
            {},
            h('div#left-panel.left-panel', {}, scrollContainer('.left-panel-main-list-container.custom-scrollbar-container', '', scrollContainer('.left-panel-main-list-content.custom-scrollbar-content', 'left-panel-main-content', h('ul.left-panel-main-list')))),
            scrollContainer(
                '.custom-scrollbar-container.content-wrapper',
                '',
                scrollContainer(
                    '.custom-scrollbar-content.content',
                    'main-content',
                    h(
                        'div.main-content-inner',
                        {},
                        h(
                            'div#song-list-container.song-list-container',
                            {},
                            h('div#playlist-hero-section.playlist-hero-section', {}, heroCover(), h('h1#hero-title')),
                            h('div.content-gradient-wrapper', {}, h('div#song-list.song-list'))
                        )
                    )
                ),
                h('div#external-scrollbar.custom-scrollbar.visible', {}, h('div#external-scrollbar-thumb.custom-scrollbar-thumb'))
            ),
            h(
                'div#right-panel.right-panel.active',
                {},
                scrollContainer(
                    '.right-panel-content-wrapper.custom-scrollbar-container.showing-placeholders',
                    '',
                    scrollContainer(
                        '.right-panel-scroll-content.custom-scrollbar-content',
                        'right-panel-content',
                        h('div#queue-content.panel-content', {}, h('div#queue-list.queue-list')),
                        h('div#tags-content.panel-content.active', {}, h('div#album-art-section.album-art-section.showing-placeholders', {}, h('div.album-art-container', {}, h('img#album-art-image.album-art-image', { alt: '', src: BLANK_IMAGE })))),
                        h('div#metadata-content.panel-content'),
                        h('div#recently-played-content.panel-content')
                    )
                )
            )
        )
    );

const SLOTS = { nav: navButtons, window: windowButtons, player: playerHost, host: () => [legacyHost()] };

/** Fills every [data-legacy-slot] in `root`. Returns the slot names it filled. Safe to call once per page. */
export function mountLegacyDom(root = document) {
    const filled = [];
    for (const [name, build] of Object.entries(SLOTS)) {
        const slot = root.querySelector(`[data-legacy-slot="${name}"]`);
        if (!slot) continue;
        slot.replaceChildren(...build());
        filled.push(name);
    }
    return filled;
}
