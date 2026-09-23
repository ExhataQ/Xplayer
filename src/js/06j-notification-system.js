// ==============================================================================
// NOTIFICATION SYSTEM
// ==============================================================================
function showNotification(message, type = 'success', duration) {
    notificationHistory.unshift({
        message: message,
        type: type,
        timestamp: Date.now()
    });

    if (notificationHistory.length > 50) {
        notificationHistory = notificationHistory.slice(0, 50);
    }

    renderNotificationPanel();

    if (!notificationPanelOpen) {
        const badge = document.getElementById('notification-badge');
        if (badge) {
            const unreadCount = notificationHistory.filter((n) => !n.isDownloadProgress && !n.isCoverProgress && !n._viewed).length;
            if (unreadCount > 0) {
                badge.style.display = 'flex';
                badge.textContent = unreadCount;
            }
        }
    }
}

let coverNotifyIndex = -1;

function showCoverProgressNotification(processed, total, found) {
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

function completeCoverProgressNotification() {
    if (coverNotifyIndex !== -1 && notificationHistory[coverNotifyIndex]) {
        notificationHistory[coverNotifyIndex].isCoverProgress = false;
        notificationHistory[coverNotifyIndex].message = '🖼️ Album art finished loading';
        notificationHistory[coverNotifyIndex].type = 'success';
        notificationHistory[coverNotifyIndex].timestamp = Date.now();
    }
    coverNotifyIndex = -1;
    renderNotificationPanel();

    if (!notificationPanelOpen) {
        const badge = document.getElementById('notification-badge');
        if (badge) {
            const unreadCount = notificationHistory.filter((n) => !n.isDownloadProgress && !n.isCoverProgress && !n._viewed).length;
            if (unreadCount > 0) {
                badge.style.display = 'flex';
                badge.textContent = unreadCount;
            }
        }
    }
}

let notificationPanelOpen = false;
let notificationHistory = [];

function toggleNotificationPanel() {
    const panel = document.getElementById('notification-panel');
    const btn = document.getElementById('notification-panel-btn');

    if (!panel || !btn) return;

    notificationPanelOpen = !notificationPanelOpen;

    if (notificationPanelOpen) {
        const btnRect = btn.getBoundingClientRect();
        const calculatedTop = btnRect.bottom + 4;
        const calculatedRight = window.innerWidth - btnRect.right;

        panel.style.top = calculatedTop + 'px';
        panel.style.right = calculatedRight + 'px';

        setTimeout(() => {
            const closeHandler = function (e) {
                if (!notificationPanelOpen) {
                    document.removeEventListener('click', closeHandler);
                    document.removeEventListener('mousedown', closeHandler);
                    return;
                }
                const panel = document.getElementById('notification-panel');
                const btn = document.getElementById('notification-panel-btn');
                if (!panel) return;
                if (panel.contains(e.target)) return;
                if (btn && btn.contains(e.target)) return;
                closeNotificationPanel();
                document.removeEventListener('click', closeHandler);
                document.removeEventListener('mousedown', closeHandler);
            };
            document.addEventListener('click', closeHandler);
            document.addEventListener('mousedown', closeHandler);
        }, 0);
        if (btn.hasAttribute('title')) {
            btn.setAttribute('data-notif-title', btn.getAttribute('title'));
            btn.removeAttribute('title');
        }

        panel.classList.add('active');
        btn.classList.add('active');
        const badge = document.getElementById('notification-badge');
        if (badge) {
            badge.style.display = 'none';
            badge.textContent = '0';
        }
        notificationHistory.forEach((n) => (n._viewed = true));
        document.body.classList.add('suppress-tooltips');
    } else {
        panel.classList.remove('active');
        btn.classList.remove('active');
        document.body.classList.remove('suppress-tooltips');

        if (btn.hasAttribute('data-notif-title')) {
            btn.setAttribute('title', btn.getAttribute('data-notif-title'));
            btn.removeAttribute('data-notif-title');
        }
    }
}

function closeNotificationPanel() {
    const panel = document.getElementById('notification-panel');
    const btn = document.getElementById('notification-panel-btn');

    if (panel) panel.classList.remove('active');
    if (btn) btn.classList.remove('active');
    notificationPanelOpen = false;
    document.body.classList.remove('suppress-tooltips');
}

function clearAllNotifications() {
    notificationHistory = [];
    downloadNotifyIndex = -1;
    renderNotificationPanel();
    const badge = document.getElementById('notification-badge');
    if (badge) {
        badge.style.display = 'none';
        badge.textContent = '0';
    }
    if (notificationPanelOpen) {
        closeNotificationPanel();
    }
}

function removeNotificationItem(index) {
    if (notificationHistory[index] && notificationHistory[index].isDownloadProgress) {
        downloadNotifyIndex = -1;
    } else if (downloadNotifyIndex > index) {
        downloadNotifyIndex--;
    }
    notificationHistory.splice(index, 1);
    renderNotificationPanel();
    updateNotificationBadge();
}

function updateNotificationBadge() {
    const badge = document.getElementById('notification-badge');
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

function renderNotificationPanel() {
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
                        ? ''
                        : `<button class="notification-item-close" onclick="event.stopPropagation(); removeNotificationItem(${index})" title="Dismiss">
                    <i class="fas fa-times"></i>
                </button>`
                }
            </div>`;
        })
        .join('');
}
