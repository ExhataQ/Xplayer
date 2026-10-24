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
//   api.readTags()                         -> Promise<{ ok, unreadable, problem? }>   reads tags the library does not hold, for the shown columns; problem says why a file could not be read (for example Python or mutagen is missing)
//   api.getSheet({ offset, limit })        -> { columns, total, checked, changes, rows: [{ id, values, changedKeys }] }  values: null = not read yet
//   api.findRows({ column, text })         -> { ok, ids }   rows whose value contains the text (not case sensitive)
//   api.checkRows(ids) / checkAll() / uncheckAll()   -> { ok, checked }
//   api.removeRows(ids)                    -> { ok, total }   only takes songs out of the sheet, never deletes files
//   api.setCell({ id, key, value })        -> { ok }
//   api.applyTag({ column, value, mode, ids? })  mode 'add' (default, keeps old values) | 'replace' | 'remove'; ids default to the checked rows
//   api.preview()                          -> { ok, total, songs, changes: [{ id, title, key, before, after }] }
//   api.discardChanges()                   -> { ok }
//   api.requestApply()                     -> Promise<{ ok, saved, failed }>  the person reviews and presses Apply
//   api.undoLast()                         -> Promise<{ ok }>   puts back what the last apply changed. Every apply is also written to the durable undo journal
//        (PD-06, kind 'tag-sheet', the same entry shape as the AI's set_tags), so Undo still works after a restart and from the notification.
//        Without a journal it falls back to an in-memory Undo that lasts until the app closes.
//   api.findTags({ ids?, threshold?, mode? })  -> Promise<{ ok, staged, review, none, unchanged, failed, cancelled, stopped }>   (PD-05)
//        looks the checked rows (or ids) up on MusicBrainz and finds the original album. Confident matches (threshold, default 0.85) are
//        STAGED like any other edit; unsure ones wait in a review queue. Nothing is written: the person reviews and applies as usual.
//        Slow on purpose (about 3 to 4 seconds a song). One search at a time, at most 2000 songs. mode 'add' (default) | 'replace'.
//   api.getFindings()                      -> { ok, running, items: [{ id, title, release, confidence, reasons, changes }], last }   the review queue
//   api.acceptFindings(ids?) / skipFindings(ids?)  -> { ok }   stage (or drop) queued matches; ids default to all of them
//   api.cancelFind()                       -> { ok }   stop a running search after the song being worked on

import * as model from './tag-sheet-model.js';
import * as realBridge from '../../adapter/tag-sheet-bridge.js';

const { COLUMNS } = model;
// The tags the finder looks at and may answer with: the ones the sheet can show and stage (the MusicBrainz ids are not sheet columns).
const FINDER_COLUMNS = ['title', 'artist', 'album', 'albumArtist', 'year', 'genre', 'label'];
const FINDER_FIELDS = ['album', 'albumArtist', 'year', 'genre', 'label'];
const FIND_LIMIT = 2000;
const eta = (seconds) => (seconds < 90 ? `${Math.max(5, Math.round(seconds / 5) * 5)} s` : `${Math.round(seconds / 60)} min`);
const asText = (value) => (Array.isArray(value) ? value.join('; ') : String(value ?? ''));
const fail = (error) => ({ ok: false, error });

export function createTagSheetActions(bridge = realBridge) {
    const sheet = model.createSheet();
    const checked = new Set();
    const listeners = new Set();
    let lastBatch = null; // [{ id, fileUrl, metadata }] previous values of what the last apply changed
    let lastEntryId = null; // the journal entry of that apply; after a restart, the newest tag-sheet entry that is still undoable
    let reviewer = null;
    let reading = false;
    let lastOutcome = null;
    const finder = { running: false, queue: new Map(), last: null }; // queue: song id -> a match that is not sure enough to stage by itself

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
        lastEntryId = await journalBatch(lastBatch);
        lastOutcome = { ok: failed.length === 0, saved: savedCount, failed };
        announceSaved(items.length, savedCount, failed);
        changed();
        return lastOutcome;
    }

    const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
    const journal = (name, ...args) => bridge.journal?.(name, ...args);

    /** One journal entry for one apply: the old values, in the shape the AI's set_tags undo already reads (arrays kept, so multi-value tags come back exactly). */
    async function journalBatch(batch) {
        if (!batch || !bridge.journal) return null;
        const labels = new Set();
        for (const item of batch) for (const key of Object.keys(item.metadata)) labels.add(COLUMNS[key]?.label || key);
        try {
            const recorded = await journal('aiJournalRecord', {
                kind: 'tag-sheet',
                summary: `Tags of ${plural(batch.length, 'song')}: ${[...labels].join(', ')}`,
                changes: [{ type: 'set_tags', undo: { changed: batch.map(({ fileUrl, metadata }) => ({ fileUrl, previous: metadata })) } }]
            });
            return recorded?.ok ? recorded.entry.id : null;
        } catch (error) {
            return null; // a journal that cannot be written must never stop a save that already happened
        }
    }

    /** The shell notification with an Undo button; the engine's toast when the shell has none. */
    function announceSaved(total, savedCount, failed) {
        const title = failed.length ? `Saved ${savedCount} of ${total} songs` : `Saved ${plural(total, 'song')}`;
        const batch = lastBatch;
        const entryId = lastEntryId;
        if (!bridge.notice) return bridge.notify(failed.length ? `Saved ${savedCount} of ${total} songs. ${plural(failed.length, 'problem')}.` : `Saved ${plural(total, 'song')}.`, failed.length ? 'warning' : 'success', 4000);
        let note = null;
        const detail = failed.length ? `${plural(failed.length, 'problem')}: ${failed[0]}` : batch && !entryId ? 'Undo works until the app is closed.' : '';
        note = bridge.notice({ title, detail, kind: failed.length ? 'warning' : 'success', important: failed.length > 0, action: batch ? { label: 'Undo', onClick: () => undoFromNotice(entryId, batch, note) } : null });
    }

    async function undoFromNotice(entryId, batch, note) {
        let result;
        if (entryId && entryId !== lastEntryId) result = await undoOlder(entryId); // a later apply came after this one
        else if (!entryId && batch !== lastBatch) result = fail('That change can no longer be undone from here.');
        else result = await undoLast();
        note?.update({ action: null });
        bridge.notice?.(result.ok ? { title: 'Undone', detail: 'The old tags were put back.', kind: 'success' } : { title: 'Could not undo everything', detail: result.error, kind: 'warning', important: true });
        return result;
    }

    /** Reads these files again, so the rows show what the files hold now (after an undo that did not go through the sheet). */
    async function rereadUrls(urls) {
        const ids = sheet.order.filter((id) => urls.has(sheet.rows.get(id)?.url));
        for (let i = 0; i < ids.length; i += 4) {
            await Promise.all(ids.slice(i, i + 4).map(async (id) => {
                const result = await bridge.readTags(sheet.rows.get(id)?.url);
                if (sheet.rows.has(id)) model.addRows(sheet, [rowFromRead(id, result)]);
            }));
        }
    }

    /** Undoes a journal entry the sheet does not hold in memory (after a restart, or one that was not the last apply). */
    async function undoOlder(id) {
        if (!bridge.undoJournalEntry) return fail('Undo is not available.');
        const entry = await journal('aiJournalGet', id);
        if (!entry || !Array.isArray(entry.changes)) {
            if (id === lastEntryId) { lastEntryId = null; changed(); }
            return fail('That change is no longer in the undo journal.');
        }
        if (entry.status === 'undone') {
            if (id === lastEntryId) { lastEntryId = null; changed(); }
            return fail('That change was already undone.');
        }
        const urls = new Set(entry.changes.flatMap((change) => (change.undo?.changed || []).map((file) => file.fileUrl)));
        const result = await bridge.undoJournalEntry(id);
        await rereadUrls(urls);
        if (!result.ok) {
            changed();
            return fail(`Undone, with problems: ${(result.failures || []).map((f) => f.message).slice(0, 3).join('; ')}`);
        }
        if (id === lastEntryId) lastEntryId = null;
        changed();
        return { ok: true };
    }

    /**
     * After a restart the in-memory batch is gone; the newest tag-sheet entry in the journal that was not undone can still be.
     * Called when the sheet is shown, not when this module loads (the page API is not ready that early), and tried again at the next
     * mount until the journal has answered once.
     */
    let restored = false;
    async function restoreUndo() {
        if (restored) return;
        try {
            const list = await journal('aiJournalList');
            if (!Array.isArray(list)) return; // no journal (yet)
            restored = true;
            if (lastBatch || lastEntryId) return;
            const newest = list.find((entry) => entry.kind === 'tag-sheet');
            if (newest && newest.status === 'done') {
                lastEntryId = newest.id;
                changed();
            }
        } catch (error) {
            // no journal: the in-memory Undo is all there is
        }
    }

    async function undoLast() {
        if (!lastBatch && !lastEntryId) return fail('There is nothing to undo.');
        if (lastEntryId && (await journal('aiJournalGet', lastEntryId))?.status === 'undone') {
            lastBatch = null; // undone from somewhere else (Edit > Undo): writing the old values again could overwrite newer edits
            lastEntryId = null;
            changed();
            return fail('That change was already undone.');
        }
        if (!lastBatch) return undoOlder(lastEntryId);
        const items = lastBatch;
        const saved = await bridge.writeTags(items.map(({ fileUrl, metadata }) => ({ fileUrl, metadata })));
        if (!saved?.success) return fail(saved?.error || 'Undo failed.');
        const problems = absorb(items, saved.results, false);
        lastBatch = null;
        if (lastEntryId && problems.length === 0) {
            await journal('aiJournalMarkUndone', lastEntryId);
            lastEntryId = null;
        }
        changed();
        return problems.length ? { ok: false, error: `Undone, with problems: ${problems.join('; ')}` } : { ok: true };
    }

    /** Reads the tags the library does not hold (for the shown columns) from the files, a few at a time. */
    async function readMissing() {
        const need = () => sheet.order.filter((id) => {
            const row = sheet.rows.get(id);
            return row.url && !row.unreadable && sheet.columns.some((key) => !(key in row));
        });
        if (reading) return unreadableSummary();
        reading = true;
        try {
            for (let todo = need(); todo.length > 0; todo = need()) {
                for (let i = 0; i < todo.length; i += 4) {
                    await Promise.all(todo.slice(i, i + 4).map(async (id) => {
                        const result = await bridge.readTags(sheet.rows.get(id)?.url);
                        if (!sheet.rows.has(id)) return;
                        model.addRows(sheet, [rowFromRead(id, result)]);
                    }));
                    changed();
                }
            }
        } finally {
            reading = false;
        }
        return unreadableSummary();
    }

    /** How many rows could not be read, and the first reason given (one reason is enough: a missing backend gives the same one for every file). */
    function unreadableSummary() {
        const bad = sheet.order.filter((id) => sheet.rows.get(id).unreadable);
        const reason = bad.map((id) => sheet.rows.get(id).problem).find(Boolean);
        return reason ? { ok: true, unreadable: bad.length, problem: reason } : { ok: true, unreadable: bad.length };
    }

    /**
     * What a read of one file gives the sheet. A successful read is the whole file: a tag the reader does not mention is empty, so it is
     * filled in as empty. Without that, a reader that leaves out empty tags would make the sheet re-read the same files for ever.
     */
    function rowFromRead(id, result) {
        if (!result?.success) return { id, unreadable: true, problem: result?.error || 'The tags could not be read' };
        const have = sheet.rows.get(id) || {};
        const empty = Object.fromEntries(Object.entries(COLUMNS).filter(([key]) => !(key in have)).map(([key, def]) => [key, def.multi ? [] : '']));
        return { id, ...empty, ...result.metadata };
    }

    /** Reads the file tags the finder compares against, for these rows only (rows the library already holds fully are not read again). */
    async function readKeys(ids, keys) {
        const todo = ids.filter((id) => {
            const row = sheet.rows.get(id);
            return row?.url && !row.unreadable && keys.some((key) => !(key in row));
        });
        for (let i = 0; i < todo.length; i += 4) {
            await Promise.all(todo.slice(i, i + 4).map(async (id) => {
                const result = await bridge.readTags(sheet.rows.get(id)?.url);
                if (!sheet.rows.has(id)) return;
                model.addRows(sheet, [rowFromRead(id, result)]);
            }));
        }
    }

    /** Stages one match like any typed edit (add keeps old values of multi-value tags, album and year are replaced). Never writes. */
    function stageMatch(match, mode) {
        for (const [key, value] of Object.entries(match.patch)) model.applyValue(sheet, [match.id], key, value, mode);
    }

    async function cancelFind() {
        if (!finder.running) return fail('No search is running.');
        await bridge.cancelFindTags?.();
        return { ok: true };
    }

    async function findTags({ ids, threshold, mode = 'add' } = {}) {
        if (finder.running) return fail('A tag search is already running.');
        if (!['add', 'replace'].includes(mode)) return fail('mode must be add or replace.');
        if (threshold !== undefined && !(Number(threshold) >= 0 && Number(threshold) <= 1)) return fail('threshold must be between 0 and 1.');
        const target = (ids || [...checked]).filter(known);
        if (target.length === 0) return fail('No rows to look up. Check some rows or pass ids.');
        if (target.length > FIND_LIMIT) return fail(`Look up at most ${FIND_LIMIT} songs at a time (${target.length} given).`);
        finder.running = true;
        changed();
        let notice = null;
        try {
            await readKeys(target, FINDER_COLUMNS);
            const rows = target.filter((id) => sheet.rows.has(id) && sheet.rows.get(id).url && !sheet.rows.get(id).unreadable);
            const skipped = target.length - rows.length;
            if (rows.length === 0) {
                const why = target.map((id) => sheet.rows.get(id)?.problem).find(Boolean);
                return fail(why ? `None of those songs could be read: ${why}` : 'None of those songs could be read.');
            }
            const songs = rows.map((id) => {
                const row = sheet.rows.get(id);
                return { id, fileUrl: row.url, tags: Object.fromEntries(FINDER_COLUMNS.map((key) => [key, row[key] ?? ''])) };
            });
            notice = bridge.progressNotice?.({ title: `Finding tags for ${songs.length} song${songs.length === 1 ? '' : 's'}`, kind: 'job', onCancel: () => cancelFind(), target: { view: 'metadata' } }) || null;
            const startedAt = Date.now();
            const reply = await bridge.findTags({ songs, options: { rule: 'original', autoThreshold: threshold === undefined ? undefined : Number(threshold), fields: FINDER_FIELDS } }, ({ done, total }) => {
                const left = done >= 3 ? ((Date.now() - startedAt) / done) * (total - done) / 1000 : 0;
                notice?.update({ percent: Math.round((done / total) * 100), status: `${done} of ${total}${left >= 5 ? `, about ${eta(left)} left` : ''}` });
            });
            if (!reply?.success) {
                notice?.fail({ title: 'Finding tags failed', detail: reply?.error || '', kind: 'error' });
                return fail(reply?.error || 'The search failed.');
            }
            const counts = { staged: 0, review: 0, none: 0, unchanged: 0, error: 0 };
            const problems = [];
            for (const result of reply.results) {
                if (!known(result.id)) continue; // taken out of the sheet while the search ran
                finder.queue.delete(result.id);
                if (result.decision === 'auto') {
                    stageMatch(result, mode);
                    counts.staged += 1;
                } else if (result.decision === 'review') {
                    finder.queue.set(result.id, { id: result.id, release: result.release, confidence: result.confidence, reasons: result.reasons, patch: result.patch, changes: result.changes });
                    counts.review += 1;
                } else if (result.decision === 'error') {
                    counts.error += 1;
                    problems.push(`${titleOf(result.id)}: ${result.error}`);
                } else counts[result.decision] += 1;
            }
            finder.last = { ...counts, total: songs.length, skipped, cancelled: Boolean(reply.cancelled), stopped: reply.stopped || null, message: reply.message || '', problems: problems.slice(0, 50) };
            const nothing = counts.none + counts.unchanged;
            const detail = `${counts.staged} staged, ${counts.review} to review, ${nothing} nothing to change${counts.error ? `, ${counts.error} failed` : ''}.${reply.message ? ` ${reply.message}` : ''}`;
            const title = reply.cancelled ? 'Tag search stopped' : reply.stopped ? 'Tag search ended early' : 'Finished finding tags';
            notice?.done({ title, detail, kind: reply.cancelled || reply.stopped || counts.error ? 'warning' : 'success', target: { view: 'metadata', label: 'Open the tag sheet' }, important: counts.review > 0 });
            return { ok: true, staged: counts.staged, review: counts.review, none: counts.none, unchanged: counts.unchanged, failed: counts.error, skipped, cancelled: Boolean(reply.cancelled), stopped: reply.stopped || null };
        } catch (error) {
            notice?.fail({ title: 'Finding tags failed', detail: error?.message || '', kind: 'error' });
            return fail(error?.message || 'The search failed.');
        } finally {
            finder.running = false;
            changed();
        }
    }

    function getFindings() {
        const items = [...finder.queue.values()].map((entry) => ({ id: entry.id, title: titleOf(entry.id), release: entry.release, confidence: entry.confidence, reasons: [...entry.reasons], changes: Object.entries(entry.changes).map(([key, change]) => ({ key, before: change.from, after: change.to })) }));
        return { ok: true, running: finder.running, items, last: finder.last && { ...finder.last } };
    }

    function acceptFindings(ids, { mode = 'add' } = {}) {
        const target = (ids || [...finder.queue.keys()]).filter((id) => finder.queue.has(id) && known(id));
        for (const id of target) {
            stageMatch(finder.queue.get(id), mode);
            finder.queue.delete(id);
        }
        changed();
        return { ok: true, accepted: target.length };
    }

    function skipFindings(ids) {
        const target = (ids || [...finder.queue.keys()]).filter((id) => finder.queue.has(id));
        for (const id of target) finder.queue.delete(id);
        changed();
        return { ok: true, skipped: target.length };
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
            for (const id of ids || []) {
                checked.delete(id);
                finder.queue.delete(id);
            }
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
            finder.queue.clear();
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
        undoLast,
        findTags,
        getFindings,
        acceptFindings,
        skipFindings,
        cancelFind
    };

    const ui = {
        sheet,
        checked,
        pending,
        commit,
        undoLast,
        readMissing,
        hasUndo: () => lastBatch !== null || lastEntryId !== null,
        restoreUndo,
        finder: { run: findTags, cancel: cancelFind, findings: getFindings, accept: acceptFindings, skip: skipFindings, running: () => finder.running },
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
