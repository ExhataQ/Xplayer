// The light window following the full app (see electron/player-sync.js): what the full app published is kept here, merged, and turned into
// where the song is now, or into a payload for playing on its own when the full app goes away. Plain functions, so tools/tests can run them.

/** The whole state after `next`: a state without a queue keeps the queue of the one before. */
export function mergeSnapshot(previous, next) {
    return { ...(previous || {}), ...next, queue: (next && next.queue) || (previous && previous.queue) || null };
}

/** Where the song is at `now` (ms): the place the state said, moved on by the time since, while it plays; never past the end. */
export function positionNow(snapshot, receivedAt, now) {
    if (!snapshot) return 0;
    const moved = snapshot.playing ? Math.max(0, now - receivedAt) / 1000 : 0;
    const at = (snapshot.position || 0) + moved;
    return snapshot.duration > 0 ? Math.min(at, snapshot.duration) : at;
}

/** The same song and queue as a payload for the light window's own player (the full app is gone): it goes on from the same place. */
export function toStandalone(snapshot) {
    const queue = snapshot && snapshot.queue ? snapshot.queue.songs : [];
    const index = snapshot && snapshot.index >= 0 && snapshot.index < queue.length ? snapshot.index : -1;
    const songs = index >= 0 ? queue : snapshot && snapshot.song ? [snapshot.song] : [];
    if (songs.length === 0) return null;
    return { success: true, songs, startIndex: index >= 0 ? index : 0, startAt: snapshot.position || 0, paused: snapshot.playing !== true, repeat: snapshot.repeat, shuffle: snapshot.shuffle };
}
