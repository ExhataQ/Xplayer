// The AI chat (task PE-10): a standard chat box. The conversation is above, the box to type in is at the bottom with the model
// choice next to it, and the assistant either answers in words or proposes a plan (Apply / Discard) when asked for a change.
// Nothing runs without the preview and the Apply button. It is shown in two shapes (a small window and the big view) by
// shell/ai-slots.js; the conversation and any request that is still running live in this module, so they survive switching views,
// closing the window and coming back.

import { el, button, iconButton, chip, segmented, textField, emptyState } from '../../components/index.js';
import { getStatus, plan, cancel, selectedCount, hasPlayingSong, playingSong } from '../../adapter/ai-bridge.js';
import { openAiSettings, openAiChat, openAiPanel, openAiQueue } from '../../shell/ai-slots.js';
import { notify } from '../../shell/notify.js';
import { explain, needsSettings } from './ai-messages.js';
import { planPreview } from './plan-preview.js';
import { applyPlan } from './apply-plan.js';
import { askPrivacy } from './privacy-dialog.js';
import { createModelPicker } from './model-picker.js';
import { createLimitsMeter } from './limits-meter.js';
import { playOrderOf, songList, saveAsPlaylist, announceShuffle } from './shuffle-list.js';
import { askLanguage } from './lyrics-bar.js';
import { translateSong } from './translate-flow.js';
import { currentLyrics } from '../../adapter/ai-bridge.js';

const SUGGESTIONS = ['Shuffle my library for a calm evening', 'Make playlists by mood from my library', 'Fill in missing genres and years', 'Put my playlists into folders by theme'];
const HISTORY_TURNS = 8;

// ---- state that outlives the screen ----
const thread = [];
let scope = 'all';
let useWeb = false;
let readLyrics = false;
let queued = null;
let pending = null; // the request that is running: { text }
const screens = new Set(); // the chat screens on the page right now (the window, or the big view)

const redraw = () => screens.forEach((screen) => screen.draw());

/** Text for the box the next time (or right now, if the chat is open). Used by Playback > AI shuffle. */
export function queuePrompt(text) {
    queued = text;
    screens.forEach((screen) => screen.fill());
}

const ready = (s) => Boolean(s && s.enabled && s.hasKey && s.privacyAccepted);
const shuffleName = (p) => String(p.summary || 'AI shuffle').slice(0, 60);

function setupHint(s) {
    if (!s || !s.enabled) return 'AI is turned off.';
    if (!s.privacyAccepted) return 'You have not accepted what is sent yet.';
    return 'There is no OpenRouter key yet.';
}

// The last few things said, so a follow-up like "make it calmer" has something to follow. Text only, no song data.
function historyBeforeNow() {
    return thread
        .filter((m) => !m.kind && (m.text || m.reply || (m.plan && m.plan.summary)))
        .slice(-HISTORY_TURNS)
        .map((m) => ({ role: m.role, text: m.role === 'user' ? m.text : m.reply || m.text || m.plan.summary }));
}

function say(message) {
    thread.push(message);
    redraw();
}

/** Sends one request. Lives outside the screens: leaving the view does not stop it, and the answer is waiting when you come back. */
async function submit(text) {
    const history = historyBeforeNow();
    thread.push({ role: 'user', text });
    pending = { text };
    redraw();
    let result;
    try {
        result = await plan({ request: text, scope, useWeb, includeLyrics: readLyrics, history });
    } catch (error) {
        result = { ok: false, error: 'unexpected' };
    }
    pending = null;
    let heard;
    if (result.ok) {
        const reply = result.plan.reply || '';
        if (result.plan.actions.length) {
            const seen = `Looked at ${result.sentRows} songs with ${result.model}.`;
            const lyrics = result.withLyrics ? ` Read the lyrics of ${result.withLyrics}.` : readLyrics ? ' No lyrics were found for these songs.' : '';
            const web = result.lookedUp ? ' Online tag candidates were used.' : useWeb ? ' No online candidates were found.' : '';
            say({ role: 'assistant', plan: result.plan, preview: result.preview, reply, info: seen + lyrics + web, state: 'ready' });
        } else {
            say({ role: 'assistant', text: reply || result.plan.summary || 'I could not do that with what I can do here.' });
        }
        heard = reply || result.plan.summary || 'Your plan is ready.';
    } else if (result.error !== 'cancelled') {
        say({ role: 'assistant', kind: 'error', text: explain(result), settings: needsSettings(result) });
        heard = explain(result);
    } else {
        say({ role: 'assistant', text: 'Cancelled.' });
    }
    screens.forEach((screen) => screen.afterRequest());
    // Nobody is looking at the chat (another view, window closed): say it is done.
    if (!screens.size && heard) notify({ title: 'The AI answered', detail: heard.slice(0, 140), kind: result.ok ? 'success' : 'warning', where: 'both', action: { label: 'Open chat', onClick: openAiChat } });
}

/**
 * opts.mode 'view' (the big main view, with a Make smaller button) or 'popup' (the small window, with Expand and Close).
 * The conversation is shared, so switching between the two keeps it.
 */
export function mountChat(host, ctx, opts = {}) {
    const mode = opts.mode === 'popup' ? 'popup' : 'view';
    host.replaceChildren();

    const picker = createModelPicker({ label: 'Model', compact: true });
    const limits = createLimitsMeter(() => (ctx.getStatus() || {}).model);
    const windowButtons =
        mode === 'popup'
            ? [iconButton({ icon: 'maximize-2', label: 'Expand to the big view', size: 'sm', onClick: () => opts.onExpand && opts.onExpand() }), iconButton({ icon: 'x', label: 'Close the chat', size: 'sm', onClick: () => opts.onClose && opts.onClose() })]
            : [iconButton({ icon: 'minimize-2', label: 'Make smaller (pop-up)', size: 'sm', onClick: () => opts.onShrink && opts.onShrink() })];

    const log = el('div', { class: 'ai-chat__thread', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' });
    const banner = el('div', { class: 'ai-chat__setup' });
    const suggestions = el('div', { class: 'ai-chat__suggestions' });
    const composer = textField({ label: 'Message', multiline: true, placeholder: 'Ask anything, or describe a change…' });
    composer.input.rows = 2;
    composer.input.addEventListener('keydown', (event) => {
        event.stopPropagation(); // typing must not trigger the player's single-key shortcuts
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            send();
        }
    });
    const sendButton = button({ label: 'Send', variant: 'primary', onClick: () => send() });
    const stopButton = button({ label: 'Cancel', onClick: () => cancel() });
    stopButton.hidden = true;

    const scopeControl = segmented({
        label: 'Which songs the assistant can see',
        value: scope,
        items: [{ value: 'all', label: 'All songs' }, { value: 'selected', label: 'Selected' }, { value: 'now', label: 'Playing now' }],
        onChange: (value) => {
            scope = value;
            paintNotes();
        }
    });
    const scopeNote = el('span', { class: 'ai-chat__scope-note' });
    const webChip = chip({ label: 'Look up tags online', pressed: useWeb, onClick: () => ((useWeb = !useWeb), webChip.setAttribute('aria-pressed', String(useWeb)), paintNotes()) });
    const lyricsChip = chip({ label: 'AI may read lyrics', pressed: readLyrics, onClick: () => ((readLyrics = !readLyrics), lyricsChip.setAttribute('aria-pressed', String(readLyrics)), paintNotes()) });
    const translateButton = button({ label: 'Translate lyrics', size: 'sm', onClick: () => translateHere() });
    const clearButton = button({ label: 'Clear', variant: 'ghost', size: 'sm', onClick: () => (thread.length = 0, redraw()) });

    function paintNotes() {
        const song = playingSong();
        const parts = [];
        if (scope === 'selected') parts.push(`${selectedCount()} selected`);
        if (scope === 'now') parts.push(song ? `"${song.title}"` : 'nothing is playing');
        if (readLyrics) parts.push('the first 700 characters of lyrics of up to 40 songs are sent');
        scopeNote.textContent = parts.join(' · ');
    }

    async function send() {
        const text = composer.input.value.trim();
        if (!text || pending) return;
        const current = await getStatus();
        if (!ready(current)) {
            if (current.enabled && !current.privacyAccepted && (await askPrivacy())) return send();
            return paintSetup(current);
        }
        if (scope === 'selected' && selectedCount() === 0) return say({ role: 'assistant', kind: 'error', text: 'Select some songs in the list first, or switch to All songs.' });
        if (scope === 'now' && !hasPlayingSong()) return say({ role: 'assistant', kind: 'error', text: 'Nothing is playing. Start a song, or switch to All songs.' });
        composer.setValue('');
        await submit(text);
    }

    async function applyCard(card) {
        card.state = 'running';
        redraw();
        const order = playOrderOf(card.plan);
        const result = await applyPlan(card.plan, card.plan.summary, { quiet: Boolean(order) });
        if (order && result.ok) {
            announceShuffle(order, shuffleName(card.plan));
            openAiQueue(); // show what is now playing
        }
        card.state = result.applied || result.ok ? 'applied' : 'failed';
        card.note = result.ok ? (result.applied ? 'Done. Use Undo in the notification or in Settings, AI.' : 'Done.') : `Stopped: ${result.failure ? result.failure.message : 'nothing changed'}.`;
        redraw();
    }

    // Translate the playing song into the default language (or the one asked for). The answer goes into the conversation.
    async function translateHere() {
        const song = currentLyrics();
        if (!song || !song.lyrics) return say({ role: 'assistant', kind: 'error', text: song ? 'This song has no lyrics to translate.' : 'Play a song with lyrics first.' });
        const current = await getStatus();
        if (!ready(current)) return paintSetup(current);
        const language = current.translateLanguage || (await askLanguage());
        if (!language) return;
        say({ role: 'user', text: `Translate "${song.title}" into ${language}` });
        pending = { text: 'translate' };
        redraw();
        const result = await translateSong(song, language);
        pending = null;
        if (!result.ok) say({ role: 'assistant', kind: 'error', text: explain(result) });
        else if (result.saved) say({ role: 'assistant', text: `Translated "${song.title}" into ${result.targetLanguage}. It is in the lyrics view now: use Original and Translated in the lyrics bar to switch.`, openLyrics: true });
        else say({ role: 'assistant', translation: { title: song.title, language: result.targetLanguage, text: result.translation, model: result.model } });
        screens.forEach((screen) => screen.afterRequest());
    }

    function card(item) {
        if (item.translation) {
            const t = item.translation;
            return el(
                'div',
                { class: 'ai-card' },
                el('p', { class: 'ai-card__title' }, `"${t.title}" in ${t.language}`),
                el('pre', { class: 'ai-card__text', dir: 'auto' }, t.text),
                el('p', { class: 'ai-card__info' }, `Translated by ${t.model}. These lyrics have no timing, so the translation cannot be shown in the lyrics view; you can copy it.`),
                el('div', { class: 'ai-card__actions' }, button({ label: 'Copy', size: 'sm', onClick: () => navigator.clipboard && navigator.clipboard.writeText(t.text) }))
            );
        }
        const actions = [];
        const order = playOrderOf(item.plan);
        if (item.state === 'ready' && item.plan.actions.length) {
            actions.push(button({ label: 'Apply', variant: 'primary', onClick: () => applyCard(item) }), button({ label: 'Discard', onClick: () => ((item.state = 'discarded'), redraw()) }));
        }
        if (order && item.state !== 'discarded') actions.push(button({ label: 'Save as playlist', onClick: () => saveAsPlaylist(order, shuffleName(item.plan)) }));
        return el(
            'div',
            { class: 'ai-card', 'data-state': item.state },
            item.reply ? el('p', { class: 'ai-card__reply', dir: 'auto' }, item.reply) : '',
            planPreview(item.preview),
            order ? songList(order) : '',
            el('p', { class: 'ai-card__info' }, item.info),
            item.state === 'running' ? el('p', { class: 'ai-card__info', role: 'status' }, 'Applying…') : '',
            item.state === 'discarded' ? el('p', { class: 'ai-card__info' }, 'Discarded. Nothing was changed.') : '',
            item.note ? el('p', { class: 'ai-card__info' }, item.note) : '',
            actions.length ? el('div', { class: 'ai-card__actions' }, ...actions) : ''
        );
    }

    function bubble(item) {
        const extras = [];
        if (item.settings) extras.push(button({ label: 'Open Settings', size: 'sm', onClick: openAiSettings }));
        if (item.openLyrics) extras.push(button({ label: 'Open lyrics', size: 'sm', onClick: () => openAiPanel('lyrics') }));
        return el('div', { class: 'ai-msg__bubble', dir: 'auto' }, item.text, extras.length ? el('div', { class: 'ai-card__actions' }, ...extras) : '');
    }

    function draw() {
        log.replaceChildren(
            ...thread.map((item) => el('div', { class: `ai-msg ai-msg--${item.role}`, 'data-kind': item.kind || null }, item.plan || item.translation ? card(item) : bubble(item))),
            pending ? el('div', { class: 'ai-msg ai-msg--assistant' }, el('div', { class: 'ai-msg__bubble', role: 'status' }, el('span', { class: 'spinner', 'aria-hidden': 'true' }), pending.text === 'translate' ? ' Translating…' : ' Thinking…')) : ''
        );
        const on = ready(ctx.getStatus()) && !pending;
        sendButton.disabled = !on;
        composer.setDisabled(!ready(ctx.getStatus()) || Boolean(pending));
        stopButton.hidden = !pending;
        suggestions.hidden = thread.length > 0;
        clearButton.hidden = thread.length === 0 || Boolean(pending);
        log.scrollTop = log.scrollHeight;
    }

    function paintSetup(s) {
        const ok = ready(s);
        banner.hidden = ok;
        banner.replaceChildren(...(ok ? [] : [emptyState({ icon: 'sparkles', title: 'Set up AI first', text: `${setupHint(s)} Open Settings, AI, to finish.`, actions: [{ label: 'Open Settings', onClick: openAiSettings }] })]));
        picker.paint(s);
        if (ok) limits.refresh();
        draw();
    }

    for (const text of SUGGESTIONS) suggestions.append(chip({ label: text, onClick: () => (composer.setValue(text), composer.input.focus()) }));

    const screen = {
        draw,
        fill() {
            if (queued === null) return;
            composer.setValue(queued);
            queued = null;
            composer.input.focus();
        },
        afterRequest() {
            limits.refresh(true);
            if (screens.has(screen)) composer.input.focus();
        }
    };
    screens.add(screen);

    host.append(
        el(
            'section',
            { class: `ai-chat ai-chat--${mode}`, 'aria-label': 'AI assistant' },
            el('header', { class: 'ai-chat__head' }, el('h2', { class: 'ai-chat__title' }, 'AI assistant'), el('div', { class: 'ai-chat__window' }, clearButton, ...windowButtons)),
            limits.el,
            banner,
            log,
            suggestions,
            el(
                'div',
                { class: 'ai-chat__box' },
                el('div', { class: 'ai-chat__composer' }, composer.el, el('div', { class: 'ai-chat__send' }, sendButton, stopButton)),
                el('div', { class: 'ai-chat__tools' }, picker.el, scopeControl.el, el('div', { class: 'ai-chat__chips' }, webChip, lyricsChip, translateButton), scopeNote)
            )
        )
    );
    paintNotes();
    draw();
    screen.fill();
    paintSetup(ctx.getStatus());
    getStatus().then(paintSetup, () => paintSetup(null));
    const off = ctx.onStatus(paintSetup);
    return {
        destroy() {
            off();
            screens.delete(screen);
        }
    };
}
