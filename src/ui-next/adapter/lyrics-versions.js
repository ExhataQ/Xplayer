// lyrics-versions: the saved synced lyrics (LRC) of one song, for the picker next to "Lyrics" in the right panel.
// The engine already keeps several versions per song (the "variants" of the lyrics store, one of them active) and every reader uses the
// active one, so choosing here is only setting the active version. Nothing new is stored.
//
//   lyricsVersions(songId)            -> [{ id, label, active }] of the song's own versions (AI translations are left out), in saved order
//   chooseLyricsVersion(songId, id)   -> true when the version became the active one; the engine's 'lyrics:changed' is raised so every view redraws
//   versionLabel(variant, position)   -> the name shown: the person's own name, or a made-up one for a version that has none (pure)

import { engineCall } from './engine-api.js';

const TRANSLATION = /^AI translation/;
// The engine names a version "Sample 1", "Sample 2" when nobody did; that is a count, not a name, so it is replaced here.
const DEFAULT_NAME = /^sample \d+$/i;

const timedLines = (text) => String(text || '').split(/\r?\n/).filter((line) => /^\s*\[\d+:\d+(?:[.:]\d+)?\]\s*\S/.test(line)).length;

/**
 * The name to show for a saved version. A name the person (or a tool such as the translation) set is kept. A version with none is called
 * "Version N" (its place among the song's own versions), then what tells it apart from the others: its number of timed lines, and its
 * timing shift when it has one, e.g. "Version 2 · 54 lines · +0.5 s".
 */
export function versionLabel(variant, position) {
    const name = String((variant && variant.name) || '').trim();
    if (name && !DEFAULT_NAME.test(name)) return name;
    const parts = [`Version ${position}`];
    const lines = timedLines(variant && variant.text);
    if (lines) parts.push(`${lines} ${lines === 1 ? 'line' : 'lines'}`);
    const offset = Number(variant && variant.offset) || 0;
    if (offset) parts.push(`${offset > 0 ? '+' : '−'}${Math.abs(offset).toFixed(1).replace(/\.0$/, '')} s`);
    return parts.join(' · ');
}

const songData = (id) => (window.SONGS_DATA || []).find((s) => String(s.id) === String(id)) || null;

export function lyricsVersions(songId) {
    const song = songData(songId);
    const entry = song ? engineCall('getSyncedLyricsVariantsForSong', song) : null;
    const own = ((entry && entry.variants) || []).filter((v) => !TRANSLATION.test(String(v.name || '')));
    const activeId = entry ? entry.activeId : null;
    return own.map((v, i) => ({ id: v.id, label: versionLabel(v, i + 1), active: v.id === activeId || (!activeId && i === 0) }));
}

export function chooseLyricsVersion(songId, versionId) {
    const song = songData(songId);
    if (!song || !engineCall('setActiveSyncedLyricsVariant', song.id, versionId)) return false;
    engineCall('emit', 'lyrics:changed', { songId: song.id });
    return true;
}
