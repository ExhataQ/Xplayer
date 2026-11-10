// notifications-bridge: the engine's notification history as data (task A-07). Counts toward the adapter budget (D18).
//
// The engine keeps its notifications in `notificationHistory` and calls `renderNotificationPanel()` after every change, but sends
// no event. That function draws into `#notification-panel-list` when the page has one. This file provides that element, hidden,
// and treats each redraw as the signal "something changed". The engine is not edited and its markup is never shown.
//
//   watchNotifications(callback) -> unsubscribe(); callback(list) now and after every change. Each entry:
//       { id, type, title, detail, time, rev, progress: null | { percent, status, kind: 'download' | 'cover' } }   newest first, copies only
//       toastOnly: the engine says this one is a popup and not a row of the bell list.
//       action: { label, onClick } or null. A saved download (`_file`) gets "Open file location".
//       rev counts the times an entry changed in place (one action, one entry: the engine updates "Importing..." into "Imported..."), so the
//       shell can show the change again. A message repeated inside its group reads "... x2".
//   dismissNotification(id), clearNotifications() -> the engine's own functions
//   cancelNotification(id) -> stops the running download or album art search behind a progress entry (D41)

const ids = new WeakMap();
let seq = 0;

// Leading emoji and the percent the engine writes into progress messages are dropped; the center draws its own icon and bar.
function split(message, progress) {
    const text = String(message || '').replace(/^[\p{Extended_Pictographic}️\s]+/u, '');
    if (!progress) return { title: text, detail: '' };
    const [head, ...rest] = text.split('...');
    return { title: head.trim(), detail: rest.join('...').replace(/^\s*\d+%\s*—\s*/, '').trim() };
}

const showFile = (file) => window.desktopApi?.supports?.('files.showFileInExplorer') && window.desktopApi.files.showFileInExplorer(file);

function snapshot() {
    const history = window.notificationHistory;
    if (!Array.isArray(history)) return [];
    return history.map((n) => {
        if (!ids.has(n)) ids.set(n, (seq += 1));
        const running = Boolean(n.isDownloadProgress || n.isCoverProgress);
        const { title, detail } = split(n.message, running);
        const status = running ? n.status || detail : '';
        const count = Number(n._count) > 1 ? ` ×${n._count}` : '';
        return { id: ids.get(n), type: String(n.type || 'info'), title: title + count, detail: running ? '' : detail, time: n.timestamp, rev: Number(n._rev) || 0, toastOnly: Boolean(n._toastOnly), action: typeof n._file === 'string' && n._file ? { label: 'Open file location', onClick: () => showFile(n._file) } : null, progress: running ? { percent: Math.max(0, Math.min(100, Number(n.percent) || 0)), status, kind: n.isDownloadProgress ? 'download' : 'cover' } : null };
    });
}

export function watchNotifications(callback) {
    const list = document.createElement('div');
    list.id = 'notification-panel-list';
    list.hidden = true;
    document.body.append(list);
    const observer = new MutationObserver(() => callback(snapshot()));
    observer.observe(list, { childList: true });
    callback(snapshot());
    return () => {
        observer.disconnect();
        list.remove();
    };
}

export function dismissNotification(id) {
    const index = (window.notificationHistory || []).findIndex((n) => ids.get(n) === id);
    if (index >= 0 && typeof window.removeNotificationItem === 'function') window.removeNotificationItem(index);
}

export function clearNotifications() {
    if (typeof window.clearAllNotifications === 'function') window.clearAllNotifications();
}

/** Stops the running work behind a progress entry: the engine's own cancel for downloads or for the album art search. */
export function cancelNotification(id) {
    const entry = (window.notificationHistory || []).find((n) => ids.get(n) === id);
    if (!entry) return;
    if (entry.isDownloadProgress && typeof window.cancelDownload === 'function') window.cancelDownload();
    else if (entry.isCoverProgress && typeof window.cancelCoverSearch === 'function') window.cancelCoverSearch();
}
