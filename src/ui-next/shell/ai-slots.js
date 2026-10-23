// The places where the AI screens plug into the shell (tasks PA-17, PE-09, PE-10, PE-11). Agent E writes the screens in
// views/ai/ and registers them from views/ai/register.js; shell.js calls that file once at start-up and never imports anything else
// from views/ai/. The shell does not talk to the AI engine: E pushes the status in, the shell only draws.
//
//   registerAiSettings({ mount(container, ctx) })        the "AI" section of Settings. `container` is a ready section body (title drawn);
//                                                        append your DOM to it, or return an element. ctx = { getStatus, onStatus(fn)->off }.
//   registerAiChat({ mount(host, ctx) -> { destroy? } }) the chat, a main view (no rail item): opened by the top bar button, the
//                                                        menu or the hotkey. The shell empties `host` when the person leaves.
//   registerAiCommands({ undo?, shuffle? })              functions behind Edit > Undo and Playback > AI shuffle.
//   setAiStatus({ enabled, privacyAccepted, hasKey, ... })   call at start and after every change. The button follows it.
//
// The chat button, the chat view and the commands exist only once the matching register call has been made.

const listeners = new Set();
let status = { enabled: false };
let settings = null;
let chat = null;
let commands = {};
let opener = null; // set by the shell: shows the chat view

export const AI_VIEW_ID = 'ai-chat';
export const AI_SHORTCUTS = { chat: 'Ctrl+Shift+A', shuffle: 'Ctrl+Shift+S', undo: 'Ctrl+Shift+U' };

const notifyAll = () => {
    for (const fn of [...listeners]) fn(status);
};

export const getAiStatus = () => status;
export const aiEnabled = () => Boolean(status.enabled && (status.privacyAccepted ?? true));
export const hasAiChat = () => Boolean(chat);
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

export function openAiChat() {
    if (opener && chat) opener();
}

/** The status as E's code sees it, tied to one piece of DOM: the listener goes away when the node leaves the page. */
function contextFor(node) {
    return {
        getStatus: () => status,
        onStatus(fn) {
            const off = watchAiStatus((s) => (node.isConnected ? fn(s) : off()));
            return off;
        }
    };
}

/** The Settings section, or null when E has not registered one. Called by shell/appearance-settings.js each time Settings is drawn. */
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
export function mountAiChat(host) {
    if (!chat) return;
    chatHandle = chat.mount(host, contextFor(host)) || {};
}
export function leaveAiChat() {
    if (chatHandle?.destroy) chatHandle.destroy();
    chatHandle = null;
}
