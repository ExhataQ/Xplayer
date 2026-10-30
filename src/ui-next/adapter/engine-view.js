// engine-view: shows the engine's own main content (its Settings page today, lists and lyrics later) inside the shell's
// view host. Decision D16 = S3: show engine views first, restyle them, replace one by one where the design needs it.
// Written by agent D with the owner's permission; part of A-04c (the view bridge). Evidence: research/B-01 section 7.
//
// Rules:
//   - The engine's main content (.content-wrapper, which holds #main-content, #song-list-container and #song-list) is MOVED,
//     never cloned or rebuilt, so every id and node the engine cached stays valid (ENGINE-CONTRACT.md 5.2).
//   - Before the shell draws a non-engine view it must call releaseEngineView(): a detached node cannot be found by
//     document.getElementById, and the engine looks things up that way.
//   - Only this folder touches the hidden host or engine globals (gate 13). Views call showEngineView(), not switchView().

import { switchView } from './actions.js';
import { on } from './events.js';

const HOST_SELECTOR = '#legacy-host .container';
const WRAPPER_SELECTOR = '.content-wrapper';

let marker = null; // where the wrapper lived in the hidden host
let wrapper = null;
let panel = null; // a tab of the engine's right panel (the metadata editor), moved the same way
let panelMarker = null;
const EDITORS = ['lyrics-editor-overlay', 'sync-editor-overlay']; // the engine appends these two to <body> and keeps them there

const find = () => wrapper || document.querySelector(`${HOST_SELECTOR} ${WRAPPER_SELECTOR}`);

/** Moves the engine's main content into `host` and asks the engine to draw `view`. Returns false when it cannot.
 *  `page`: the engine page to draw when it is not the view's own (the engine went to Favorites by itself: Library follows it there). */
export function showEngineView(host, view, page = view) {
    const node = find();
    const engine = window.switchView;
    if (!node || typeof engine !== 'function') return false;
    if (node.parentNode !== host) {
        if (!marker) {
            marker = document.createComment('engine-main-content');
            node.parentNode.insertBefore(marker, node);
        }
        wrapper = node;
        host.replaceChildren(node);
    }
    host.dataset.engine = view;
    switchView(page || view);
    return true;
}

/** Subscribes to the engine's current-view changes and passes the view name to `callback`. */
export function connectEngineViewBridge(callback) {
    if (typeof callback !== 'function') throw new TypeError('View callback must be a function');
    return on('view:changed', ({ view }) => callback(view));
}

/**
 * Moves one tab of the engine's right panel (`#<tab>-content`) into `host`: the metadata editor (D-04). The engine draws into it by
 * id, so it is moved, not copied. The caller asks the engine to fill it (engineAction('openMetadataEditor')). Returns false when
 * the node does not exist.
 */
export function showEnginePanel(host, tab) {
    const node = panel || document.getElementById(`${tab}-content`);
    if (!node) return false;
    if (node.parentNode !== host) {
        if (!panelMarker) {
            panelMarker = document.createComment(`engine-${tab}`);
            node.parentNode.insertBefore(panelMarker, node);
        }
        panel = node;
        host.replaceChildren(node);
    }
    host.dataset.enginePanel = tab;
    return true;
}

/** Moves the engine's lyrics editors (Write, Sync) into `host`, so they are modes of the Lyrics page and not windows over the app (D-03). */
export function adoptLyricsEditors(host) {
    for (const id of EDITORS) {
        const node = document.getElementById(id);
        if (node && node.parentNode !== host) host.append(node);
    }
}

/** Puts whatever was moved into `host` back in the hidden host. Safe to call when it is already there. */
export function releaseEngineView(host) {
    for (const id of EDITORS) {
        const node = document.getElementById(id);
        if (node && node.parentNode === host) document.body.append(node); // where the engine put it
    }
    if (wrapper && marker && marker.parentNode && wrapper.parentNode === host) marker.parentNode.insertBefore(wrapper, marker.nextSibling);
    if (panel && panelMarker && panelMarker.parentNode && panel.parentNode === host) panelMarker.parentNode.insertBefore(panel, panelMarker.nextSibling);
    delete host.dataset.engine;
    delete host.dataset.enginePanel;
}

// The engine's Theme Color buttons set a body class (theme-pink ...); ui-next reads data-accent on <html>.
const ACCENTS = ['pink', 'purple', 'yellow', 'white'];
export function syncAccentFromEngine() {
    // The body class changes for many reasons (in-lyrics-view ...): act only when the theme part changed. No theme class means
    // the engine's old default, green, but a page that never had one keeps ui-next's own amber default.
    const current = () => ACCENTS.find((a) => document.body.classList.contains(`theme-${a}`)) || '';
    let last = current();
    if (last) document.documentElement.dataset.accent = last;
    new MutationObserver(() => {
        const now = current();
        if (now === last) return;
        last = now;
        document.documentElement.dataset.accent = now || 'green';
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
