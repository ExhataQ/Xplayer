// Data: what belongs to you, where it lives, and what to send with a bug report.
//   Backup         export and import
//   Saved lyrics   the lyrics you wrote or edited
//   Storage        the data folder
//   Performance    when long lists switch to virtual scrolling
//   Diagnostics    a report for a bug, the log files, and the memory recording
//   About          the version and the project page
import { el } from '../../components/index.js';
import { engineAction } from '../../adapter/engine-api.js';
import { openLogViewer } from '../../shell/log-viewer.js';

const api = () => window.desktopApi;
const has = (name) => Boolean(api() && typeof api().supports === 'function' && api().supports(name));

// What the main process says about the app (electron/app-info.js). One question, shared by the rows that show it.
let info = null;
let dataDir = '';
const appInfo = () => {
    if (!info) info = has('app.getAppInfo') ? Promise.resolve(api().app.getAppInfo()).catch(() => null) : Promise.resolve(null);
    return info;
};

// A button that calls api.app[run](). Disabled without the desktop app.
const appAction = (label, run, { done, failed = 'Could not do that' } = {}) => ({
    label,
    failed,
    disabled: () => !has(`app.${run}`),
    run: async () => {
        await api().app[run]();
        return done;
    }
});

// The memory recording is off every time the app starts; the two buttons need to know whether it is on.
function recordingRow() {
    let on = false;
    const ask = () => (has('app.perfRecording') ? Promise.resolve(api().app.perfRecording()).then((answer) => (on = Boolean(answer && answer.recording))) : null);
    return {
        id: 'memory-recording',
        type: 'toggle',
        label: 'Record memory use',
        hint: 'One line every 30 seconds in logs/perf.csv: memory, CPU and the open view. Numbers only, kept on this computer. Off at every start.',
        disabled: () => !has('app.perfRecording'),
        get: () => on,
        set: async (value) => {
            on = value;
            try {
                const answer = await api().app.perfRecording(value);
                on = Boolean(answer && answer.recording);
            } catch (_) {
                on = !value;
            }
        },
        subscribe: (cb) => {
            const first = ask();
            if (first) first.then(cb);
            return () => {};
        }
    };
}

// Lists of more than this many songs use virtual scrolling. The engine owns the numbers; this only moves the slider.
const lim = (name, fallback) => (Number.isFinite(window[name]) ? window[name] : fallback);
function thresholdRow() {
    return {
        id: 'virtual-scroll',
        type: 'slider',
        label: 'Virtual scrolling above',
        hint: 'Lists with more songs than this draw only the rows you see.',
        min: () => lim('MIN_VIRTUAL_SCROLL_THRESHOLD', 0), // read when the page is drawn, after the engine has started
        max: () => lim('MAX_VIRTUAL_SCROLL_THRESHOLD', 2000),
        step: 50,
        format: (v) => `${v} songs`,
        get: () => Number(window.VIRTUAL_SCROLL_THRESHOLD) || lim('MIN_VIRTUAL_SCROLL_THRESHOLD', 0),
        set: (value) => {
            const snapped = typeof window.snapVirtualScrollThreshold === 'function' ? window.snapVirtualScrollThreshold(value) : value;
            engineAction('setVirtualScrollThreshold', snapped);
        }
    };
}

// The lyrics you saved: the engine draws the list into #saved-lyrics-list and keeps it in step (open one, delete one).
function savedLyricsRow() {
    return {
        id: 'saved-lyrics-list',
        type: 'custom',
        render: () => {
            const list = el('div', { class: 'library-locations-list', id: 'saved-lyrics-list' });
            queueMicrotask(() => engineAction('renderSavedLyricsList'));
            return { el: el('div', { class: 'library-locations-list-container sp-listbox' }, list) };
        }
    };
}

// Asks GitHub for a newer version when the button is pressed, never in the background. Nothing is downloaded or installed.
function updatesRow() {
    let result = null;
    let refresh = () => {};
    return {
        id: 'updates',
        type: 'action',
        label: 'Updates',
        hint: () => (result && result.updateAvailable ? `Version ${result.latest} is available.` : 'Looks on GitHub for a newer version when you press the button.'),
        subscribe: (cb) => {
            refresh = cb;
            return () => {
                refresh = () => {};
            };
        },
        actions: [
            {
                label: 'Check for updates',
                failed: 'Could not check for updates',
                disabled: () => !has('app.checkForUpdates'),
                run: async () => {
                    const answer = await api().app.checkForUpdates();
                    if (!answer || !answer.success) return (answer && answer.error) || 'Could not check for updates';
                    result = answer;
                    refresh();
                    if (answer.updateAvailable) return `Version ${answer.latest} is available.`;
                    return answer.latest ? `You have the newest version (${answer.current}).` : 'No releases found yet.';
                }
            },
            {
                label: 'Open download page',
                disabled: () => !(result && result.updateAvailable) || !has('app.openReleasesPage'),
                run: () => api().app.openReleasesPage()
            }
        ]
    };
}

export const data = {
    id: 'data',
    label: 'Data',
    icon: 'download',
    order: 50,
    parts: [
        {
            id: 'backup',
            title: 'Backup',
            rows: [
                { id: 'export', type: 'action', label: 'Export data', actions: [{ label: 'Export', icon: 'download', run: () => engineAction('exportAllData') }] },
                { id: 'import', type: 'action', label: 'Import data', actions: [{ label: 'Import', run: () => engineAction('importAllData') }] }
            ]
        },
        {
            id: 'saved-lyrics',
            title: 'Saved lyrics',
            rows: [
                savedLyricsRow(),
                { id: 'saved-lyrics-clear', type: 'action', label: 'Remove all saved lyrics', actions: [{ label: 'Remove all', icon: 'trash-2', variant: 'danger', run: () => engineAction('removeAllSavedLyrics') }] }
            ]
        },
        {
            id: 'storage',
            title: 'Storage',
            hint: 'Library, covers, settings and logs are in one folder. Copy it to move everything.',
            rows: [
                {
                    id: 'data-folder',
                    type: 'action',
                    label: 'Data folder',
                    hint: () => dataDir,
                    subscribe: (cb) => {
                        appInfo().then((i) => {
                            dataDir = (i && i.dataDir) || '';
                            cb();
                        });
                        return () => {};
                    },
                    actions: [appAction('Open folder', 'openDataFolder')]
                }
            ]
        },
        { id: 'performance', title: 'Performance', rows: [thresholdRow()] },
        {
            id: 'diagnostics',
            title: 'Diagnostics',
            rows: [
                {
                    id: 'copy-diagnostics',
                    type: 'action',
                    label: 'Bug report',
                    hint: 'Copies the version, memory use and recent log lines. Paths are removed; no song names or keys.',
                    actions: [appAction('Copy diagnostics', 'copyDiagnostics', { done: 'Copied' })]
                },
                {
                    id: 'open-logs',
                    type: 'action',
                    label: 'Log files',
                    hint: 'Shows the last lines of main.log with paths and your user name removed. Also in Help > Open logs.',
                    actions: [{ label: 'View log', disabled: () => !has('app.readLog'), run: () => openLogViewer() }, appAction('Open folder', 'openLogsFolder')]
                },
                recordingRow(),
                { id: 'memory-summary', type: 'action', label: 'Memory summary', hint: 'Copies the totals of the recording.', actions: [appAction('Copy summary', 'copyPerfSummary', { done: 'Copied' })] }
            ]
        },
        {
            id: 'about',
            title: 'About',
            rows: [
                {
                    id: 'version',
                    type: 'info',
                    label: 'Version',
                    value: () => appInfo().then((i) => (i ? `${i.version || 'unknown'}${i.mode === 'dev' ? ' (development run)' : ''}, Electron ${i.electron}` : 'unknown'))
                },
                updatesRow(),
                { id: 'project-site', type: 'action', label: 'Project page', hint: 'github.com/ExhataQ/Xplayer: releases, source and where to report a problem.', actions: [appAction('Open', 'openProjectSite')] }
            ]
        }
    ]
};
