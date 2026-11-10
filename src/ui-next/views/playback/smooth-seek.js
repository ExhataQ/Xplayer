// The plain seek bar, moved every frame instead of at each time event (polish). The engine still owns the bar: it writes the width
// and the knob at each time event and while the person drags; this only writes them in between, from a smoothed clock.
// While the person drags, while the waveform is drawn over the bar, or while less animation is on, it leaves everything alone.

import { playerPart, onTime } from '../../adapter/player-parts.js';
import { createSmoothClock } from './smooth-clock.js';
import { reducedMotion } from '../../components/motion.js';

export function mountSmoothSeek() {
    const seek = playerPart('seek');
    const fill = playerPart('seek-fill');
    const knob = document.getElementById('progress-knob');
    if (!seek || !fill) return () => {};
    const clock = createSmoothClock({ reduced: reducedMotion });
    let frame = 0;
    let playing = false;

    const paint = () => {
        frame = 0;
        if (!playing) return;
        if (!reducedMotion() && !seek.classList.contains('dragging') && !seek.classList.contains('has-waveform')) {
            const percent = `${(clock.fraction(performance.now()) * 100).toFixed(3)}%`;
            fill.style.width = percent;
            if (knob) knob.style.left = percent;
        }
        frame = requestAnimationFrame(paint);
    };
    const stopTime = onTime((time) => {
        clock.sample(time, performance.now());
        playing = time.playing;
        if (playing && !frame) frame = requestAnimationFrame(paint);
    }, { immediate: true });

    return () => {
        stopTime();
        cancelAnimationFrame(frame);
        frame = 0;
    };
}
