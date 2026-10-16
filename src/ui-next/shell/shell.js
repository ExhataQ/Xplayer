// ui-next shell behavior (task A-03): logo menu, nav rail, panel host, empty views.
//
// Phase 1 has no real views yet (they come from tasks B, C and D), so each rail item shows an empty view that says
// what is planned. This file never touches an engine element: the engine's elements all live in the adapter's slots
// (adapter/legacy-dom-adapter.js).

import { icon } from '../icons/icons.js';

// Rail order follows decision D4.
const VIEWS = [
    { id: 'home', label: 'Home', icon: 'house', note: 'Not built yet.' },
    { id: 'library', label: 'Library', icon: 'library', note: 'The library panel and song list are planned in tasks B-02 and B-03.' },
    { id: 'search', label: 'Search', icon: 'search', note: 'Search is planned in task B-04.' },
    { id: 'recent', label: 'Recently played', icon: 'clock', note: 'Not built yet.' },
    { id: 'lyrics', label: 'Lyrics', icon: 'text-align-start', note: 'The lyrics panel is planned in task D-01.' },
    { id: 'metadata', label: 'Metadata', icon: 'tag', note: 'The metadata editor is planned in task D-04.' },
    { id: 'settings', label: 'Settings', icon: 'sliders-horizontal', note: 'Settings sections are planned in task D-05.', end: true }
];

// Decision D8 names the four groups. Their items are not decided yet, so each shows one disabled placeholder.
const MENU = ['File', 'View', 'Playback', 'Help'].map((group) => ({ group, items: ['Not built yet'] }));

const PANEL_KEY = 'xplayer.ui-next.panel';

const $ = (selector) => document.querySelector(selector);

function readPanelState() {
    try {
        return localStorage.getItem(PANEL_KEY) === 'compact' ? 'compact' : 'expanded';
    } catch (_) {
        return 'expanded';
    }
}

function savePanelState(value) {
    try {
        localStorage.setItem(PANEL_KEY, value);
    } catch (_) {
        /* the panel just opens expanded next time */
    }
}

function el(tag, className, html) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (html != null) node.innerHTML = html;
    return node;
}

// ---------- logo menu ----------

function buildTitlebar() {
    const logo = el('button', 'logo-btn', '<svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="9" fill="currentColor"/><path d="M8 6.5v7l6-3.5z" fill="var(--surface-ground)"/></svg>');
    logo.type = 'button';
    logo.setAttribute('aria-label', 'Application menu');
    logo.setAttribute('aria-haspopup', 'menu');
    logo.setAttribute('aria-expanded', 'false');

    const menu = el('div', 'logo-menu');
    menu.hidden = true;
    menu.setAttribute('role', 'menu');
    for (const { group, items } of MENU) {
        menu.append(el('div', 'logo-menu__group', group));
        for (const label of items) {
            const item = el('button', 'logo-menu__item', label);
            item.type = 'button';
            item.setAttribute('role', 'menuitem');
            item.setAttribute('aria-disabled', 'true'); // the app menu is filled in by a later task
            menu.append(item);
        }
    }

    const setOpen = (open) => {
        menu.hidden = !open;
        logo.setAttribute('aria-expanded', String(open));
    };
    logo.addEventListener('click', () => setOpen(menu.hidden));
    document.addEventListener('mousedown', (e) => {
        if (!menu.hidden && !menu.contains(e.target) && !logo.contains(e.target)) setOpen(false);
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !menu.hidden) {
            setOpen(false);
            logo.focus();
        }
    });

    const bell = el('button', 'icon-btn', icon('bell', { size: 18 }));
    bell.type = 'button';
    bell.setAttribute('aria-label', 'Notifications');

    const bar = $('.titlebar');
    bar.prepend(logo);
    bar.append(menu);
    bar.querySelector('.titlebar__window').before(bell);
}

// ---------- rail, panel host, view host ----------

function buildRail(onSelect) {
    const rail = $('.rail');
    for (const view of VIEWS) {
        const button = el('button', `rail-btn${view.end ? ' rail-btn--end' : ''}`, icon(view.icon, { size: 20 }));
        button.type = 'button';
        button.dataset.view = view.id;
        button.setAttribute('aria-label', view.label);
        button.title = view.label;
        button.addEventListener('click', () => onSelect(view.id));
        rail.append(button);
    }
}

function buildPanelToggle(panel) {
    const toggle = el('button', 'icon-btn');
    toggle.type = 'button';
    const paint = () => {
        const compact = panel.dataset.panel === 'compact';
        toggle.innerHTML = icon(compact ? 'chevron-right' : 'chevron-left', { size: 18 });
        toggle.setAttribute('aria-label', compact ? 'Expand panel' : 'Collapse panel');
        toggle.setAttribute('aria-expanded', String(!compact));
    };
    toggle.addEventListener('click', () => {
        panel.dataset.panel = panel.dataset.panel === 'compact' ? 'expanded' : 'compact';
        savePanelState(panel.dataset.panel);
        paint();
    });
    paint();
    $('.panel-host__header').append(toggle);
}

function showView(id) {
    const view = VIEWS.find((v) => v.id === id) || VIEWS[0];
    for (const button of document.querySelectorAll('.rail-btn')) {
        if (button.dataset.view === view.id) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    }
    $('.panel-host__title').textContent = view.label;
    $('.panel-host__body').textContent = view.note;
    const host = $('.view-host');
    host.dataset.view = view.id;
    host.replaceChildren();
    const section = el('section', 'empty-view');
    section.append(el('h1', '', view.label), el('p', '', view.note));
    host.append(section);
}

function init() {
    const panel = $('.panel-host');
    panel.dataset.panel = readPanelState();
    buildTitlebar();
    buildRail(showView);
    buildPanelToggle(panel);
    showView('library');
}

init();
