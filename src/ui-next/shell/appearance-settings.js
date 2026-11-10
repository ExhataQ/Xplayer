// The Appearance section of Settings (task A-10): theme, density and scrollbar.
//
// The engine draws the Settings page itself, with a "Theme Color" block of five swatches that only set an old body class and are
// never saved. This puts a real Appearance section in front of that block and hides it. The page is drawn again every time it
// is opened (and when you come back from Advanced), so a small observer, alive only while Settings is shown, puts it back.

import { el, segmented } from '../components/index.js';
import { buildAiSettingsSection } from './ai-slots.js';
import { buildWaveformSection } from '../views/playback/waveform-setting.js';
import { buildVisualizerRow, buildVisualizerWidthRow, buildVisualizerSongInfoRow } from '../views/playback/visualizer-setting.js';
import { buildRatingSection } from '../views/library/rating-settings.js';
import { layoutSettings, resetSettingsPage } from './settings-layout.js';
import { DENSITIES, SCROLLBARS, SCROLLBAR_SHAPES, SCROLLBAR_CATS, SCROLLBAR_CAT_SKINS, SCROLLBAR_CAT_ROAMS, SCROLLBAR_CAT_ACTS, SCROLLBAR_CAT_MUSICS, MOTIONS, CUSTOM_ID, effectiveMotion, getAppearance, setAppearance, watchAppearance } from './appearance.js';
import { buildAboutSection } from './about-settings.js';
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
    const catRoam = segmented({ label: 'Cat walks by itself', value: now.scrollbarCatRoam, items: SCROLLBAR_CAT_ROAMS.map((o) => ({ value: o.id, label: o.label })), onChange: (value) => setAppearance({ scrollbarCatRoam: value }) });
    const catRoamRow = row('Cat walks by itself', 'Now and then the cat walks up or down on its own, and the list scrolls with it. It never scrolls the right panel, and it keeps away while you are using a list.', catRoam.el);
    catRoamRow.hidden = now.scrollbarCat !== 'on';
    const catActs = segmented({ label: 'Cat does things by itself', value: now.scrollbarCatActs, items: SCROLLBAR_CAT_ACTS.map((o) => ({ value: o.id, label: o.label })), onChange: (value) => setAppearance({ scrollbarCatActs: value }) });
    const catActsRow = row('Cat does things by itself', 'Apart from walking: it comes out to look around, yawns, stretches and falls asleep after a long quiet. Nothing moves the list, so it works everywhere, the right panel too.', catActs.el);
    catActsRow.hidden = now.scrollbarCat !== 'on';
    const catMusic = segmented({ label: 'Cat reacts to music', value: now.scrollbarCatMusic, items: SCROLLBAR_CAT_MUSICS.map((o) => ({ value: o.id, label: o.label })), onChange: (value) => setAppearance({ scrollbarCatMusic: value }) });
    const catMusicRow = row('Cat reacts to music', 'While a song plays the cat bobs its head and swings its tail in time, and it glances at the player bar when the song changes.', catMusic.el);
    catMusicRow.hidden = now.scrollbarCat !== 'on';

    const motion = segmented({ label: 'Reduce animations', value: effectiveMotion(now), items: MOTIONS.map((o) => ({ value: o.id, label: o.label })), onChange: (value) => setAppearance({ reduceMotion: value }) });

    const section = el(
        'div',
        { class: 'settings-section appearance', 'data-appearance': '' },
        el('div', { class: 'settings-section-title' }, 'Appearance'),
        el('div', { class: 'appearance__block' }, el('div', { class: 'appearance__title' }, 'Theme'), el('div', { class: 'appearance__hint' }, 'Each theme has its own surfaces and accent. Pick one, or build your own below.'), theme.el),
        el('div', { class: 'appearance__block' }, el('div', { class: 'appearance__title' }, 'Build your own theme'), el('div', { class: 'appearance__hint' }, 'Choose four colors, then restyle any panel on its own: its background or gradient, text, accent and edge line. Text stays readable. Save the looks you like.'), builder.el),
        row('Density', 'Row height in song lists.', density.el),
        row('Reduce animations', 'Turns off the movement: the cat, the waveform fade, panel and menu motion, fades and loops. It starts as your Windows "show animations" setting; once you choose, your choice stays.', motion.el),
        row('Interface', 'The previous interface is kept. Switching reloads the window and is remembered.', switchButton())
    );
    // Every scrollbar choice lives in its own box, so Appearance stays short.
    const scrollbarBox = el(
        'div',
        { class: 'settings-section appearance', 'data-appearance-scrollbar': '' },
        el('div', { class: 'settings-section-title' }, 'Scrollbar'),
        row('Scrollbar color', 'Theme color follows the accent of the theme; Neutral stays grey.', scrollbar.el),
        row('Scrollbar shape', 'Flush bar is a square bar against the edge; Standard is the browser look, a rounded thumb with a gap between it and the edge.', scrollbarShape.el)
    );
    // The cat is a little secret: while it is off, this box is only its title and the one switch; the rest appears with the cat.
    const catBox = el(
        'div',
        { class: 'settings-section appearance', 'data-appearance-cat': '' },
        el('div', { class: 'settings-section-title' }, 'The cat'),
        row('Show the cat', 'A little easter egg: a small cat that clings to the edge of long lists and rides along as the scroll thumb. Switch it on to meet it.', scrollbarCat.el),
        catSkinRow,
        catRoamRow,
        catActsRow,
        catMusicRow
    );
    // Another place can change the choice (the song list's column menu has a Row height group): keep the controls in step.
    const off = watchAppearance((next) => {
        if (!section.isConnected) return off();
        theme.setValue(next.theme);
        theme.setCustom(next.custom && next.custom.colors);
        density.setValue(next.density);
        motion.setValue(effectiveMotion(next));
        scrollbar.setValue(next.scrollbar);
        scrollbarShape.setValue(next.scrollbarShape);
        scrollbarCat.setValue(next.scrollbarCat);
        catSkin.setValue(next.scrollbarCatSkin);
        catSkinRow.hidden = next.scrollbarCat !== 'on';
        catRoam.setValue(next.scrollbarCatRoam);
        catRoamRow.hidden = next.scrollbarCat !== 'on';
        catActs.setValue(next.scrollbarCatActs);
        catActsRow.hidden = next.scrollbarCat !== 'on';
        catMusic.setValue(next.scrollbarCatMusic);
        catMusicRow.hidden = next.scrollbarCat !== 'on';
    });
    return [section, scrollbarBox, catBox];
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
        const playerBar = buildWaveformSection({ el, segmented }); // Agent C's waveform on/off (PC-03); it belongs to the Playback group
        playerBar.append(buildVisualizerRow({ el, segmented }), buildVisualizerWidthRow({ el, segmented }), buildVisualizerSongInfoRow({ el, segmented })); // the visualizer on/off, in the same Player bar section
        old.before(playerBar);
        const library = [...host.querySelectorAll('.settings-section-title')].find((node) => node.textContent.trim().startsWith('Play from URL'));
        const rating = buildRatingSection({ el, segmented }); // Agent B's Rating system (B3); it belongs to the Library group, after the folders
        if (library) library.closest('.settings-section').after(rating);
        else old.before(rating);
        old.parentElement.append(buildAboutSection()); // version, data folder, diagnostics: last, in the Data group
        layoutSettings(host); // the hub of cards and one page per group (PA-11)
    };
    inject();
    observer = new MutationObserver(() => (host.dataset.view === 'settings' ? inject() : stop()));
    observer.observe(host, { childList: true, subtree: true });
}
