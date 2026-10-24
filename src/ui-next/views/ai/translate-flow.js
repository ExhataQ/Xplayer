// Translating the lyrics of one song, shared by the chat, the lyrics bar and auto-translate.
// Synced lyrics are saved as a lyrics version ("AI translation (French)") that the lyrics view can switch to; plain lyrics have no
// timing to attach a version to, so they come back as text to copy.

import { translate, currentLyrics } from '../../adapter/ai-bridge.js';
import { saveTranslation } from '../../adapter/ai-lyrics.js';

const running = new Set();

export const isTranslating = (songId) => running.has(songId);

/**
 * song: { id, title, lyrics } (from currentLyrics()). Resolves the translate result plus `saved` (true when it is now a lyrics
 * version) or { ok: false, error }. A second request for the same song while one is running is refused with error 'busy'.
 */
export async function translateSong(song, language) {
    if (!song || !song.lyrics) return { ok: false, error: 'no-lyrics' };
    if (running.has(song.id)) return { ok: false, error: 'busy' };
    running.add(song.id);
    try {
        const result = await translate(song.lyrics, language);
        if (!result.ok) return result;
        const saved = result.synced ? saveTranslation(song.id, result.translation, result.targetLanguage) : false;
        return { ...result, saved };
    } catch (error) {
        return { ok: false, error: 'unexpected' };
    } finally {
        running.delete(song.id);
    }
}

export { currentLyrics };
