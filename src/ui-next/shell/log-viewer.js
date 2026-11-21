// Help > Open logs: the last lines of the app's log in a dialog, like a console. The main process removes paths, file addresses and the
// user name before the text leaves it (electron/app-info.js readLog), so nothing private reaches the page. "Open folder" shows the files in Explorer.
import { openDialog, el } from '../components/index.js';
import { notify } from './notify.js';

const api = () => window.desktopApi;
const has = (name) => Boolean(api() && typeof api().supports === 'function' && api().supports(name));

export async function openLogViewer() {
    let lines = [];
    try {
        const answer = await api().app.readLog();
        lines = (answer && answer.lines) || [];
    } catch (_) {
        notify({ title: 'Could not read the log', kind: 'error', where: 'toast' });
        return null;
    }
    const text = lines.length ? lines.join('\n') : 'The log is empty.';
    const box = el('pre', { class: 'log-viewer', tabindex: '0' }, text);
    const keepOpen = (run) => async () => {
        await run();
        return false;
    };
    const actions = [
        { label: 'Copy', value: 'copy', onClick: keepOpen(() => navigator.clipboard.writeText(text).then(() => notify({ title: 'Log copied', kind: 'success', where: 'toast' }), () => {})) },
        ...(has('app.openLogsFolder') ? [{ label: 'Open folder', value: 'folder', onClick: keepOpen(() => api().app.openLogsFolder()) }] : []),
        { label: 'Close', value: 'close', variant: 'primary', autofocus: true }
    ];
    const done = openDialog({ title: 'Log', body: [el('p', { class: 'log-viewer__note' }, 'The last lines of main.log. Paths, file addresses and your user name are removed.'), box], wide: true, actions });
    requestAnimationFrame(() => (box.scrollTop = box.scrollHeight)); // newest at the bottom, as in a console
    return done;
}
