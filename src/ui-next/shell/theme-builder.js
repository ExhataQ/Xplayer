// The custom theme designer in Settings, Appearance. A small picture of the window (click a part of it to restyle that part) beside three tabs:
//   Colors  four colors (background, panels, text, accent), the strength and color of the lines, a live result on the whole app,
//           readable-contrast readouts, and a button that fixes unreadable colors. Everything else a theme needs is derived (shell/theme-math.js).
//   Panels  each of the six panels on its own: a solid or gradient background, text, accent and the line on its edge (shell/theme-design.js).
// The choice is the "Custom" theme of shell/appearance.js: it is saved there and applied before the first paint (colors) or as soon as the
// page has loaded (panels and style). Saved themes keep all of it (shell/saved-themes.js).
import { el, button, chip, textField, openDialog, segmented, tabs } from '../components/index.js';
import { THEMES, CUSTOM_ID, getAppearance, setAppearance, watchAppearance } from './appearance.js';
import { isHex, isDark, mix, readouts, deriveTheme, lineColors, LINE_DEFAULT } from './theme-math.js';
import { PANELS, FILLS, LINE_WIDTHS, DEFAULT_ANGLE, normalizeCustom, normalizePanels, normalizeStyle, designOf, sameDesign, panelScope, startingFill } from './theme-design.js';
import { listSavedThemes, saveTheme, renameTheme, deleteSavedTheme, watchSavedThemes, sameColors } from './saved-themes.js';
import { savedThemeCard } from './theme-picker.js';

const FIELDS = [
    { key: 'ground', label: 'Background', hint: 'The window and the lists.' },
    { key: 'surface', label: 'Panels', hint: 'Side panels, bars and the player.' },
    { key: 'ink', label: 'Text', hint: 'Titles and body text.' },
    { key: 'accent', label: 'Accent', hint: 'Buttons, the playing song and highlights.' }
];

const rootToken = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim().toLowerCase();

/** The four colors the app shows right now (a theme's own values), as hex. */
export function currentColors() {
    const now = getAppearance();
    if (now.theme === CUSTOM_ID && now.custom) return { ...now.custom.colors };
    const pick = (token, fallback) => (isHex(rootToken(token)) ? rootToken(token) : fallback);
    return { ground: pick('--c-ground', '#0e1013'), surface: pick('--c-surface', '#13161b'), ink: pick('--c-ink', '#ece9e3'), accent: pick('--c-accent-own', '#eba43a') };
}

/** Colors of a built-in theme, from its preview tokens (the picture tokens in tokens.css); the text color is chosen to suit the background. */
function themeColors(id) {
    const ground = rootToken(`--preview-${id}-ground`);
    const surface = rootToken(`--preview-${id}-surface`);
    const accent = rootToken(`--preview-${id}-accent`);
    if (![ground, surface, accent].every(isHex)) return null;
    return { ground, surface, accent, ink: isDark(ground) ? mix('#ffffff', surface, 0.08) : mix('#000000', surface, 0.08) };
}

/** The design a custom theme had when the builder opened: what is saved, or nothing. */
function currentDesign() {
    const now = getAppearance();
    return now.theme === CUSTOM_ID && now.custom ? designOf(now.custom) : { panels: {}, style: {} };
}

/** One color: a swatch that opens the picker, a name, and the hex code. `get` and `set` read and write the builder's state. */
function colorRow({ label, hint, aria = label, get, set }) {
    const picker = el('input', { type: 'color', class: 'theme-builder__color', 'aria-label': aria });
    const hex = el('input', { type: 'text', class: 'theme-builder__hex', 'aria-label': `${aria} as a hex code`, maxlength: '7', spellcheck: 'false', autocomplete: 'off' });
    const name = el('div', { class: 'theme-builder__name' }, label);
    const note = el('div', { class: 'theme-builder__hint' }, hint || '');
    picker.addEventListener('input', () => set(picker.value));
    hex.addEventListener('input', () => {
        const value = hex.value.startsWith('#') ? hex.value : `#${hex.value}`;
        if (isHex(value)) set(value.toLowerCase());
    });
    hex.addEventListener('blur', () => (hex.value = get()));
    const node = el('div', { class: 'theme-builder__field' }, el('div', { class: 'theme-builder__swatch' }, picker), el('div', { class: 'theme-builder__text' }, name, hint ? note : ''), hex);
    return {
        el: node,
        picker,
        paint() {
            const value = get();
            picker.value = value;
            if (document.activeElement !== hex) hex.value = value;
        },
        /** The visible name, and the name the screen reader hears (which stays different from the Colors tab's, so no two fields share one). */
        rename(next, spoken = next) {
            name.textContent = next;
            picker.setAttribute('aria-label', spoken);
            hex.setAttribute('aria-label', `${spoken} as a hex code`);
        }
    };
}

/** A titled group inside a tab page. */
const group = (title, hint, ...children) => el('div', { class: 'designer__group' }, el('div', { class: 'designer__group-head' }, el('div', { class: 'designer__group-title' }, title), hint ? el('div', { class: 'designer__group-hint' }, hint) : ''), ...children);

export function buildThemeBuilder() {
    const initial = getAppearance();
    let colors = currentColors();
    let exact = Boolean(initial.custom && initial.custom.exact);
    let { panels, style } = currentDesign();
    let selected = 'main';
    const memory = {}; // colors a panel had before it went back to the theme's: switching back and forth keeps them (not saved)

    const custom = () => normalizeCustom({ colors, exact, panels, style });

    // ---------- Colors ----------
    const fields = FIELDS.map((f) => {
        const row = colorRow({ label: f.label, hint: f.hint, get: () => colors[f.key], set: (value) => apply({ ...colors, [f.key]: value }) });
        return { key: f.key, ...row };
    });

    const startSelect = el('select', { class: 'theme-builder__select', 'aria-label': 'Start from a theme' }, el('option', { value: '' }, 'Start from…'), ...THEMES.map((t) => el('option', { value: t.id }, t.label)));
    startSelect.addEventListener('change', () => {
        const next = themeColors(startSelect.value);
        startSelect.value = '';
        if (next) apply(next);
    });

    const exactBox = el('input', { type: 'checkbox', class: 'theme-builder__check' });
    exactBox.addEventListener('change', () => {
        exact = exactBox.checked;
        apply(colors);
    });
    const exactLabel = el('label', { class: 'theme-builder__exact' }, exactBox, 'Use my exact colors (even if hard to read)');

    const readoutBox = el('div', { class: 'theme-builder__readouts', role: 'status' });
    const message = el('div', { class: 'theme-builder__message' });
    // The lines of the whole app (between panels and rows, and around inputs): how strong, and what color.
    const strength = el('input', { type: 'range', class: 'designer__range', min: '0', max: '100', step: '1', 'aria-label': 'Line strength' });
    const strengthValue = el('span', { class: 'designer__range-value' });
    strength.addEventListener('input', () => commit({ style: normalizeStyle({ ...style, lineStrength: Number(strength.value) }) }));
    const lineKind = segmented({
        label: 'Line color kind',
        value: 'auto',
        items: [{ value: 'auto', label: 'Text color' }, { value: 'own', label: 'Custom' }],
        onChange: (v) => commit({ style: normalizeStyle({ ...style, lineColor: v === 'own' ? lineColors(colors.surface, colors.ink, {})[1] : undefined }) })
    });
    const lineColorRow = colorRow({ label: 'Line color', get: () => style.lineColor || '#000000', set: (v) => commit({ style: normalizeStyle({ ...style, lineColor: v }) }) });
    const linePreview = el('div', { class: 'designer__line-preview', 'aria-hidden': 'true' });
    const resetLines = button({ label: 'Reset lines', size: 'sm', variant: 'ghost', onClick: () => commit({ style: {} }) });
    const linesGroup = group(
        'Lines',
        'The thin lines between panels and rows, and around fields.',
        el('div', { class: 'designer__angle' }, el('span', { class: 'designer__angle-label' }, 'Strength'), strength, strengthValue),
        lineKind.el,
        lineColorRow.el,
        linePreview,
        el('div', { class: 'designer__footer' }, resetLines)
    );
    const colorsPage = el('div', { class: 'designer__page', id: 'designer-page-colors', role: 'tabpanel' }, el('div', { class: 'theme-builder__fields' }, ...fields.map((f) => f.el)), readoutBox, message, linesGroup);

    // ---------- Panels ----------
    const panelChips = new Map();
    const panelRow = el('div', { class: 'designer__chips', role: 'group', 'aria-label': 'Panel to restyle' });
    for (const p of PANELS) {
        const node = chip({ label: p.label, pressed: p.id === selected, onClick: () => select(p.id) });
        panelChips.set(p.id, node);
        panelRow.append(node);
    }

    const panelName = el('div', { class: 'designer__panel-name' });
    const panelHint = el('div', { class: 'designer__panel-hint' });
    const resetPanel = button({ label: 'Reset this panel', size: 'sm', variant: 'ghost', onClick: () => editPanel(selected, () => ({})) });
    const panelHead = el('div', { class: 'designer__panel-head' }, el('div', { class: 'designer__panel-title' }, panelName, panelHint), resetPanel);

    const effective = (key) => panelScope(custom(), selected)[key];
    const own = () => panels[selected] || {};

    // background
    const fillSeg = segmented({ label: 'Panel background kind', value: 'auto', items: FILLS.map((f) => ({ value: f.id, label: f.label })), onChange: (id) => setFill(id) });
    const bgRow = colorRow({ label: 'Background', aria: 'Panel background', get: () => own().bg || memoryOf(selected).bg || '#000000', set: (v) => editPanel(selected, (p) => ({ ...p, bg: v })) });
    const bg2Row = colorRow({ label: 'Gradient end', aria: 'Gradient end', get: () => own().bg2 || memoryOf(selected).bg2 || '#000000', set: (v) => editPanel(selected, (p) => ({ ...p, bg2: v })) });
    const angle = el('input', { type: 'range', class: 'designer__range', min: '0', max: '360', step: '5', 'aria-label': 'Gradient angle' });
    const angleValue = el('span', { class: 'designer__range-value' });
    angle.addEventListener('input', () => editPanel(selected, (p) => ({ ...p, angle: Number(angle.value) })));
    const presets = [
        { label: 'Down', glyph: '↓', value: 180 },
        { label: 'Right', glyph: '→', value: 90 },
        { label: 'Down and right', glyph: '↘', value: 135 },
        { label: 'Up and right', glyph: '↗', value: 45 }
    ].map((p) => el('button', { type: 'button', class: 'designer__preset', 'aria-label': `Gradient direction: ${p.label}`, onClick: () => editPanel(selected, (cur) => ({ ...cur, angle: p.value })) }, p.glyph));
    const angleRow = el('div', { class: 'designer__angle' }, el('span', { class: 'designer__angle-label' }, 'Direction'), angle, angleValue, el('div', { class: 'designer__presets' }, ...presets));
    const gradientBar = el('div', { class: 'designer__gradient-bar', 'aria-hidden': 'true' });
    const fillBox = el('div', { class: 'designer__stack' }, bgRow.el, bg2Row.el, gradientBar, angleRow);

    // text, accent and line: "the theme's" or a color of this panel's own
    const choice = (label, onChange) => segmented({ label, value: 'auto', items: [{ value: 'auto', label: 'Theme' }, { value: 'own', label: 'Custom' }], onChange });
    const inkSeg = choice('Panel text kind', (v) => editPanel(selected, (p) => ({ ...p, ink: v === 'own' ? effective('ink') : undefined })));
    const inkRow = colorRow({ label: 'Text', aria: 'Panel text', get: () => own().ink || effective('ink'), set: (v) => editPanel(selected, (p) => ({ ...p, ink: v })) });
    const accentSeg = choice('Panel accent kind', (v) => editPanel(selected, (p) => ({ ...p, accent: v === 'own' ? effective('accent') : undefined })));
    const accentRow = colorRow({ label: 'Accent', aria: 'Panel accent', get: () => own().accent || effective('accent'), set: (v) => editPanel(selected, (p) => ({ ...p, accent: v })) });
    const widthSeg = segmented({ label: 'Panel line width', value: 'auto', items: LINE_WIDTHS.map((w) => ({ value: w.id, label: w.label })), onChange: (v) => editPanel(selected, (p) => ({ ...p, lineWidth: v === 'auto' ? undefined : Number(v) })) });
    const lineSeg = choice('Panel line color kind', (v) => editPanel(selected, (p) => ({ ...p, line: v === 'own' ? effective('line') : undefined })));
    const lineRow = colorRow({ label: 'Line', aria: 'Panel line', get: () => own().line || effective('line'), set: (v) => editPanel(selected, (p) => ({ ...p, line: v })) });

    const ratioBox = el('div', { class: 'designer__ratios', role: 'status' });
    const backgroundGroup = group('Background', 'Its own color, or a blend of two.', fillSeg.el, fillBox);
    const textGroup = group('Text', 'Titles, names and icons in this panel.', inkSeg.el, inkRow.el);
    const accentGroup = group('Accent', 'Highlights, the playing song and active buttons in this panel.', accentSeg.el, accentRow.el);
    const lineGroup = group('Edge line', 'The line between this panel and its neighbor.', widthSeg.el, lineSeg.el, lineRow.el);
    const resetAll = button({ label: 'Reset all panels', size: 'sm', variant: 'ghost', onClick: () => commit({ panels: {} }) });
    const panelsPage = el('div', { class: 'designer__page', id: 'designer-page-panels', role: 'tabpanel', hidden: true }, panelRow, panelHead, backgroundGroup, textGroup, accentGroup, lineGroup, ratioBox, el('div', { class: 'designer__footer' }, resetAll));

    // ---------- the picture of the window ----------
    const regions = new Map();
    const picture = el('div', { class: 'designer__preview', role: 'group', 'aria-label': 'The window: choose a part to restyle' });
    const line = (extra = '') => el('span', { class: `dv-line ${extra}`.trim() });
    const decor = {
        titlebar: () => [el('span', { class: 'dv-dot dv-dot--accent' }), line('dv-line--short'), el('span', { class: 'dv-grow' }), el('span', { class: 'dv-box dv-box--tiny' }), el('span', { class: 'dv-box dv-box--tiny' }), el('span', { class: 'dv-box dv-box--tiny' })],
        rail: () => [el('span', { class: 'dv-box dv-box--accent' }), el('span', { class: 'dv-box' }), el('span', { class: 'dv-box' }), el('span', { class: 'dv-box' })],
        left: () => [line('dv-line--title'), ...[0, 1, 2].map(() => el('span', { class: 'dv-item' }, el('span', { class: 'dv-box dv-box--small' }), el('span', { class: 'dv-lines' }, line(), line('dv-line--short'))))],
        main: () => [line('dv-line--title'), ...[0, 1, 2, 3].map((i) => el('span', { class: `dv-row${i === 1 ? ' dv-row--on' : ''}` }, el('span', { class: 'dv-box dv-box--small' }), line(i === 1 ? 'dv-line--accent' : ''), line('dv-line--short')))],
        right: () => [el('span', { class: 'dv-cover' }), line('dv-line--title'), line(), line('dv-line--accent'), line('dv-line--short')],
        player: () => [el('span', { class: 'dv-box dv-box--small' }), el('span', { class: 'dv-lines' }, line(), line('dv-line--short')), el('span', { class: 'dv-grow' }), el('span', { class: 'dv-dot dv-dot--accent' }), el('span', { class: 'dv-track' }, el('span', { class: 'dv-track-fill' })), el('span', { class: 'dv-grow' })]
    };
    for (const p of PANELS) {
        const node = el('button', { type: 'button', class: `designer__region designer__region--${p.id}`, 'data-panel': p.id, 'data-side': p.side || '', 'aria-label': p.label, 'aria-pressed': 'false' }, ...decor[p.id]());
        node.addEventListener('click', () => {
            select(p.id);
            pageTabs.setValue('panels');
            showPage('panels');
        });
        regions.set(p.id, node);
        picture.append(node);
    }
    const pictureCaption = el('div', { class: 'designer__caption' }, 'Click a part of the window to restyle it.');

    // ---------- tabs ----------
    const PAGES = { colors: colorsPage, panels: panelsPage };
    const pageTabs = tabs({
        label: 'Designer sections',
        value: 'colors',
        items: [
            { id: 'colors', label: 'Colors', panelId: 'designer-page-colors' },
            { id: 'panels', label: 'Panels', panelId: 'designer-page-panels' }
        ],
        onChange: (id) => showPage(id)
    });
    function showPage(id) {
        for (const [key, page] of Object.entries(PAGES)) page.hidden = key !== id;
        stage.dataset.page = id; // the picture marks the panel being edited only while the Panels tab is open
    }

    // ---------- actions and saved themes ----------
    const notice = el('div', { class: 'designer__notice', hidden: true });
    const saveButton = button({ label: 'Save this theme', size: 'sm', onClick: () => saveCurrent() });
    const actions = el('div', { class: 'theme-builder__actions' }, startSelect, exactLabel, saveButton);
    const savedTitle = el('div', { class: 'theme-builder__saved-title' }, 'Your saved themes');
    const savedGrid = el('div', { class: 'theme-grid theme-builder__saved' });
    const savedBox = el('div', { class: 'theme-builder__saved-box' }, savedTitle, savedGrid);

    // ---------- state ----------
    function memoryOf(id) {
        return memory[id] || {};
    }

    function select(id) {
        selected = id;
        paint();
    }

    /** Change a panel: `fn` gets everything known about it (its saved values, and the colors it had before it went back to the theme's) and returns the new values. */
    function editPanel(id, fn) {
        const known = { ...memoryOf(id), ...(panels[id] || {}) };
        const next = fn({ ...known });
        memory[id] = { bg: next.bg, bg2: next.bg2, angle: next.angle };
        commit({ panels: normalizePanels({ ...panels, [id]: next }) });
    }

    function setFill(mode) {
        editPanel(selected, (p) => {
            if (mode === 'auto') return { ...p, fill: undefined };
            const start = startingFill(custom(), selected);
            return { ...p, fill: mode, bg: p.bg || start.bg, bg2: p.bg2 || start.bg2, angle: p.angle ?? DEFAULT_ANGLE };
        });
    }

    // One change per frame: a color being dragged sends far more input events than the screen can show, and each change recolors the whole app.
    let frame = 0;
    let dirty = false;
    function commit(patch) {
        if ('colors' in patch) colors = { ...patch.colors };
        if ('exact' in patch) exact = patch.exact;
        if ('panels' in patch) panels = patch.panels;
        if ('style' in patch) style = patch.style;
        dirty = true;
        if (!frame) frame = requestAnimationFrame(flush);
    }
    const apply = (next) => commit({ colors: next });
    function flush() {
        frame = 0;
        if (!dirty) return;
        dirty = false;
        paint();
        setAppearance({ theme: CUSTOM_ID, custom: { colors, exact, panels, style } }, { defer: true });
    }

    function paint() {
        const model = custom();
        // colors
        for (const f of fields) f.paint();
        exactBox.checked = exact;
        const items = readouts(colors, { exact });
        readoutBox.replaceChildren(
            ...items.map((r) => {
                const ok = r.ratio >= 4.5;
                return el('span', { class: 'theme-builder__readout', 'data-ok': String(ok) }, `${r.label} ${r.ratio.toFixed(1)}:1`, el('span', { class: 'theme-builder__verdict' }, ok ? ' good' : ' hard to read'));
            })
        );
        const { adjusted, problems } = deriveTheme(colors, { exact });
        const names = { ink: 'Text', accent: 'The accent' };
        message.textContent = problems.length
            ? 'Some text is hard to read with these colors. Turn off "Use my exact colors" and it is adjusted for you.'
            : adjusted.length
              ? `${adjusted.map((k) => names[k]).join(' and ')} ${adjusted.length > 1 ? 'were' : 'was'} adjusted a little to stay readable; the picker keeps your choice.`
              : 'Changes apply to the whole app as you make them and are saved.';
        paintPicture(model);
        paintPanel(model);
        paintLines();
        paintSaved();
    }

    function paintPicture(model) {
        picture.style.setProperty('--pv-ground', model.vars.ground);
        for (const p of PANELS) {
            const s = panelScope(model, p.id);
            const node = regions.get(p.id);
            node.style.setProperty('--pv-bg', s.background || s.mid);
            node.style.setProperty('--pv-ink', s.ink);
            node.style.setProperty('--pv-accent', s.accent);
            node.style.setProperty('--pv-line', s.line);
            node.style.setProperty('--pv-line-w', `${s.lineWidth === undefined ? 1 : s.lineWidth}px`);
            node.dataset.changed = String(s.changed);
            node.setAttribute('aria-pressed', String(p.id === selected));
            panelChips.get(p.id).setAttribute('aria-pressed', String(p.id === selected));
        }
    }

    function paintPanel(model) {
        const spec = PANELS.find((p) => p.id === selected);
        const o = panels[selected] || {};
        const s = panelScope(model, selected);
        panelName.textContent = spec.label;
        panelHint.textContent = spec.hint;
        resetPanel.disabled = !panels[selected];
        resetAll.disabled = !Object.keys(panels).length;
        const fill = o.fill || 'auto';
        fillSeg.setValue(fill);
        bgRow.rename(fill === 'gradient' ? 'Gradient start' : 'Background', fill === 'gradient' ? 'Gradient start' : 'Panel background');
        bgRow.paint();
        bg2Row.paint();
        bgRow.el.hidden = fill === 'auto';
        bg2Row.el.hidden = fill !== 'gradient';
        gradientBar.hidden = fill !== 'gradient';
        angleRow.hidden = fill !== 'gradient';
        if (fill === 'gradient') {
            gradientBar.style.background = s.background;
            angle.value = String(o.angle ?? DEFAULT_ANGLE);
            angleValue.textContent = `${o.angle ?? DEFAULT_ANGLE}°`;
        }
        inkSeg.setValue(o.ink ? 'own' : 'auto');
        inkRow.paint();
        inkRow.el.hidden = !o.ink;
        accentSeg.setValue(o.accent ? 'own' : 'auto');
        accentRow.paint();
        accentRow.el.hidden = !o.accent;
        lineGroup.hidden = !spec.side;
        widthSeg.setValue(o.lineWidth === undefined ? 'auto' : String(o.lineWidth));
        lineSeg.setValue(o.line ? 'own' : 'auto');
        lineRow.paint();
        lineRow.el.hidden = !o.line;
        const rows = [
            ['Text', s.ratios.ink],
            ['Accent', s.ratios.accent]
        ];
        ratioBox.replaceChildren(
            ...rows.map(([name, ratio]) => el('span', { class: 'designer__ratio', 'data-ok': String(ratio >= 4.5) }, `${name} ${ratio.toFixed(1)}:1`, el('span', { class: 'theme-builder__verdict' }, ratio >= 4.5 ? ' good' : ' hard to read'))),
            (o.ink || o.accent) && !exact ? el('span', { class: 'designer__ratio-note' }, 'Colors are nudged a little where needed to stay readable.') : ''
        );
    }

    function paintLines() {
        const strengthNow = style.lineStrength ?? LINE_DEFAULT;
        strength.value = String(strengthNow);
        strengthValue.textContent = `${strengthNow}%`;
        lineKind.setValue(style.lineColor ? 'own' : 'auto');
        lineColorRow.paint();
        lineColorRow.el.hidden = !style.lineColor;
        resetLines.disabled = !Object.keys(style).length;
        const [thin, strong] = lineColors(colors.surface, colors.ink, { strength: strengthNow, color: style.lineColor });
        linePreview.style.background = colors.surface;
        linePreview.style.borderTop = `1px solid ${thin}`;
        linePreview.style.borderBottom = `2px solid ${strong}`;
    }

    function paintSaved() {
        const list = listSavedThemes();
        savedBox.hidden = list.length === 0;
        const now = getAppearance();
        const here = { panels, style };
        savedGrid.replaceChildren(
            ...list.map((t) =>
                savedThemeCard({
                    name: t.name,
                    colors: t.colors,
                    current: now.theme === CUSTOM_ID && sameColors(t.colors, colors) && t.exact === exact && sameDesign(t, here),
                    onApply: () => commit({ colors: t.colors, exact: t.exact, panels: t.panels, style: t.style }),
                    onRename: () => renameCurrent(t),
                    onDelete: () => deleteSavedTheme(t.id)
                })
            )
        );
    }

    async function renameCurrent(theme) {
        const field = textField({ label: 'Theme name', value: theme.name, hint: 'Only the name changes.' });
        const chosen = await openDialog({
            title: 'Rename this theme',
            body: el('div', {}, field.el),
            actions: [
                { label: 'Cancel', value: null },
                {
                    label: 'Rename',
                    variant: 'primary',
                    value: true,
                    onClick: () => {
                        const next = field.input.value.trim();
                        if (!next) throw new Error('Write a name first.');
                        if (listSavedThemes().some((t) => t.id !== theme.id && t.name.toLowerCase() === next.toLowerCase())) throw new Error('Another saved theme has that name.');
                    }
                }
            ]
        });
        if (chosen === true) renameTheme(theme.id, field.input.value);
    }

    async function saveCurrent() {
        const field = textField({ label: 'Theme name', value: '', placeholder: 'For example: Midnight rose', hint: 'Saving under a name you already used replaces that theme.' });
        const chosen = await openDialog({
            title: 'Save this theme',
            body: el('div', {}, field.el),
            actions: [
                { label: 'Cancel', value: null },
                {
                    label: 'Save',
                    variant: 'primary',
                    value: true,
                    onClick: () => {
                        if (!field.input.value.trim()) throw new Error('Write a name first.');
                    }
                }
            ]
        });
        if (chosen !== true) return;
        const saved = saveTheme(field.input.value, colors, exact, { panels, style });
        if (!saved) {
            notice.hidden = false;
            notice.textContent = 'The list of saved themes is full. Delete one first.';
        }
    }

    const stage = el('div', { class: 'designer__stage', 'data-page': 'colors' }, el('div', { class: 'designer__picture' }, picture, pictureCaption), el('div', { class: 'designer__controls' }, pageTabs.el, colorsPage, panelsPage));
    const section = el('div', { class: 'theme-builder', 'data-theme-builder': '' }, stage, actions, notice, savedBox);
    paint();
    // Another place changed the theme (a card, a reload): show that theme's colors, ready to edit.
    const stopSaved = watchSavedThemes(() => (section.isConnected ? paintSaved() : stopSaved()));
    const off = watchAppearance((next) => {
        if (!section.isConnected) return off();
        if (frame) return; // our own change is on its way
        const mine = next.theme === CUSTOM_ID && next.custom;
        if (mine && sameColors(next.custom.colors, colors) && next.custom.exact === exact && sameDesign(next.custom, { panels, style })) return; // our own change, already shown
        colors = mine ? { ...next.custom.colors } : currentColors();
        exact = Boolean(mine && next.custom.exact);
        ({ panels, style } = mine ? designOf(next.custom) : { panels: {}, style: {} });
        paint();
    });
    return {
        el: section,
        refresh: () => {
            colors = currentColors();
            ({ panels, style } = currentDesign());
            paint();
        },
        startFrom: apply,
        themeColors
    };
}
