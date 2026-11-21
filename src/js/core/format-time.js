// The one way a time in seconds is written, m:ss: the player bar, the seek tooltip, the queue and the Mini and Quick Players all use this.
// Anything that is not a positive number (a song whose length is not known yet) is 0:00.
export function formatTime(seconds) {
    const whole = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}
