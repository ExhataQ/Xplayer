// ==============================================================================
// NOTIFICATION SYSTEM
// ==============================================================================
// ----- one entry for one action -----
// Without grouping, one action would fill the bell with its steps ("Importing 3 file(s)...", then "Imported 3 song(s)"), and a quick
// run of the same toggle (liked, unliked, liked) with copies. A message that belongs to a group now changes the group's latest entry in place when that
// entry is still open (its action has begun and not ended) or is recent: the toast and the bell row change with it, and a repeat of the same message
// counts up (x2). `begin` marks the message that opens an action. The list does not move entries: the progress rows below find theirs by position.
const GROUP_WINDOW_MS = 8000;
const NOTIFICATION_GROUPS = [
    { key: 'import-files', begin: /^Importing \d/, match: /^(Importing \d|Imported \d+ song|Already in your library$|Added back \d|Could not import|No new songs to import$|Failed to import files$)/ },
    { key: 'change-folder', begin: /^Selecting folder/, match: /^(Selecting folder|Loaded \d+ songs from new folder$|Failed to change folder$|Error changing folder$)/ },
    { key: 'rebuild-library', begin: /^(Scanning \d|Clearing the music library)/, match: /^(Scanning \d|Clearing the music library|Loaded \d+ songs from \d+ folder|Music library cleared$|Failed to rebuild library)/ },
    { key: 'favorites', window: 6000, match: /^(Added to favorites|Removed from favorites|(Added|Removed) \d+ songs? (to|from) favorites)$/ },
    { key: 'liked-songs', window: 6000, match: /^Added \d+ item\(s\) to Liked Songs$/ },
    { key: 'queue', window: 6000, match: /^Added \d+ (song|item)\(s\) to queue$/ },
    { key: 'pin', window: 6000, match: /^".*" (pinned|unpinned)$/ },
    { key: 'metadata-save', match: /^(Metadata saved$|No changes to save$|Failed to save metadata|Not supported for this file type)/ },
    { key: 'lyrics-save', match: /^(Saved$|Saved as |Saved \d+ synced lines$|Lyrics saved$|LRC saved to song$|Lyrics saved to song$|Failed to save$|Nothing to save$)/ },
    { key: 'lyrics-copy', window: 4000, match: /^(Copied |LRC copied$|Lyrics copied$)/ }
];

// ----- each message in one place -----
// Most messages only confirm what the person just did, so one popup is enough and the bell list would only fill up with them. What is worth reading
// again (every failure, and the results of an import, a rebuild or a save with skipped files, data export / import, clearing a history list
// and changing the download folder) is not on these lists, so it stays in both places.
//   DROP: not shown at all (the screen already says it, or nothing was asked for).  TOAST_ONLY: a popup, no row in the bell list.
const DROP_NOTIFICATIONS = /^((Import )?[Nn]ot available( in browser mode)?|No song playing|Nothing to (undo|redo)|Please enter a (playlist name|folder name|URL)|Enter an artist or title|Smart Shuffle setting saved|Delete function not available|Line has no time to shift|Copied .*|(Lyrics|LRC) copied)$/;
const TOAST_ONLY_NOTIFICATIONS = [
    /^(Added to|Removed from) favorites$/,
    /^(Added|Removed) \d+ songs? (to|from) favorites$/,
    /^Added \d+ (song|item)\(s\) to /,
    /^Added ".*" to /,
    /^".*" (pinned|unpinned)$/,
    /^(Added|Moved) .+ to "/,
    /^(Removed .+ shortcut from folder|Moved .+ back to library root)$/,
    /^(Playlist ".*" (created|deleted)|Playlist updated|Folder ".*" (created|deleted.*|and all contents deleted)|Folder renamed|Folder deleted)$/,
    /^(Search removed from history|Entry deleted from history)$/, // clearing a whole list is kept in the bell: it cannot be undone
    /^(Saved|Saved as .+|Saved \d+ synced lines|Lyrics saved|Lyrics cleared|Synced lyrics cleared|Variant deleted|Removed \d+ saved lyrics)$/,
    /^(Metadata saved|Download cancelled)$/, // saving or importing data and changing the download folder are kept in the bell (what changed, to look back on)
    /^(Streaming|Saved): /,
    /^(Already in playlist|Song already in .+|Already in folder|Item already in that folder|Item is not in this folder|No changes to save)$/,
    /^(Playlist is empty|Album is empty|Artist has no songs|No songs to play|No lyrics available|No (LRC|plain lyrics) available|Nothing to save)$/,
    /^(Importing \d|Selecting folder|Scanning \d|Clearing the music library)/ // the first step of an action: the result that follows is the one worth keeping
];

function notificationModeOf(message) {
    if (typeof message !== 'string') return 'both';
    if (DROP_NOTIFICATIONS.test(message)) return 'drop';
    return TOAST_ONLY_NOTIFICATIONS.some((rule) => rule.test(message)) ? 'toast' : 'both';
}

function notificationGroupOf(message) {
    if (typeof message !== 'string') return null;
    return NOTIFICATION_GROUPS.find((group) => group.match.test(message)) || null;
}

// `options.file` is the full path of a file the message is about (a download that was saved): the entry is kept in the bell list with an
// "Open file location" button (shell/notification-center.js, through adapter/notifications-bridge.js). A popup alone would be gone before it is clicked.
export function showNotification(message, type = 'success', duration, options) {
    const file = options && typeof options.file === 'string' && options.file ? options.file : '';
    const mode = file ? 'both' : notificationModeOf(message);
    if (mode === 'drop') return;
    const toastOnly = mode === 'toast';
    const group = notificationGroupOf(message);
    const open = Boolean(group && group.begin && group.begin.test(message));
    const now = Date.now();
    const latest = group ? notificationHistory.find((n) => n._group === group.key) : null;
    if (latest && (latest._open || now - latest.timestamp <= (group.window || GROUP_WINDOW_MS))) {
        const same = latest.message === message && latest.type === type;
        latest.message = message;
        latest.type = type;
        latest.timestamp = now;
        latest._viewed = false;
        latest._open = open;
        latest._toastOnly = toastOnly; // "Importing..." was popup only; "Imported 3 songs" is kept in the bell list, so the same entry joins it
        latest._rev = (latest._rev || 0) + 1; // the shell shows a changed entry again (adapter/notifications-bridge.js)
        latest._count = same ? (latest._count || 1) + 1 : 1;
        renderNotificationPanel();
        updateNotificationBadge();
        return;
    }

    notificationHistory.unshift({
        message: message,
        type: type,
        timestamp: now,
        ...(toastOnly ? { _toastOnly: true } : {}),
        ...(file ? { _file: file } : {}),
        ...(group ? { _group: group.key, _open: open, _rev: 0, _count: 1 } : {})
    });

    if (notificationHistory.length > 50) {
        notificationHistory = notificationHistory.slice(0, 50);
    }

    renderNotificationPanel();

    if (!notificationPanelOpen) {
        const badge = getCachedEl('notification-badge');
        if (badge) {
            const unreadCount = notificationHistory.filter((n) => !n.isDownloadProgress && !n.isCoverProgress && !n.isScanProgress && !n.isTaskProgress && !n._viewed).length;
            if (unreadCount > 0) {
                badge.style.display = 'flex';
                badge.textContent = unreadCount;
            }
        }
    }
}

let coverNotifyIndex = -1;

export function showCoverProgressNotification(processed, total, found) {
    const pct = total > 0 ? Math.round((processed / total) * 100) : 0;
    const message = `🖼️ Finding album art... ${found} found · ${processed}/${total} scanned`;

    if (coverNotifyIndex === -1) {
        notificationHistory.unshift({
            message: message,
            type: 'info',
            timestamp: Date.now(),
            isCoverProgress: true,
            percent: pct
        });
        coverNotifyIndex = 0;
    } else {
        notificationHistory[coverNotifyIndex].message = message;
        notificationHistory[coverNotifyIndex].percent = pct;
        notificationHistory[coverNotifyIndex].timestamp = Date.now();
    }

    if (notificationHistory.length > 50) {
        if (coverNotifyIndex >= 50) coverNotifyIndex = -1;
        notificationHistory = notificationHistory.slice(0, 50);
    }

    renderNotificationPanel();
}

// ----- the library scan, shown as one progress row -----
// A scan (rebuild, change folder) runs in the main process while the person keeps using the app (electron/scan-state.js). Its progress arrives
// as 'scan-progress' events and lives in one row of the notifications; the result ("Loaded 812 songs from 3 folder(s)") is a normal entry that
// replaces it. While it runs the main process refuses what would write the library underneath it, so the start says so.
let scanNotice = null;
let scanProgressAttached = false;
let scanWatcher = null; // the function that takes the progress events of the scan that is being watched

export function showScanProgressNotification(percent, step) {
    const pct = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
    const status = typeof step === 'string' ? step : '';
    const message = `📚 Scanning library... ${pct}%${status ? ' — ' + status : ''}`;
    if (!scanNotice || !notificationHistory.includes(scanNotice)) {
        scanNotice = { message, type: 'info', timestamp: Date.now(), isScanProgress: true, percent: pct, status };
        notificationHistory.unshift(scanNotice);
        if (notificationHistory.length > 50) notificationHistory = notificationHistory.slice(0, 50);
    } else {
        Object.assign(scanNotice, { message, percent: pct, status, timestamp: Date.now() });
    }
    renderNotificationPanel();
}

export function endScanProgressNotification() {
    if (!scanNotice) return;
    const index = notificationHistory.indexOf(scanNotice);
    if (index >= 0) notificationHistory.splice(index, 1);
    scanNotice = null;
    renderNotificationPanel();
}

/**
 * Call before a scan call; call the function it returns when that call has answered (success or not).
 * The first progress event (or `immediate: true`, when the scan starts at once) puts the row up, opens the notifications so the progress is in
 * sight, and says what waits until the scan ends. The change-folder scan starts only after the person picked a folder, hence the lazy start.
 */
export function beginScanProgress({ immediate = true } = {}) {
    let live = true;
    let announced = false;
    const announce = () => {
        if (announced) return;
        announced = true;
        showScanProgressNotification(0, 'Starting');
        window.dispatchEvent(new CustomEvent('xplayer:notifications-open'));
        showNotification(
            'Library scan started. You can keep browsing and playing. Importing, editing tags, downloads and another scan wait until it finishes.',
            'warning',
            8000
        );
    };
    scanWatcher = (info) => {
        if (!live || !info) return;
        announce();
        showScanProgressNotification(info.percent, info.step);
    };
    if (!scanProgressAttached && desktopApi.supports('library.onScanProgress')) {
        scanProgressAttached = true;
        desktopApi.library.onScanProgress((info) => scanWatcher && scanWatcher(info));
    }
    if (immediate) announce();
    return () => {
        if (!live) return;
        live = false;
        scanWatcher = null;
        endScanProgressNotification();
    };
}

// ----- a short task with a progress row (export / import of data) -----
// Same place as the scan row: it is put up, the notifications open so the bar is in sight, and it is taken away when the task ends (the
// result is a normal entry). `title` is the task ("Exporting data"); update(percent, status) moves the bar and says what is happening.
export function beginTaskProgress(title) {
    const notice = { message: `📦 ${title}... 0%`, type: 'info', timestamp: Date.now(), isTaskProgress: true, percent: 0, status: '' };
    notificationHistory.unshift(notice);
    if (notificationHistory.length > 50) notificationHistory = notificationHistory.slice(0, 50);
    renderNotificationPanel();
    window.dispatchEvent(new CustomEvent('xplayer:notifications-open'));
    return {
        update(percent, status = '') {
            const pct = Math.max(0, Math.min(100, Math.round(Number(percent) || 0)));
            Object.assign(notice, { message: `📦 ${title}... ${pct}%${status ? ' — ' + status : ''}`, percent: pct, status, timestamp: Date.now() });
            renderNotificationPanel();
        },
        end() {
            const index = notificationHistory.indexOf(notice);
            if (index >= 0) notificationHistory.splice(index, 1);
            renderNotificationPanel();
        }
    };
}

/** True when a main-process answer says the library is being scanned; the person is told, and the caller should stop. */
export function refusedForScan(result) {
    if (!result || result.reason !== 'scan-running') return false;
    showNotification(result.error || 'The library is still being scanned. Try again when it finishes.', 'warning', 5000);
    return true;
}

/** Stops the album art search. What was found so far is kept; the main process then reports the end as `cancelled`. */
export function cancelCoverSearch() {
    if (coverNotifyIndex === -1 || !desktopApi.supports('library.cancelCoverSearch')) return;
    notificationHistory[coverNotifyIndex].message = '🖼️ Stopping album art search...';
    renderNotificationPanel();
    desktopApi.library.cancelCoverSearch();
}

export function completeCoverProgressNotification(info) {
    if (coverNotifyIndex !== -1 && notificationHistory[coverNotifyIndex]) {
        const cancelled = Boolean(info && info.cancelled);
        notificationHistory[coverNotifyIndex].isCoverProgress = false;
        notificationHistory[coverNotifyIndex].message = cancelled ? '🖼️ Album art search stopped' : '🖼️ Album art finished loading';
        notificationHistory[coverNotifyIndex].type = cancelled ? 'info' : 'success';
        notificationHistory[coverNotifyIndex].timestamp = Date.now();
    }
    coverNotifyIndex = -1;
    renderNotificationPanel();

    if (!notificationPanelOpen) {
        const badge = getCachedEl('notification-badge');
        if (badge) {
            const unreadCount = notificationHistory.filter((n) => !n.isDownloadProgress && !n.isCoverProgress && !n.isScanProgress && !n.isTaskProgress && !n._viewed).length;
            if (unreadCount > 0) {
                badge.style.display = 'flex';
                badge.textContent = unreadCount;
            }
        }
    }
}


export function closeNotificationPanel() {
    const panel = getCachedEl('notification-panel');
    const btn = getCachedEl('notification-panel-btn');

    if (panel) panel.classList.remove('active');
    if (btn) btn.classList.remove('active');
    notificationPanelOpen = false;
    document.body.classList.remove('suppress-tooltips');
}

export function clearAllNotifications() {
    notificationHistory = [];
    setDownloadNotifyIndex(-1);
    renderNotificationPanel();
    const badge = getCachedEl('notification-badge');
    if (badge) {
        badge.style.display = 'none';
        badge.textContent = '0';
    }
    if (notificationPanelOpen) {
        closeNotificationPanel();
    }
}

export function removeNotificationItem(index) {
    if (notificationHistory[index] && notificationHistory[index].isDownloadProgress) {
        setDownloadNotifyIndex(-1);
    } else if (downloadNotifyIndex > index) {
        setDownloadNotifyIndex(downloadNotifyIndex - 1);
    }
    notificationHistory.splice(index, 1);
    renderNotificationPanel();
    updateNotificationBadge();
}

function updateNotificationBadge() {
    const badge = getCachedEl('notification-badge');
    if (!badge) return;
    if (notificationPanelOpen) {
        badge.style.display = 'none';
        badge.textContent = '0';
        return;
    }
    const unreadCount = notificationHistory.filter((n) => !n.isDownloadProgress && !n._viewed).length;
    if (unreadCount > 0) {
        badge.style.display = 'flex';
        badge.textContent = unreadCount;
    } else {
        badge.style.display = 'none';
        badge.textContent = '0';
    }
}

export function renderNotificationPanel() {
    const list = document.getElementById('notification-panel-list');
    if (!list) return;

    if (notificationHistory.length === 0) {
        list.innerHTML = `
            <div class="notification-empty">
                <i class="fas fa-bell-slash"></i>
                <span>No notifications</span>
            </div>`;
        return;
    }

    const icons = {
        success: 'fa-check',
        error: 'fa-trash-alt',
        info: 'fa-info-circle',
        warning: 'fa-exclamation-triangle',
        heart: 'fa-heart'
    };

    list.innerHTML = notificationHistory
        .map((notif, index) => {
            const time = new Date(notif.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });

            let progressBarHTML = '';
            if (notif.isDownloadProgress) {
                const pct = Math.round(notif.percent || 0);
                progressBarHTML = `
                <div style="width: 100%; height: 3px; background: #444; border-radius: 2px; overflow: hidden; margin-top: 6px;">
                    <div style="width: ${pct}%; height: 100%; background: #1db954; border-radius: 2px; transition: width 0.3s ease;"></div>
                </div>
                <div style="font-size: 10px; color: var(--text-secondary); margin-top: 3px;">${escapeHtml(
                    notif.status || ''
                )}</div>`;
            } else if (notif.isCoverProgress) {
                const pct = Math.round(notif.percent || 0);
                progressBarHTML = `
                <div style="width: 100%; height: 3px; background: #444; border-radius: 2px; overflow: hidden; margin-top: 6px;">
                    <div style="width: ${pct}%; height: 100%; background: #1db954; border-radius: 2px; transition: width 0.3s ease;"></div>
                </div>`;
            }

            return `
            <div class="notification-item">
                <div class="notification-item-icon ${notif.type}">
                    <i class="fas ${
                        notif.isDownloadProgress ? 'fa-download' : notif.isCoverProgress ? 'fa-image' : icons[notif.type] || 'fa-check'
                    }"></i>
                </div>
                <div class="notification-item-content">
                    <div class="notification-item-message">${escapeHtml(
                        notif.message.replace(/📥 Downloading... \d+% — /, '📥 ')
                    )}</div>
                    ${progressBarHTML}
                    <div class="notification-item-time">${time}</div>
                </div>
                ${
                    notif.isDownloadProgress || notif.isCoverProgress
                        ? `<button class="notification-item-close" ${notif.isDownloadProgress ? actionAttrs('cancelDownload', [], { stop: true }) : actionAttrs('cancelCoverSearch', [], { stop: true })} title="Cancel" aria-label="Cancel">
                    <i class="fas fa-times"></i>
                </button>`
                        : `<button class="notification-item-close" ${actionAttrs('removeNotificationItem', [index], { stop: true })} title="Dismiss">
                    <i class="fas fa-times"></i>
                </button>`
                }
            </div>`;
        })
        .join('');
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({
        showNotification,
        beginTaskProgress,
        showCoverProgressNotification,
        completeCoverProgressNotification,
        showScanProgressNotification,
        endScanProgressNotification,
        beginScanProgress,
        refusedForScan,
        cancelCoverSearch,
        closeNotificationPanel,
        clearAllNotifications,
        removeNotificationItem,
        renderNotificationPanel
    });
}
