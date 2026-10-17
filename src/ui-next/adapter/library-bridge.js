// library-bridge (task B-02, decision D21): the one place the library panel touches the engine's panel list and
// its view model. Views outside adapter/ must not look up engine elements (register L-01), so the list is moved here.
// This is a small, early part of the adapter API planned in task A-04c; A may fold it into store and actions.

const engine = () => window;

/** Moves the engine's panel list out of the hidden host into `target`. The node keeps its identity. */
export function mountLibraryList(target) {
    const list = document.querySelector('.left-panel-main-list-container');
    if (!list || list.parentNode === target) return;
    target.append(list);
    // The engine may already have drawn the list while it was hidden (zero height), so draw it again.
    if (typeof engine().setLeftPanelView === 'function') engine().setLeftPanelView({});
}

/** Runs `callback` once the engine has loaded (it loads after the shell, see index.html). */
export function whenLibraryReady(callback) {
    const check = () => (typeof engine().setLeftPanelView === 'function' ? callback() : requestAnimationFrame(check));
    check();
}

/** { types, query, sort } as the engine has it (ui/05b). */
export const getLibraryView = () => engine().getLeftPanelView();

/** Merges `patch` ({ types, query, sort }) into the engine's view model and redraws the list. */
export const setLibraryView = (patch) => engine().setLeftPanelView(patch);

export const libraryItemCount = () => engine().getLeftPanelItemsArray().length;

/** The open folder's name, or '' when no folder is open. */
export const openLibraryFolder = () => (engine().currentOpenFolderId ? String(engine().currentOpenFolderName || '') : '');

export const closeLibraryFolder = () => engine().closeFolder();

/** Calls `callback` (once per frame at most) whenever the engine redraws the list or changes folder. */
export function onLibraryChange(callback) {
    const list = document.querySelector('.left-panel-main-list');
    if (!list) return () => {};
    let queued = false;
    const observer = new MutationObserver(() => {
        if (queued) return;
        queued = true;
        requestAnimationFrame(() => {
            queued = false;
            callback();
        });
    });
    observer.observe(list, { childList: true });
    return () => observer.disconnect();
}
