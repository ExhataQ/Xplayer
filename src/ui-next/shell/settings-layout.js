// The Settings layout (tasks PA-11, reworked twice): a menu bar of category tabs (General, Playback, Library, AI, Data) under the title,
// sticky while the page scrolls. A tab shows its own sections; Settings opens on General. The engine still draws every setting and
// owns every id and handler: sections are only moved and shown or hidden, never rebuilt. A section this file does not know goes to a "More" page so a new engine section never vanishes.
//
// Things that only belong to the previous interface are hidden here, in the new screen only (the engine page is shared with the
// old screen and stays as it is): the History shortcut buttons, the old Theme Color block, the engine's own Interface section and
// the "Change Music Folder (Legacy)" button. Two labels lose their old-interface wording ("Smart Shuffle v1", "(new interface)").
import { el, tabs } from '../components/index.js';

export const SETTINGS_GROUPS = [
    { id: 'general', label: 'General', icon: 'sliders-horizontal', summary: 'Appearance, window and startup screen', titles: ['Appearance', 'Window', 'Interface', 'Startup screen'] },
    { id: 'playback', label: 'Playback', icon: 'volume-2', summary: 'Crossfade, fades, volume levelling, waveform and Smart Shuffle', titles: ['Playback', 'Player bar', 'Smart Shuffle'] },
    { id: 'library', label: 'Library', icon: 'folder', summary: 'Music folders and where downloads are saved', titles: ['Music Library', 'Play from URL'] },
    { id: 'ai', label: 'AI', icon: 'sparkles', summary: 'Assistant, provider and privacy', titles: ['AI'] },
    { id: 'data', label: 'Data', icon: 'download', summary: 'Backup, restore and advanced options', titles: ['Backup', 'Advanced'] }
];
const MORE = { id: 'more', label: 'More', icon: 'ellipsis', summary: 'Everything else', titles: [] };

const titleOf = (section) => section.querySelector(':scope > .settings-section-title')?.textContent.trim() || '';

function groupOf(title) {
    for (const group of SETTINGS_GROUPS) if (group.titles.some((t) => title.startsWith(t))) return group;
    return MORE;
}

function scrollerOf(node) {
    for (let n = node.parentElement; n; n = n.parentElement) {
        const overflow = getComputedStyle(n).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') return n;
    }
    return document.scrollingElement;
}

// Which tab is open. The engine draws Settings again after some actions (coming back from Advanced Settings, for one), so the
// tab is remembered here and the next draw opens on it. Opening Settings from the rail starts over on the first tab.
let currentPage = null;
export function resetSettingsPage() {
    currentPage = null;
}

const hideOld = (node) => {
    node.hidden = true;
    node.dataset.oldUi = '';
};
const isOld = (node) => node.dataset.oldUi !== undefined;

/** Hides what belongs to the previous interface and fixes the two labels. Safe to run twice. */
function retireOldInterface(content, sections) {
    for (const button of content.querySelectorAll('.settings-panel-actions > .settings-action-btn')) hideOld(button); // View Play History, Search History
    for (const section of sections) {
        const title = titleOf(section);
        if (title === 'Theme Color') hideOld(section); // five swatches that set an old body class; Appearance replaces it
        else if (title === 'Interface' && !section.classList.contains('appearance')) hideOld(section); // the engine's switch; Appearance has the new one
        else if (title === 'Music Library') {
            for (const legacy of section.querySelectorAll('[data-action="changeMusicFolder"]')) hideOld(legacy);
            if (![...section.children].some((child) => !child.matches('.settings-section-title') && !isOld(child))) hideOld(section);
        } else if (title === 'Smart Shuffle v1') section.querySelector(':scope > .settings-section-title').textContent = 'Smart Shuffle';
    }
    for (const label of content.querySelectorAll('.settings-threshold-row > span:first-child')) {
        if (label.textContent.trim() === 'Background (new interface)') label.textContent = 'Background';
    }
}

/** Called after the engine has drawn Settings (and Appearance and the AI section are in). Safe to call again; it does nothing twice. */
export function layoutSettings(host) {
    const content = host.querySelector('.settings-panel-content');
    const title = content?.querySelector(':scope > .settings-panel-title');
    const actions = content?.querySelector(':scope > .settings-panel-actions');
    if (!content || !title || !actions || content.querySelector(':scope > .settings-menu')) return;
    const sections = [...actions.querySelectorAll(':scope > .settings-section')];
    if (!sections.length) return;
    retireOldInterface(content, sections);

    // Group the sections, in order, and let the folder list the engine draws right after "Music Library" travel with it.
    const rank = (s) => [...SETTINGS_GROUPS, MORE].indexOf(groupOf(titleOf(s)));
    const ordered = sections.map((s, i) => ({ s, i, r: rank(s) })).sort((a, b) => a.r - b.r || a.i - b.i);
    const members = [];
    for (const { s } of ordered) {
        const group = groupOf(titleOf(s));
        const tail = [];
        for (let n = s.nextElementSibling; n && n.matches('.library-locations-section'); n = n.nextElementSibling) tail.push(n);
        for (const node of [s, ...tail]) {
            node.dataset.group = group.id;
            members.push(node);
        }
        actions.append(s, ...tail);
    }
    const present = [...SETTINGS_GROUPS, MORE].filter((g) => members.some((n) => n.dataset.group === g.id && !isOld(n)));

    // The header: the engine's own title and a line under it that says what the open tab holds.
    const sub = el('div', { class: 'settings-panel-sub' });
    const head = el('div', { class: 'settings-head' });
    title.before(head);
    head.append(el('div', { class: 'settings-head__text' }, title, sub));

    // The menu bar: one tab per group. A tab carries data-page so a test or a shortcut can reach it by group id.
    const menu = tabs({ label: 'Settings sections', items: present.map((g) => ({ id: g.id, label: g.label, icon: g.icon })), value: present[0].id, onChange: (id) => show(id) });
    for (const node of menu.el.querySelectorAll('.tab')) node.dataset.page = node.dataset.id;
    const bar = el('div', { class: 'settings-menu' }, menu.el);
    head.after(bar);
    actions.setAttribute('role', 'tabpanel');

    const scroller = scrollerOf(content);
    const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function show(id) {
        const group = present.find((g) => g.id === id) || present[0];
        currentPage = group.id;
        content.dataset.settingsPage = group.id;
        menu.setValue(group.id);
        actions.setAttribute('aria-labelledby', menu.el.querySelector('[aria-selected="true"]')?.id || '');
        for (const node of members) node.hidden = isOld(node) || node.dataset.group !== group.id;
        sub.textContent = group.summary;
        scroller.scrollTop = 0;
        actions.classList.remove('is-entering');
        if (!reduce()) {
            void actions.offsetWidth; // restart the entrance
            actions.classList.add('is-entering');
        }
    }

    show(currentPage);
}
