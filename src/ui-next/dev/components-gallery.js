// Developer gallery of every ui-next component in every state (task A-05). Not part of the app UI.
// Forced states use the .is-hover, .is-active and .is-focus classes; the live examples below them are real.
import { button, iconButton, chipGroup, chip, textField, tabs, segmented, attachTooltip, createToaster, statusIndicator, progress, openDialog, confirmDialog, openMenu, emptyState, el } from '../components/index.js';

const root = document.documentElement;
const THEMES = ['warm-graphite', 'deep-forest', 'espresso-copper'];
const ACCENTS = ['theme', 'green', 'pink', 'purple', 'yellow', 'white'];

function switcher(containerId, values, current, apply) {
    const container = document.getElementById(containerId);
    const group = chipGroup({ items: values.map((v) => ({ value: v, label: v.replace(/-/g, ' ') })), value: current, label: containerId, onChange: apply });
    container.append(group.el);
}
switcher('themes', THEMES, 'warm-graphite', (v) => root.setAttribute('data-theme', v));
switcher('accents', ACCENTS, 'theme', (v) => (v === 'theme' ? root.removeAttribute('data-accent') : root.setAttribute('data-accent', v)));
switcher('directions', ['ltr', 'rtl'], 'ltr', (v) => root.setAttribute('dir', v));

const gallery = document.getElementById('gallery');
const section = (title, note, ...content) => {
    const surface = el('div', { class: 'surface' }, ...content);
    gallery.append(el('section', { id: title.toLowerCase().replace(/\W+/g, '-') }, el('h2', {}, title), el('p', {}, note), surface));
    return surface;
};
const cell = (caption, node, extra = '') => el('div', { class: `cell ${extra}`.trim() }, node, el('small', {}, caption));
const forced = (node, cls) => {
    node.classList.add(cls);
    return node;
};

/* Buttons */
const statesFor = (make) => [
    cell('default', make()),
    cell('hover', forced(make(), 'is-hover')),
    cell('active', forced(make(), 'is-active')),
    cell('focus', forced(make(), 'is-focus')),
    cell('disabled', make({ disabled: true })),
    cell('loading', make({ loading: true }))
];
section(
    'Buttons',
    'Primary is the one main action in a view. Outline is the default. Ghost is for quiet actions. Danger is for destructive ones.',
    ...['primary', 'outline', 'ghost', 'danger'].map((variant) => el('div', { class: 'row' }, ...statesFor((o = {}) => button({ label: variant === 'danger' ? 'Delete playlist' : 'Add folder', icon: variant === 'primary' ? 'plus' : undefined, variant, ...o })))),
    el('div', { class: 'row' }, cell('small', button({ label: 'Add folder', size: 'sm', icon: 'plus' })), cell('toggle off', button({ label: 'Compact', pressed: false, icon: 'list-music' })), cell('toggle on', button({ label: 'Compact', pressed: true, icon: 'list-music' })))
);

/* Icon buttons */
const iconStates = (make) => [cell('default', make()), cell('hover', forced(make(), 'is-hover')), cell('active', forced(make(), 'is-active')), cell('focus', forced(make(), 'is-focus')), cell('disabled', make({ disabled: true }))];
let shuffleOn = false;
const shuffle = iconButton({
    icon: 'shuffle',
    label: 'Shuffle',
    pressed: false,
    tooltip: { state: 'Off', shortcut: 'S' },
    onClick: () => {
        shuffleOn = !shuffleOn;
        shuffle.setAttribute('aria-pressed', String(shuffleOn));
        shuffle.tooltip.update({ state: shuffleOn ? 'On' : 'Off' });
    }
});
section(
    'Icon buttons',
    'Always have a text name (aria-label and tooltip). Toggles use aria-pressed and the accent color; hover the shuffle button, click it, and the tooltip state follows.',
    el('div', { class: 'row' }, ...iconStates((o = {}) => iconButton({ icon: 'heart', label: 'Favorite', ...o }))),
    el('div', { class: 'row' }, cell('pressed (live toggle)', shuffle), cell('pressed, forced', iconButton({ icon: 'repeat', label: 'Repeat', pressed: true })), cell('small', iconButton({ icon: 'x', label: 'Close', size: 'sm' })), cell('solid (transport)', iconButton({ icon: 'play', label: 'Play', variant: 'solid', tooltip: { shortcut: 'Space' } })), cell('solid, hover', forced(iconButton({ icon: 'pause', label: 'Pause', variant: 'solid' }), 'is-hover')), cell('solid, disabled', iconButton({ icon: 'play', label: 'Play', variant: 'solid', disabled: true })))
);

/* Chips */
section(
    'Chips',
    'One active at a time. The active chip uses the primary fill.',
    el('div', { class: 'row' }, cell('chip group (live)', chipGroup({ label: 'Library filter', value: 'all', items: [{ value: 'all', label: 'All' }, { value: 'playlists', label: 'Playlists', count: 12 }, { value: 'folders', label: 'Folders' }, { value: 'albums', label: 'Albums', count: 318 }, { value: 'artists', label: 'Artists', disabled: true }] }).el)),
    el('div', { class: 'row' }, cell('hover', forced(chip({ label: 'Albums' }), 'is-hover')), cell('active press', forced(chip({ label: 'Albums' }), 'is-active')), cell('focus', forced(chip({ label: 'Albums' }), 'is-focus')), cell('selected', chip({ label: 'Albums', pressed: true })), cell('disabled', chip({ label: 'Albums', disabled: true })))
);

/* Fields */
const field = (caption, opts, after) => {
    const f = textField({ label: 'Title', placeholder: 'Track title', ...opts });
    if (after) after(f);
    return cell(caption, f.el, 'cell--field');
};
const liveError = textField({ label: 'Playlist name', placeholder: 'My playlist', hint: 'Shown in the library', onInput: (v) => (v.trim() ? liveError.setHint('Shown in the library') : liveError.setError('Give the playlist a name.')) });
section(
    'Text fields',
    'Label above, hint or error below. An error adds an icon and text, never color alone. Search has its own icon and a clear button (Escape clears too).',
    el('div', { class: 'row' }, field('default', {}), field('hover', {}, (f) => f.el.querySelector('.field__control').classList.add('is-hover')), field('focus', { value: 'Glass Harbour' }, (f) => f.el.querySelector('.field__control').classList.add('is-focus')), field('filled', { value: 'Glass Harbour', hint: 'Shown in the library' })),
    el('div', { class: 'row' }, field('error', { value: 'x' }, (f) => f.setError('Titles need at least 2 characters.')), field('success', { value: 'Glass Harbour' }, (f) => f.setSuccess('Saved to the file tags.')), field('disabled', { value: 'Glass Harbour', disabled: true }), field('read-only', { value: 'Glass Harbour', readOnly: true })),
    el('div', { class: 'row' }, cell('search (live)', textField({ label: 'Find in library', search: true, placeholder: 'Find in library', value: 'tide' }).el, 'cell--field'), cell('live validation: clear the text', liveError.el, 'cell--field'), cell('right-to-left text (dir=auto)', textField({ label: 'Lyrics line', value: 'متن تازه برای آزمایش خط راست به چپ' }).el, 'cell--field'), cell('multiline', textField({ label: 'Notes', multiline: true, value: 'Line one\nLine two' }).el, 'cell--field'))
);

/* Tabs and segmented */
const lyricsTabs = tabs({ label: 'Lyrics mode', value: 'view', items: [{ id: 'view', label: 'Lyrics' }, { id: 'find', label: 'Find online', icon: 'search' }, { id: 'write', label: 'Write' }, { id: 'sync', label: 'Sync timing', disabled: true }] });
const hoverTabs = tabs({ label: 'Forced states', value: 'view', items: [{ id: 'view', label: 'Selected' }, { id: 'find', label: 'Hover' }, { id: 'write', label: 'Active' }] });
forced(hoverTabs.el.children[1], 'is-hover');
forced(hoverTabs.el.children[2], 'is-active');
section(
    'Tabs and segmented control',
    'Tabs switch between views of the same thing (the four lyrics modes). A segmented control switches a setting. Arrow keys, Home and End move and select.',
    el('div', { class: 'row' }, cell('tabs (live; the last one is disabled)', lyricsTabs.el, 'cell--wide'), cell('tabs, forced states', hoverTabs.el, 'cell--wide')),
    el('div', { class: 'row' }, cell('segmented (live)', segmented({ label: 'Density', value: 'comfortable', items: [{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }] }).el), cell('with icons and a disabled option', segmented({ label: 'Sort', value: 'a', items: [{ value: 'a', label: 'Name', icon: 'text-align-start' }, { value: 'b', label: 'Recent', icon: 'clock' }, { value: 'c', label: 'Count', icon: 'arrow-up-down', disabled: true }] }).el))
);

/* Tooltip */
const staticTip = (parts) => {
    const node = el('div', { class: 'tooltip static', role: 'presentation' }, el('div', { class: 'tooltip__head' }, el('span', { class: 'tooltip__name' }, parts.name), parts.state ? el('span', { class: 'tooltip__state' }, parts.state) : '', parts.shortcut ? el('kbd', { class: 'tooltip__shortcut' }, ...String(parts.shortcut).split(/(?<=.)\+(?=.)/).map((key) => el('span', { class: 'tooltip__key' }, key))) : ''), parts.description ? el('div', { class: 'tooltip__description' }, parts.description) : '');
    return node;
};
const hoverTarget = button({ label: 'Hover me (500 ms delay)', variant: 'outline' });
attachTooltip(hoverTarget, { name: 'Add music folder', description: 'Scan a folder and add its songs to the library.', shortcut: 'Ctrl+O' });
section(
    'Tooltips',
    'Name, current state, short description, shortcut. Appears after a delay, hides when the pointer leaves or the button is pressed, shows on keyboard focus, hides on Escape.',
    el('div', { class: 'row' }, cell('name only', staticTip({ name: 'Next' })), cell('name, state, shortcut', staticTip({ name: 'Shuffle', state: 'Off', shortcut: 'S' })), cell('with description', staticTip({ name: 'Add music folder', description: 'Scan a folder and add its songs to the library.', shortcut: 'Ctrl+O' })), cell('live', hoverTarget))
);

/* Toasts */
const toaster = createToaster({ host: document.body });
const toastCell = (label, data) => cell(label, button({ label, variant: 'outline', size: 'sm', onClick: () => toaster.show(data) }));
const staticToast = (kind, title, message) => {
    const host = el('div', { class: 'toaster static' });
    const t = createToaster({ host, max: 1 });
    t.show({ kind, title, message, duration: 0 });
    // the static copy lives in the gallery only; the live region above is not announced twice
    host.firstElementChild.removeAttribute('aria-label');
    return cell(kind, host.firstElementChild.firstElementChild);
};
section(
    'Toasts',
    'Quick confirmations and minor errors, bottom right above the player. Hover or focus pauses the timer. Repeats with the same id update in place.',
    el('div', { class: 'row' }, staticToast('info', 'Added to queue', 'Glass Harbour'), staticToast('success', 'Lyrics saved', 'Synced lines were written to the file.'), staticToast('error', 'Could not save tags', 'The file is open in another program.')),
    el('div', { class: 'row' }, toastCell('Show info', { kind: 'info', title: 'Added to queue', message: 'Glass Harbour' }), toastCell('Show success', { kind: 'success', title: 'Playlist created', message: 'Evening drive' }), toastCell('Show error with action', { id: 'save-error', kind: 'error', title: 'Could not save tags', message: 'The file is open in another program.', action: { label: 'Try again', onClick: () => toaster.show({ kind: 'success', title: 'Saved' }) } }), toastCell('Persistent', { kind: 'info', title: 'Stays until closed', duration: 0 }))
);

/* Status */
const live = statusIndicator({ state: 'running', label: 'Scanning 1,204 of 3,902' });
const liveProgress = progress({ value: 0.31, label: 'Scanning music folders' });
let tick = 0.31;
setInterval(() => {
    tick = tick >= 1 ? 0 : Math.min(1, tick + 0.04);
    liveProgress.set(tick);
    live.set(tick >= 1 ? 'success' : 'running', tick >= 1 ? 'Scan finished' : `Scanning ${Math.round(tick * 3902)} of 3,902`);
}, 700);
section(
    'Status and progress',
    'Every state has a shape and words as well as a color.',
    el('div', { class: 'row' }, ...['idle', 'running', 'success', 'error'].map((s) => cell(s, statusIndicator({ state: s, label: { idle: 'Library up to date', running: 'Scanning folders', success: 'Download finished', error: 'Download failed' }[s] }).el))),
    el('div', { class: 'row' }, cell('progress, known', progress({ value: 0.62, label: 'Download' }).el, 'cell--field'), cell('progress, unknown length', progress({ value: null, label: 'Extracting covers' }).el, 'cell--field'), cell('progress, error', (() => { const p = progress({ value: 0.4, label: 'Download' }); p.set(0.4, { error: true }); return p.el; })(), 'cell--field'), cell('live (loops)', el('div', { style: 'display:flex;flex-direction:column;gap:8px;width:240px' }, live.el, liveProgress.el))),
    el('div', { class: 'row' }, cell('bell with notice dot', el('div', { style: 'display:flex;align-items:center;gap:8px' }, iconButton({ icon: 'bell', label: 'Notifications' }), el('span', { class: 'notice-dot', role: 'img', 'aria-label': 'Something is running' }))))
);

/* Dialog */
const dialogButtons = [
    button({ label: 'Info dialog', onClick: () => openDialog({ title: 'About scanning', body: 'Xplayer reads tags from your files. Nothing leaves your computer.', actions: [{ label: 'Got it', variant: 'primary' }] }) }),
    button({ label: 'Confirm', onClick: async () => toaster.show({ kind: 'info', title: (await confirmDialog({ title: 'Remove folder?', message: 'The songs stay on disk. They disappear from the library.', confirmLabel: 'Remove' })) ? 'Removed' : 'Cancelled' }) }),
    button({ label: 'Destructive', variant: 'danger', onClick: () => openDialog({ title: 'Delete playlist?', body: 'This cannot be undone.', actions: [{ label: 'Cancel', autofocus: true }, { label: 'Delete', variant: 'danger' }] }) }),
    button({ label: 'Async fails', onClick: () => openDialog({ title: 'Save tags', body: 'Write the changes to the file?', actions: [{ label: 'Cancel' }, { label: 'Save', variant: 'primary', onClick: () => new Promise((_, no) => setTimeout(() => no(new Error('The file is open in another program. Close it and try again.')), 1200)) }] }) }),
    button({ label: 'Not dismissible', onClick: () => openDialog({ title: 'Updating library', body: 'Wait for the update to finish.', dismissible: false, actions: [{ label: 'Continue', variant: 'primary', onClick: () => new Promise((ok) => setTimeout(ok, 1500)) }] }) })
];
section('Dialogs', 'Native dialog: focus stays inside, Escape and backdrop click close it, focus returns to the button. Async actions show a spinner; a failure keeps the dialog open with a message.', el('div', { class: 'row' }, ...dialogButtons.map((b) => cell('', b))));

/* Menu */
const menuState = { sort: 'recent', showCovers: true };
function menuItems() {
    return [
        { type: 'heading', label: 'Sort by' },
        { label: 'Recently played', radio: true, checked: menuState.sort === 'recent', keepOpen: true, onSelect: () => (menuState.sort = 'recent') },
        { label: 'Name', radio: true, checked: menuState.sort === 'name', keepOpen: true, onSelect: () => (menuState.sort = 'name') },
        { type: 'separator' },
        { label: 'Show covers', checked: menuState.showCovers, onSelect: () => (menuState.showCovers = !menuState.showCovers) },
        { label: 'File', icon: 'folder', items: [{ label: 'Add music folder', icon: 'plus', shortcut: 'Ctrl+O' }, { label: 'Rescan library', shortcut: 'Ctrl+R' }, { label: 'More', items: [{ label: 'Nested item' }] }] },
        { label: 'Unavailable item', disabled: true, shortcut: 'Ctrl+Z' },
        { type: 'separator' },
        { label: 'Delete playlist', icon: 'x', danger: true, onSelect: () => toaster.show({ kind: 'info', title: 'Delete chosen' }) }
    ];
}
const menuButton = button({ label: 'Open menu', icon: 'chevron-down', onClick: () => openMenu({ anchor: menuButton, items: menuItems() }) });
const contextTarget = el('div', { class: 'surface', style: 'padding:var(--space-6);background:var(--surface-ground)', tabindex: '0' }, 'Right-click here for a context menu (or press Shift+F10)');
contextTarget.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    openMenu({ anchor: null, point: { x: event.clientX, y: event.clientY }, items: menuItems().slice(0, 5) });
});
const forcedMenu = el('ul', { class: 'menu', role: 'presentation', style: 'position:static;width:240px' }, ...[['Default item', ''], ['Hover item', 'is-hover'], ['Active item', 'is-active'], ['Disabled item', '']].map(([text, cls], i) => el('li', {}, el('button', { type: 'button', class: `menu__item ${cls}`, 'aria-disabled': i === 3 ? 'true' : null }, el('span', { class: 'menu__gutter' }), el('span', { class: 'menu__label' }, text)))));
section('Menus', 'Arrow keys, Home and End, type to jump, Right opens a submenu, Left or Escape goes back, Enter and Space choose, Tab closes. Radio and checkbox items show a check.', el('div', { class: 'row' }, cell('live (keyboard or mouse)', menuButton), cell('forced item states', forcedMenu), cell('context menu', contextTarget)));

/* Empty states */
section(
    'Empty, loading and error states',
    'The headline is the only serif text in chrome. Error says what happened and offers a next step.',
    el('div', { class: 'empty-row' }, el('div', {}, emptyState({ icon: 'list-music', title: 'No lyrics for this song', text: 'Find them online, write them yourself, or open an LRC file.', actions: [{ label: 'Find online', icon: 'search' }, { label: 'Write lyrics' }, { label: 'Open LRC file' }] })), el('div', {}, emptyState({ state: 'loading', title: 'Reading your library', text: 'This takes a moment the first time.' })), el('div', {}, emptyState({ state: 'error', title: 'Could not reach the lyrics service', text: 'Check your connection and try again.', actions: [{ label: 'Try again', variant: 'primary' }] })))
);
