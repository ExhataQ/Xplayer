// General: how the app looks and how its window behaves.
//   Appearance   theme, your own theme, row height, animations
//   Scrollbar    color, shape, and the cat with everything that belongs to it
//   Window       closing, the startup screen, opening music files from Windows
import { el } from '../../components/index.js';
import { engineCall, engineAction } from '../../adapter/engine-api.js';
import { DENSITIES, SCROLLBARS, SCROLLBAR_SHAPES, SCROLLBAR_CAT_SKINS, MOTIONS, CUSTOM_ID, effectiveMotion, getAppearance, setAppearance, watchAppearance } from '../../shell/appearance.js';
import { themePicker } from '../../shell/theme-picker.js';
import { buildThemeBuilder, currentColors } from '../../shell/theme-builder.js';
import { PLAYER_NAMES } from '../../light/names.js';
import { choiceBoxes } from '../kit.js';
import { PREVIEWS } from '../previews.js';

const options = (list, previews) => list.map((o) => ({ value: o.id, label: o.label, preview: previews && previews[o.id] }));
const subscribe = (cb) => watchAppearance(cb);

// A row bound to one field of the appearance store. `bool: true` maps 'on' / 'off' to true / false.
function appearanceRow({ id, label, hint, type = 'choice', field, list, previews, bool = false, read, ...rest }) {
    return {
        id,
        type,
        label,
        hint,
        options: list ? options(list, previews) : undefined,
        get: () => (read ? read(getAppearance()) : bool ? getAppearance()[field] === 'on' : getAppearance()[field]),
        set: (value) => setAppearance({ [field]: bool ? (value ? 'on' : 'off') : value }),
        subscribe,
        ...rest
    };
}

function themeRow() {
    return {
        id: 'theme',
        type: 'custom',
        label: 'Theme',
        render: () => {
            const now = getAppearance();
            const picker = themePicker({
                value: now.theme,
                onChange: (id) => setAppearance(id === CUSTOM_ID ? { theme: id, custom: getAppearance().custom || { colors: currentColors() } } : { theme: id })
            });
            picker.setCustom(now.custom && now.custom.colors);
            const off = watchAppearance((next) => {
                if (!picker.el.isConnected) return off();
                picker.setValue(next.theme);
                picker.setCustom(next.custom && next.custom.colors);
            });
            return { el: picker.el, destroy: off };
        }
    };
}

const customThemeRow = () => ({ id: 'custom-theme', type: 'custom', label: 'Your own theme', hint: 'Pick four colors, then restyle any panel on its own.', render: () => buildThemeBuilder() });

// What opening a music file from Windows does (electron/open-mode.js). Without the desktop app the choice stays disabled.
const supported = (api, name) => Boolean(api && typeof api.supports === 'function' && api.supports(name));
function openModeRow() {
    return {
        id: 'open-mode',
        type: 'custom',
        layout: 'stack',
        label: 'Open music files in',
        render: () => {
            const api = window.desktopApi;
            const can = supported(api, 'window.getOpenMode') && supported(api, 'window.setOpenMode');
            const note = el('span', { class: 'sp-row__hint', role: 'status' });
            const items = ['mini', 'quick', 'full'].map((value) => ({ value, label: PLAYER_NAMES[value], preview: PREVIEWS.openMode[value], disabled: !can }));
            const choice = choiceBoxes({
                items,
                value: 'quick',
                label: 'Open music files in',
                onChange: async (value) => {
                    note.textContent = '';
                    try {
                        const answer = await api.window.setOpenMode(value);
                        if (!answer || !answer.success) {
                            note.textContent = 'Could not save that';
                            if (answer && answer.mode) choice.setValue(answer.mode);
                        }
                    } catch (_) {
                        note.textContent = 'Could not save that';
                    }
                }
            });
            if (can) {
                api.window
                    .getOpenMode()
                    .then((answer) => answer && choice.setValue(answer.mode))
                    .catch(() => {});
            }
            return { el: el('div', { class: 'sp-stackbox' }, choice.el, note) };
        }
    };
}

function defaultAppRow() {
    const api = () => window.desktopApi;
    return {
        id: 'default-app',
        type: 'action',
        label: 'Default music app',
        hint: 'Choose Xplayer there for the file types you want. Installed version only.',
        actions: [
            {
                label: 'Open Windows settings',
                failed: 'Could not open Windows settings',
                disabled: () => !supported(api(), 'app.openDefaultApps'),
                run: async () => {
                    const answer = await api().app.openDefaultApps();
                    if (!answer || !answer.success) throw new Error('failed');
                }
            }
        ]
    };
}

export const general = {
    id: 'general',
    label: 'General',
    icon: 'sliders-horizontal',
    order: 10,
    parts: [
        {
            id: 'appearance',
            title: 'Appearance',
            rows: [
                themeRow(),
                customThemeRow(),
                appearanceRow({ id: 'density', label: 'Row height', field: 'density', list: DENSITIES }),
                appearanceRow({ id: 'motion', label: 'Reduce animations', hint: 'Follows Windows until you choose.', field: 'reduceMotion', list: MOTIONS, bool: true, read: (a) => effectiveMotion(a) === 'on', type: 'toggle' })
            ]
        },
        {
            id: 'scrollbar',
            title: 'Scrollbar',
            rows: [
                appearanceRow({ id: 'scrollbar-color', label: 'Color', field: 'scrollbar', list: SCROLLBARS }),
                appearanceRow({ id: 'scrollbar-shape', label: 'Shape', field: 'scrollbarShape', list: SCROLLBAR_SHAPES }),
                appearanceRow({
                    id: 'cat',
                    type: 'toggle',
                    label: 'Cat scrollbar',
                    hint: 'A small cat that rides the scroll thumb.',
                    field: 'scrollbarCat',
                    bool: true,
                    children: [
                        appearanceRow({ id: 'cat-skin', label: 'Skin', field: 'scrollbarCatSkin', list: SCROLLBAR_CAT_SKINS }),
                        appearanceRow({ id: 'cat-roam', type: 'toggle', label: 'Walks by itself', hint: 'Scrolls the list with it. Never the right panel.', field: 'scrollbarCatRoam', bool: true }),
                        appearanceRow({ id: 'cat-acts', type: 'toggle', label: 'Idles', hint: 'Looks around, yawns, stretches, falls asleep.', field: 'scrollbarCatActs', bool: true }),
                        appearanceRow({ id: 'cat-music', type: 'toggle', label: 'Moves to the music', field: 'scrollbarCatMusic', bool: true })
                    ]
                })
            ]
        },
        {
            id: 'window',
            title: 'Window',
            rows: [
                {
                    id: 'minimize-on-close',
                    type: 'toggle',
                    label: 'Minimize to taskbar when closed',
                    get: () => Boolean((engineCall('getWindowSettings') || {}).minimizeOnClose),
                    set: (value) => engineAction('setMinimizeOnClose', value === true)
                },
                {
                    id: 'startup-background',
                    type: 'select',
                    label: 'Startup screen',
                    // The engine's list: it is read when the page is drawn, after the engine has started.
                    options: () => (Array.isArray(window.STARTUP_BACKGROUNDS) ? window.STARTUP_BACKGROUNDS : []).map((o) => ({ value: o.id, label: o.label })),
                    get: () => engineCall('getStartupBackground'),
                    set: (value) => engineAction('setStartupBackground', value)
                },
                openModeRow(),
                defaultAppRow()
            ]
        }
    ]
};
