// ai-lyrics (Agent E, page side; counted in the DP9 adapter budget with ai-bridge.js).
//
// A translation is kept as one more version of the song's lyrics in the engine's own lyrics store (the "variants" the lyrics view
// already switches between), named "AI translation (French)". So the lyrics view shows it with the original's timing, and "show the
// original" is the engine switching back to the first version that is not a translation. Nothing new is stored here.
//
//   saveTranslation(songId, text, language)  -> adds or replaces the variant; the song's own lyrics stay the active version
//   translationPair(song)                    -> { original, translated, language } (parsed lines) or null without a translation
//   onSongChanged(callback)                  -> runs when another song starts (auto-translate); returns a stop function

import { engineEvent } from './engine-api.js';

const PREFIX = 'AI translation';
const e = () => window;
// `song` may be the library song or any object with its id (the engine keys the store by the song's url, so it is looked up).
const variantsOf = (song) => (song && typeof e().getSyncedLyricsVariantsForSong === 'function' && e().getSyncedLyricsVariantsForSong(songById(song.id) || song)) || { variants: [], activeId: null };
const isTranslation = (v) => v.name.startsWith(PREFIX);
const changed = (songId) => e().emit && e().emit('lyrics:changed', { songId });
const songById = (id) => (e().SONGS_DATA || []).find((s) => s.id === id);

export function translationPair(song) {
    const { variants, activeId } = variantsOf(song);
    const found = variants.filter(isTranslation);
    const base = variants.find((v) => v.id === activeId && !isTranslation(v)) || variants.find((v) => !isTranslation(v));
    const last = found[found.length - 1];
    if (!base || !last || typeof e().parseLRC !== 'function') return null;
    return { original: e().parseLRC(base.text) || [], translated: e().parseLRC(last.text) || [], language: last.name.replace(/^.*\((.*)\)$/, '$1') };
}

export function saveTranslation(songId, text, language) {
    const song = songById(songId);
    if (!song || typeof e().addSyncedLyricsVariant !== 'function') return false;
    const name = `${PREFIX} (${language})`;
    for (const old of variantsOf(song).variants.filter((v) => v.name === name)) e().deleteSyncedLyricsVariant(songId, old.id);
    const before = variantsOf(song).activeId;
    const variant = e().addSyncedLyricsVariant(songId, text, 0);
    if (!variant) return false;
    e().renameSyncedLyricsVariant(songId, variant.id, name);
    if (before) e().setActiveSyncedLyricsVariant(songId, before); // the Sync tool and every other reader keep the song's own lyrics
    changed(songId);
    return true;
}

export const onSongChanged = (callback) => engineEvent('queue:indexChanged', callback);
export function watchSong(callback) {
    const stops = ['lyrics:changed', 'queue:indexChanged'].map((name) => engineEvent(name, callback));
    return () => stops.forEach((stop) => stop());
}
