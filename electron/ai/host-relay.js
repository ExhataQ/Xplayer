// The AI chat can live in a window of its own (window-manager.js: the "ai" tool window). That window has no library, queue or
// playlists of its own that matter: those belong to the main window, and the chat must never edit a second copy of them. So every
// call that needs them goes through here: window -> this relay -> main window -> answer -> window.
//
//   ai:host-call (window asks)      (name, args, focus)  -> { ok, value } | { ok: false, error }
//   ai:host-request (to main)       { id, name, args }
//   ai:host-response (main answers) { id, ok, value | error }
//
// The relay forwards, it does not decide: the main window only runs the short list of names it has agreed to (shell/ai-host.js).

const TIMEOUT_MS = 20000;
const MAX_NAME = 60;

function registerHostRelay(ipcMain, { getMainWindow, timeoutMs = TIMEOUT_MS }) {
    const pending = new Map();
    let seq = 0;

    ipcMain.handle('ai:host-call', (event, name, args, focus) => {
        const main = getMainWindow();
        if (typeof name !== 'string' || !name || name.length > MAX_NAME) return { ok: false, error: 'bad-call' };
        if (!main || main.isDestroyed()) return { ok: false, error: 'no-main-window' };
        if (event.sender === main.webContents) return { ok: false, error: 'same-window' }; // the main window runs its own code directly
        return new Promise((resolve) => {
            seq += 1;
            const id = seq;
            const timer = setTimeout(() => {
                pending.delete(id);
                resolve({ ok: false, error: 'timeout' });
            }, timeoutMs);
            pending.set(id, { resolve, timer });
            main.webContents.send('ai:host-request', { id, name, args: Array.isArray(args) ? args : [] });
            if (focus === true) {
                if (main.isMinimized()) main.restore();
                main.focus();
            }
        });
    });

    ipcMain.on('ai:host-response', (event, message) => {
        const main = getMainWindow();
        if (!main || event.sender !== main.webContents) return; // only the main window answers
        const m = message && typeof message === 'object' ? message : {};
        const entry = pending.get(m.id);
        if (!entry) return;
        pending.delete(m.id);
        clearTimeout(entry.timer);
        entry.resolve(m.ok === true ? { ok: true, value: m.value } : { ok: false, error: typeof m.error === 'string' ? m.error.slice(0, 300) : 'failed' });
    });

    return { pendingCount: () => pending.size };
}

module.exports = { registerHostRelay };
