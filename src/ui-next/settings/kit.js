// The Settings kit: turns the plain objects of settings/registry.js into DOM. Every control on every Settings page comes from here, so every
// row looks, behaves and is reached by keyboard the same way.
//
// A row object (all fields optional unless said):
//   id, type, label, hint                 what it is. hint may be a function that returns the text (it is read again on every refresh).
//   get() / set(value) / subscribe(cb)    where the value lives. subscribe returns an unsubscribe function; call cb when it changes elsewhere.
//   when()                                false hides the row (and its children).
//   disabled()                            true greys the controls out.
//   children, childrenWhen(value)         rows that depend on this one. They sit indented under it; shown when childrenWhen(value) is true
//                                         (a toggle's default: when it is on; any other row's default: always).
//   layout: 'stack'                       the control goes under the label instead of at its end (custom rows do this by default).
// By type:
//   toggle   an on/off switch; get/set use true and false.
//   choice   options: [{ value, label, preview? }]. style 'segmented' (default): 2 to 4 buttons side by side; style 'preview': boxes with a small
//            picture (option.preview, static SVG/HTML) for choices you recognise by sight.
//   select   a menu for longer lists; options: [{ value, label }].
//   slider   min, max, step, format(value) for the number shown beside it.
//   number   a number box; min, max, step.
//   action   one or more buttons; actions: [{ label, icon?, variant?, run(), confirm?: { title, message, confirmLabel } }].
//            run() may return a promise and may return a short text, which is shown under the row for a moment.
//   info     text at the end of the row; value is a string, or a function returning a string or a promise of one. mono: true for paths.
//   custom   render(ctx, { note }) returns a node, or { el, update?, destroy? }. update() runs on every refresh.
// A part may also give render(ctx) instead of rows, and then draws itself (the AI section does: it brings its own cards).
//
// buildRow / buildPart return { el, update(), destroy() }. A context (createContext) keeps them in step: after any change it calls
// update() on all of them, which is what shows and hides the children and the rows that carry a when().

import { el, button, segmented, setLoading, confirmDialog } from '../components/index.js';
import { updateRangeFill } from '../views/tools/range-fill.js';

/** The thing every row of one page shares: it keeps the rows up to date and lets them clean up after themselves. */
export function createContext({ isLive = () => true } = {}) {
    const items = new Set();
    const cleanups = [];
    let destroyed = false;
    const ctx = {
        /** Re-reads every value and shows or hides what depends on it. Cheap; called after every change. */
        refresh() {
            if (destroyed) return;
            if (!isLive()) return void ctx.destroy();
            for (const item of [...items]) item.update();
        },
        track(item) {
            items.add(item);
            return item;
        },
        cleanup(fn) {
            cleanups.push(fn);
        },
        destroy() {
            if (destroyed) return;
            destroyed = true;
            for (const item of [...items]) if (item.destroy) item.destroy();
            items.clear();
            for (const fn of cleanups.splice(0)) {
                try {
                    fn();
                } catch (_) {
                    /* a listener that is already gone */
                }
            }
        },
        get destroyed() {
            return destroyed;
        }
    };
    return ctx;
}

const text = (value) => (typeof value === 'function' ? value() : value);
const optionsOf = (row) => (typeof row.options === 'function' ? row.options() : row.options);
const same = (a, b) => String(a) === String(b);
const num = (v) => (typeof v === 'function' ? v() : v);

// Saves a value, then refreshes the page. A set() that returns a promise (a switch that asks the main process) refreshes again when it is done.
function commit(row, ctx, value) {
    const result = row.set(value);
    ctx.refresh();
    if (result && typeof result.then === 'function') result.then(() => ctx.refresh(), () => ctx.refresh());
}

// ---------- controls ----------

function switchControl(row, ctx) {
    const node = el('button', { type: 'button', class: 'sp-switch', role: 'switch', 'aria-checked': 'false', 'aria-label': row.label });
    node.append(el('span', { class: 'sp-switch__thumb' }));
    node.addEventListener('click', () => {
        if (node.disabled) return;
        commit(row, ctx, node.getAttribute('aria-checked') !== 'true');
    });
    return { el: node, paint: (value) => node.setAttribute('aria-checked', String(value === true)) };
}

/**
 * A group of boxes to choose one from: each box shows a small picture (item.preview: static SVG/HTML markup) above its label.
 * Arrow keys move and choose; items[].disabled greys one out.
 * Returns { el, setValue(value) }.
 */
export function choiceBoxes({ label, items, value, onChange, kind = 'preview' }) {
    const root = el('div', { class: `sp-boxes sp-boxes--${kind}`, role: 'radiogroup', 'aria-label': label });
    const boxes = items.map((item) => {
        const node = el('button', { type: 'button', class: 'sp-box', role: 'radio', 'aria-checked': 'false', tabindex: '-1' });
        if (kind === 'preview' && item.preview) {
            const art = el('span', { class: 'sp-box__art', 'aria-hidden': 'true' });
            art.innerHTML = item.preview;
            node.append(art);
        }
        node.append(el('span', { class: 'sp-box__label' }, item.label));
        node.disabled = item.disabled === true;
        node.addEventListener('click', () => {
            if (node.disabled) return;
            setValue(item.value);
            onChange(item.value);
        });
        root.append(node);
        return { item, node };
    });
    function setValue(next) {
        const chosen = boxes.find((b) => same(b.item.value, next)) || boxes.find((b) => !b.node.disabled) || boxes[0];
        for (const b of boxes) {
            const on = b === chosen;
            b.node.setAttribute('aria-checked', String(on && same(b.item.value, next)));
            b.node.tabIndex = on ? 0 : -1;
        }
    }
    root.addEventListener('keydown', (event) => {
        const enabled = boxes.filter((b) => !b.node.disabled);
        const at = enabled.findIndex((b) => b.node === document.activeElement);
        if (at < 0) return;
        const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
        if (!step) return;
        event.preventDefault();
        const target = enabled[(at + step + enabled.length) % enabled.length];
        target.node.focus();
        target.node.click();
    });
    setValue(value);
    return { el: root, setValue };
}

function choiceControl(row, ctx) {
    const list = optionsOf(row);
    if (row.style === 'preview') {
        const boxes = choiceBoxes({
            label: row.label,
            kind: row.style,
            value: row.get(),
            items: list,
            onChange: (picked) => commit(row, ctx, picked)
        });
        return { el: boxes.el, paint: (value) => boxes.setValue(value) };
    }
    const control = segmented({
        label: row.label,
        value: String(row.get()),
        items: list.map((o) => ({ value: String(o.value), label: o.label })),
        onChange: (picked) => {
            const option = list.find((o) => same(o.value, picked));
            commit(row, ctx, option ? option.value : picked);
        }
    });
    return { el: control.el, paint: (value) => control.setValue(String(value)) };
}

function selectControl(row, ctx) {
    const list = optionsOf(row);
    const node = el('select', { class: 'sp-select', 'aria-label': row.label });
    for (const o of list) node.append(el('option', { value: String(o.value) }, o.label));
    node.addEventListener('change', () => {
        const option = list.find((o) => same(o.value, node.value));
        commit(row, ctx, option ? option.value : node.value);
    });
    return { el: node, paint: (value) => (node.value = String(value)) };
}

function sliderControl(row, ctx) {
    const input = el('input', { type: 'range', class: 'sp-range', min: num(row.min), max: num(row.max), step: num(row.step) || 1, 'aria-label': row.label });
    const readout = el('output', { class: 'sp-range__value' });
    const format = row.format || ((v) => String(v));
    input.addEventListener('input', () => {
        const value = Number(input.value);
        readout.textContent = format(value);
        input.setAttribute('aria-valuetext', format(value));
        updateRangeFill(input);
        commit(row, ctx, value);
    });
    return {
        el: el('div', { class: 'sp-range-wrap' }, input, readout),
        paint(value) {
            if (document.activeElement !== input) input.value = String(value); // the slider being dragged already shows its value
            readout.textContent = format(Number(value));
            input.setAttribute('aria-valuetext', format(Number(value)));
            updateRangeFill(input);
        }
    };
}

function numberControl(row, ctx) {
    const input = el('input', { type: 'number', class: 'sp-number', min: num(row.min), max: num(row.max), step: num(row.step) || 1, 'aria-label': row.label });
    input.addEventListener('change', () => {
        let value = Number(input.value);
        if (!Number.isFinite(value)) return ctx.refresh(); // put the saved value back
        if (Number.isFinite(num(row.min))) value = Math.max(num(row.min), value);
        if (Number.isFinite(num(row.max))) value = Math.min(num(row.max), value);
        commit(row, ctx, value);
    });
    return { el: input, paint: (value) => (document.activeElement === input ? undefined : (input.value = String(value))) };
}

const CONTROLS = { toggle: switchControl, choice: choiceControl, select: selectControl, slider: sliderControl, number: numberControl };

function actionControl(row, note) {
    const wrap = el('div', { class: 'sp-actions' });
    const nodes = row.actions.map((action) => {
        const node = button({
            label: action.label,
            icon: action.icon,
            variant: action.variant || 'outline',
            onClick: async () => {
                if (action.confirm && !(await confirmDialog(action.confirm))) return;
                setLoading(node, true);
                try {
                    const result = await action.run();
                    if (typeof result === 'string') note(result);
                } catch (error) {
                    note(action.failed || 'Could not do that', 'error');
                } finally {
                    setLoading(node, false);
                }
            }
        });
        wrap.append(node);
        return { node, action };
    });
    return { el: wrap, nodes };
}

// ---------- rows ----------

/** One setting. `ctx` comes from createContext. */
export function buildRow(row, ctx) {
    const stack = row.layout === 'stack' || (row.type === 'custom' && row.layout !== 'inline');
    const title = row.label ? el('div', { class: 'sp-row__title' }, row.label) : null;
    const hint = el('div', { class: 'sp-row__hint' });
    const noteNode = el('div', { class: 'sp-row__note', role: 'status' });
    let noteTimer = 0;
    const note = (message, tone = 'ok') => {
        clearTimeout(noteTimer);
        noteNode.textContent = message;
        noteNode.dataset.tone = tone;
        noteNode.hidden = !message;
        if (message && tone !== 'error') noteTimer = setTimeout(() => note(''), 2500);
    };
    note('');

    const labelBlock = el('div', { class: 'sp-row__label' }, title, hint, noteNode);
    const root = el('div', { class: `sp-row${stack ? ' sp-row--stack' : ''}`, 'data-row': row.id, 'data-type': row.type });
    const main = el('div', { class: 'sp-row__main' }, labelBlock);
    root.append(main);

    let control = null; // { el, paint?, update?, destroy?, nodes? }
    let controlEl = null;
    if (CONTROLS[row.type]) {
        control = CONTROLS[row.type](row, ctx);
        controlEl = control.el;
    } else if (row.type === 'action') {
        control = actionControl(row, note);
        controlEl = control.el;
    } else if (row.type === 'info') {
        const value = el('div', { class: `sp-info${row.mono ? ' sp-info--mono' : ''}`, dir: 'auto' });
        const set = (v) => {
            value.textContent = v === undefined || v === null || v === '' ? '—' : String(v);
            if (row.mono) value.title = value.textContent;
        };
        const given = typeof row.value === 'function' ? row.value() : row.value;
        if (given && typeof given.then === 'function') {
            set('');
            given.then(set, () => set(''));
        } else {
            set(given);
        }
        const live = typeof row.value === 'function' && !(given && typeof given.then === 'function');
        control = { el: value, update: live ? () => set(row.value()) : undefined };
        controlEl = value;
    } else if (row.type === 'custom') {
        const made = row.render(ctx, { note }); // note(text, tone?) shows a short message under the row
        control = made instanceof Node ? { el: made } : made;
        controlEl = control.el;
    }
    if (controlEl) {
        controlEl.classList.add('sp-row__control-inner');
        main.append(el('div', { class: 'sp-row__control' }, controlEl));
    }

    // The rows that depend on this one.
    let kids = null;
    let kidHandles = [];
    if (row.children && row.children.length) {
        kids = el('div', { class: 'sp-children' });
        kidHandles = row.children.map((child) => buildRow(child, ctx));
        for (const handle of kidHandles) kids.append(handle.el);
        root.append(kids);
    }

    let unsubscribe = null;
    if (typeof row.subscribe === 'function') {
        unsubscribe = row.subscribe(() => ctx.refresh());
    }

    const handle = {
        el: root,
        note,
        update() {
            const visible = typeof row.when === 'function' ? row.when() !== false : true;
            root.hidden = !visible;
            if (!visible) return;
            let value;
            if (typeof row.get === 'function') {
                value = row.get();
                if (control && control.paint) control.paint(value);
            }
            if (control && control.update) control.update();
            const hintText = text(row.hint);
            hint.textContent = hintText || '';
            hint.hidden = !hintText;
            // Only a row that says when it is disabled touches its controls; a custom control keeps its own disabled buttons.
            const off = typeof row.disabled === 'function' ? row.disabled() === true : false;
            root.dataset.disabled = off ? 'true' : 'false';
            if (typeof row.disabled === 'function') {
                for (const node of root.querySelectorAll(':scope > .sp-row__main button, :scope > .sp-row__main input, :scope > .sp-row__main select')) node.disabled = off;
            }
            if (control && control.nodes) {
                for (const { node, action } of control.nodes) if (typeof action.disabled === 'function') node.disabled = off || action.disabled() === true;
            }
            if (kids) {
                const open = typeof row.childrenWhen === 'function' ? row.childrenWhen(value) : row.type === 'toggle' ? value === true : true;
                kids.hidden = !open;
                root.dataset.open = String(open);
            }
            if (control && control.refreshExtra) control.refreshExtra();
        },
        destroy() {
            clearTimeout(noteTimer);
            if (unsubscribe) unsubscribe();
            if (control && control.destroy) control.destroy();
        }
    };
    ctx.track(handle);
    handle.update();
    return handle;
}

// ---------- parts ----------

/** One card: a title, an optional line under it, and its rows. */
export function buildPart(part, ctx) {
    if (typeof part.render === 'function') {
        // A part that draws itself (the AI section's cards): it is not wrapped in a card of its own.
        const made = part.render(ctx);
        const handle = made instanceof Node ? { el: made } : made;
        const wrapped = { el: handle.el, update: () => handle.update && handle.update(), destroy: () => handle.destroy && handle.destroy() };
        ctx.track(wrapped);
        return wrapped;
    }
    const head = el('div', { class: 'sp-part__head' }, el('h3', { class: 'sp-part__title' }, part.title), part.hint ? el('div', { class: 'sp-part__hint' }, part.hint) : null);
    const body = el('div', { class: 'sp-part__body' });
    const root = el('section', { class: 'sp-part', 'data-part': part.id, 'aria-label': part.title }, head, body);
    for (const row of part.rows) body.append(buildRow(row, ctx).el);
    const handle = {
        el: root,
        update() {
            root.hidden = typeof part.when === 'function' ? part.when() === false : false;
        }
    };
    ctx.track(handle);
    handle.update();
    return handle;
}
