// Tag sheet model (task PD-03). Plain logic, no DOM, no engine: rows are songs, columns are tags the person chose.
// Edits are staged here and never written until the person reviews them (plan rule 9). The view draws this; the AI (agent E)
// can call the same functions later.
//
//   createSheet()                          -> sheet
//   addRows(sheet, songs) / removeRows(sheet, ids)
//   addColumn(sheet, key) / removeColumn(sheet, key)
//   valueOf(sheet, id, key)                -> the staged value if there is one, else the loaded one (a list for multi-value tags)
//   stageCell(sheet, id, key, value)       -> sets one cell
//   applyValue(sheet, ids, key, value, mode)  mode: 'add' (default, keeps old values), 'replace', 'remove'
//   changes(sheet)                         -> [{ id, key, before, after }] for the review step
//   discard(sheet)

/** key -> { label, multi }. Multi-value tags split on ";" like the tag writer (electron/metadata-editor.py); a comma never splits. */
export const COLUMNS = {
    title: { label: 'Title', multi: false },
    artist: { label: 'Artist', multi: true },
    album: { label: 'Album', multi: false },
    albumArtist: { label: 'Album artist', multi: true },
    genre: { label: 'Genre', multi: true },
    year: { label: 'Year', multi: false },
    track: { label: 'Track', multi: false },
    discNumber: { label: 'Disc', multi: false },
    composer: { label: 'Composer', multi: true },
    conductor: { label: 'Conductor', multi: true },
    remixer: { label: 'Remixer', multi: true },
    label: { label: 'Label', multi: false },
    bpm: { label: 'BPM', multi: false },
    comment: { label: 'Comment', multi: false },
    isrc: { label: 'ISRC', multi: false }
};

export const DEFAULT_COLUMNS = ['title', 'artist', 'album', 'genre', 'year'];

export function createSheet(columns = DEFAULT_COLUMNS) {
    return { columns: columns.filter((key) => COLUMNS[key]), rows: new Map(), staged: new Map(), order: [] };
}

/** Normalizes a loaded or typed value: lists for multi-value tags (trimmed, no blanks, no repeats), a trimmed string otherwise. */
export function normalize(key, value) {
    if (!COLUMNS[key]?.multi) return String(Array.isArray(value) ? value.join('; ') : value ?? '').trim();
    const list = Array.isArray(value) ? value : String(value ?? '').split(';');
    const seen = new Set();
    return list.map((v) => String(v).trim()).filter((v) => v && !seen.has(v.toLowerCase()) && seen.add(v.toLowerCase()));
}

const same = (key, a, b) => JSON.stringify(normalize(key, a)) === JSON.stringify(normalize(key, b));

/** Songs are { id, ...tags }. A song already in the sheet keeps its place and staged edits; its loaded tags are refreshed. */
export function addRows(sheet, songs) {
    let added = 0;
    for (const song of songs || []) {
        if (!song || song.id === undefined) continue;
        if (!sheet.rows.has(song.id)) {
            sheet.order.push(song.id);
            added += 1;
        }
        sheet.rows.set(song.id, { ...(sheet.rows.get(song.id) || {}), ...song });
    }
    return added;
}

/** Takes rows out of the sheet only. The songs and their files are never touched. */
export function removeRows(sheet, ids) {
    const gone = new Set(ids);
    sheet.order = sheet.order.filter((id) => !gone.has(id));
    for (const id of gone) {
        sheet.rows.delete(id);
        sheet.staged.delete(id);
    }
}

export function addColumn(sheet, key) {
    if (COLUMNS[key] && !sheet.columns.includes(key)) sheet.columns.push(key);
}

export function removeColumn(sheet, key) {
    sheet.columns = sheet.columns.filter((k) => k !== key);
}

/** The loaded value, or undefined when the song's tags have not been read for this column yet. */
export function loadedValue(sheet, id, key) {
    const row = sheet.rows.get(id);
    return row && key in row ? normalize(key, row[key]) : undefined;
}

export function valueOf(sheet, id, key) {
    const edits = sheet.staged.get(id);
    if (edits && key in edits) return edits[key];
    return loadedValue(sheet, id, key) ?? normalize(key, '');
}

export function stageCell(sheet, id, key, value) {
    if (!sheet.rows.has(id) || !COLUMNS[key]) return;
    const next = normalize(key, value);
    const edits = sheet.staged.get(id) || {};
    if (same(key, next, loadedValue(sheet, id, key) ?? '')) delete edits[key];
    else edits[key] = next;
    if (Object.keys(edits).length) sheet.staged.set(id, edits);
    else sheet.staged.delete(id);
}

/** Adds, replaces or removes `value` on every row in `ids`. Rows whose tags are not loaded yet for this column are skipped and returned. */
export function applyValue(sheet, ids, key, value, mode = 'add') {
    const skipped = [];
    const wanted = normalize(key, value);
    const list = Array.isArray(wanted) ? wanted : wanted === '' ? [] : [wanted];
    for (const id of ids) {
        if (!sheet.rows.has(id)) continue;
        if (loadedValue(sheet, id, key) === undefined) {
            skipped.push(id);
            continue;
        }
        const current = valueOf(sheet, id, key);
        if (!COLUMNS[key].multi) {
            stageCell(sheet, id, key, mode === 'remove' ? '' : wanted);
            continue;
        }
        const lower = new Set(list.map((v) => v.toLowerCase()));
        if (mode === 'replace') stageCell(sheet, id, key, list);
        else if (mode === 'remove') stageCell(sheet, id, key, current.filter((v) => !lower.has(v.toLowerCase())));
        else stageCell(sheet, id, key, [...current, ...list]);
    }
    return skipped;
}

export function changes(sheet) {
    const out = [];
    for (const [id, edits] of sheet.staged) {
        for (const [key, after] of Object.entries(edits)) out.push({ id, key, before: loadedValue(sheet, id, key) ?? normalize(key, ''), after });
    }
    return out;
}

export const discard = (sheet) => sheet.staged.clear();
