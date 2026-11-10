// The About section of Settings (task 1.4 and 1.5 of .agent/archive/dev-plan/DEV-PLAN.md): the version, the data folder, and the diagnostics text.
//
// It lives in the Data tab. The numbers come from the main process (electron/app-info.js); with no desktop app around (a plain
// browser, the tests) the buttons stay disabled and the version reads "unknown".

import { el } from '../components/index.js';

function row(title, hint, control) {
    return el('div', { class: 'appearance__row' }, el('div', { class: 'appearance__label' }, el('div', { class: 'appearance__title' }, title), hint ? el('div', { class: 'appearance__hint' }, hint) : ''), control);
}

function actionButton(label, name, run) {
    const button = el('button', { type: 'button', class: 'about__button', 'data-action-local': name }, label);
    const api = window.desktopApi;
    if (!api || typeof api.supports !== 'function' || !api.supports('app.' + run)) {
        button.disabled = true;
        return button;
    }
    button.addEventListener('click', async () => {
        button.disabled = true;
        try {
            await api.app[run]();
            if (run === 'copyDiagnostics') button.textContent = 'Copied';
        } catch (e) {
            button.textContent = 'Could not do that';
        }
        setTimeout(() => {
            button.disabled = false;
            button.textContent = label;
        }, 1500);
    });
    return button;
}

// Start and stop the memory recording, and copy its summary (task X2). The recording is off every time the app starts.
function recordingControl() {
    const toggle = el('button', { type: 'button', class: 'about__button', 'data-action-local': 'perf-record', 'aria-pressed': 'false' }, 'Start recording');
    const summary = el('button', { type: 'button', class: 'about__button', 'data-action-local': 'perf-summary' }, 'Copy summary');
    const api = window.desktopApi;
    if (!api || typeof api.supports !== 'function' || !api.supports('app.perfRecording') || !api.supports('app.copyPerfSummary')) {
        toggle.disabled = true;
        summary.disabled = true;
        return el('div', { class: 'about__control' }, toggle, summary);
    }
    const paint = (on) => {
        toggle.textContent = on ? 'Stop recording' : 'Start recording';
        toggle.setAttribute('aria-pressed', String(on));
    };
    api.app.perfRecording().then((answer) => paint(Boolean(answer && answer.recording))).catch(() => {});
    toggle.addEventListener('click', async () => {
        const wasOn = toggle.getAttribute('aria-pressed') === 'true';
        toggle.disabled = true;
        try {
            const answer = await api.app.perfRecording(!wasOn);
            paint(Boolean(answer && answer.recording));
        } catch (e) {
            toggle.textContent = 'Could not do that';
            setTimeout(() => paint(wasOn), 1500);
        }
        toggle.disabled = false;
    });
    summary.addEventListener('click', async () => {
        summary.disabled = true;
        try {
            await api.app.copyPerfSummary();
            summary.textContent = 'Copied';
        } catch (e) {
            summary.textContent = 'Could not do that';
        }
        setTimeout(() => {
            summary.disabled = false;
            summary.textContent = 'Copy summary';
        }, 1500);
    });
    return el('div', { class: 'about__control' }, toggle, summary);
}

/** The section element. The version line fills in when the main process answers. */
export function buildAboutSection() {
    const version = el('div', { class: 'appearance__hint', 'data-about': 'version' }, 'Version unknown');
    const where = el('div', { class: 'appearance__hint', 'data-about': 'folder' }, '');
    const api = window.desktopApi;
    if (api && typeof api.supports === 'function' && api.supports('app.getAppInfo')) {
        api.app.getAppInfo().then((info) => {
            if (!info) return;
            version.textContent = `Version ${info.version || 'unknown'}${info.mode === 'dev' ? ' (development run)' : ''}, Electron ${info.electron}`;
            where.textContent = info.dataDir || '';
        }).catch(() => {});
    }
    return el(
        'div',
        { class: 'settings-section appearance', 'data-about-section': '' },
        el('div', { class: 'settings-section-title' }, 'About'),
        row('Version', null, version),
        row('Data folder', 'Your library, covers, settings and logs. Copy this folder to move everything.', el('div', { class: 'about__control' }, where, actionButton('Open data folder', 'open-data-folder', 'openDataFolder'))),
        row('Diagnostics', 'Copies the version, the mode, how much memory each part of the app uses, and the last log lines for a bug report. Paths are removed; no song names or keys are included.', actionButton('Copy diagnostics', 'copy-diagnostics', 'copyDiagnostics')),
        row('Memory recording', 'While on, one line is added every 30 seconds to logs/perf.csv in the data folder: memory per part of the app, CPU, and the name of the open view. Numbers only, kept on this computer. It is off each time the app starts. Copy summary puts the totals on the clipboard to send with a bug report.', recordingControl())
    );
}
