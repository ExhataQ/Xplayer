// ==============================================================================
// DRAG & DROP - AUDIO FILES FROM WINDOWS
// ==============================================================================
// Files dragged in from outside the app (polish A4). The main list keeps its own drop handler (core/startup.js: files dropped on the list
// are imported into the view that is open). This file adds the other places a file can go, and the feedback for all of them:
//   - a playlist or Liked Songs in the left panel: the files are imported and put there
//   - All songs in the left panel: the files are imported
//   - the queue (it opens while the files are over its zone, see ui-next queue-panel): the files are imported and queued
//   - everything else is dimmed while files are dragged, and a drop there does nothing
// What can take a drop is decided by acceptsDrop('files', ...) in ui/06l, the same rule the song drag uses.

const AUDIO_EXTENSIONS = ['.mp3', '.flac', '.m4a', '.mp4', '.aac', '.ogg', '.opus', '.wma', '.wav', '.aiff', '.aif', '.ape', '.wv'];
// A drag that has stopped sending events (the pointer left the window, or the drag was cancelled) is over after this long (ms).
const IDLE_END_MS = 1500;

function pathOfFile(file) {
    if (!file) return '';
    if (typeof desktopApi !== 'undefined' && desktopApi.supports('files.getPathForFile')) {
        try {
            const path = desktopApi.files.getPathForFile(file);
            if (typeof path === 'string' && path) return path;
        } catch (e) {
            // Fall back to the legacy Electron File.path property.
        }
    }
    return typeof file.path === 'string' ? file.path : '';
}

function audioPathsOf(dataTransfer) {
    const paths = [];
    for (const file of Array.from((dataTransfer && dataTransfer.files) || [])) {
        const ext = '.' + String(file.name).split('.').pop().toLowerCase();
        if (!AUDIO_EXTENSIONS.includes(ext)) continue;
        const path = pathOfFile(file);
        if (path) paths.push(path);
    }
    return paths;
}

function isFileDrag(event) {
    const types = event.dataTransfer && event.dataTransfer.types;
    return !!types && Array.from(types).includes('Files');
}

export function initFileDropTargets() {
    let active = false;
    let depth = 0;
    let idleTimer = null;
    let hovered = null;

    function clearHover() {
        if (hovered) hovered.classList.remove('drag-hover', 'file-drop-hover');
        hovered = null;
    }

    function start() {
        active = true;
        document.body.classList.add('dragging-files');
        document.querySelectorAll('.left-panel-main-item').forEach((item) => {
            if (!acceptsDrop('files', item.getAttribute('data-view'), item.getAttribute('data-pin-id'))) item.classList.add('drag-invalid');
        });
        document.querySelectorAll('#recently-played-list .queue-item').forEach((item) => item.classList.add('drag-invalid'));
    }

    function end() {
        clearTimeout(idleTimer);
        idleTimer = null;
        depth = 0;
        if (!active) return;
        active = false;
        clearHover();
        document.body.classList.remove('dragging-files');
        document.querySelectorAll('.left-panel-main-item.drag-invalid, .queue-item.drag-invalid').forEach((el) => el.classList.remove('drag-invalid'));
    }

    function keepAlive() {
        if (!active) start();
        clearTimeout(idleTimer);
        idleTimer = setTimeout(end, IDLE_END_MS);
    }

    // Where a drop at this event would go: { target, element } or { target: null }. The list itself answers { list: true }.
    function aim(event) {
        const el = event.target instanceof Element ? event.target : null;
        if (!el) return { target: null };
        const queue = el.closest('.queue-panel, #queue-list');
        if (queue) return { target: { type: 'queue' }, element: el.closest('.queue-panel') || queue };
        if (el.closest('.content-wrapper')) return { list: true };
        const item = el.closest('.left-panel-main-item');
        if (item && !item.classList.contains('drag-invalid')) {
            const target = dropTarget('files', item.getAttribute('data-view'), item.getAttribute('data-pin-id'));
            if (target) return { target, element: item };
        }
        return { target: null };
    }

    window.addEventListener(
        'dragenter',
        (event) => {
            if (!isFileDrag(event)) return;
            depth++;
            keepAlive();
        },
        true
    );

    window.addEventListener(
        'dragover',
        (event) => {
            if (!isFileDrag(event)) return;
            keepAlive();
            const aimed = aim(event);
            if (aimed.list) {
                clearHover();
                return; // core/startup.js answers for the list
            }
            event.preventDefault(); // also stops Electron from opening the dropped file
            event.dataTransfer.dropEffect = aimed.target ? 'copy' : 'none';
            if (hovered !== aimed.element) {
                clearHover();
                if (aimed.element) {
                    hovered = aimed.element;
                    hovered.classList.add(aimed.target.type === 'queue' ? 'file-drop-hover' : 'drag-hover');
                }
            }
        },
        true
    );

    window.addEventListener(
        'dragleave',
        (event) => {
            if (!isFileDrag(event)) return;
            depth = Math.max(0, depth - 1);
            if (depth === 0) end();
        },
        true
    );

    window.addEventListener(
        'drop',
        (event) => {
            if (!isFileDrag(event)) return;
            const aimed = aim(event);
            if (aimed.list) {
                end();
                return; // the list imports into the open view (core/startup.js)
            }
            event.preventDefault();
            event.stopPropagation();
            const paths = audioPathsOf(event.dataTransfer);
            end();
            if (!aimed.target) return;
            if (paths.length === 0) {
                showNotification('No supported audio files found', 'warning', 2000);
                return;
            }
            importDroppedFiles(paths, aimed.target);
        },
        true
    );
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        initFileDropTargets
    });
}
