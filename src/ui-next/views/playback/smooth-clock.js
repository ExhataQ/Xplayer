// Polish: the playback position between the audio element's time events. The element reports a new time about four times a second;
// drawing straight from it makes the bars step. This keeps the last report, runs the clock on from it while the song plays, and
// eases toward each new report instead of jumping, so the bar and the waveform move every frame.
//
//   const clock = createSmoothClock();
//   clock.sample({ currentTime, duration, playing }, now)   at every time event
//   clock.fraction(now)                                     0..1, once per frame
//
// A real jump (a seek, a new song: more than `snap` seconds from what is shown) is shown at once, and so is a paused song.
// With less animation turned on (`reduced()` is true) none of this runs: the position is the last one reported, as the engine gives it.

export function createSmoothClock({ snap = 0.75, ease = 140, reduced = () => false } = {}) {
    let state = { currentTime: 0, duration: 0, playing: false, at: 0 };
    let shown = null;
    let last = 0;

    return {
        sample(time, now) {
            state = { currentTime: time.currentTime || 0, duration: time.duration || 0, playing: Boolean(time.playing), at: now };
        },
        fraction(now) {
            if (!state.duration) {
                shown = 0;
                last = now;
                return 0;
            }
            if (reduced()) {
                shown = Math.max(0, Math.min(1, state.currentTime / state.duration));
                last = now;
                return shown;
            }
            const elapsed = state.playing ? Math.max(0, now - state.at) / 1000 : 0;
            const target = Math.max(0, Math.min(1, (state.currentTime + elapsed) / state.duration));
            if (shown === null || !state.playing || Math.abs(target - shown) * state.duration > snap) shown = target;
            else if (target > shown) shown += (target - shown) * Math.min(1, Math.max(0, now - last) / ease);
            // else: the report is a little behind what is shown. The bar never steps back; the clock catches up.
            last = now;
            return shown;
        }
    };
}
