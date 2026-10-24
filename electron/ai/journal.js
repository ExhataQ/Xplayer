// The undo journal (plan PE-04). One entry per AI or batch action, holding what it changed and
// the old values, saved to disk so Undo still works after a restart. Capped: the oldest entries
// are dropped. Shared with Agent D (tag changes) and anything else that changes data in bulk.
//
// Entry: { id, at, kind, summary, status: 'done' | 'undone', changes: [{ type, undo }] }
// `undo` is whatever the owner of that change type needs to put things back (old tag values,
// old playlist contents ...). The journal stores it and never interprets it.

const fs = require('fs');
const path = require('path');

const DEFAULT_CAP = 50;
const MAX_CHANGES_PER_ENTRY = 5000;

function createJournal({ file, cap = DEFAULT_CAP, now = () => Date.now() }) {
    let entries = null;

    function load() {
        if (entries) return entries;
        entries = [];
        let text;
        try {
            text = fs.readFileSync(file, 'utf8');
        } catch (e) {
            return entries;
        }
        try {
            const data = JSON.parse(text);
            if (!data || !Array.isArray(data.entries)) throw new Error('not a journal');
            entries = data.entries.filter((e) => e && typeof e.id === 'string' && Array.isArray(e.changes));
        } catch (e) {
            // A damaged file is kept aside instead of being overwritten, so nothing is silently lost.
            try {
                fs.renameSync(file, `${file}.damaged-${now()}`);
            } catch (e2) {
                // Intentionally silent: the journal starts empty either way.
            }
            entries = [];
        }
        return entries;
    }

    function save() {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        const tmp = `${file}.tmp`;
        fs.writeFileSync(tmp, JSON.stringify({ version: 1, entries }), 'utf8');
        fs.renameSync(tmp, file);
    }

    function record({ kind, summary, changes }) {
        if (typeof kind !== 'string' || !kind) throw new Error('journal entry needs a kind');
        if (!Array.isArray(changes) || changes.length === 0) throw new Error('journal entry needs at least one change');
        if (changes.length > MAX_CHANGES_PER_ENTRY) throw new Error('journal entry is too large');
        load();
        const at = now();
        const entry = {
            id: `${at.toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
            at,
            kind,
            summary: String(summary || '').slice(0, 300),
            status: 'done',
            changes
        };
        entries.push(entry);
        while (entries.length > cap) entries.shift();
        save();
        return entry;
    }

    // Newest first, without the bulky undo data.
    function list() {
        return load().slice().reverse().map(({ id, at, kind, summary, status, changes }) => ({ id, at, kind, summary, status, changeCount: changes.length }));
    }

    function get(id) {
        return load().find((e) => e.id === id) || null;
    }

    // The newest entry that has not been undone yet.
    function latestUndoable() {
        const all = load();
        for (let i = all.length - 1; i >= 0; i--) if (all[i].status === 'done') return all[i];
        return null;
    }

    function markUndone(id) {
        const entry = get(id);
        if (!entry) return false;
        entry.status = 'undone';
        save();
        return true;
    }

    return { record, list, get, latestUndoable, markUndone };
}

module.exports = { createJournal, DEFAULT_CAP };
