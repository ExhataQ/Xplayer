// Auto-translate: when the setting is on, a song that starts is translated into the default language and the translation is shown.
// It waits a moment first, so skipping through songs does not spend requests, and it skips songs that already have a translation in
// that language. Each translation is one or more requests against the free daily limit, so the setting says so.

import { getStatus, currentLyrics } from '../../adapter/ai-bridge.js';
import { translationState, onSongChanged } from '../../adapter/ai-lyrics.js';
import { notify } from '../../shell/notify.js';
import { translateSong } from './translate-flow.js';
import { explain } from './ai-messages.js';

const WAIT = 1500;
let timer = null;
let told = new Set();

async function run(songId) {
    const status = await getStatus().catch(() => null);
    if (!status || !status.enabled || !status.hasKey || !status.privacyAccepted || !status.autoTranslate || !status.translateLanguage) return;
    const song = currentLyrics();
    if (!song || song.id !== songId || !song.lyrics) return;
    const have = translationState(song);
    if (have.has && have.language.toLowerCase() === status.translateLanguage.toLowerCase()) return;
    const result = await translateSong(song, status.translateLanguage);
    if (result.ok || told.has(result.error) || result.error === 'busy') return;
    told.add(result.error); // one notice per kind of problem, not one per song
    notify({ title: 'Auto-translate stopped for a song', detail: explain(result), kind: 'warning', where: 'toast' });
}

export function startAutoTranslate() {
    return onSongChanged(() => {
        clearTimeout(timer);
        const song = currentLyrics();
        if (!song) return;
        timer = setTimeout(() => run(song.id), WAIT);
    });
}
