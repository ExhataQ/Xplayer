// The AI parts of the window chrome (PA-17): the chat button next to the bell, the menu entries and the hotkeys.
// What they call comes from shell/ai-slots.js; the shell hands in how to switch views.
import { iconButton } from '../components/index.js';
import { AI_VIEW_ID, AI_SHORTCUTS, aiEnabled, hasAiChat, getAiCommands, watchAiStatus, openAiChat, setAiChatOpener, setAiChatCloser, setAiNavigator, setAiPopupHost, setAiQueueOpener, hasAiPopup, isAiPopupOpen, toggleAiPopup } from './ai-slots.js';

const OFF_HINT = 'Turn on AI in Settings';

/** goTo(viewId) switches the main view; current() returns the id of the view now shown. */
export function mountAiChrome({ bell, goTo, current }) {
    let returnTo = 'library';
    const button = iconButton({
        icon: 'sparkles',
        label: 'AI chat',
        size: 'sm',
        className: 'ai-btn',
        pressed: false,
        tooltip: () => (aiEnabled() ? {} : { name: OFF_HINT, state: 'AI is off' }),
        onClick: () => (!aiEnabled() ? goTo('settings') : toggleChat())
    });
    // The chat opens as a small pop-up (a layer over the page); from there it can be expanded into the big view and back.
    const layer = document.createElement('div');
    layer.className = 'ai-popup-layer';
    document.body.append(layer);
    setAiPopupHost(layer);
    const toggleChat = () => (current() === AI_VIEW_ID ? goTo(returnTo) : hasAiPopup() ? toggleAiPopup() : openAiChat());
    button.hidden = true;
    bell.before(button);

    setAiNavigator(goTo);
    setAiQueueOpener(() => {
        const toggle = document.querySelector('[aria-controls="queue-panel"]');
        if (toggle && toggle.getAttribute('aria-expanded') !== 'true') toggle.click();
    });
    setAiChatCloser(() => goTo(returnTo));
    setAiChatOpener(() => {
        if (current() !== AI_VIEW_ID) returnTo = current() || 'library';
        goTo(AI_VIEW_ID);
    });

    function paint() {
        const on = aiEnabled();
        button.hidden = !hasAiChat();
        // Off: still focusable and clickable (it leads to Settings), but announced as unavailable with the reason as its name.
        button.setAttribute('aria-disabled', String(!on));
        button.setAttribute('aria-label', on ? 'AI chat' : OFF_HINT);
        button.setAttribute('aria-pressed', String(on && (current() === AI_VIEW_ID || isAiPopupOpen())));
    }
    watchAiStatus(paint);
    paint();

    const run = (name) => {
        const fn = name === 'chat' ? (aiEnabled() ? toggleChat : null) : aiEnabled() || name === 'undo' ? getAiCommands()[name] : null;
        if (typeof fn === 'function') fn();
    };
    const keyOf = { a: 'chat', s: 'shuffle', u: 'undo' };
    document.addEventListener('keydown', (event) => {
        if (!event.ctrlKey || !event.shiftKey || event.altKey || event.metaKey || event.isComposing) return;
        const name = keyOf[event.key.toLowerCase()];
        if (!name || (name === 'chat' ? !hasAiChat() : typeof getAiCommands()[name] !== 'function')) return;
        event.preventDefault();
        event.stopImmediatePropagation(); // the engine's own S key (shuffle) must not also fire for Ctrl+Shift+S
        run(name);
    }, true); // capture: before the engine's own key handler

    return {
        sync: paint,
        /** Menu entries by slot (ai-undo, ai-chat, ai-shuffle), only for what is registered. Edit > Undo stays available while AI is off (it undoes the last change). */
        menu() {
            const cmds = getAiCommands();
            const on = aiEnabled();
            const out = {};
            if (typeof cmds.undo === 'function') out['ai-undo'] = { label: 'Undo', shortcut: AI_SHORTCUTS.undo, onSelect: () => run('undo') };
            if (hasAiChat()) out['ai-chat'] = { label: 'AI chat', shortcut: AI_SHORTCUTS.chat, disabled: !on, onSelect: () => run('chat') };
            if (typeof cmds.shuffle === 'function') out['ai-shuffle'] = { label: 'AI shuffle', shortcut: AI_SHORTCUTS.shuffle, disabled: !on, onSelect: () => run('shuffle') };
            return out;
        }
    };
}
