// notifications-bridge: the engine's notification history as data (task A-07). Counts toward the adapter budget (D18).
//
// The engine keeps its notifications in `notificationHistory` and calls `renderNotificationPanel()` after every change, but sends
// no event. That function draws into `#notification-panel-list` when the page has one. This file provides that element, hidden,
// and treats each redraw as the signal "something changed". The engine is not edited and its markup is never shown.
//
//   watchNotifications(callback) -> unsubscribe(); callback(list) now and after every change. Each entry:
//       { id, type, title, detail, time, progress: null | { percent, status } }   newest first, copies only
//   dismissNotification(id), clearNotifications() -> the engine's own functions

const ids = new WeakMap();
let seq = 0;

// Leading emoji and the percent the engine writes into progress messages are dropped; the center draws its own icon and bar.
function split(message, progress) {
    const text = String(message || '').replace(/^[\p{Extended_Pictographic}️\s]+/u, '');
    if (!progress) return { title: text, detail: '' };
    const [head, ...rest] = text.split('...');
    return { title: head.trim(), detail: rest.join('...').replace(/^\s*\d+%\s*—\s*/, '').trim() };
}

function snapshot() {
    const history = window.notificationHistory;
    if (!Array.isArray(history)) return [];
    return history.map((n) => {
        if (!ids.has(n)) ids.set(n, (seq += 1));
        const running = Boolean(n.isDownloadProgress || n.isCoverProgress);
        const { title, detail } = split(n.message, running);
        const status = running ? n.status || detail : '';
        return { id: ids.get(n), type: String(n.type || 'info'), title, detail: running ? '' : detail, time: n.timestamp, progress: running ? { percent: Math.max(0, Math.min(100, Number(n.percent) || 0)), status } : null };
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
