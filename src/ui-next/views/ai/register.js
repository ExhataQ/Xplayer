// Agent E owns this file. shell/shell.js calls registerAi() once at start-up (after the shell is built, before the first view).
// It plugs the AI screens into the places the shell offers (shell/ai-slots.js, task PA-17).

import { registerAiSettings, registerAiChat, registerAiCommands, registerAiLyricsBar, openAiChat, openAiQueue, openAiPanel } from '../../shell/ai-slots.js';
import { registerHandler } from '../../adapter/ai-bridge.js';
import { buildLyricsControls } from './lyrics-bar.js';
import { startAutoTranslate } from './auto-translate.js';
import { buildAiSettings } from './ai-settings.js';
import { mountChat, queuePrompt } from './ai-chat.js';
import { registerPopup, shrink } from './popup.js';
import { undoLast } from './apply-plan.js';
import { refreshStatus } from './ai-state.js';

/** Playback > AI shuffle: opens the chat with the request started for the person to finish. */
export function aiShuffle() {
    queuePrompt('Build a play order from my library for: ');
    openAiChat();
}

/** Contextual buttons elsewhere in the app (Library > Organize with AI, tag sheet > Fill with AI): the chat opens with the request. */
export function aiAsk(text, { send = false, songs = null } = {}) {
    queuePrompt(text, { send, songs });
    openAiChat();
}

export function registerAi() {
    registerAiSettings({ mount: buildAiSettings });
    registerAiChat({ mount: (host, ctx) => mountChat(host, ctx, { mode: 'view', onShrink: shrink }) });
    registerPopup();
    registerAiLyricsBar({ mount: buildLyricsControls });
    registerHandler('open_panel', ({ panel }) => (panel === 'queue' ? openAiQueue() : openAiPanel(panel)) || {});
    startAutoTranslate();
    registerAiCommands({ undo: undoLast, shuffle: aiShuffle, ask: aiAsk });
    refreshStatus();
}
