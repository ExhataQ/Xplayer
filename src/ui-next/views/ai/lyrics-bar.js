// The Translate controls in the lyrics bar (mounted by views/tools/lyrics.js through shell/ai-slots.js, mountAiLyricsBar):
//   [Original | Translated]   shown once the song has an AI translation; it switches the lyrics version the lyrics view shows
//   [Translate]               translates this song into the default language (asks for one when none is set)
//   [Auto]                    translate every song that starts (the setting also lives in Settings, AI)
// Nothing is drawn until AI is turned on and set up.

import { el, button, chip, segmented, textField, openDialog } from '../../components/index.js';
import { getStatus, setSettings, currentLyrics } from '../../adapter/ai-bridge.js';
import { translationState, showOriginal, showTranslation, watchSong } from '../../adapter/ai-lyrics.js';
import { notify } from '../../shell/notify.js';
import { translateSong, isTranslating } from './translate-flow.js';
import { explain } from './ai-messages.js';
import { refreshStatus } from './ai-state.js';

const ready = (s) => Boolean(s && s.enabled && s.hasKey && s.privacyAccepted);
export const LANGUAGES = ['English', 'Persian', 'Arabic', 'Spanish', 'French', 'German', 'Italian', 'Portuguese', 'Russian', 'Turkish', 'Hindi', 'Japanese', 'Korean', 'Chinese'];

/** Asks which language, offering the common ones. Resolves the language, or null when cancelled. */
export async function askLanguage(initial = '') {
    const field = textField({ label: 'Translate into', value: initial, placeholder: 'For example: French, Persian, Spanish', hint: 'Set a default language in Settings, AI, to skip this question.' });
    field.input.setAttribute('list', 'ai-language-list');
    const list = el('datalist', { id: 'ai-language-list' }, ...LANGUAGES.map((l) => el('option', { value: l })));
    const chosen = await openDialog({
        title: 'Translate lyrics',
        body: el('div', {}, field.el, list),
        actions: [
            { label: 'Cancel', value: null },
            {
                label: 'Translate',
                variant: 'primary',
                value: true,
                onClick: () => {
                    if (!field.input.value.trim()) throw new Error('Write the language first.');
                }
            }
        ]
    });
    return chosen === true ? field.input.value.trim() : null;
}

/** Translates the playing song and tells the person how it went. Used by the Translate button. */
export async function translateNow(language) {
    const song = currentLyrics();
    if (!song || !song.lyrics) return notify({ title: 'Nothing to translate', detail: song ? 'This song has no lyrics.' : 'Play a song with lyrics first.', kind: 'warning', where: 'toast' });
    const target = language || (await getStatus()).translateLanguage || (await askLanguage());
    if (!target) return null;
    const note = notify({ title: `Translating "${song.title}" into ${target}…`, kind: 'info', where: 'toast' });
    const result = await translateSong(song, target);
    note.dismiss();
    if (!result.ok) return notify({ title: 'Could not translate', detail: explain(result), kind: 'error' });
    return notify(
        result.saved
            ? { title: `Translated into ${result.targetLanguage}`, detail: 'Use Original / Translated in the lyrics bar to switch.', kind: 'success', where: 'toast' }
            : { title: 'Translated, but not saved', detail: 'These lyrics have no timing, so the translation could not be added to the lyrics view. Ask in the AI chat to copy it.', kind: 'warning', where: 'both' }
    );
}

export function buildLyricsControls(host, ctx) {
    const toggle = segmented({
        label: 'Lyrics language',
        value: 'translated',
        items: [{ value: 'original', label: 'Original' }, { value: 'translated', label: 'Translated' }],
        onChange: (value) => {
            const song = currentLyrics();
            if (song) (value === 'original' ? showOriginal : showTranslation)(song.id);
        }
    });
    const translateButton = button({ label: 'Translate', size: 'sm', onClick: () => translateNow() });
    const auto = chip({
        label: 'Auto',
        pressed: false,
        onClick: async () => {
            const status = await getStatus();
            await setSettings({ autoTranslate: !status.autoTranslate });
            await refreshStatus();
        }
    });
    auto.title = 'Translate every song that starts into the default language';
    const root = el('div', { class: 'ai-lyrics-tools', hidden: true }, toggle.el, translateButton, auto);

    function paint() {
        const status = ctx.getStatus();
        root.hidden = !ready(status);
        auto.setAttribute('aria-pressed', String(Boolean(status.autoTranslate)));
        const song = currentLyrics();
        const state = song ? translationState(song) : { has: false };
        toggle.el.hidden = !state.has;
        if (state.has) toggle.setValue(state.showing ? 'translated' : 'original');
        translateButton.disabled = !song || !song.lyrics || isTranslating(song.id);
    }

    const stop = watchSong(() => (root.isConnected ? paint() : stop()));
    const off = ctx.onStatus(paint);
    host.append(root);
    paint();
    return { destroy: () => (stop(), off()) };
}
