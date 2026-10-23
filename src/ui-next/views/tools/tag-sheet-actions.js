// Tag sheet actions (task PD-03, step 5). Everything the sheet can do, without any screen: the view draws this state, and the AI
// (agent E) drives the very same sheet through `api`. Both see the same rows, columns, staged edits and undo.
//
// Rules for the AI (and anything else using `api`):
//   - Every call returns plain data { ok, ... } and never throws; { ok: false, error } says what to fix.
//   - Nothing is written to a file by the AI directly. `requestApply()` opens the review for the person, who presses Apply.
//   - Edits are staged first; `preview()` shows exactly what would change.
//
//   api.listSources()                      -> [{ id, label, group }]
//   api.listColumns()                      -> [{ key, label, multi, shown }]
//   api.loadSongs(sourceId)                -> { ok, added, total }
//   api.setColumns(keys)                   -> { ok, columns }
//   api.readTags()                         -> Promise<{ ok, unreadable }>   reads tags the library does not hold, for the shown columns
//   api.getSheet({ offset, limit })        -> { columns, total, checked, changes, rows: [{ id, values, changedKeys }] }  values: null = not read yet
//   api.findRows({ column, text })         -> { ok, ids }   rows whose value contains the text (not case sensitive)
//   api.checkRows(ids) / checkAll() / uncheckAll()   -> { ok, checked }
//   api.removeRows(ids)                    -> { ok, total }   only takes songs out of the sheet, never deletes files
//   api.setCell({ id, key, value })        -> { ok }
//   api.applyTag({ column, value, mode, ids? })  mode 'add' (default, keeps old values) | 'replace' | 'remove'; ids default to the checked rows
//   api.preview()                          -> { ok, total, songs, changes: [{ id, title, key, before, after }] }
//   api.discardChanges()                   -> { ok }
//   api.requestApply()                     -> Promise<{ ok, saved, failed }>  the person reviews and presses Apply
//   api.undoLast()                         -> Promise<{ ok }>   puts back what the last apply changed

import * as model from './tag-sheet-model.js';
import * as realBridge from '../../adapter/tag-sheet-bridge.js';

const { COLUMNS } = model;
const asText = (value) => (Array.isArray(value) ? value.join('; ') : String(value ?? ''));
const fail = (error) => ({ ok: false, error });

export function createTagSheetActions(bridge = realBridge) {
    const sheet = model.createSheet();
    const checked = new Set();
    const listeners = new Set();
    let lastBatch = null; // [{ id, fileUrl, metadata }] previous values of what the last apply changed
    let reviewer = null;
    let reading = false;
    let lastOutcome = null;

    const changed = () => listeners.forEach((listener) => listener());
    const titleOf = (id) => asText(model.valueOf(sheet, id, 'title')) || 'A song';
    const known = (id) => sheet.rows.has(id);

    /** Per song, only the tags that changed (what the review shows and what is written). */
    function pending() {
        const byId = new Map();
        for (const change of model.changes(sheet)) {
            const row = sheet.rows.get(change.id);
            if (!row?.url) continue;
            if (!byId.has(change.id)) byId.set(change.id, { id: change.id, fileUrl: row.url, metadata: {}, before: {} });
            byId.get(change.id).metadata[change.key] = change.after;
            byId.get(change.id).before[change.key] = change.before;
        }
        return [...byId.values()];
    }

    /** Takes the files' answers into the sheet. Returns the problems as lines of text. */
    function absorb(items, results, keepUndo) {
        const problems = [];
        const undo = [];
        results.forEach((result, index) => {
            const item = items[index];
            if (!result?.success) return problems.push(`${titleOf(item.id)}: ${result?.error || 'could not be saved'}`);
            const fresh = { id: item.id };
            for (const key of Object.keys(COLUMNS)) if (result.metadata && key in result.metadata) fresh[key] = result.metadata[key];
            model.addRows(sheet, [fresh]);
            sheet.staged.delete(item.id);
            const skipped = new Set(result.skipped || []);
            const back = {};
            for (const key of Object.keys(item.metadata)) if (!skipped.has(key)) back[key] = result.previous?.[key] ?? (COLUMNS[key].multi ? [] : '');
            if (Object.keys(back).length) undo.push({ id: item.id, fileUrl: item.fileUrl, metadata: back });
            if (skipped.size) problems.push(`${titleOf(item.id)}: ${[...skipped].join(', ')} not supported for this file type`);
        });
        bridge.refreshSongs(results);
        if (keepUndo) lastBatch = undo.length ? undo : null;
        return problems;
    }

    /** UI only: writes every staged change in one call. Called by the review dialog's Apply button, never by the AI. */
    async function commit() {
        const items = pending();
        if (items.length === 0) return { ok: true, saved: 0, failed: [] };
        const saved = await bridge.writeTags(items.map(({ fileUrl, metadata }) => ({ fileUrl, metadata })));
        if (!saved?.success) throw new Error(saved?.error || 'Could not save the tags');
        const savedCount = saved.results.filter((result) => result?.success).length;
        const failed = absorb(items, saved.results, true);
        lastOutcome = { ok: failed.length === 0, saved: savedCount, failed };
        bridge.notify(failed.length ? `Saved ${savedCount} of ${items.length} songs. ${failed.length} problem${failed.length === 1 ? '' : 's'}.` : `Saved ${items.length} song${items.length === 1 ? '' : 's'}.`, failed.length ? 'warning' : 'success', 4000);
        changed();
        return lastOutcome;
    }

    async function undoLast() {
        if (!lastBatch) return fail('There is nothing to undo.');
        const items = lastBatch;
        const saved = await bridge.writeTags(items.map(({ fileUrl, metadata }) => ({ fileUrl, metadata })));
        if (!saved?.success) return fail(saved?.error || 'Undo failed.');
        const problems = absorb(items, saved.results, false);
        lastBatch = null;
        changed();
        return problems.length ? { ok: false, error: `Undone, with problems: ${problems.join('; ')}` } : { ok: true };
    }

    /** Reads the tags the library does not hold (for the shown columns) from the files, a few at a time. */
    async function readMissing() {
        const need = () => sheet.order.filter((id) => {
            const row = sheet.rows.get(id);
            return row.url && !row.unreadable && sheet.columns.some((key) => !(key in row));
        });
        if (reading) return { ok: true, unreadable: sheet.order.filter((id) => sheet.rows.get(id).unreadable).length };
        reading = true;
        try {
            for (let todo = need(); todo.length > 0; todo = need()) {
                for (let i = 0; i < todo.length; i += 4) {
                    await Promise.all(todo.slice(i, i + 4).map(async (id) => {
                        const result = await bridge.readTags(sheet.rows.get(id)?.url);
                        if (!sheet.rows.has(id)) return;
                        model.addRows(sheet, [result?.success ? { id, ...result.metadata } : { id, unreadable: true }]);
                    }));
                    changed();
                }
            }
        } finally {
            reading = false;
        }
        return { ok: true, unreadable: sheet.order.filter((id) => sheet.rows.get(id).unreadable).length };
    }

    const api = {
        listSources: () => bridge.sources(),
        listColumns: () => Object.entries(COLUMNS).map(([key, def]) => ({ key, label: def.label, multi: def.multi, shown: sheet.columns.includes(key) })),
        loadSongs(sourceId) {
            if (!bridge.sources().some((source) => source.id === sourceId)) return fail(`Unknown source "${sourceId}". Use listSources().`);
            const added = model.addRows(sheet, bridge.loadSource(sourceId));
            changed();
            return { ok: true, added, total: sheet.order.length };
        },
        setColumns(keys) {
            const bad = (keys || []).filter((key) => !COLUMNS[key]);
            if (!Array.isArray(keys) || bad.length) return fail(`Unknown column${bad.length === 1 ? '' : 's'}: ${bad.join(', ') || 'keys must be a list'}. Use listColumns().`);
            sheet.columns = [...new Set(keys)];
            changed();
            return { ok: true, columns: [...sheet.columns] };
        },
        readTags: async () => {
            const result = await readMissing();
            changed();
            return result;
        },
        getSheet({ offset = 0, limit = 50 } = {}) {
            const ids = sheet.order.slice(Math.max(0, offset), Math.max(0, offset) + Math.min(Math.max(1, limit), 500));
            return {
                columns: [...sheet.columns],
                total: sheet.order.length,
                checked: checked.size,
                changes: model.changes(sheet).length,
                rows: ids.map((id) => ({
                    id,
                    values: Object.fromEntries(sheet.columns.map((key) => [key, key in sheet.rows.get(id) || sheet.staged.get(id)?.[key] !== undefined ? model.valueOf(sheet, id, key) : null])),
                    changedKeys: Object.keys(sheet.staged.get(id) || {})
                }))
            };
        },
        findRows({ column, text } = {}) {
            if (!COLUMNS[column]) return fail(`Unknown column "${column}". Use listColumns().`);
            const needle = String(text ?? '').toLowerCase();
            return { ok: true, ids: sheet.order.filter((id) => asText(model.valueOf(sheet, id, column)).toLowerCase().includes(needle)) };
        },
        checkRows(ids) {
            for (const id of ids || []) if (known(id)) checked.add(id);
            changed();
            return { ok: true, checked: checked.size };
        },
        checkAll() {
            sheet.order.forEach((id) => checked.add(id));
            changed();
            return { ok: true, checked: checked.size };
        },
        uncheckAll() {
            checked.clear();
            changed();
            return { ok: true, checked: 0 };
        },
        removeRows(ids) {
            model.removeRows(sheet, ids || []);
            for (const id of ids || []) checked.delete(id);
            changed();
            return { ok: true, total: sheet.order.length };
        },
        setCell({ id, key, value } = {}) {
            if (!known(id)) return fail(`Song ${id} is not in the sheet.`);
            if (!COLUMNS[key]) return fail(`Unknown column "${key}". Use listColumns().`);
            if (!(key in sheet.rows.get(id))) return fail('That song\'s tags have not been read yet. Call readTags() first.');
            model.stageCell(sheet, id, key, value);
            changed();
            return { ok: true };
        },
        applyTag({ column, value, mode = 'add', ids } = {}) {
            if (!COLUMNS[column]) return fail(`Unknown column "${column}". Use listColumns().`);
            if (!['add', 'replace', 'remove'].includes(mode)) return fail('mode must be add, replace or remove.');
            if (mode !== 'remove' && model.normalize(column, value).length === 0) return fail('value is empty.');
            const target = (ids || [...checked]).filter(known);
            if (target.length === 0) return fail('No rows to change. Check some rows or pass ids.');
            const skipped = model.applyValue(sheet, target, column, value, mode);
            changed();
            return { ok: true, staged: target.length - skipped.length, skipped };
        },
        preview() {
            const items = pending();
            const list = items.flatMap((item) => Object.keys(item.metadata).map((key) => ({ id: item.id, title: titleOf(item.id), key, before: item.before[key], after: item.metadata[key] })));
            return { ok: true, total: list.length, songs: items.length, changes: list };
        },
        discardChanges() {
            model.discard(sheet);
            changed();
            return { ok: true };
        },
        async requestApply() {
            if (pending().length === 0) return fail('There is nothing to apply.');
            if (!reviewer) return fail('The tag sheet is not open. Ask the person to open Metadata, Many songs.');
            lastOutcome = null;
            await reviewer();
            return lastOutcome ? { ...lastOutcome } : { ok: false, saved: 0, failed: [], cancelled: true };
        },
        undoLast
    };

    const ui = {
        sheet,
        checked,
        pending,
        commit,
        undoLast,
        readMissing,
        hasUndo: () => lastBatch !== null,
        isDirty: () => model.changes(sheet).length > 0,
        subscribe(listener) {
            listeners.add(listener);
            return () => listeners.delete(listener);
        },
        setReviewer(fn) {
            reviewer = fn;
        },
        notify: (...args) => bridge.notify(...args)
    };
    return { api, ui };
}

const shared = createTagSheetActions();
/** The one sheet of the running app. */
export const tagSheetApi = shared.api;
export const tagSheetUi = shared.ui;
