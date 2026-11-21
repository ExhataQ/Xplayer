// The Settings page: a menu bar of section tabs under the title and, below it, the open section's
// parts as cards. It reads settings/registry.js and draws with settings/kit.js; it knows no setting by name.
//
//   const page = buildSettingsPage({ section })   -> { el, show(id), destroy() }
//   requestSettingsSection(id)                     opens that section now, or the next time Settings opens (the AI chat's "Open Settings")
//   resetSettingsSection()                         the next page starts on the first section
//
// A section is built the first time it is opened and kept, so a switch you flipped is where you left it when you come back.

import { el, tabs, reducedMotion } from '../components/index.js';
import { bindRangeFill } from '../views/tools/range-fill.js';
import { getSections } from './registry.js';
import { createContext, buildPart } from './kit.js';

let remembered = null; // the section that was open; a redraw by the engine puts the page back on it
let wanted = null; // a section somebody asked for before Settings was open
let live = null; // the page that is on screen, if any

export function resetSettingsSection() {
    remembered = null;
}

export function requestSettingsSection(id) {
    if (live && live.has(id)) return void live.show(id);
    wanted = id;
}

function scrollerOf(node) {
    for (let n = node.parentElement; n; n = n.parentElement) {
        const overflow = getComputedStyle(n).overflowY;
        if (overflow === 'auto' || overflow === 'scroll') return n;
    }
    return document.scrollingElement;
}

function failedPart(title) {
    return el('section', { class: 'sp-part', 'data-failed': '' }, el('div', { class: 'sp-part__head' }, el('h3', { class: 'sp-part__title' }, title)), el('div', { class: 'sp-part__body' }, el('div', { class: 'sp-row__hint' }, 'This part could not be shown.')));
}

export function buildSettingsPage({ section } = {}) {
    const sections = getSections();
    if (!sections.length) throw new Error('Settings has no sections');
    const root = el('div', { class: 'sp' });
    // The page is built before it is put on screen: it counts as gone only once it has been on screen and left.
    let seen = false;
    const ctx = createContext({ isLive: () => (root.isConnected ? (seen = true) : !seen) });
    const reduce = reducedMotion;

    // The menu bar: one tab per section, under the title, sticky while the page scrolls (the same tabs as the rest of the app).
    const menu = tabs({ label: 'Settings sections', items: sections.map((s) => ({ id: s.id, label: s.label })), value: sections[0].id, onChange: (id) => show(id) });
    for (const node of menu.el.querySelectorAll('.tab')) node.dataset.section = node.dataset.id;
    const panels = el('div', { class: 'sp-main__panels' });
    const main = el('div', { class: 'sp-main', role: 'tabpanel' }, panels);
    root.append(el('h1', { class: 'sp-heading' }, 'Settings'), el('div', { class: 'sp-menu' }, menu.el), main);

    const built = new Map();
    let scroller = null;
    let current = null;

    function build(def) {
        const panel = el('div', { class: 'sp-section', 'data-section': def.id });
        for (const part of def.parts) {
            try {
                panel.append(buildPart(part, ctx).el);
            } catch (error) {
                console.error(`Settings: part "${part.id}" of "${def.id}" failed`, error);
                panel.append(failedPart(part.title));
            }
        }
        return panel;
    }

    function show(id) {
        const def = sections.find((s) => s.id === id) || sections[0];
        remembered = def.id;
        current = def.id;
        root.dataset.page = def.id;
        menu.setValue(def.id);
        main.setAttribute('aria-labelledby', menu.el.querySelector('[aria-selected="true"]')?.id || '');
        let panel = built.get(def.id);
        if (!panel) {
            panel = build(def);
            built.set(def.id, panel);
            panels.append(panel);
        }
        for (const [key, node] of built) node.hidden = key !== def.id;
        ctx.refresh();
        if (!scroller && root.isConnected) scroller = scrollerOf(root);
        if (scroller) scroller.scrollTop = 0;
        panel.classList.remove('is-entering');
        if (!reduce()) {
            void panel.offsetWidth; // restart the entrance
            panel.classList.add('is-entering');
        }
    }

    const stopFill = bindRangeFill(panels); // the filled part of every slider's track
    const page = {
        el: root,
        show,
        has: (id) => sections.some((s) => s.id === id),
        get current() {
            return current;
        },
        destroy() {
            stopFill();
            ctx.destroy();
            if (live === page) live = null;
        }
    };
    live = page;
    const first = wanted && page.has(wanted) ? wanted : section && page.has(section) ? section : remembered && page.has(remembered) ? remembered : sections[0].id;
    wanted = null;
    show(first);
    return page;
}
