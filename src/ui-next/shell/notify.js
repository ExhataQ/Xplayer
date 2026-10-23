// The notification API for the other agents (task PA-06). Shell-owned entries that sit next to the engine's own in the center.
//
//   notify({ title, detail?, kind?: 'info'|'success'|'warning'|'error', where?: 'both'|'center'|'toast', important?,
//            target?: { label?, view? | go? }, action?: { label, onClick } }) -> { id, update(partial), dismiss() }
//       where: 'both' (default) = toast and center, 'center' = quiet (bell dot only), 'toast' = a toast that leaves no entry.
//       important: the first important entry of a session opens the center by itself (errors count as important).
//       target: makes the entry clickable. `view` is a rail view id the shell opens (see setNotificationNavigator); `go` is any function.
//       action: a button on the entry and its toast, such as Undo. The caller clears it again with update({ action: null }).
//   notifyProgress({ title, kind?: 'download'|'cover'|'job', onCancel?, target? }) -> { id, update({ percent, status, title }),
//            done(opts as notify), fail(opts as notify), dismiss() }
//       A running entry sits under "In progress" with its bar; done() and fail() turn it into a finished entry.
//   watchShellNotifications(callback) -> unsubscribe; callback(list) now and after every change. Newest first, copies only.
//   setNotificationNavigator(fn) -> the shell registers how `target.view` is opened.
//
// Entries here use string ids ("s1"); the engine's use numbers, so the two never clash.

const entries = [];
const listeners = new Set();
let seq = 0;
let navigator = null;

const emit = () => {
    const copy = entries.map((e) => ({ ...e, progress: e.progress && { ...e.progress } }));
    for (const fn of [...listeners]) fn(copy);
};

function finish(entry, { title, detail = '', kind = 'info', where = 'both', important = false, target = null, action = null }) {
    Object.assign(entry, { type: kind, title, detail, important: important || kind === 'error', toast: where !== 'center', target, action, progress: null, time: Date.now() });
    entry.rev += 1;
}

export function notify(options) {
    if (!options || !options.title) throw new Error('notify needs a title');
    const id = `s${(seq += 1)}`;
    if ((options.where || 'both') === 'toast') {
        // A toast-only message never enters the list: the center sees it through `toastOnly` and shows it once.
        const entry = { id, rev: 0, source: 'shell', toastOnly: true };
        finish(entry, options);
        entries.push(entry);
        emit();
        entries.splice(entries.indexOf(entry), 1);
        return { id, update() {}, dismiss() {} };
    }
    const entry = { id, rev: 0, source: 'shell' };
    finish(entry, options);
    entries.unshift(entry);
    emit();
    return {
        id,
        update(partial) {
            if (!entries.includes(entry)) return;
            for (const key of ['title', 'detail', 'target', 'action']) if (key in partial) entry[key] = partial[key];
            entry.rev += 1;
            emit();
        },
        dismiss: () => dismissShellNotification(id)
    };
}

export function notifyProgress({ title, kind = 'job', onCancel = null, target = null }) {
    if (!title) throw new Error('notifyProgress needs a title');
    const id = `s${(seq += 1)}`;
    const entry = { id, rev: 0, source: 'shell', type: 'info', title, detail: '', time: Date.now(), important: false, toast: false, target, action: null, onCancel, progress: { percent: 0, status: '', kind } };
    entries.unshift(entry);
    emit();
    const live = () => entries.includes(entry);
    const end = (defaults) => (options = {}) => {
        if (!live()) return;
        finish(entry, { title, ...defaults, ...options });
        entry.onCancel = null;
        emit();
    };
    return {
        id,
        update({ percent, status, title: next } = {}) {
            if (!live() || !entry.progress) return;
            if (percent !== undefined) entry.progress.percent = Math.max(0, Math.min(100, Number(percent) || 0));
            if (status !== undefined) entry.progress.status = String(status);
            if (next) entry.title = next;
            emit();
        },
        done: end({ kind: 'success' }),
        fail: end({ kind: 'error' }),
        dismiss: () => dismissShellNotification(id)
    };
}

export function dismissShellNotification(id) {
    const index = entries.findIndex((e) => e.id === id);
    if (index < 0) return false;
    entries.splice(index, 1);
    emit();
    return true;
}

export function clearShellNotifications() {
    for (let i = entries.length - 1; i >= 0; i -= 1) if (!entries[i].progress) entries.splice(i, 1);
    emit();
}

/** Stops the work behind a running shell entry. Returns true when it was one of ours. */
export function cancelShellNotification(id) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return false;
    if (typeof entry.onCancel === 'function') entry.onCancel();
    return true;
}

export function watchShellNotifications(callback) {
    listeners.add(callback);
    callback(entries.map((e) => ({ ...e, progress: e.progress && { ...e.progress } })));
    return () => listeners.delete(callback);
}

export function setNotificationNavigator(fn) {
    navigator = fn;
}

/** Opens what an entry points at. Returns true when something was opened. */
export function openNotificationTarget(target) {
    if (!target) return false;
    if (typeof target.go === 'function') return target.go(), true;
    if (target.view && navigator) return navigator(target.view), true;
    return false;
}
