// The pure part of "pick up where you left off" (adapter/last-session.js): what to remember about the song that is playing.
// Kept apart so it can be tested in plain Node.

export const SESSION = Object.freeze({ saveEveryMs: 5000, minSeconds: 3, endMargin: 5 });
// saveEveryMs: how often the position is written while a song plays (it is also written on pause, on a song change and on close);
// minSeconds: a song stopped before this is remembered from its start; endMargin: a song this close to its end is finished.

/** The record to keep, { id, position, duration } (seconds), or null when there is nothing to pick up (no song, or the song is over). */
export function sessionToSave({ id, position, duration }) {
    const p = Number(position);
    const length = Number(duration) > 0 ? Number(duration) : 0;
    if (id === null || id === undefined || id === '' || !Number.isFinite(p) || p < 0) return null;
    if (length && p >= length - SESSION.endMargin) return null;
    return { id, position: p < SESSION.minSeconds ? 0 : Math.floor(p), duration: length };
}
