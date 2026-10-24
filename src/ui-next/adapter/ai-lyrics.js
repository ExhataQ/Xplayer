// ai-lyrics (Agent E, page side; counted in the DP9 adapter budget with ai-bridge.js).
//
// A translation is kept as one more version of the song's lyrics in the engine's own lyrics store (the "variants" the lyrics view
// already switches between), named "AI translation (French)". So the lyrics view shows it with the original's timing, and "show the
// original" is the engine switching back to the first version that is not a translation. Nothing new is stored here.
//
//   saveTranslation(songId, text, language)  -> adds or replaces the variant and shows it
//   translationState(song)                   -> { has, showing, language } for the lyrics bar
//   showTranslation(songId) / showOriginal(songId)
//   onSongChanged(callback)                  -> runs when another song starts (auto-translate); returns a stop function

import { engineEvent } from './engine-api.js';

const PREFIX = 'AI translation';
const e = () => window;
// `song` may be the library song or any object with its id (the engine keys the store by the song's url, so it is looked up).
const variantsOf = (song) => (song && typeof e().getSyncedLyricsVariantsForSong === 'function' && e().getSyncedLyricsVariantsForSong(songById(song.id) || song)) || { variants: [], activeId: null };
const isTranslation = (v) => v.name.startsWith(PREFIX);
const changed = (songId) => e().emit && e().emit('lyrics:changed', { songId });
const songById = (id) => (e().SONGS_DATA || []).find((s) => s.id === id);

export function translationState(song) {
    const { variants, activeId } = variantsOf(song);
    const found = variants.filter(isTranslation);
    const active = found.find((v) => v.id === activeId);
    return { has: found.length > 0, showing: Boolean(active), language: ((active || found[found.length - 1] || {}).name || '').replace(/^.*\((.*)\)$/, '$1') };
}

export function saveTranslation(songId, text, language) {
    const song = songById(songId);
    if (!song || typeof e().addSyncedLyricsVariant !== 'function') return false;
    const name = `${PREFIX} (${language})`;
    for (const old of variantsOf(song).variants.filter((v) => v.name === name)) e().deleteSyncedLyricsVariant(songId, old.id);
    const variant = e().addSyncedLyricsVariant(songId, text, 0);
    if (!variant) return false;
    e().renameSyncedLyricsVariant(songId, variant.id, name);
    e().setActiveSyncedLyricsVariant(songId, variant.id);
    changed(songId);
    return true;
}

function show(songId, pick) {
    const { variants } = variantsOf(songById(songId));
    const target = pick(variants);
    if (!target || !e().setActiveSyncedLyricsVariant(songId, target.id)) return false;
    changed(songId);
    return true;
}
export const showOriginal = (songId) => show(songId, (v) => v.find((x) => !isTranslation(x)));
export const showTranslation = (songId) => show(songId, (v) => v.filter(isTranslation).pop());

export const onSongChanged = (callback) => engineEvent('queue:indexChanged', callback);
export function watchSong(callback) {
    const stops = ['lyrics:changed', 'queue:indexChanged'].map((name) => engineEvent(name, callback));
    return () => stops.forEach((stop) => stop());
}
