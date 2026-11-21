// The places where the AI screens plug into the shell. The screens are written in
// views/ai/ and registers them from views/ai/register.js; shell.js calls that file once at start-up and never imports anything else
// from views/ai/. The shell does not talk to the AI engine: views/ai pushes the status in, the shell only draws.
//
//   registerAiSettings({ mount(container, ctx) })        the "AI" section of Settings. `container` is a ready section body (title drawn);
//                                                        append your DOM to it, or return an element. ctx = { getStatus, onStatus(fn)->off }.
//   registerAiChat({ mount(host, ctx) -> { destroy? } }) the chat, a main view (no rail item): opened by the top bar button, the
//                                                        menu or the hotkey. The shell empties `host` when the person leaves.
//   registerAiCommands({ undo?, shuffle? })              functions behind Edit > Undo and Playback > AI shuffle.
//   setAiStatus({ enabled, privacyAccepted, hasKey, ... })   call at start and after every change. The button follows it.
//
// The chat button, the chat view and the commands exist only once the matching register call has been made.

import { requestSettingsSection } from '../settings/page.js';

const listeners = new Set();
let status = { enabled: false };
let settings = null;
let chat = null;
let commands = {};
let opener = null; // set by the shell: shows the chat view
let navigator = null; // set by the shell: switches the main view by id
let closer = null; // set by the shell: leaves the chat view, back to where the person was
let popup = null; // set by views/ai: the small chat window { open, toggle }
let popupHost = null; // set by the shell: the layer the pop-up is drawn into
let popupOpen = false;
let queueOpener = null; // set by the shell: shows the queue panel
let lyricsBar = null; // set by views/ai: the Translate controls in the lyrics bar
let away = null; // set by views/ai in the chat's own window: shows something in the main window instead of here
let windowOpener = null; // set by views/ai: opens the chat in a window of its own

export const AI_VIEW_ID = 'ai-chat';
export const AI_SHORTCUTS = { chat: 'Ctrl+Shift+A', shuffle: 'Ctrl+Shift+S', undo: 'Ctrl+Shift+U' };

const notifyAll = () => {
    for (const fn of [...listeners]) fn(status);
};

export const aiEnabled = () => Boolean(status.enabled && (status.privacyAccepted ?? true));
export const hasAiChat = () => Boolean(chat);
/** True when a button that hands work to the AI should be shown: the chat is registered and AI is on. */
export const aiAvailable = () => hasAiChat() && aiEnabled();
/**
 * For other screens (contextual buttons): opens the chat with `text` in the box, or sends it at once with `send`. `songs` (ids) are
 * the songs the request is about; they count as selected for that one request, on top of the real selection.
 */
export function askAi(text, { send = false, songs = null } = {}) {
    if (typeof commands.ask === 'function') commands.ask(text, { send, songs });
    else openAiChat();
}
export const getAiCommands = () => commands;
export const watchAiStatus = (fn) => (listeners.add(fn), () => listeners.delete(fn));

export function setAiStatus(next) {
    status = { ...(next || {}) };
    notifyAll();
}

export function registerAiSettings(spec) {
    if (typeof spec?.mount !== 'function') throw new Error('registerAiSettings needs a mount function');
    settings = spec;
}

export function registerAiChat(spec) {
    if (typeof spec?.mount !== 'function') throw new Error('registerAiChat needs a mount function');
    chat = spec;
    notifyAll();
}

export function registerAiCommands(next) {
    commands = { ...commands, ...(next || {}) };
    notifyAll();
}

/** Used by the shell: how the chat view is opened. */
export function setAiChatOpener(fn) {
    opener = fn;
}

/** Used by the shell: how a main view is opened by id. */
export function setAiNavigator(fn) {
    navigator = fn;
}

/** Used by the shell: how the chat view is left. */
export function setAiChatCloser(fn) {
    closer = fn;
}

/** Used by the shell: the page layer the chat pop-up lives in. */
export function setAiPopupHost(node) {
    popupHost = node;
}

/** For E's screens: the pop-up chat. `spec` = { open(), toggle() }; E reports open/closed through setAiPopupOpen. */
export function registerAiPopup(spec) {
    popup = spec || null;
    notifyAll();
}
export const getAiPopupHost = () => popupHost;
export const hasAiPopup = () => Boolean(popup && popupHost);
export const isAiPopupOpen = () => popupOpen;
export function setAiPopupOpen(open) {
    popupOpen = Boolean(open);
    notifyAll();
}
export const toggleAiPopup = () => popup && popup.toggle();

/** Used by the shell: how the queue panel is opened. */
export function setAiQueueOpener(fn) {
    queueOpener = fn;
}
export const openAiQueue = () => (away ? away('queue') : queueOpener && queueOpener());

/** Used by views/ai in the chat window: shows a view, the queue or Settings in the main window. */
export function setAiAway(fn) {
    away = fn;
}
/** Used by views/ai: how the chat is opened in a window of its own (null when this build cannot). */
export function setAiWindowOpener(fn) {
    windowOpener = fn;
}
/** The pop-up's Expand: the chat in a window of its own; the big view when that window cannot be opened (no Electron, old interface). */
export async function expandAiChat() {
    if (windowOpener && (await windowOpener()) === true) return true;
    openAiChatView();
    return true;
}

/** For E's screens: shows a main view by id (library, search, recents, lyrics, metadata, settings). */
export const openAiPanel = (id) => (away ? away('panel', id) : navigator && navigator(id));

/** The Translate controls of the lyrics bar. `spec` = { mount(host, ctx) }; the lyrics view calls mountAiLyricsBar(host) when it draws its bar. */
export function registerAiLyricsBar(spec) {
    lyricsBar = spec || null;
}
export function mountAiLyricsBar(host) {
    if (lyricsBar) lyricsBar.mount(host, contextFor(host));
}

/** For E's screens: leaves the big chat view. */
export function closeAiChatView() {
    if (closer) closer();
}

/** For E's screens: shows Settings (where the AI section lives). */
export function openAiSettings() {
    if (away) return away('settings');
    if (!navigator) return;
    navigator('settings');
    requestSettingsSection('ai'); // Settings opens on its first section; this takes it to AI, now or when the page is drawn
}

/** Shows the chat: the pop-up when there is one, else the big view. */
export function openAiChat() {
    if (popup && popupHost) popup.open();
    else if (opener && chat) opener();
}

/** Shows the chat as the big view (the pop-up's Expand button). */
export function openAiChatView() {
    if (opener && chat) opener();
}

/**
 * The status as E's code sees it, tied to one piece of DOM. A listener goes away when the node has left the page AND a status arrives, which
 * may be never: until then it holds the node and everything under it (each time Settings was opened, a whole AI section stayed). So the
 * context also keeps its listeners, and dispose() removes them all; whoever mounts with it calls dispose() when that piece of DOM is done.
 */
export function contextFor(node) {
    const stops = new Set();
    return {
        getStatus: () => status,
        onStatus(fn) {
            const stop = () => {
                stops.delete(stop);
                off();
            };
            const off = watchAiStatus((s) => (node.isConnected ? fn(s) : stop()));
            stops.add(stop);
            return stop;
        },
        dispose() {
            for (const stop of [...stops]) stop();
        }
    };
}

/** True once views/ai has registered its Settings section. */
export const aiSettingsAvailable = () => Boolean(settings);

/** Draws the AI settings into `container`; `owner` is the node whose life the status listener follows. Called by settings/sections/ai.js. Returns { destroy() }: it removes the status listeners (call it when the section is torn down). */
export function mountAiSettings(container, owner = container) {
    if (!settings) return null;
    const ctx = contextFor(owner);
    const made = settings.mount(container, ctx);
    if (made instanceof Node && made !== container) container.append(made);
    return {
        destroy: () => {
            ctx.dispose();
            if (made && typeof made.destroy === 'function') made.destroy();
        }
    };
}

/** The Settings section, or null when E has not registered one. Kept for the old section layout; the new Settings page uses mountAiSettings. */
export function buildAiSettingsSection(el) {
    if (!settings) return null;
    const body = el('div', { class: 'ai-settings__body' });
    const section = el('div', { class: 'settings-section ai-settings', 'data-ai-settings': '' }, el('div', { class: 'settings-section-title' }, 'AI'), body);
    const made = settings.mount(body, contextFor(section));
    if (made instanceof Node && made !== body) body.append(made);
    return section;
}

/** The chat as a shell view. */
let chatHandle = null;
let chatContext = null;
export function mountAiChat(host) {
    if (!chat) return;
    chatContext = contextFor(host);
    chatHandle = chat.mount(host, chatContext) || {};
}
export function leaveAiChat() {
    if (chatHandle?.destroy) chatHandle.destroy();
    if (chatContext) chatContext.dispose();
    chatHandle = null;
    chatContext = null;
}
