// The Appearance section of Settings (task A-10): theme, accent color and density.
//
// The engine draws the Settings page itself, with a "Theme Color" block of five swatches that only set an old body class and are
// never saved. This puts a real Appearance section in front of that block and hides it. The page is drawn again every time it
// is opened (and when you come back from Advanced), so a small observer, alive only while Settings is shown, puts it back.

import { el, segmented, attachTooltip } from '../components/index.js';
import { THEMES, ACCENTS, DENSITIES, getAppearance, setAppearance, watchAppearance } from './appearance.js';

let observer = null;

function stop() {
    if (observer) observer.disconnect();
    observer = null;
}

const dot = (name, kind) => el('span', { class: 'swatch', 'data-swatch': kind, 'data-name': name, 'aria-hidden': 'true' });

function row(title, hint, control) {
    return el('div', { class: 'appearance__row' }, el('div', { class: 'appearance__label' }, el('div', { class: 'appearance__title' }, title), hint ? el('div', { class: 'appearance__hint' }, hint) : ''), control);
}

function build() {
    const now = getAppearance();
    const theme = segmented({
        label: 'Theme',
        value: now.theme,
        items: THEMES.map((t) => ({ value: t.id, label: el('span', { class: 'appearance__theme', 'data-theme-id': t.id }, dot(t.id, 'ground'), dot(t.id, 'surface'), dot(t.id, 'accent'), t.label) })),
        onChange: (value) => setAppearance({ theme: value })
    });
    const accent = segmented({
        label: 'Accent color',
        value: now.accent,
        items: ACCENTS.map((a) => ({ value: a.id, label: dot(a.id, 'accent-choice') })),
        onChange: (value) => setAppearance({ accent: value })
    });
    for (const a of ACCENTS) {
        const node = accent.el.querySelector(`[data-value="${a.id}"]`);
        node.setAttribute('aria-label', a.label);
        attachTooltip(node, { name: a.label });
    }
    const density = segmented({ label: 'Density', value: now.density, items: DENSITIES.map((d) => ({ value: d.id, label: d.label })), onChange: (value) => setAppearance({ density: value }) });

    const section = el(
        'div',
        { class: 'settings-section appearance', 'data-appearance': '' },
        el('div', { class: 'settings-section-title' }, 'Appearance'),
        row('Theme', 'The surfaces and the default accent.', theme.el),
        row('Accent color', 'Theme color uses the accent that belongs to the theme.', accent.el),
        row('Density', 'Row height in song lists.', density.el)
    );
    // Another place can change the choice (the song list's column menu has a Row height group): keep the controls in step.
    const off = watchAppearance((next) => {
        if (!section.isConnected) return off();
        theme.setValue(next.theme);
        accent.setValue(next.accent);
        density.setValue(next.density);
    });
    return section;
}

/** Called after the engine has drawn Settings into `host`. */
export function mountAppearanceSettings(host) {
    stop();
    const inject = () => {
        const title = [...host.querySelectorAll('.settings-section-title')].find((node) => node.textContent.trim() === 'Theme Color');
        const old = title && title.closest('.settings-section');
        if (!old || old.dataset.replaced) return;
        old.dataset.replaced = 'true';
        old.hidden = true;
        old.before(build());
    };
    inject();
    observer = new MutationObserver(() => (host.dataset.view === 'settings' ? inject() : stop()));
    observer.observe(host, { childList: true, subtree: true });
}
