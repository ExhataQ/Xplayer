// The translation controls in the header of the right panel and of its full-size mode (views/playback/right-panel-content.js mounts
// them through shell/ai-slots.js, mountAiLyricsBar). Two icon buttons:
//   Translate   translates this song into the default language (asks for one when none is set); needs AI set up
//   View        one button for what the lyrics show: both texts, the translation only (the original is hidden), the original only.
//               A click moves to the next one and the icon says which is on. It appears once the song has a translation.
// What is shown is kept by shell/lyrics-display.js; the panel draws it. ("Translate every song" is in Settings, AI.)

import { el, iconButton, iconEl, textField, openDialog } from '../../components/index.js';
import { getStatus, currentLyrics } from '../../adapter/ai-bridge.js';
import { translationPair, watchSong } from '../../adapter/ai-lyrics.js';
import { displayChoice, nextMode, setMode, onDisplayChange } from '../../shell/lyrics-display.js';
import { notify } from '../../shell/notify.js';
import { translateSong, isTranslating } from './translate-flow.js';
import { explain } from './ai-messages.js';

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
            ? { title: `Translated into ${result.targetLanguage}`, detail: 'The right panel shows it with the original; the buttons in its header change that.', kind: 'success', where: 'toast' }
            : { title: 'Translated, but not saved', detail: 'These lyrics have no timing, so the translation could not be shown with the lyrics. Ask in the AI chat to copy it.', kind: 'warning', where: 'both' }
    );
}

// One icon per state of the View button, and what a click will do from there.
const VIEW = {
    both: { icon: 'text-both', label: 'Showing the original and the translation. Click to hide the original' },
    translated: { icon: 'eye-off', label: 'Showing the translation only. Click to show the original only' },
    original: { icon: 'translation-off', label: 'Showing the original only. Click to show both' }
};

export function buildLyricsControls(host, ctx) {
    const translate = iconButton({ icon: 'languages', label: 'Translate lyrics', size: 'sm', onClick: () => translateNow() });
    const view = iconButton({ icon: VIEW.both.icon, label: VIEW.both.label, size: 'sm', onClick: () => setMode(nextMode(displayChoice().mode)) });
    const root = el('div', { class: 'ai-lyrics-tools', hidden: true }, translate, view);

    function paint() {
        const song = currentLyrics();
        const has = Boolean(song && translationPair(song));
        const shown = VIEW[displayChoice().mode];
        translate.hidden = !ready(ctx.getStatus());
        translate.disabled = !song || !song.lyrics || isTranslating(song.id);
        view.hidden = !has;
        view.replaceChildren(iconEl(shown.icon, { size: 18 }));
        view.setAttribute('aria-label', shown.label);
        view.title = shown.label;
        root.hidden = translate.hidden && !has;
    }

    const stop = watchSong(() => (root.isConnected ? paint() : stop()));
    const offStatus = ctx.onStatus(paint);
    const offDisplay = onDisplayChange(paint);
    host.append(root);
    paint();
    return { destroy: () => (stop(), offStatus(), offDisplay()) };
}
