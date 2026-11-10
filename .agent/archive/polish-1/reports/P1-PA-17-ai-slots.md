# P1-PA-17: slots for Agent E's AI screens

Agent A, 2026-10-22. Status: in review. Answers E's request (PE-09, PE-10, menu, notify check, tokens).

Note: `P1-PE-02-03-04-ai-core.md`, `electron/ai/` and `adapter/ai-bridge.js` were not in my tree, so I did not read them. Everything below is built from my side; E must match these shapes.

## (a) Registration points
One file, owned by E: `src/ui-next/views/ai/register.js`, exporting `registerAi()`. `shell.js` imports it and calls it once in `init()`. E never edits `shell.js`. Inside it, import from `src/ui-next/shell/ai-slots.js`:

| Call | What it gives |
|---|---|
| `registerAiSettings({ mount(container, ctx) })` | The "AI" section in Settings (PE-09). `container` is the section body, the "AI" title is already drawn. Append DOM to it or return an element. |
| `registerAiChat({ mount(host, ctx) -> { destroy? } })` | The chat (PE-10). A **main view** with id `ai-chat` and **no rail item** (DP2: main-view kind). `host` is the view host, emptied when the person leaves; `destroy` runs on leave. |
| `registerAiCommands({ undo?, shuffle? })` | Edit > Undo and Playback > AI shuffle. Pass `undoLast` and `aiShuffle`. |
| `setAiStatus({ enabled, privacyAccepted, hasKey, ... })` | Call at start and after every change (from `electronAPI.ai.aiGetStatus()` through E's bridge). The shell never calls the AI engine. |

`ctx` is `{ getStatus(), onStatus(fn) -> off }`; `onStatus` stops by itself when the section or view leaves the page.
`openAiChat()` is also exported from `ai-slots.js` for E's own buttons.

Top bar button: the shell adds it next to the bell (icon `sparkles`, added to the icon set). It is hidden until `registerAiChat` is called. AI off or privacy not accepted: it is `aria-disabled`, named and tooltipped "Turn on AI in Settings", and pressing it opens Settings. AI on: opens the chat; pressing again returns to the previous view.

## Menu and hotkeys (brief 18.2)
- Edit > Undo calls `commands.undo` (shortcut shown: Ctrl+Shift+U). It stays enabled while AI is off, since it undoes the last change.
- Tools > AI chat (Ctrl+Shift+A) and Playback > AI shuffle (Ctrl+Shift+S) are disabled while AI is off.
- Plain Ctrl+Z is not used: the lyrics sync editor owns it while it is open, and Ctrl+Alt combos are AltGr on some layouts (Persian). **Owner to confirm the three hotkeys.**
- There is no generic Undo in the shell; `registerAiCommands({ undo })` is the plug-in point. When other undoable actions appear, the shell menu can combine them.

## Notification API (check 4): unchanged, now covered by tests
- `update()` changes only title, detail, target and action; `kind`, `where`, `important` and `id` in the partial are ignored.
- An entry with an action stays in the center after its toast is dismissed.
- Calling `h.dismiss()` and `h.update({ action: null })` inside the action's own click is safe (no error, entry gone).

## Tokens and states for the preview screen (check 5)
Use `components/index.js`: `dialog`, `button`/`iconButton`, `field`, `segmented`/tabs, `toast`, `emptyState`, `openMenu`. Colors only from `tokens.css`: `--surface-panel`, `--surface-raised`, `--border-subtle`, `--accent`, `--accent-soft`, `--shadow-raised`, `--layer-menu`. The "changes data" warning should use the warning/danger tokens already in `tokens.css` (the `.toast--error` and `danger` menu item styles are the reference). A scrolling list inside a dialog and a progress state (use `notifyProgress`) need no new component. Focus rings, 4.5:1 contrast and reduced motion come from the shared tokens and `components.css`; E must not override them. I did not build a ready-made preview dialog; if E finds `dialog` lacks a scrolling body, tell me and I add it (small).

## (b) Changes I want in E's views
- Expose `mount(container, ctx)`/`mount(host, ctx)` shapes exactly as above; no direct `document.querySelector` outside your container.
- No `localStorage` for the key or the on/off state; keep them in the main process behind the bridge.
- Reach the engine only through `adapter/`; call `setAiStatus` after every status change.

## (c) Done and blocked
Done now: items 1 (as a section added in front of the old Theme Color block, inside today's Settings), 2, 3, 4 (verified), 5 (guidance).
Blocked or later: the final Settings layout (PA-11, floating menu bar). The registration point stays; only where the section sits changes. No Electron or Windows check was possible (headless Chromium only).

## Files
`shell/ai-slots.js`, `shell/ai-chrome.js`, `views/ai/register.js` (stub for E), `shell/shell.js`, `shell/appearance-settings.js`, `icons/icons.js` (+`sparkles`), `tools/build-ui-next-icons.js`, `tools/tests/ui-next-ai-slots.test.js` (7 tests).
