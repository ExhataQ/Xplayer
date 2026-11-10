# Report: PE-05, PE-08, PE-10 (rework), PE-11 chat that sees everything, and the new chat box

**Tasks:** PE-05, PE-08, PE-11, and the owner's rework of PE-10 | **Agent:** E | **Date:** 2026-10-30 | **Status:** In review (Node tests and a browser run of the chat in a test page pass; not run in Electron)

## Summary
The assistant no longer has a scope. Every request carries the whole library, with the song playing, the queue, the selected songs and the playlist songs first, plus the queue in play order, every playlist with its songs and the folders with their playlists. The chat box was rebuilt: ready-made messages on top (the first one translates the playing song), the model as a small window, a Low / Medium / High mode with a bars logo, an options menu, and Send inside the box. The pop-up's Close became Minimize. Two actions were added (`remove_from_playlist`, `play_next`) and two contextual buttons (Library "Organize with AI…", tag sheet "Fill with AI…").

## Changed files
| File | Change |
|---|---|
| `electron/ai/privacy.js` | Table up to 1000 songs (rich up to 400, then title/artist/album/length plus flags); new flags `selected`; `buildContext` turns the queue, playlists and folders into numbered lines; lyrics go on the first 40 rows only and no longer cut the list; policy text says what is sent |
| `electron/ai/planner.js` | Context lines in the prompt; mode (Low / Medium / High) as a prompt line, a token cap and the model's reasoning effort |
| `electron/ai/provider.js` | `reasoning` setting; when a model refuses it, the request is repeated without it, then as plain JSON (so a model with no reasoning setting still works) |
| `electron/ai/ipc.js` | `mode` is a saved setting; the plan gets the context and the saved mode |
| `electron/ai/actions.js` | `remove_from_playlist`, `play_next` |
| `src/ui-next/adapter/ai-bridge.js` | `collectSongs` (whole library, priority order, flags, `focus`), `collectContext`, the two new handlers and the undo of `remove_from_playlist` |
| `src/ui-next/views/ai/ai-chat.js` | New box; scope control removed; ready-made messages; options in a menu; Minimize; `queuePrompt(text, { send, songs })` |
| `src/ui-next/views/ai/model-popover.js` (new) | The model window: search, free/paid, saved at once; closes on Escape or when focus leaves |
| `src/ui-next/views/ai/composer-controls.js` (new) | Mode button and options menu |
| `src/ui-next/views/ai/quick-prompts.js` (new) | The six ready-made messages |
| `src/ui-next/views/ai/ai.css`, `popup.js`, `model-picker.js`, `register.js` | Styles; Escape closes the model window first; shared model cache; the `ask` command |
| `src/ui-next/shell/ai-slots.js` | `aiAvailable()` and `askAi(text, { send, songs })` for contextual buttons |
| `src/ui-next/views/library/library-panel.js`, `views/tools/tag-sheet.js` | One menu item and one button, shown only when AI is on (these are B's and D's files: please check) |
| `src/ui-next/icons/custom-icons.js` | `send`, `cpu`, `effort-low`, `effort-medium`, `effort-high` |
| `tools/tests/ai-core.test.js`, `ai-bridge.test.js`, `ui-next-ai.test.js` | 10 new unit tests; the browser tests follow the new box |

## Second round (owner, 2026-10-30)
- **Ready-made messages** moved out of the box: one row above it. The conversation has a box of its own (with a short hint while empty).
- **Options** no longer print a note under the box. Switching "AI may read lyrics" or "Look up tags online" on shows a notification that says exactly what is sent (700 characters, up to 40 songs, no timestamps; title, artist, album and length of 10 songs to MusicBrainz) and where. Switching it off says it stopped.
- **The chat in a window of its own.** The pop-up's button is now "Pop out the chat". It opens the `ai` tool window (`electron/window-manager.js`, 560 by 820, minimum 380 by 480; no 800 by 600 minimum there). That window is the same page, but it never reads or edits its own engine: `adapter/ai-bridge.js` sends `collect`, `currentLyrics`, `runPlan`, `undoEntry`, `saveTranslation` and `show` to the main window through `electron/ai/host-relay.js` and `views/ai/chat-host.js`, and the main window runs only those six names. If the main window is gone the chat says so. When no window can open (no Electron, the old interface) Pop out falls back to the big view as before.
- **DP14 allowed** by the owner: the AI adapter total is now 320 in `ui-next-ai-static.test.js`.
- Not shared between the two: the conversation (each window keeps its own) and the model/mode shown in a window that was already open (they are saved settings; the other window reads them when it opens).

## Decisions made or needed
- **Made:** the assistant sees everything with every request, so the "which songs" choice is gone. Above 1000 songs the end of the list is cut (the songs that matter are first), and the answer says how many did not fit.
- **Made:** "Mode" is the model's reasoning effort plus a prompt line and a size cap, saved with the AI settings like the model. A model with no reasoning setting ignores it by the retry in `provider.js`.
- **Made:** web search for tags stays the free MusicBrainz lookup (title, artist, album of the first 10 rows, now the playing, queued, selected and sheet songs). OpenRouter's paid web plugin is not used.
- **Needed (DP14):** `ai-bridge.js` grew from 206 to 245 counted lines. The AI adapters are 284 of their shared 300, but the plan total was already over. See the BOARD.
- **Needed:** the privacy text (Settings > AI > "What is sent") now also lists the queue, playlists and folders; the owner should read it once.

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/ai-core.test.js` | 45 tests, 45 pass (was 38; two are the relay) |
| `node --test tools/tests/ai-bridge.test.js` | 12 tests, 12 pass (was 7) |
| `node --test tools/tests/ui-next-ai-static.test.js tools/tests/ai-apply-plan.test.js` | all pass |
| `node tools/tests/run.js unit`, untouched zip | 617 pass, 10 fail |
| `node tools/tests/run.js unit`, with my changes | 629 pass, the same 10 fail (names compared) |
| Two real pages in headless Chromium (a main page and a chat-window page, joined by a stand-in relay) | the chat window's request carried the main page's songs, queue and playlists; Apply removed the song from the main page's playlist and journaled it there; with the main page closed the chat said the player is not open; both option notifications appeared |
| The real `ai-chat.js` in headless Chromium, stubbed main process | box layout, model window (search, choose, saved), mode menu (saved), options menu, ready-made messages (plan request carries songs in priority order, flags and context), translate message, Enter to send, Minimize: all as expected, no console errors |

## Not verified
- Not run in Electron, on Windows, or with a real OpenRouter key. The real window opening, the relay in the main process and the window's size and title bar have only unit tests (`host-relay`) and the stand-in above. The reasoning-effort retry is tested against a fake fetch only.
- `ui-next-ai.test.js` (Playwright) was updated to the new box but not run here (no Playwright for Node).
- The Library item and the tag sheet button are untested in the full app.

## Questions for the owner
1. Should "Fill with AI…" in the tag sheet send at once (now it opens the chat with the request written, for you to send)?
2. Should the conversation be carried over when the chat is popped out (now the window starts empty)?
