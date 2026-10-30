// The Appearance section of Settings (task A-10): theme, density and scrollbar.
//
// The engine draws the Settings page itself, with a "Theme Color" block of five swatches that only set an old body class and are
// never saved. This puts a real Appearance section in front of that block and hides it. The page is drawn again every time it
// is opened (and when you come back from Advanced), so a small observer, alive only while Settings is shown, puts it back.

import { el, segmented } from '../components/index.js';
import { buildAiSettingsSection } from './ai-slots.js';
import { buildWaveformSection } from '../views/playback/waveform-setting.js';
import { layoutSettings, resetSettingsPage } from './settings-layout.js';
import { DENSITIES, SCROLLBARS, SCROLLBAR_SHAPES, SCROLLBAR_CATS, SCROLLBAR_CAT_SKINS, CUSTOM_ID, getAppearance, setAppearance, watchAppearance } from './appearance.js';
import { themePicker } from './theme-picker.js';
import { buildThemeBuilder, currentColors } from './theme-builder.js';

let observer = null;

function stop() {
    if (observer) observer.disconnect();
    observer = null;
}

function row(title, hint, control) {
    return el('div', { class: 'appearance__row' }, el('div', { class: 'appearance__label' }, el('div', { class: 'appearance__title' }, title), hint ? el('div', { class: 'appearance__hint' }, hint) : ''), control);
}

function switchButton() {
    const button = el('button', { type: 'button', class: 'appearance__switch', 'data-action-local': 'switch-interface' }, 'Switch to the previous interface');
    const api = window.desktopApi;
    if (!api || typeof api.supports !== 'function' || !api.supports('window.setUiChoice')) {
        button.disabled = true;
        return button;
    }
    button.addEventListener('click', () => {
        button.disabled = true;
        api.window.setUiChoice('current').catch(() => { button.disabled = false; });
    });
    return button;
}

function build() {
    const now = getAppearance();
    const theme = themePicker({
        value: now.theme,
        onChange: (id) => setAppearance(id === CUSTOM_ID ? { theme: id, custom: getAppearance().custom || { colors: currentColors() } } : { theme: id })
    });
    theme.setCustom(now.custom && now.custom.colors);
    const builder = buildThemeBuilder();
    const density = segmented({ label: 'Density', value: now.density, items: DENSITIES.map((d) => ({ value: d.id, label: d.label })), onChange: (value) => setAppearance({ density: value }) });

    const scrollbar = segmented({ label: 'Scrollbar color', value: now.scrollbar, items: SCROLLBARS.map((o) => ({ value: o.id, label: o.label })), onChange: (value) => setAppearance({ scrollbar: value }) });
    const scrollbarShape = segmented({ label: 'Scrollbar shape', value: now.scrollbarShape, items: SCROLLBAR_SHAPES.map((o) => ({ value: o.id, label: o.label })), onChange: (value) => setAppearance({ scrollbarShape: value }) });
    const scrollbarCat = segmented({ label: 'Cat scrollbar', value: now.scrollbarCat, items: SCROLLBAR_CATS.map((o) => ({ value: o.id, label: o.label })), onChange: (value) => setAppearance({ scrollbarCat: value }) });

    const catSkin = segmented({ label: 'Cat skin', value: now.scrollbarCatSkin, items: SCROLLBAR_CAT_SKINS.map((o) => ({ value: o.id, label: o.label })), onChange: (value) => setAppearance({ scrollbarCatSkin: value }) });
    const catSkinRow = row('Cat skin', 'Classic is the detailed yellow cat. The others are simple one-color silhouettes.', catSkin.el);
    catSkinRow.hidden = now.scrollbarCat !== 'on'; // only while the cat scrollbar is on

    const section = el(
        'div',
        { class: 'settings-section appearance', 'data-appearance': '' },
        el('div', { class: 'settings-section-title' }, 'Appearance'),
        el('div', { class: 'appearance__block' }, el('div', { class: 'appearance__title' }, 'Theme'), el('div', { class: 'appearance__hint' }, 'Each theme has its own surfaces and accent. Pick one, or build your own below.'), theme.el),
        el('div', { class: 'appearance__block' }, el('div', { class: 'appearance__title' }, 'Build your own theme'), el('div', { class: 'appearance__hint' }, 'Choose four colors, then restyle any panel on its own: its background or gradient, text, accent and edge line. Text stays readable. Save the looks you like.'), builder.el),
        row('Density', 'Row height in song lists.', density.el),
        row('Interface', 'The previous interface is kept. Switching reloads the window and is remembered.', switchButton())
    );
    // Every scrollbar choice lives in its own box, so Appearance stays short.
    const scrollbarBox = el(
        'div',
        { class: 'settings-section appearance', 'data-appearance-scrollbar': '' },
        el('div', { class: 'settings-section-title' }, 'Scrollbar'),
        row('Scrollbar color', 'Theme color follows the accent of the theme; Neutral stays grey.', scrollbar.el),
        row('Scrollbar shape', 'Flush bar is a square bar against the edge; Standard is the browser look, a rounded thumb with a gap between it and the edge.', scrollbarShape.el),
        row('Cat scrollbar', 'A small cat clings to the edge of a long list and rides along as its scroll thumb. It climbs as you scroll, now and then walks up or down by itself (the list scrolls with it) or comes out to look around, and reacts when you hover or drag it.', scrollbarCat.el),
        catSkinRow
    );
    // Another place can change the choice (the song list's column menu has a Row height group): keep the controls in step.
    const off = watchAppearance((next) => {
        if (!section.isConnected) return off();
        theme.setValue(next.theme);
        theme.setCustom(next.custom && next.custom.colors);
        density.setValue(next.density);
        scrollbar.setValue(next.scrollbar);
        scrollbarShape.setValue(next.scrollbarShape);
        scrollbarCat.setValue(next.scrollbarCat);
        catSkin.setValue(next.scrollbarCatSkin);
        catSkinRow.hidden = next.scrollbarCat !== 'on';
    });
    return [section, scrollbarBox];
}

/** Called after the engine has drawn Settings into `host`. */
export function mountAppearanceSettings(host) {
    stop();
    resetSettingsPage(); // opening Settings from the rail starts on the hub; a redraw by the engine (Advanced > Back) keeps the page
    const inject = () => {
        const title = [...host.querySelectorAll('.settings-section-title')].find((node) => node.textContent.trim() === 'Theme Color');
        const old = title && title.closest('.settings-section');
        if (!old || old.dataset.replaced) return;
        old.dataset.replaced = 'true';
        old.hidden = true;
        old.before(...build());
        const ai = buildAiSettingsSection(el); // Agent E's section, when registered (PA-17)
        if (ai) old.before(ai);
        old.before(buildWaveformSection({ el, segmented })); // Agent C's waveform on/off (PC-03); it belongs to the Playback group
        layoutSettings(host); // the hub of cards and one page per group (PA-11)
    };
    inject();
    observer = new MutationObserver(() => (host.dataset.view === 'settings' ? inject() : stop()));
    observer.observe(host, { childList: true, subtree: true });
}
