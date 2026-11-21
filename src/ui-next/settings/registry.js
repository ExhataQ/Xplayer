// The Settings registry: the one place that says what Settings contains.
//
//   section  (a page in the left menu: General, Playback ...)
//     part   (a card on that page: Scrollbar, Transitions ...)
//       row  (one setting: a label and its control)
//         children  (rows that depend on it and sit indented under it: the cat's skin under "Show the cat")
//
// Nothing here draws anything; settings/page.js reads this and draws. To add a setting, add a row to a part. To add a card, add a part
// to a section. To add a whole page, register a section. Each takes one object, in any file, as long as it runs before Settings opens.
//
//   registerSection({ id, label, icon, order, available?, parts })
//   registerPart(sectionId, { id, title, hint?, rows } or { id, title, render(ctx) }, { after?: partId })
//   registerRow(sectionId, partId, row, { after?: rowId })
//
// A row (what each field does is in settings/kit.js):
//   { id, type, label, hint?, get, set, subscribe?, when?, disabled?, children?, ... }
//   (a choice or select may give `options` as a function; it is called when the page is drawn, which is after the engine has started)
// Types: toggle, choice, select, slider, number, action, info, custom.
//
// A typo throws here, when the page is built, not at the first click.

export const ROW_TYPES = ['toggle', 'choice', 'select', 'slider', 'number', 'action', 'info', 'custom'];

const sections = new Map();

const need = (cond, message) => {
    if (!cond) throw new Error(`settings registry: ${message}`);
};
const isId = (value) => typeof value === 'string' && /^[a-z][a-z0-9-]*$/.test(value);

function checkRow(row, where, seen) {
    need(row && typeof row === 'object', `${where}: a row must be an object`);
    need(isId(row.id), `${where}: row id "${row.id}" must be lower-case letters, digits and dashes`);
    need(!seen.has(row.id), `${where}: row "${row.id}" is there twice`);
    seen.add(row.id);
    need(ROW_TYPES.includes(row.type), `${where}: row "${row.id}" has an unknown type "${row.type}"`);
    if (row.type !== 'custom' && row.type !== 'info' && row.type !== 'action') need(typeof row.label === 'string' && row.label, `${where}: row "${row.id}" needs a label`);
    if (['toggle', 'choice', 'select', 'slider', 'number'].includes(row.type)) {
        need(typeof row.get === 'function' && typeof row.set === 'function', `${where}: row "${row.id}" needs get() and set()`);
    }
    if (row.type === 'choice' || row.type === 'select') need(typeof row.options === 'function' || (Array.isArray(row.options) && row.options.length > 1), `${where}: row "${row.id}" needs options (a list, or a function that returns one)`);
    if (row.style !== undefined) need(row.type === 'choice' && ['segmented', 'preview'].includes(row.style), `${where}: row "${row.id}" has a style that is not allowed (only a choice: segmented or preview)`);
    if (row.type === 'slider') need((Number.isFinite(row.min) || typeof row.min === 'function') && (Number.isFinite(row.max) || typeof row.max === 'function'), `${where}: row "${row.id}" needs min and max (numbers, or functions that return them)`);
    if (row.type === 'action') need(Array.isArray(row.actions) && row.actions.length > 0, `${where}: row "${row.id}" needs actions`);
    if (row.type === 'custom') need(typeof row.render === 'function', `${where}: row "${row.id}" needs render()`);
    if (row.children !== undefined) {
        need(Array.isArray(row.children), `${where}: children of "${row.id}" must be a list`);
        for (const child of row.children) checkRow(child, `${where} > ${row.id}`, seen);
    }
}

function checkPart(part, where) {
    need(part && typeof part === 'object', `${where}: a part must be an object`);
    need(isId(part.id), `${where}: part id "${part.id}" must be lower-case letters, digits and dashes`);
    need(typeof part.title === 'string' && part.title, `${where}: part "${part.id}" needs a title`);
    if (typeof part.render === 'function') return; // a part that draws itself has no rows to check
    need(Array.isArray(part.rows), `${where}: part "${part.id}" needs rows`);
    const seen = new Set();
    for (const row of part.rows) checkRow(row, `${where} > ${part.id}`, seen);
}

function insert(list, item, after) {
    const at = after ? list.findIndex((entry) => entry.id === after) : -1;
    need(!after || at >= 0, `"${after}" is not there to put "${item.id}" after`);
    if (at >= 0) list.splice(at + 1, 0, item);
    else list.push(item);
}

export function registerSection(def) {
    need(def && typeof def === 'object', 'a section must be an object');
    need(isId(def.id), `section id "${def.id}" must be lower-case letters, digits and dashes`);
    need(!sections.has(def.id), `section "${def.id}" is already registered`);
    need(typeof def.label === 'string' && def.label, `section "${def.id}" needs a label`);
    need(typeof def.icon === 'string' && def.icon, `section "${def.id}" needs an icon`);
    const parts = def.parts || [];
    need(Array.isArray(parts), `section "${def.id}": parts must be a list`);
    const seen = new Set();
    for (const part of parts) {
        checkPart(part, def.id);
        need(!seen.has(part.id), `section "${def.id}": part "${part.id}" is there twice`);
        seen.add(part.id);
    }
    sections.set(def.id, { id: def.id, label: def.label, icon: def.icon, order: Number.isFinite(def.order) ? def.order : 100, available: def.available, parts: [...parts] });
}

export function registerPart(sectionId, part, { after } = {}) {
    const section = sections.get(sectionId);
    need(section, `section "${sectionId}" is not registered`);
    checkPart(part, sectionId);
    need(!section.parts.some((p) => p.id === part.id), `section "${sectionId}": part "${part.id}" is already there`);
    insert(section.parts, part, after);
}

export function registerRow(sectionId, partId, row, { after } = {}) {
    const section = sections.get(sectionId);
    need(section, `section "${sectionId}" is not registered`);
    const part = section.parts.find((p) => p.id === partId);
    need(part, `section "${sectionId}" has no part "${partId}"`);
    need(Array.isArray(part.rows), `part "${partId}" draws itself; it has no rows to add to`);
    const seen = new Set();
    for (const existing of part.rows) checkRow(existing, `${sectionId} > ${partId}`, seen);
    checkRow(row, `${sectionId} > ${partId}`, seen);
    insert(part.rows, row, after);
}

/** The sections to draw now, in order. A section whose available() says no (AI, when it is not registered) is left out. */
export function getSections() {
    return [...sections.values()]
        .filter((section) => typeof section.available !== 'function' || section.available())
        .sort((a, b) => a.order - b.order);
}

export const getSection = (id) => sections.get(id) || null;

/** For tests: forget everything. */
export function clearRegistry() {
    sections.clear();
}
