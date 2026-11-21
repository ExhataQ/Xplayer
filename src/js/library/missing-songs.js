// ==============================================================================
// SONGS WHOSE FILE IS GONE
// ==============================================================================
// A short while after start the main process looks for songs whose file no longer exists (deleted in Explorer, or by an older version of the app that
// moved the file to the Recycle Bin but kept the song in the saved library) and removes them from the saved list. The ones it names are taken out of
// the lists here too, so they do not wait for the next start. A song on a folder that cannot be reached (an unplugged drive) is left alone.

const WAIT_MS = 4000;

export async function removeMissingSongs() {
    if (typeof desktopApi === 'undefined' || !desktopApi.supports('library.pruneMissingSongs')) return 0;
    let answer;
    try {
        answer = await desktopApi.library.pruneMissingSongs();
    } catch (e) {
        return 0;
    }
    const urls = new Set(answer && Array.isArray(answer.removed) ? answer.removed : []);
    if (!urls.size) return 0;
    let count = 0;
    for (const song of SONGS_DATA) {
        if (!urls.has(song.url) || deletedSongIds.has(song.id)) continue;
        markSongAsDeleted(song.id);
        count++;
    }
    if (count) {
        if (typeof onSongsChanged === 'function') onSongsChanged();
        if (typeof refreshCurrentViewAfterMutation === 'function') refreshCurrentViewAfterMutation();
        showNotification(`${count} ${count === 1 ? 'song was' : 'songs were'} removed from the library: ${count === 1 ? 'its file is' : 'their files are'} no longer on your computer.`, 'info', 6000);
    }
    return count;
}

if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    window.addEventListener('load', () => setTimeout(removeMissingSongs, WAIT_MS), { once: true });
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ removeMissingSongs });
}
