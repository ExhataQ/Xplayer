// Applies an approved AI plan and reports the result as a notification with an Undo button (task PE-04, notification side).
// The preview and the approval happen before this is called. The plan runs through adapter/ai-bridge.js, which journals it.
//
//   applyPlan(plan, summary)  -> the bridge's result; always posts exactly one notification about it
//   undoLast()                -> undoes the newest journal entry that is still "done" (for an Edit > Undo item); { ok, none? }

import { notify } from '../../shell/notify.js';
import { runPlan, undoEntry, journalList } from '../../adapter/ai-bridge.js';

const count = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

async function undoAndReport(entryId, notification) {
    const result = await undoEntry(entryId);
    if (notification) notification.dismiss();
    if (result.ok) notify({ title: 'Undone', detail: 'Everything that plan changed was put back.', kind: 'success', where: 'both' });
    else notify({ title: 'Could not undo everything', detail: result.failures.map((f) => f.message).slice(0, 3).join(' '), kind: 'warning', important: true });
    return result;
}

/** `quiet`: a plan that changes nothing saved (a play order) posts no "Done" toast; the caller posts its own notice. */
export async function applyPlan(plan, summary, { quiet = false } = {}) {
    const total = plan.actions.length;
    const result = await runPlan(plan, summary);
    const title = summary || plan.summary || 'AI plan';
    const warnings = result.warnings.length ? ` ${count(result.warnings.length, 'song')} could not be changed: ${result.warnings[0]}` : '';
    if (!result.applied && result.ok) {
        if (!quiet) notify({ title, detail: 'Done.', kind: 'success', where: 'toast' });
        return result;
    }
    if (!result.applied) {
        notify({ title: 'The plan could not run', detail: result.failure ? result.failure.message : 'Nothing was changed.', kind: 'error' });
        return result;
    }
    const entry = { title, kind: result.ok && !warnings ? 'success' : 'warning', where: 'both' };
    entry.detail = result.ok
        ? `${count(result.applied, 'change')} made.${warnings}`
        : `Stopped after ${result.applied} of ${total} steps: ${result.failure.message}.${warnings} What ran can be undone.`;
    const notification = notify({ ...entry, action: { label: 'Undo', onClick: () => undoAndReport(result.entryId, notification) } });
    return result;
}

/** Undoes one journal entry by id (the settings page lists them). Posts the same notifications as the Undo button. */
export const undoById = (id) => undoAndReport(id, null);

export async function undoLast() {
    const list = await journalList();
    const latest = list.find((e) => e.status === 'done');
    if (!latest) return { ok: false, none: true };
    return undoAndReport(latest.id, null);
}
