// The welcome screen of a first start: a page over the whole window (the title bar floats above it with the window buttons only) that asks a few things
// once. The main process asks for it when there is no library yet (electron/main.js openFullWindow); the engine's old box (js/ui/06b-modals.js)
// sends the cancelable 'xplayer:welcome' event first, and this answers it.
//
// Three steps: hello, make it yours (light or dark, gapless, minimise on close, the Windows default app), and where the music is. The folder box
// is Settings' own box (same classes, so the same look and selection). "Skip setup" is on every step, and so are Esc and the title bar: skipping
// is a choice too, remembered so the screen does not come back on every start.
//
// Motion: steps slide and their parts rise one after the other, buttons ripple and press in, and the screen closes with an iris that shrinks into
// the button that was pressed. All of it is transform and opacity only, and off with "reduce motion" (reducedMotion(), and base.css).

import { el, iconEl, button, reducedMotion } from '../components/index.js';
import { engineAction, engineCall } from '../adapter/engine-api.js';
import { logo } from '../startup/logo.js';
import { getAppearance, setAppearance } from './appearance.js';
import { preview } from './theme-picker.js';

const SEEN_KEY = 'xplayer.ui-next.welcomed';
const THEMES = [
    { id: 'warm-graphite', label: 'Dark' },
    { id: 'light', label: 'Light' }
];
const FOLDER_FEEDBACK = { duplicate: 'That folder is already in the list.', failed: 'Could not add that folder.' };
const LEAVE_MS = 110; // a step leaving (the entering one is css)
const IRIS_MS = 400;
const DONE_PAUSE_MS = 500; // how long "Library ready" shows before the screen closes

const seen = () => {
    try {
        return localStorage.getItem(SEEN_KEY) === '1';
    } catch (e) {
        return false; // storage can be blocked; the screen then simply shows again next time
    }
};
const markSeen = () => {
    try {
        localStorage.setItem(SEEN_KEY, '1');
    } catch (e) {
        // best effort, see seen()
    }
};
const supports = (name) => Boolean(window.desktopApi && typeof window.desktopApi.supports === 'function' && window.desktopApi.supports(name));
const folderName = (path) => String(path).split(/[\\/]/).filter(Boolean).pop() || path;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
// Settings draws these with Font Awesome, scoped to its own panel; here the same pictures come from the icon set.
const ICON_OF = { plus: 'plus', 'trash-alt': 'trash-2', folder: 'folder', 'folder-open': 'folder' };
const fa = (name) => iconEl(ICON_OF[name], { size: 16 });

// Runs a change with the page's cross-fade when the browser has one, so a theme change is a fade and not a flash.
const crossfade = (change) => (!reducedMotion() && typeof document.startViewTransition === 'function' ? document.startViewTransition(change) : change());

// The parts of a step rise one after the other (css reads --i).
function staggered(section) {
    [...section.children].forEach((child, i) => child.style.setProperty('--i', String(i)));
    return section;
}

// A row with a title, a line of help and a control on the right.
const row = (title, text, control, extra) => el('div', { class: 'welcome__row' }, el('div', {}, el('strong', {}, title), el('span', {}, text), extra || ''), control);

function toggle(label, checked, onChange) {
    const input = el('input', { type: 'checkbox', role: 'switch', 'aria-label': label });
    input.checked = checked;
    input.addEventListener('change', () => onChange(input.checked));
    return el('label', { class: 'welcome__switch' }, input, el('span', { class: 'welcome__switch-track', 'aria-hidden': 'true' }));
}

function stepHello() {
    const mark = el('div', { class: 'welcome__mark' });
    mark.innerHTML = logo('x', { size: 64 });
    const hero = el('div', { class: 'welcome__hero', 'aria-hidden': 'true' }, el('span', { class: 'welcome__ring' }), el('span', { class: 'welcome__ring welcome__ring--late' }), mark);
    const bars = el('div', { class: 'welcome__eq', 'aria-hidden': 'true' }, ...[0, 1, 2, 3, 4, 5, 6].map((i) => el('span', { style: `--b: ${i}` })));
    return staggered(el('section', { class: 'welcome__step welcome__step--hello' }, hero, el('h2', { class: 'welcome__headline', id: 'welcome-title' }, 'Welcome to Xplayer'), el('p', { class: 'welcome__text' }, 'Let’s get you set up. It takes a minute.'), bars));
}

// The default app row says how many music file types already open with Xplayer, and looks again when the person comes back from Windows.
function defaultAppRow(listen) {
    const api = window.desktopApi;
    const status = el('span', { class: 'welcome__status', role: 'status' });
    const open = button({ label: 'Open default apps', variant: 'outline', disabled: !supports('app.openDefaultApps') });
    const look = async () => {
        if (!supports('app.getDefaultAppStatus')) return;
        try {
            const state = await api.app.getDefaultAppStatus();
            if (!state || !state.total) return;
            status.textContent = state.ours === state.total ? 'Xplayer opens all your music files.' : state.ours > 0 ? `Xplayer opens ${state.ours} of ${state.total} music file types.` : 'Xplayer is not the default yet.';
            status.classList.toggle('is-done', state.ours === state.total);
        } catch (e) {
            // no status: the button still works
        }
    };
    open.addEventListener('click', async () => {
        try {
            await api.app.openDefaultApps();
        } catch (e) {
            // Windows settings did not open; the same button is in Settings > Opening music files.
        }
    });
    listen(window, 'focus', look);
    look();
    return row('Default music app', 'Windows lets only you choose it. The button opens Xplayer’s page in Windows settings: press Set default there.', open, status);
}

function stepYours(listen) {
    const now = getAppearance();
    const grid = el('div', { class: 'welcome__themes', role: 'radiogroup', 'aria-label': 'Theme' });
    const cards = THEMES.map((theme) => {
        const card = el('button', { type: 'button', class: 'theme-card', role: 'radio', 'aria-checked': String(theme.id === now.theme), 'data-theme-id': theme.id }, preview(), el('span', { class: 'theme-card__name' }, theme.label));
        card.addEventListener('click', () => {
            for (const other of cards) other.setAttribute('aria-checked', String(other === card));
            crossfade(() => setAppearance({ theme: theme.id }));
        });
        return card;
    });
    grid.append(...cards);
    const playback = engineCall('getAudioPlaybackSettings') || {};
    const windowSettings = engineCall('getWindowSettings') || {};
    return staggered(
        el(
            'section',
            { class: 'welcome__step' },
            el('h2', { class: 'welcome__headline', id: 'welcome-title' }, 'Make it yours'),
            grid,
            el(
                'div',
                { class: 'welcome__rows' },
                row('Gapless playback', 'Songs follow each other with no pause, which suits live albums and mixes.', toggle('Gapless playback', playback.gaplessEnabled !== false, (on) => engineAction('setAudioPlaybackSetting', 'gaplessEnabled', on))),
                row('Minimise when closing', 'The close button minimises the window, so music keeps playing.', toggle('Minimise when closing', Boolean(windowSettings.minimizeOnClose), (on) => engineAction('setMinimizeOnClose', on))),
                defaultAppRow(listen)
            )
        )
    );
}

// The folder box is Settings' (same classes and markup), so the two look and behave alike: click selects, Ctrl or Shift extends, Ctrl+A selects
// all, Remove Folder removes the selected, and folders can be dropped on the box.
function stepMusic(ctl) {
    const api = window.desktopApi;
    const canPick = supports('library.addMusicFolder');
    let selected = [];
    let known = null; // the folders of the last drawing, to animate only the new ones
    const note = el('p', { class: 'welcome__note', role: 'status' });
    const list = el('div', { class: 'library-locations-list', tabindex: '0', role: 'listbox', 'aria-multiselectable': 'true', 'aria-label': 'Music folders' });
    const add = el('button', { type: 'button', class: 'library-locations-add-btn', disabled: !canPick }, fa('plus'), 'Add Folder');
    const del = el('button', { type: 'button', class: 'library-locations-add-btn library-locations-danger', disabled: true }, fa('trash-alt'), 'Remove Folder');
    ctl.list = list;

    const items = () => [...list.querySelectorAll('.library-location-item')];
    const paint = () => {
        items().forEach((item) => item.classList.toggle('selected', selected.includes(item.dataset.folder)));
        del.disabled = selected.length === 0;
    };
    function pick(item, event) {
        const all = items();
        const path = item.dataset.folder;
        const last = selected.length ? all.findIndex((other) => other.dataset.folder === selected[selected.length - 1]) : -1;
        if (event.shiftKey && last >= 0) {
            const [a, b] = [Math.min(last, all.indexOf(item)), Math.max(last, all.indexOf(item))];
            selected = all.slice(a, b + 1).map((other) => other.dataset.folder);
        } else if (event.ctrlKey || event.metaKey) {
            selected = selected.includes(path) ? selected.filter((p) => p !== path) : [...selected, path];
        } else {
            selected = selected.length === 1 && selected[0] === path ? [] : [path];
        }
        paint();
    }
    function render(folders) {
        ctl.folders = folders;
        selected = selected.filter((path) => folders.includes(path));
        if (folders.length === 0) {
            list.replaceChildren(el('div', { class: 'empty-queue welcome__empty' }, fa('folder-open'), el('p', {}, 'No folders added'), el('small', {}, canPick ? 'Add a folder, or drop one here.' : 'Folders can be added in the desktop app.')));
        } else {
            list.replaceChildren(
                ...folders.map((path) => {
                    const item = el('div', { class: `library-location-item${known && !known.includes(path) ? ' is-new' : ''}`, 'data-folder': path, role: 'option' }, el('div', { class: 'library-location-name' }, fa('folder'), el('span', {}, folderName(path))), el('div', { class: 'library-location-path', title: path }, path));
                    item.addEventListener('click', (event) => pick(item, event));
                    return item;
                })
            );
        }
        known = folders;
        paint();
        ctl.update();
    }
    const refresh = async () => {
        try {
            render((canPick && (await api.library.getMusicFolders())) || []);
        } catch (e) {
            render([]);
        }
    };
    ctl.addFolders = async (paths) => {
        if (!canPick) return;
        let problem = '';
        try {
            for (const path of paths.length ? paths : [undefined]) {
                const result = await api.library.addMusicFolder(path);
                if (result && !result.success && result.reason !== 'cancelled') problem = FOLDER_FEEDBACK[result.reason] || FOLDER_FEEDBACK.failed;
            }
        } catch (e) {
            problem = FOLDER_FEEDBACK.failed;
        }
        note.textContent = problem;
        await refresh();
    };
    async function removeSelected() {
        const gone = items().filter((item) => selected.includes(item.dataset.folder));
        gone.forEach((item) => item.classList.add('is-leaving'));
        if (gone.length && !reducedMotion()) await wait(LEAVE_MS);
        for (const path of selected) {
            try {
                await api.library.removeMusicFolder(path);
            } catch (e) {
                // the list below shows what is really there
            }
        }
        selected = [];
        refresh();
    }
    add.addEventListener('click', () => ctl.addFolders([]));
    del.addEventListener('click', removeSelected);
    list.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'a') {
            event.preventDefault();
            selected = items().map((item) => item.dataset.folder);
            paint();
        }
    });
    refresh();
    return staggered(
        el(
            'section',
            { class: 'welcome__step' },
            el('h2', { class: 'welcome__headline', id: 'welcome-title' }, 'Where is your music?'),
            el('p', { class: 'welcome__text' }, 'Xplayer reads the tags and covers and builds your library. Your files are not moved or changed.'),
            el('div', { class: 'library-locations-section' }, el('div', { class: 'library-locations-header' }, el('span', { class: 'library-locations-title' }, 'Music Library Folders'), el('div', { class: 'library-locations-header-buttons' }, add, del)), el('div', { class: 'library-locations-list-container' }, list)),
            note
        )
    );
}

/** Opens the welcome screen. Resolves when it is closed. */
export function showWelcome() {
    const ctl = { folders: [], list: null, update: () => {}, addFolders: () => {} };
    let index = -1;
    let moving = false;
    let closing = false;
    let scanning = false;
    let finish;
    const closed = new Promise((resolve) => (finish = resolve));

    // Listeners that belong to the step on screen are removed when it leaves.
    let stepListeners = [];
    const listen = (target, type, handler) => {
        target.addEventListener(type, handler);
        stepListeners.push(() => target.removeEventListener(type, handler));
    };
    const steps = [stepHello, () => stepYours(listen), () => stepMusic(ctl)];

    const stage = el('div', { class: 'welcome__stage' });
    const dots = el('div', { class: 'welcome__dots', 'aria-hidden': 'true' }, ...steps.map(() => el('span', { class: 'welcome__dot' })));
    const back = button({ label: 'Back', variant: 'ghost', onClick: () => go(index - 1) });
    const next = button({ label: 'Next', variant: 'primary', onClick: () => go(index + 1) });
    const start = button({ label: 'Start without music', variant: 'primary', onClick: () => startApp(start) });
    const skip = button({ label: 'Skip setup', variant: 'ghost', onClick: () => close(skip) });
    const nav = el('div', { class: 'welcome__nav' }, skip, el('span', { class: 'welcome__spacer' }), back, next, start);
    const scanText = el('span', { class: 'welcome__scan-text' });
    const scanBar = el('span', { class: 'welcome__scan-bar' }, el('i', {}));
    const scan = el('div', { class: 'welcome__scan', role: 'status', hidden: true }, scanBar, scanText);
    const root = el('div', { class: 'welcome', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'welcome-title' }, el('div', { class: 'welcome__page' }, dots, stage, nav, scan));

    // Everything but the title bar is out of reach while the screen is open (the title bar keeps the window buttons).
    const behind = [...document.querySelectorAll('.app > :not(.titlebar), [data-legacy-slot="host"]')];
    for (const node of behind) node.setAttribute('inert', '');
    const trap = (event) => {
        if (event.key === 'Escape') return close(null);
        if (event.key !== 'Tab') return;
        const items = [...root.querySelectorAll('button:not([hidden]):not(:disabled), input, [tabindex="0"]')].filter((node) => node.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) (event.preventDefault(), last.focus());
        else if (!event.shiftKey && document.activeElement === last) (event.preventDefault(), first.focus());
    };
    document.addEventListener('keydown', trap);
    document.body.classList.add('welcome-open');

    // A soft ring grows from the point that was pressed (buttons, theme cards, the folder buttons).
    root.addEventListener('pointerdown', (event) => {
        const target = event.target instanceof Element ? event.target.closest('.btn, .theme-card, .library-locations-add-btn') : null;
        if (!target || target.disabled || reducedMotion()) return;
        const box = target.getBoundingClientRect();
        const size = Math.max(box.width, box.height) * 2;
        const ring = el('span', { class: 'welcome__ripple', style: `width:${size}px;height:${size}px;left:${event.clientX - box.left - size / 2}px;top:${event.clientY - box.top - size / 2}px` });
        target.append(ring);
        ring.addEventListener('animationend', () => ring.remove(), { once: true });
    });

    // The iris: the screen shrinks into the point `from` (the button that was pressed, the middle for Esc) and the app comes up behind it.
    async function close(from) {
        if (closing || scanning) return;
        closing = true;
        document.removeEventListener('keydown', trap);
        stepListeners.forEach((off) => off());
        for (const node of behind) node.removeAttribute('inert');
        markSeen();
        document.body.classList.replace('welcome-open', 'welcome-closing'); // the title bar's buttons come back at once
        if (!reducedMotion() && typeof root.animate === 'function') {
            const area = root.getBoundingClientRect();
            const point = from ? from.getBoundingClientRect() : null;
            const x = point ? point.left + point.width / 2 - area.left : area.width / 2;
            const y = point ? point.top + point.height / 2 - area.top : area.height / 2;
            const radius = Math.hypot(Math.max(x, area.width - x), Math.max(y, area.height - y));
            const circle = (r) => `circle(${r}px at ${x}px ${y}px)`;
            for (const node of behind) node.animate([{ opacity: 0.35, transform: 'scale(0.97)' }, { opacity: 1, transform: 'none' }], { duration: IRIS_MS, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' });
            await root.animate({ clipPath: [circle(radius), circle(0)] }, { duration: IRIS_MS, easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fill: 'forwards' }).finished.catch(() => {});
        }
        root.remove();
        document.body.classList.remove('welcome-closing');
        finish();
    }

    // Start: with folders, scan them (the page shows the progress), show the library and close; without, just close.
    async function startApp(from) {
        if (ctl.folders.length === 0) return close(from);
        scanning = true;
        markSeen();
        nav.hidden = true;
        scan.hidden = false;
        scanText.textContent = 'Starting the scan…';
        window.desktopApi.library.onScanProgress?.((info) => {
            if (!scanning || !info) return;
            const percent = Math.max(0, Math.min(100, Math.round(Number(info.percent) || 0)));
            scanBar.firstChild.style.transform = `scaleX(${percent / 100})`;
            scanText.textContent = `Scanning ${percent}%${info.step ? ` · ${info.step}` : ''}`;
        });
        let result = null;
        try {
            result = await window.desktopApi.library.rebuildFromFolders();
        } catch (e) {
            result = null;
        }
        if (result && result.success) {
            engineAction('resetLibraryAfterRebuild', result.songs); // the same step Settings takes after a rebuild
            scanBar.firstChild.style.transform = 'scaleX(1)';
            scan.classList.add('is-done');
            scanText.textContent = `Your library is ready: ${(result.songs || []).length} songs`;
            await wait(reducedMotion() ? 0 : DONE_PAUSE_MS);
            scanning = false;
            return close(scan);
        }
        scanning = false;
        scan.hidden = true;
        nav.hidden = false;
        const note = stage.querySelector('.welcome__note');
        if (note) note.textContent = result && result.error ? String(result.error) : 'The scan did not finish. Try again, or skip and add folders in Settings.';
    }

    // A step leaves with a short slide, the next one rises in (css); the direction follows Back and Next.
    async function go(to) {
        to = Math.min(Math.max(to, 0), steps.length - 1);
        if (moving || to === index) return;
        moving = true;
        const direction = to >= index ? 1 : -1;
        const old = stage.firstElementChild;
        if (old && !reducedMotion()) await old.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translateX(${-28 * direction}px)` }], { duration: LEAVE_MS, easing: 'cubic-bezier(0.7, 0, 0.84, 0)', fill: 'forwards' }).finished.catch(() => {});
        stepListeners.forEach((off) => off());
        stepListeners = [];
        index = to;
        const last = index === steps.length - 1;
        ctl.update = () => {
            start.querySelector('.btn__label').textContent = ctl.folders.length > 0 ? 'Scan and start' : 'Start without music';
        };
        stage.style.setProperty('--shift', `${28 * direction}px`);
        stage.replaceChildren(steps[index]());
        [...dots.children].forEach((dot, i) => dot.classList.toggle('is-on', i <= index));
        back.hidden = index === 0;
        next.hidden = last;
        start.hidden = !last;
        if (last) ctl.update();
        moving = false;
    }

    // Folders dropped from Explorer on the screen go to the list. Only the box lights up (never the app or the screen), and only while the
    // music step is open; a drop on another step jumps there first. The drop is always answered so the window never opens the dropped item.
    const overBox = (on) => ctl.list && ctl.list.classList.toggle('drag-over-folder', on);
    root.addEventListener('dragover', (event) => {
        if (!Array.from(event.dataTransfer?.types || []).includes('Files')) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
        overBox(true);
    });
    root.addEventListener('dragleave', (event) => {
        if (!root.contains(event.relatedTarget)) overBox(false);
    });
    root.addEventListener('drop', async (event) => {
        event.preventDefault();
        overBox(false);
        const folders = engineCall('droppedFolderPaths', event.dataTransfer) || []; // readable only now, before any await
        if (folders.length === 0 || scanning) return;
        if (index !== steps.length - 1) await go(steps.length - 1);
        ctl.addFolders(folders);
    });

    document.body.append(root);
    go(0).then(() => next.focus({ preventScroll: true }));
    return closed;
}

/** Answers the engine's 'xplayer:welcome' event (shell.js calls this once at start). */
export function installWelcome() {
    document.addEventListener('xplayer:welcome', (event) => {
        event.preventDefault();
        if (!seen() && !document.querySelector('.welcome')) showWelcome();
    });
}
