// Help > About: a dialog with the version, where the app runs from, the licence and the project page.
// The numbers come from the main process (electron/app-info.js getInfo). Without the desktop app (a plain browser, the tests) the dialog
// still opens and says what it can: the name, the licence and "unknown" for the rest.
import { openDialog, el } from '../components/index.js';
import { openLogViewer } from './log-viewer.js';

const LICENCE = 'ISC, free and open source';
const MODES = { portable: 'Portable (data beside the program)', installed: 'Installed (data in your user profile)', dev: 'Development run' };

const api = () => window.desktopApi;
const has = (name) => Boolean(api() && typeof api().supports === 'function' && api().supports(name));

// A version with a suffix ("1.0.0-beta.1") is a pre-release.
export const releaseKind = (version) => (/-/.test(String(version || '')) ? 'Pre-release' : '');

// Only the folder's own name: a full path would show the user name (and a screenshot of About goes into bug reports).
export const dataFolderName = (dir) => String(dir || '').replace(/[\\/]+$/, '').split(/[\\/]/).pop();

async function readInfo() {
    if (!has('app.getAppInfo')) return null;
    try {
        return await api().app.getAppInfo();
    } catch (_) {
        return null;
    }
}

export async function openAbout() {
    const info = await readInfo();
    const version = (info && info.version) || '';
    const kind = releaseKind(version);

    const rows = [
        ['Version', version || 'unknown'],
        ['Electron', (info && info.electron) || 'unknown'],
        ['Runs as', (info && (MODES[info.mode] || info.mode)) || 'unknown'],
        ['Data folder', dataFolderName(info && info.dataDir) || 'unknown'],
        ['Licence', LICENCE]
    ];
    const list = el('dl', { class: 'about__list' });
    for (const [label, value] of rows) list.append(el('dt', {}, label), el('dd', {}, value));

    const body = el(
        'div',
        { class: 'about' },
        el('div', { class: 'about__head' }, el('h3', { class: 'about__name' }, 'Xplayer'), version ? el('span', { class: 'about__version' }, version) : '', kind ? el('span', { class: 'about__badge' }, kind) : ''),
        el('p', { class: 'about__tagline' }, 'A free, local-first music player for Windows. Your library, covers and settings stay on this computer.'),
        list
    );

    // A button that opens a page or a folder keeps the dialog open: onClick returns false (see components/dialog.js).
    const keepOpen = (name) => async () => {
        if (has(`app.${name}`)) await api().app[name]();
        return false;
    };
    const actions = [
        ...(has('app.openProjectSite') ? [{ label: 'Project page', value: 'site', onClick: keepOpen('openProjectSite') }] : []),
        ...(has('app.readLog') ? [{ label: 'Open logs', value: 'logs', onClick: async () => (openLogViewer(), false) }] : []),
        { label: 'Close', value: 'close', variant: 'primary', autofocus: true }
    ];
    return openDialog({ title: 'About Xplayer', body, actions });
}
