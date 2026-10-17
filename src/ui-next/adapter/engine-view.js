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

const HOST_SELECTOR = '#legacy-host .container';
const WRAPPER_SELECTOR = '.content-wrapper';

let marker = null; // where the wrapper lived in the hidden host
let wrapper = null;

const find = () => wrapper || document.querySelector(`${HOST_SELECTOR} ${WRAPPER_SELECTOR}`);

/** Moves the engine's main content into `host` and asks the engine to draw `view`. Returns false when it cannot. */
export function showEngineView(host, view) {
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
    engine(view);
    return true;
}

/** Puts the engine's main content back in the hidden host. Safe to call when it is already there. */
export function releaseEngineView(host) {
    if (wrapper && marker && marker.parentNode && wrapper.parentNode === host) marker.parentNode.insertBefore(wrapper, marker.nextSibling);
    delete host.dataset.engine;
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
