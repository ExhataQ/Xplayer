// Agent E owns this file. shell/shell.js calls registerAi() once at start-up (after the shell is built, before the first view).
// Register the AI screens here with shell/ai-slots.js:
//
//   import { registerAiSettings, registerAiChat, registerAiCommands, setAiStatus } from '../../shell/ai-slots.js';
//
//   export function registerAi() {
//       registerAiSettings({ mount(container, ctx) { container.append(buildAiSettings(ctx)); } });
//       registerAiChat({ mount(host, ctx) { return mountChat(host, ctx); } });
//       registerAiCommands({ undo: undoLast, shuffle: aiShuffle });
//       aiBridge.getStatus().then(setAiStatus);   // and again after every change
//   }
//
// Until then nothing AI shows anywhere.

export function registerAi() {}
