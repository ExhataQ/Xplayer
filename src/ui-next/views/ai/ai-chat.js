// The AI chat (task PE-10): a standard chat box. The conversation is above. Below it is one box to type in: ready-made messages along
// its top, the text in the middle, and along its bottom the model (a small window), the mode (Low, Medium, High), the options and the
// Send button. The assistant sees everything at once, with every request: the whole library (the song playing, the queue and the
// selected songs first), the queue, the playlists and the folders. It either answers in words or proposes a plan (Apply / Discard).
// Nothing runs without the preview and the Apply button. It is shown in two shapes (a small window and the big view) by
// shell/ai-slots.js; the conversation and any request that is still running live in this module, so they survive switching views,
// minimizing the window and coming back.

import { el, iconEl, button, iconButton, emptyState } from '../../components/index.js';
import { getStatus, plan, cancel } from '../../adapter/ai-bridge.js';
import { openAiSettings, openAiChat, openAiPanel, openAiQueue } from '../../shell/ai-slots.js';
import { notify } from '../../shell/notify.js';
import { explain, needsSettings } from './ai-messages.js';
import { planPreview } from './plan-preview.js';
import { applyPlan } from './apply-plan.js';
import { askPrivacy } from './privacy-dialog.js';
import { createModelPopover } from './model-popover.js';
import { createModeButton, createOptionsButton, modeInfo } from './composer-controls.js';
import { QUICK_PROMPTS } from './quick-prompts.js';
import { createLimitsMeter } from './limits-meter.js';
import { playOrderOf, songList, saveAsPlaylist, announceShuffle } from './shuffle-list.js';
import { askLanguage } from './lyrics-bar.js';
import { translateSong } from './translate-flow.js';
import { currentLyrics } from '../../adapter/ai-bridge.js';

const HISTORY_TURNS = 8;
const INPUT_MAX_HEIGHT = 140; // px: the text box grows with what is typed, up to about six lines

// ---- state that outlives the screen ----
const thread = [];
const options = { useWeb: false, readLyrics: false }; // the Options menu; kept for the session
let queued = null;
let queuedSend = false; // send the queued text as soon as a screen shows it
let focus = null; // song ids a contextual button said the next request is about (they count as selected, once)
let pending = null; // the request that is running: { text }
const screens = new Set(); // the chat screens on the page right now (the window, or the big view)

const redraw = () => screens.forEach((screen) => screen.draw());

/** Text for the box the next time (or right now, if the chat is open). Used by Playback > AI shuffle. */
export function queuePrompt(text, { send = false, songs = null } = {}) {
    queued = text;
    queuedSend = send;
    if (Array.isArray(songs) && songs.length) focus = songs.slice(0, 2000);
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
        const about = focus;
        focus = null;
        result = await plan({ request: text, useWeb: options.useWeb, includeLyrics: options.readLyrics, history, focus: about });
    } catch (error) {
        result = { ok: false, error: 'unexpected' };
    }
    pending = null;
    let heard;
    if (result.ok) {
        const reply = result.plan.reply || '';
        if (result.plan.actions.length) {
            const around = result.contextLines ? ', the queue and your playlists' : '';
            const seen = `Looked at ${result.sentRows} songs${around} with ${result.model}${result.mode && result.mode !== 'medium' ? ` (${modeInfo(result.mode).label} mode)` : ''}.${result.omitted ? ` ${result.omitted} more songs did not fit.` : ''}`;
            const lyrics = result.withLyrics ? ` Read the lyrics of ${result.withLyrics}.` : options.readLyrics ? ' No lyrics were found for these songs.' : '';
            const web = result.lookedUp ? ' Online tag candidates were used.' : options.useWeb ? ' No online candidates were found.' : '';
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
 * opts.mode 'view' (the big main view, with a Make smaller button) or 'popup' (the small window, with Expand and Minimize).
 * The conversation is shared, so switching between the two keeps it.
 */
export function mountChat(host, ctx, opts = {}) {
    const mode = opts.mode === 'popup' ? 'popup' : 'view';
    host.replaceChildren();

    const limits = createLimitsMeter(() => (ctx.getStatus() || {}).model);
    const windowButtons =
        mode === 'popup'
            ? [iconButton({ icon: 'maximize-2', label: 'Expand to the big view', size: 'sm', onClick: () => opts.onExpand && opts.onExpand() }), iconButton({ icon: 'minus', label: 'Minimize the chat', size: 'sm', onClick: () => opts.onClose && opts.onClose() })]
            : [iconButton({ icon: 'minimize-2', label: 'Make smaller (pop-up)', size: 'sm', onClick: () => opts.onShrink && opts.onShrink() })];

    const log = el('div', { class: 'ai-chat__thread', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversation' });
    const banner = el('div', { class: 'ai-chat__setup' });
    const clearButton = button({ label: 'Clear', variant: 'ghost', size: 'sm', onClick: () => (thread.length = 0, redraw()) });

    // ---- the box ----
    const input = el('textarea', { class: 'ai-composer__input', rows: 1, dir: 'auto', 'aria-label': 'Message', placeholder: 'Ask anything, or describe a change…' });
    const fit = () => {
        input.style.height = 'auto';
        input.style.height = `${Math.min(input.scrollHeight, INPUT_MAX_HEIGHT)}px`;
    };
    const setValue = (text) => {
        input.value = text;
        fit();
    };
    input.addEventListener('input', fit);
    input.addEventListener('keydown', (event) => {
        event.stopPropagation(); // typing must not trigger the player's single-key shortcuts
        if (event.key === 'Enter' && !event.shiftKey && !event.isComposing) {
            event.preventDefault();
            send();
        }
    });

    const prompts = el('div', { class: 'ai-composer__prompts', role: 'group', 'aria-label': 'Ready-made messages' });
    for (const item of QUICK_PROMPTS) {
        const tap = el('button', { type: 'button', class: 'ai-quick', 'data-prompt': item.id }, item.icon ? iconEl(item.icon, { size: 14 }) : '', el('span', {}, item.label));
        tap.addEventListener('click', () => (item.run === 'translate' ? translateHere() : send(item.text)));
        prompts.append(tap);
    }

    const modelPopover = createModelPopover();
    const modeButton = createModeButton();
    const optionsNote = el('p', { class: 'ai-composer__note' });
    const optionsButton = createOptionsButton(options, () => paintNotes());
    const sendButton = iconButton({ icon: 'send', label: 'Send', variant: 'solid', onClick: () => send() });
    sendButton.classList.add('ai-composer__send');
    const stopButton = iconButton({ icon: 'square', label: 'Cancel', onClick: () => cancel() });
    stopButton.classList.add('ai-composer__stop');
    stopButton.hidden = true;

    function paintNotes() {
        const parts = [];
        if (options.readLyrics) parts.push('The first 700 characters of the lyrics of up to 40 songs are sent');
        if (options.useWeb) parts.push('The first 10 songs are looked up online');
        optionsNote.textContent = parts.join(' · ');
        optionsNote.hidden = parts.length === 0;
    }

    async function send(text) {
        const message = (text === undefined ? input.value : text).trim();
        if (!message || pending) return;
        const current = await getStatus();
        if (!ready(current)) {
            if (current.enabled && !current.privacyAccepted && (await askPrivacy())) return send(text);
            return paintSetup(current);
        }
        if (text === undefined) setValue('');
        await submit(message);
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
        if (pending) return;
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
        const usable = ready(ctx.getStatus());
        sendButton.disabled = !usable || Boolean(pending);
        sendButton.hidden = Boolean(pending);
        stopButton.hidden = !pending;
        input.disabled = !usable || Boolean(pending);
        for (const tap of prompts.children) tap.disabled = !usable || Boolean(pending);
        clearButton.hidden = thread.length === 0 || Boolean(pending);
        log.scrollTop = log.scrollHeight;
    }

    function paintSetup(s) {
        const ok = ready(s);
        banner.hidden = ok;
        banner.replaceChildren(...(ok ? [] : [emptyState({ icon: 'sparkles', title: 'Set up AI first', text: `${setupHint(s)} Open Settings, AI, to finish.`, actions: [{ label: 'Open Settings', onClick: openAiSettings }] })]));
        modelPopover.paint(s);
        modeButton.paint(s);
        if (ok) limits.refresh();
        draw();
    }

    const screen = {
        draw,
        fill() {
            if (queued === null) return;
            const text = queued;
            const now = queuedSend;
            queued = null;
            queuedSend = false;
            setValue(text);
            input.focus();
            if (now) send();
        },
        afterRequest() {
            limits.refresh(true);
            if (screens.has(screen)) input.focus();
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
            el(
                'div',
                { class: 'ai-composer' },
                prompts,
                input,
                optionsNote,
                el('div', { class: 'ai-composer__bar' }, el('div', { class: 'ai-composer__tools' }, modelPopover.button, modeButton.el, optionsButton.el), el('div', { class: 'ai-composer__go' }, stopButton, sendButton)),
                modelPopover.panel
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
            modelPopover.destroy();
            screens.delete(screen);
        }
    };
}
