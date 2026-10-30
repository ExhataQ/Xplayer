// View router: the one path every change of the main view takes (a rail click, the menu, a notification, Home cards, mouse back and
// forward, and the engine changing page by itself). No DOM here; the shell hands in what drawing means (`env`), so the rules below
// are tested in plain Node (tools/tests/ui-next-view-router.test.js).
//
// What it guarantees, and what the code that used to do this inline did not:
//
//   1. A view that has to ask first can answer later. leave() may return a Promise (the engine's "Discard Sync?" dialog answers
//      when the person clicks). The click that started the change is remembered and carried out when the answer is yes, and dropped
//      when it is no. Asking twice is never needed: a second choice while a question is open only replaces the target.
//   2. A bug in one view cannot trap the person. A leave() that throws is logged and the change goes on; a view that throws while it
//      is drawn is replaced by a plain "could not be shown" page (env.recover), and the next choice of that view rebuilds it.
//   3. Changes never nest. A change asked for while another is being drawn waits until that one is done.
//   4. Conditions live on the view: canEnter() can refuse or redirect before anything is touched.
//
// go(id, options) returns one of these (or a Promise of one when a view is waiting for an answer):
//   'shown'        the view is now on screen (or was already, and keeps its form)
//   'unavailable'  the view could not draw yet (the engine is still loading): an empty page is up, the caller may retry later
//   'stayed'       the view on screen asked to stay (unsaved text, "Keep editing"), or the person chose it again while it was asking
//   'refused'      the view's canEnter() said no
//   'failed'       drawing threw; env.recover() put a safe page up
//   'queued'       another change is being drawn; this one runs right after it
//
// options: any option of the shell's views (keepPanel, chosen, query, songId ...) plus
//   fromEngine: true   the engine did this itself (it opened or closed a page): the view on screen is not asked, it is already gone
//   after: fn          runs once the view is shown (also after an answer). Never runs when the change did not happen.
//   rebuild: true      draw the view again even when it is on screen and would keep its form (a retry after an empty page)

const isThenable = (value) => value !== null && typeof value === 'object' && typeof value.then === 'function';

export function createRouter({ registry, env }) {
    let committing = false;
    let waiting = null; // { request: { view, options } | null, promise }: a leave() that has not answered yet
    let broken = null; // id of a view whose drawing threw: it has no guard and is always rebuilt
    const queued = [];

    const report = (phase, view, error) => {
        try {
            env.report(phase, view, error);
        } catch (_) {
            /* reporting must never throw */
        }
    };
    const safely = (phase, view, fn) => {
        try {
            fn();
        } catch (error) {
            report(phase, view, error);
        }
    };

    function resolve(id, options, depth = 0) {
        const view = registry.get(id) || registry.fallback;
        if (view.canEnter) {
            let verdict = true;
            try {
                verdict = view.canEnter({ options, current: env.current() });
            } catch (error) {
                report('canEnter', view, error); // a broken condition must not lock the view out
            }
            if (verdict === false) return null;
            if (verdict && typeof verdict === 'object' && typeof verdict.redirect === 'string') {
                if (depth >= 4) {
                    report('canEnter', view, new Error(`Redirect loop from "${id}"`));
                    return null;
                }
                return resolve(verdict.redirect, { ...options, ...(verdict.options || {}) }, depth + 1);
            }
        }
        return { view, options };
    }

    // true: leave; false: stay; a Promise of either when the person has to answer.
    function askToLeave(view) {
        let result = true;
        env.willLeave(view);
        try {
            result = view.leave();
        } catch (error) {
            report('leave', view, error);
            result = true;
        } finally {
            env.didLeave(view);
        }
        if (isThenable(result)) {
            return Promise.resolve(result).then(
                (answer) => answer !== false,
                (error) => {
                    report('leave', view, error);
                    return true;
                }
            );
        }
        return result !== false;
    }

    function commit(view, options) {
        committing = true;
        let outcome;
        try {
            outcome = env.enter(view, options) === false ? 'unavailable' : 'shown';
            broken = null;
        } catch (error) {
            outcome = 'failed';
            broken = view.id;
            report('enter', view, error);
            safely('recover', view, () => env.recover(view, options, error));
        } finally {
            committing = false;
        }
        if (outcome !== 'failed') {
            safely('committed', view, () => env.committed(view, options));
            if (outcome === 'shown' && typeof options.after === 'function') safely('after', view, () => options.after());
        }
        drain();
        return outcome;
    }

    function drain() {
        let guard = 0;
        while (queued.length && !committing && guard++ < 20) {
            const next = queued.shift();
            go(next.id, next.options, next.answered);
        }
    }

    function go(id, options = {}, answered = false) {
        if (committing) {
            queued.push({ id, options, answered });
            return 'queued';
        }
        const resolved = resolve(id, options);
        if (!resolved) return 'refused';
        const { view, options: opts } = resolved;
        const hereId = env.current();
        const here = hereId && hereId !== broken ? registry.get(hereId) : null;

        // Choosing the view you are on. A form with unsaved text is not rebuilt; and it cancels a change that was waiting for an answer.
        if (here && here.id === view.id && !opts.rebuild && registry.reenter(here) === 'keep') {
            if (waiting) waiting.request = null;
            return 'shown';
        }
        // A question is already open: only the target changes, the person is not asked twice.
        if (waiting && !answered) {
            waiting.request = { view, options: opts };
            return waiting.promise;
        }
        if (here && here.leave && !opts.fromEngine && !answered) {
            const verdict = askToLeave(here);
            if (isThenable(verdict)) {
                const entry = { request: { view, options: opts }, promise: null };
                waiting = entry;
                entry.promise = verdict.then((leave) => {
                    if (waiting === entry) waiting = null;
                    const request = entry.request;
                    if (!leave || !request) return 'stayed';
                    return go(request.view.id, request.options, true); // the view has answered: it is not asked again
                });
                return entry.promise;
            }
            if (verdict === false) return 'stayed';
        }
        return commit(view, opts);
    }

    return {
        go,
        /** True while a view is being drawn (the engine events that causes are the router's own, not the engine's). */
        drawing: () => committing,
        /** True while a view waits for the person's answer. */
        asking: () => waiting !== null,
        /** The id of a view whose drawing failed and that is shown as an error page, or null. */
        brokenView: () => broken
    };
}
