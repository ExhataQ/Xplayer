// A notification for the Many songs finder (task PC-09, brief 15.3). The engine's finder (js/lyrics/19) tells the app how a run is going
// through the event 'smartLyrics:progress':
//
//   { phase: 'start',    mode, total, completed: 0, found: 0 }
//   { phase: 'progress', mode, total, completed, found, title }
//   { phase: 'end',      mode, total, completed, found, stopped }
//
// createFinderNotice returns the function that turns those payloads into one shell notification (shell/notify.js): a progress entry with a
// Cancel button while the run goes, then a finished entry with the counts. Clicking either opens Many songs, where the results are.
// It holds no engine or shell import: views/tools/lyrics.js hands it the real functions, a test hands it stand-ins.

const wordFor = (mode) => (mode === 'lrc' ? 'LRC' : 'lyrics');
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * deps.notifyProgress  the shell's notifyProgress
 * deps.stop            ends the run after the songs that are being searched (the engine's stopSmartLyricsFinder)
 * deps.open            opens the Many songs page without starting a new run
 */
export function createFinderNotice({ notifyProgress, stop, open }) {
    let job = null;
    const target = { label: 'Open results', go: open };

    return function onFinderEvent(event) {
        if (!event || typeof event !== 'object') return;
        const { phase, mode, total = 0, completed = 0, found = 0, stopped = false } = event;
        if (phase === 'start') {
            if (job) job.dismiss(); // a run that never reported its end must not stay "in progress" next to the new one
            job = notifyProgress({ title: `Finding ${wordFor(mode)} for ${plural(total, 'song')}`, kind: 'job', onCancel: stop, target });
            job.update({ percent: 0, status: `0 of ${total}` });
        } else if (phase === 'progress' && job) {
            job.update({ percent: total ? (completed / total) * 100 : 0, status: `${completed} of ${total} · ${found} found` });
        } else if (phase === 'end' && job) {
            const word = wordFor(mode);
            const detail = stopped ? `Stopped: found ${word} for ${found} of ${plural(completed, 'song')} (${total - completed} skipped)` : `Found ${word} for ${found} of ${plural(total, 'song')}`;
            job.done({ title: stopped ? `Search stopped` : `Search finished`, detail, kind: found > 0 ? 'success' : 'info', target });
            job = null;
        }
    };
}
