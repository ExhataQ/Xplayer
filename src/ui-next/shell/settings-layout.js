// The Settings layout (tasks PA-11, reworked): Settings opens on a hub of category cards, and each card opens its own page with a
// back button. The engine still draws every setting and owns every id and handler: sections are only moved and shown or hidden,
// never rebuilt. A section this file does not know goes to a "More" page so a new engine section never vanishes.
//
// Things that only belong to the previous interface are hidden here, in the new screen only (the engine page is shared with the
// old screen and stays as it is): the History shortcut buttons, the old Theme Color block, the engine's own Interface section and
// the "Change Music Folder (Legacy)" button. Two labels lose their old-interface wording ("Smart Shuffle v1", "(new interface)").
import { el, iconEl, iconButton } from '../components/index.js';

export const SETTINGS_GROUPS = [
    { id: 'general', label: 'General', icon: 'sliders-horizontal', summary: 'Appearance, window and startup screen', titles: ['Appearance', 'Right Panel', 'Window', 'Interface', 'Startup screen'] },
    { id: 'playback', label: 'Playback', icon: 'volume-2', summary: 'Crossfade, fades, volume levelling, waveform and Smart Shuffle', titles: ['Playback', 'Player bar', 'Smart Shuffle'] },
    { id: 'library', label: 'Library', icon: 'folder', summary: 'Music folders and where downloads are saved', titles: ['Music Library', 'Play from URL'] },
    { id: 'ai', label: 'AI', icon: 'sparkles', summary: 'Assistant, provider and privacy', titles: ['AI'] },
    { id: 'data', label: 'Data', icon: 'download', summary: 'Backup, restore and advanced options', titles: ['Backup', 'Advanced'] }
];
const MORE = { id: 'more', label: 'More', icon: 'ellipsis', summary: 'Everything else', titles: [] };
const HUB = 'hub';

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

// Which page is open. The engine draws Settings again after some actions (coming back from Advanced Settings, for one), so the
// page is remembered here and the next draw opens on it. Opening Settings from the rail starts over on the hub.
let currentPage = HUB;
export function resetSettingsPage() {
    currentPage = HUB;
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
    if (!content || !title || !actions || content.querySelector(':scope > .settings-hub')) return;
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

    // The hub: one card per group.
    const hub = el('nav', { class: 'settings-hub', 'aria-label': 'Settings sections' });
    for (const g of present) {
        hub.append(
            el(
                'button',
                { type: 'button', class: 'settings-card', 'data-page': g.id, onClick: () => show(g.id, { focus: true }) },
                el('span', { class: 'settings-card__icon' }, iconEl(g.icon, { size: 20 })),
                el('span', { class: 'settings-card__text' }, el('span', { class: 'settings-card__title' }, g.label), el('span', { class: 'settings-card__summary' }, g.summary)),
                el('span', { class: 'settings-card__chevron' }, iconEl('chevron-right', { size: 18 }))
            )
        );
    }
    actions.before(hub);

    // The header: the back button, the title (the engine's own element) and a line under it.
    const back = iconButton({ icon: 'chevron-left', label: 'Back to Settings', onClick: () => show(HUB, { focus: true }) });
    back.classList.add('settings-back');
    const sub = el('div', { class: 'settings-panel-sub' });
    const head = el('div', { class: 'settings-head' });
    title.before(head);
    title.tabIndex = -1;
    head.append(back, el('div', { class: 'settings-head__text' }, title, sub));

    const scroller = scrollerOf(content);
    const reduce = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let opener = null; // the card to put focus back on when you go back

    function show(id, { focus = false } = {}) {
        const group = present.find((g) => g.id === id);
        const page = group ? id : HUB;
        if (page !== HUB) opener = hub.querySelector(`[data-page="${page}"]`);
        currentPage = page;
        content.dataset.settingsPage = page;
        hub.hidden = page !== HUB;
        actions.hidden = page === HUB;
        for (const node of members) node.hidden = isOld(node) || node.dataset.group !== page;
        back.hidden = page === HUB;
        title.textContent = group ? group.label : 'Settings';
        sub.textContent = group ? group.summary : 'Choose what you want to change.';
        scroller.scrollTop = 0;
        const stage = page === HUB ? hub : actions;
        stage.classList.remove('is-entering');
        if (!reduce()) {
            void stage.offsetWidth; // restart the entrance
            stage.classList.add('is-entering');
        }
        if (focus) (page === HUB ? opener || title : title).focus({ preventScroll: true });
    }

    content.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape' || event.defaultPrevented || content.dataset.settingsPage === HUB) return;
        if (/^(INPUT|SELECT|TEXTAREA)$/.test(event.target.tagName)) return; // Escape belongs to the control
        event.preventDefault();
        show(HUB, { focus: true });
    });

    show(currentPage);
}
