// Carries out an approved plan and undoes it (plan PE-03 and PE-04).
//
// `handlers[type]` is supplied by whoever owns that kind of change (the tag service for tags, the
// library functions for folders and playlists). A handler does the work and returns what is
// needed to reverse it: { undo }. It may be async. `undoHandlers[type](undo)` reverses it.
//
// A plan stops at the first failure. What already happened is still written to the journal, so the
// person can undo the part that ran; nothing is left half-done and untracked.

const { ACTIONS } = require('./actions');

async function executePlan(plan, { handlers, journal, summary, onProgress }) {
    const done = [];
    let failure = null;
    for (let i = 0; i < plan.actions.length; i++) {
        const action = plan.actions[i];
        const handler = handlers[action.type];
        if (!handler) {
            failure = { index: i, type: action.type, message: `No handler for ${action.type}` };
            break;
        }
        try {
            const result = (await handler(action.args)) || {};
            if (ACTIONS[action.type].changesData) done.push({ type: action.type, undo: result.undo === undefined ? null : result.undo });
            if (onProgress) onProgress({ done: i + 1, total: plan.actions.length });
        } catch (error) {
            failure = { index: i, type: action.type, message: error && error.message ? error.message : String(error) };
            break;
        }
    }
    let entry = null;
    if (done.length) entry = journal.record({ kind: 'ai-plan', summary: summary || plan.summary, changes: done });
    return { ok: !failure, failure, applied: done.length, total: plan.actions.length, entryId: entry ? entry.id : null };
}

// Undo runs the entry's changes in reverse. A change that cannot be reversed is reported and the
// entry stays "done" so the person can see what is left; the rest are still reversed.
async function undoEntry(id, { undoHandlers, journal }) {
    const entry = journal.get(id);
    if (!entry) return { ok: false, error: 'not-found' };
    if (entry.status === 'undone') return { ok: false, error: 'already-undone' };
    const failures = [];
    for (let i = entry.changes.length - 1; i >= 0; i--) {
        const change = entry.changes[i];
        const handler = undoHandlers[change.type];
        try {
            if (!handler) throw new Error(`No undo handler for ${change.type}`);
            await handler(change.undo);
        } catch (error) {
            failures.push({ index: i, type: change.type, message: error && error.message ? error.message : String(error) });
        }
    }
    if (!failures.length) journal.markUndone(id);
    return { ok: failures.length === 0, failures };
}

module.exports = { executePlan, undoEntry };
