// Tag sheet view (task PD-03, agent D): many songs on one screen, like a spreadsheet in function. Rows are songs, columns are the
// tags the person chose. The state and every action live in tag-sheet-actions.js (the AI drives the same sheet); this file draws
// them and asks the person things (the review dialog). Edits are written only after the review, one call for all files.
//
//   mountTagSheet(host)   draws the sheet into host (state survives leaving and coming back)
//   tagSheetDirty()       true when there are staged changes
//   discardTagSheet()

import { el, openDialog } from '../../components/index.js';
import { tagSheetApi as api, tagSheetUi as ui } from './tag-sheet-actions.js';
import { COLUMNS, normalize, valueOf } from './tag-sheet-model.js';

const { sheet, checked } = ui;
const MAX_DRAWN = 1000;
let applyColumn = 'genre';
let applyText = '';
let note = '';
let readProblem = ''; // why files could not be read (for example Python or mutagen is missing), shown once in the status line

export const tagSheetDirty = () => ui.isDirty();

export function discardTagSheet() {
    api.discardChanges();
}

const text = (value) => (Array.isArray(value) ? value.join('; ') : String(value ?? ''));

export function mountTagSheet(host) {
    host.replaceChildren();
    const root = el('div', { class: 'tag-sheet', 'aria-label': 'Tag sheet' });
    host.append(root);
    // Anything that changes the sheet (the person, or the AI through the same actions) redraws it.
    const off = ui.subscribe(() => (root.isConnected ? paint(root, { skipRead: true }) : off()));
    ui.setReviewer(() => review(root));
    paint(root);
    ui.restoreUndo(); // after a restart, offers Undo for the last apply that the journal still holds
}

function topValues(key) {
    const counts = new Map();
    for (const id of sheet.order) {
        const value = valueOf(sheet, id, key);
        for (const v of Array.isArray(value) ? value : value ? [value] : []) counts.set(v, (counts.get(v) || 0) + 1);
    }
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 8);
}

function paint(root, { skipRead = false } = {}) {
    const focused = document.activeElement?.dataset?.focusKey;
    root.replaceChildren(toolbar(root), applyBar(root), finderBar(root), table(root), footer(root));
    if (focused) root.querySelector(`[data-focus-key="${focused}"]`)?.focus();
    if (!skipRead) {
        api.readTags().then((result) => {
            const next = result.problem || '';
            if (next === readProblem || !root.isConnected) return;
            readProblem = next;
            paint(root, { skipRead: true });
        });
    }
}

function toolbar(root) {
    const list = api.listSources();
    const group = (label, id) => {
        const items = list.filter((s) => s.group === id);
        return items.length ? el('optgroup', { label }, items.map((s) => el('option', { value: s.id }, s.label))) : null;
    };
    const load = el('select', { 'aria-label': 'Add songs from', 'data-focus-key': 'load', onchange: (event) => {
        const id = event.target.value;
        if (!id) return;
        const result = api.loadSongs(id);
        note = result.added ? `Added ${result.added} song${result.added === 1 ? '' : 's'}.` : 'Those songs are already in the sheet.';
        paint(root);
    } }, el('option', { value: '' }, 'Add songs from…'), group('Now', 'now'), group('Library', 'library'), group('Playlists', 'playlist'), group('Albums', 'album'), group('Artists', 'artist'));
    const columns = el('details', { class: 'tag-sheet__columns' }, el('summary', {}, 'Columns'), el('div', { class: 'tag-sheet__column-list' },
        api.listColumns().map((column) => el('label', {}, el('input', { type: 'checkbox', checked: column.shown, onchange: (event) => {
            const keys = api.listColumns().filter((c) => (c.key === column.key ? event.target.checked : c.shown)).map((c) => c.key);
            api.setColumns(keys);
            paint(root);
        } }), column.label))));
    return el('div', { class: 'tag-sheet__toolbar' }, load, columns);
}

const showValue = (value) => (Array.isArray(value) ? value.join('; ') : value) || '(empty)';

/** Find tags online (PD-05): looks the checked songs up, stages the sure matches like any edit, and lists the unsure ones here to accept or skip. */
function finderBar(root) {
    const found = ui.finder.findings();
    const running = ui.finder.running();
    const find = el('button', { type: 'button', class: 'tag-sheet__button', disabled: running || checked.size === 0, title: 'Looks the checked songs up on MusicBrainz and stages the original album, year, genre and label. Nothing is written until you review and apply.', onclick: async () => {
        const result = await ui.finder.run();
        if (!result.ok) {
            note = result.error;
            paint(root, { skipRead: true });
        }
    } }, 'Find tags online');
    const cancel = running ? el('button', { type: 'button', class: 'tag-sheet__button', onclick: () => ui.finder.cancel() }, 'Cancel search') : null;
    const last = found.last ? `Last search: ${found.last.staged} staged, ${found.last.review} to review, ${found.last.none + found.last.unchanged} nothing to change${found.last.error ? `, ${found.last.error} failed` : ''}.` : '';
    const state = running ? 'Looking songs up, about 3 to 4 seconds each. Progress is in the notifications.' : last;
    const shown = found.items.slice(0, 50);
    const queue = found.items.length === 0 ? null : el('div', { class: 'tag-sheet__findings' },
        el('div', { class: 'tag-sheet__finder-row' },
            el('strong', {}, `${found.items.length} song${found.items.length === 1 ? '' : 's'} need${found.items.length === 1 ? 's' : ''} your review`),
            el('button', { type: 'button', class: 'tag-sheet__button', onclick: () => ui.finder.accept() }, 'Accept all'),
            el('button', { type: 'button', class: 'tag-sheet__button', onclick: () => ui.finder.skip() }, 'Skip all')),
        el('ul', { class: 'tag-sheet__finding-list' }, shown.map((item) => el('li', { class: 'tag-sheet__finding' },
            el('span', { class: 'tag-sheet__finding-title' }, item.title),
            el('span', { class: 'tag-sheet__finding-detail' }, `${item.release.title}${item.release.date ? ` (${String(item.release.date).slice(0, 4)})` : ''}, ${Math.round(item.confidence * 100)}% sure. ${item.changes.map((change) => `${COLUMNS[change.key]?.label || change.key}: ${showValue(change.before)} → ${showValue(change.after)}`).join('; ')}`),
            el('button', { type: 'button', class: 'tag-sheet__button', onclick: () => ui.finder.accept([item.id]) }, 'Accept'),
            el('button', { type: 'button', class: 'tag-sheet__button', onclick: () => ui.finder.skip([item.id]) }, 'Skip')))),
        found.items.length > shown.length ? el('p', { class: 'tag-sheet__hint' }, `Showing the first ${shown.length}. Accept or skip these to see the rest.`) : null);
    return el('div', { class: 'tag-sheet__finder' }, el('div', { class: 'tag-sheet__finder-row' }, find, cancel, state ? el('span', { class: 'tag-sheet__hint', role: 'status' }, state) : null), queue);
}

function applyBar(root) {
    const column = el('select', { 'aria-label': 'Tag to apply', 'data-focus-key': 'apply-column', onchange: (event) => {
        applyColumn = event.target.value;
        paint(root);
    } }, Object.entries(COLUMNS).map(([key, def]) => el('option', { value: key, selected: key === applyColumn }, def.label)));
    const input = el('input', { type: 'text', class: 'tag-sheet__value', 'aria-label': 'Tag or name', placeholder: 'Tag or name (use ; for several)', value: applyText, 'data-focus-key': 'apply-value', oninput: (event) => {
        applyText = event.target.value;
    } });
    const run = (mode) => {
        if (checked.size === 0) {
            note = 'Check some rows first.';
            return paint(root);
        }
        if (mode !== 'remove' && normalize(applyColumn, applyText).length === 0) {
            note = 'Type a tag or name first.';
            return paint(root);
        }
        const result = api.applyTag({ column: applyColumn, value: applyText, mode });
        note = result.ok && result.skipped.length ? `${result.skipped.length} song${result.skipped.length === 1 ? '' : 's'} skipped: their tags are still loading.` : result.ok ? '' : result.error;
        paint(root);
    };
    const buttons = [['add', 'Add'], ['replace', 'Replace'], ['remove', 'Remove']].map(([mode, label]) => el('button', { type: 'button', class: 'tag-sheet__button', onclick: () => run(mode) }, label));
    const popular = topValues(applyColumn).map(([value, count]) => el('button', { type: 'button', class: 'tag-sheet__chip', title: `On ${count} song${count === 1 ? '' : 's'}`, onclick: () => {
        applyText = value;
        paint(root);
    } }, value));
    return el('div', { class: 'tag-sheet__apply' }, el('div', { class: 'tag-sheet__apply-row' }, column, input, buttons, el('span', { class: 'tag-sheet__hint' }, `on ${checked.size} checked`)), popular.length ? el('div', { class: 'tag-sheet__popular' }, el('span', { class: 'tag-sheet__hint' }, 'Most used'), popular) : null);
}

function cell(root, id, key) {
    const value = valueOf(sheet, id, key);
    const loaded = key in sheet.rows.get(id);
    const staged = sheet.staged.get(id)?.[key] !== undefined;
    const td = el('td', { class: `tag-sheet__cell${staged ? ' is-changed' : ''}`, tabindex: 0, 'data-focus-key': `${id}:${key}`, title: staged ? 'Changed. Not saved yet.' : '' });
    if (!loaded) {
        const row = sheet.rows.get(id);
        td.append(el('span', { class: 'tag-sheet__loading', title: row.unreadable ? row.problem || '' : '' }, row.unreadable ? 'unreadable' : '…'));
    } else if (Array.isArray(value)) {
        td.append(...value.map((v) => el('span', { class: 'tag-sheet__tag' }, v)));
    } else td.append(value);
    const edit = () => {
        if (!loaded) return;
        const field = el('input', { type: 'text', class: 'tag-sheet__editor', value: text(value), 'aria-label': COLUMNS[key].label });
        let done = false; // removing the input fires blur, which must not commit a second time
        const finish = (save) => {
            if (done) return;
            done = true;
            if (save) api.setCell({ id, key, value: field.value });
            paint(root);
        };
        field.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') finish(true);
            else if (event.key === 'Escape') finish(false);
        });
        field.addEventListener('blur', () => finish(true));
        td.replaceChildren(field);
        field.focus();
        field.select();
    };
    td.addEventListener('dblclick', edit);
    td.addEventListener('keydown', (event) => {
        if (event.target === td && (event.key === 'Enter' || event.key === 'F2')) edit();
    });
    return td;
}

function table(root) {
    if (sheet.order.length === 0) return el('div', { class: 'tag-sheet__empty' }, 'No songs yet. Use "Add songs from…" to load a playlist, album, artist, your selection, the queue or a search.');
    const ids = sheet.order.slice(0, MAX_DRAWN);
    const all = el('input', { type: 'checkbox', 'aria-label': 'Check all rows', checked: ids.length > 0 && ids.every((id) => checked.has(id)), onchange: (event) => {
        if (event.target.checked) api.checkRows(ids);
        else for (const id of ids) checked.delete(id);
        paint(root);
    } });
    const head = el('tr', {}, el('th', { class: 'tag-sheet__check' }, all), sheet.columns.map((key) => el('th', {}, COLUMNS[key].label)));
    const rows = ids.map((id) => el('tr', { class: checked.has(id) ? 'is-checked' : '' }, el('td', { class: 'tag-sheet__check' }, el('input', { type: 'checkbox', 'aria-label': `Check ${text(valueOf(sheet, id, 'title')) || 'song'}`, checked: checked.has(id), onchange: (event) => {
        event.target.checked ? checked.add(id) : checked.delete(id);
        paint(root);
    } })), sheet.columns.map((key) => cell(root, id, key))));
    return el('div', { class: 'tag-sheet__scroll' }, el('table', { class: 'tag-sheet__table' }, el('thead', {}, head), el('tbody', {}, rows)), sheet.order.length > MAX_DRAWN ? el('p', { class: 'tag-sheet__hint' }, `Showing the first ${MAX_DRAWN} of ${sheet.order.length} songs.`) : null);
}

/** The review the person sees before anything is written. Used by the Review and apply button and by the AI's requestApply(). */
async function review(root) {
    const items = ui.pending();
    if (items.length === 0) return;
    const rows = items.flatMap((item) => Object.keys(item.metadata).map((key) => ({ item, key })));
    const shown = rows.slice(0, 300);
    const total = rows.length;
    const table = el('table', { class: 'tag-sheet__review' }, el('thead', {}, el('tr', {}, el('th', {}, 'Song'), el('th', {}, 'Tag'), el('th', {}, 'Before'), el('th', {}, 'After'))),
        el('tbody', {}, shown.map(({ item, key }) => el('tr', {}, el('td', {}, text(valueOf(sheet, item.id, 'title')) || item.fileUrl), el('td', {}, COLUMNS[key].label), el('td', { class: 'tag-sheet__old' }, text(item.before[key]) || '(empty)'), el('td', { class: 'tag-sheet__new' }, text(item.metadata[key]) || '(empty)')))));
    const body = el('div', {}, el('p', {}, `${total} change${total === 1 ? '' : 's'} on ${items.length} song${items.length === 1 ? '' : 's'} will be written into the files.`), el('div', { class: 'tag-sheet__review-scroll' }, table), total > shown.length ? el('p', { class: 'tag-sheet__hint' }, `and ${total - shown.length} more`) : null);
    let outcome = null;
    await openDialog({ title: 'Review changes', body, wide: true, actions: [
        { label: 'Cancel', value: false },
        { label: `Apply ${total} change${total === 1 ? '' : 's'}`, variant: 'primary', onClick: async () => {
            outcome = await ui.commit();
            return true;
        } }
    ] });
    if (outcome === null) return;
    note = outcome.failed.length ? `${outcome.failed.length} problem${outcome.failed.length === 1 ? '' : 's'}: ${outcome.failed.slice(0, 3).join('; ')}${outcome.failed.length > 3 ? '…' : ''}` : 'Saved.';
    paint(root, { skipRead: true });
}

function footer(root) {
    const changed = ui.pending().length > 0 || ui.isDirty();
    const count = api.getSheet({ limit: 1 }).changes;
    return el('div', { class: 'tag-sheet__footer' },
        el('span', { class: 'tag-sheet__status', role: 'status' }, `${sheet.order.length} songs, ${checked.size} checked, ${count} change${count === 1 ? '' : 's'}.${note ? ` ${note}` : ''}${readProblem ? ` ${readProblem}` : ''}`),
        el('span', { class: 'tag-sheet__spacer' }),
        el('button', { type: 'button', class: 'tag-sheet__button', disabled: checked.size === 0, onclick: () => {
            api.removeRows([...checked]);
            note = 'Removed from the sheet. The songs and files are untouched.';
            paint(root);
        } }, 'Remove checked rows'),
        el('button', { type: 'button', class: 'tag-sheet__button', disabled: !changed, onclick: () => {
            api.discardChanges();
            note = '';
            paint(root);
        } }, 'Discard changes'),
        ui.hasUndo() ? el('button', { type: 'button', class: 'tag-sheet__button', onclick: async () => {
            const result = await api.undoLast();
            note = result.ok ? 'Undone. The files hold their earlier tags again.' : result.error;
            paint(root, { skipRead: true });
        } }, 'Undo last apply') : null,
        el('button', { type: 'button', class: 'tag-sheet__button is-primary', disabled: count === 0, onclick: () => review(root) }, 'Review and apply'));
}
