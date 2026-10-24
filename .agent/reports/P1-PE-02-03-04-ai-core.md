# Report: PE-02, PE-03, PE-04 AI core (provider, key, actions, journal)

**Task:** PE-02, PE-03, PE-04 (main-process part) | **Agent:** E | **Date:** 2026-10-21 | **Status:** In review (round 2: page-side runner added; chat UI and settings page not started)

## Summary
Built the main-process core of the AI feature in a new folder `electron/ai/`: provider interface with an OpenRouter client, encrypted key storage, a fixed action list with validation and preview, an executor with undo, a persistent capped journal, a privacy filter, and a planner. The `ai` group is added to the preload and `desktop-api.js`. Nothing in the visible UI was built, and nothing was run against the real service.

## Changed files
| File | Change |
|---|---|
| `electron/ai/schema.js` | Small JSON-Schema checker (no new dependency) |
| `electron/ai/actions.js` | The fixed list: create_playlist, create_folder, add_to_playlist, put_playlist_in_folder, set_tags, set_play_order; plan validation (accepts a fenced reply, maps song numbers to ids, rejects unknown actions, extra fields, invented numbers); preview |
| `electron/ai/privacy.js` | Sends only title, artist, album, seconds, as numbered rows; no paths, no ids |
| `electron/ai/provider.js` | Provider interface, OpenRouter client, typed `AiError` codes, bounded retries |
| `electron/ai/planner.js` | Prompt plus one repair attempt; library text is marked as data |
| `electron/ai/journal.js` | Undo journal on disk, capped at 50, atomic writes, damaged file kept aside |
| `electron/ai/executor.js` | Runs an approved plan; stops at first failure but journals what ran; undo in reverse order |
| `electron/ai/key-store.js` | Key encrypted with Electron safeStorage; refused (not stored in plain text) when encryption is unavailable; the page only learns "has key" and the last 4 characters |
| `electron/ai/ipc.js` | Service plus 12 named `ai:*` channels. Off by default; planning needs enabled, privacy accepted and a key |
| `electron/preload.js`, `src/js/api/desktop-api.js` | New `ai` group, 12 named calls (no generic invoke) |
| `electron/main.js` | Two lines: require and register |
| `build/music_player.py` | Copies `electron/ai/` to the app folder. **Needed:** the build copies a fixed file list, so without this the deployed `main.js` would fail on `require('./ai/ipc')` |
| `tools/tests/ai-core.test.js` | 25 new unit tests |
| `tools/tests/desktop-api.test.js` | Group list and expected-name list now include `ai` |
| `tools/tests/output-dir.test.js` | Its temporary copy of `electron/` now includes `ai/` |

## Decisions made or needed
- **Made (reversible):** AI defaults to off; privacy must be accepted before the first request; free-only model list; default model `openrouter/free` (see PE-01). These follow the board's recommendation for DP6.
- **Made:** Plans are validated in the main process, but carried out where the data lives. Tag changes will run in main (Agent D's tag service); playlist and folder changes run in the page (Agent B's functions). The page records the result with `ai:journal-record` and undoes through `ai:journal-get` / `ai:journal-mark-undone`. `executor.js` is the main-side runner; the page needs its own small runner (not written).
- **Needed:** DP6 (confirm), DP9 (no `adapter/` file was touched, so no budget used yet; the page-side runner will need one), and the questions in the reply.
- The action list is a proposal. `put_playlist_in_folder` assumes folders hold playlists; Agent B must confirm against the folder functions (PB-06).

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/ai-core.test.js` | 25 tests, 25 pass |
| `node --test tools/tests/ai-core.test.js tools/tests/desktop-api.test.js tools/tests/main-process-safety.test.js tools/tests/manifest.test.js` | 64 tests, 64 pass |
| `node --test tools/tests/output-dir.test.js` | 9 tests, 9 pass (failed before the test copy was updated, because of my change) |
| `node tools/tests/run.js unit`, pristine copy of the zip | 242 tests, 236 pass, 5 fail, 1 skipped |
| `node tools/tests/run.js unit`, with my changes | 267 tests, 261 pass, 5 fail, 1 skipped. Same 5 failures as the pristine copy |
| `node --check electron/ai/*.js` | no errors |

The 5 failures exist without my changes: `drag-drop-modules`, `lint` and `setters` fail with `Cannot find module 'acorn'` (the sandbox could not install dev dependencies), and two scanner cancel tests in `cancel-running-work` fail (cause not investigated).

## Not run
- Lint (`npm run lint:strict`): ESLint could not be installed here (no package registry access).
- Browser test groups other than `desktop-api`'s page test.
- The build (`music_player.py`): only the Python syntax was checked; no generated output was inspected.
- Electron on Windows, real `safeStorage`, and any real OpenRouter call.
- Event allowlist audit: no engine events were added.

## Environment
Linux sandbox, Node v22.22.0, Chromium via Playwright available, no Python build run, no network to OpenRouter.

## Manual checklist for the owner (Windows, after applying the patch and rebuilding)
1. Start the app. Expected: it starts normally, with no console error mentioning `./ai/ipc`.
2. In the developer console of the page: `await electronAPI.ai.aiGetStatus()`. Expected: `{ enabled: false, privacyAccepted: false, model: 'openrouter/free', hasKey: false, last4: '', encryptionAvailable: true }`.
3. `await electronAPI.ai.aiSetKey('sk-or-v1-0000000000000000')`, then `aiGetStatus()`. Expected: `hasKey: true`, `last4: '0000'`, and the key text appears nowhere in the result. Open `ai-key.json` in the app data folder: the key is not readable in it.
4. `await electronAPI.ai.aiPlan({ request: 'x', songs: [] })`. Expected: `{ ok: false, error: 'disabled' }`.
5. `aiClearKey()`. Expected: `hasKey: false`, and `ai-key.json` is gone.

## Round 2 (after the owner's answers, 2026-10-21)

Owner answers: (1) privacy defaults accepted, but for smart shuffle, data management and tag changes send as much as possible; (2) adapter budget of 300 lines accepted, reuse the old screen's functions; (3) pinned default model, and people choose their own model; (4) check the old screen for folder meaning; (5) "web" means tags and similar data, not downloads; (6) order left to me.

| Change | Detail |
|---|---|
| Wider data for the model | `privacy.js`: rows now carry every tag in `SONG_FIELDS` that has a value (genre, year, bpm, mood, language, composer, label, track and disc numbers, isrc, and so on). Still never sent: file path, url, cover, lyrics, comment, copyright, encoder and sort fields. This is my reading of "anything possible"; say if lyrics or comments should be allowed too (see question 1 in the reply). |
| Full tag set for writing | `set_tags` accepts every tag the engine writes, with the engine's own names and number limits. One action sets the same tags on several songs, so different values per song use one action each. The preview now shows the values. Up to 500 actions per plan. |
| Tag lookup instead of paid web search | `planner.js`: with `useWeb`, the first 10 songs are looked up through the existing MusicBrainz search (`online-metadata.js`, free, spaced requests) and the candidates are added to the prompt. Failed lookups are counted, not fatal. OpenRouter's paid web plugin is not used. |
| Model choice | Already in the settings: `model` is saved, `aiListModels` returns free models first, structured-output models on top. The page needs a picker (settings page, PE-09). Default stays `openrouter/free` until a real test run picks a pinned one (needs a key). |
| Page-side runner | New `src/ui-next/adapter/ai-bridge.js` (about 170 lines of the 300 budget). Uses the old screen's own functions: `createPlaylist`, `createFolder`, `addSongToPlaylist`, `addToFolder`, `removeItemFromFolder`, `setPlaybackQueue`, `playSongFromQueue`, and the metadata editor's save (`saveAudioMetadata`) with the same in-memory update. |
| Folder meaning (read from `03h-folders.js`) | A folder holds folders, playlists, albums, artists and shortcuts, not songs. `addToFolder` moves a playlist out of its other folder, so the runner records the previous folder and undo puts it back. `createPlaylist` drops the new playlist into whichever folder is open; the runner takes it out again so a plan does not depend on that. |
| Reuse | A plan asking for a playlist or folder that already exists reuses it; undo does not delete it. |

Behavior to know about:
- `set_tags` uses the existing tag writer, which needs Python and mutagen. Until Agent D's service lands (PD-01), a machine without Python gets a clear per-song error ("Python is not installed" style), no change, and no journal entry. If only some songs fail, the rest are written and keep their undo data, and the failures come back as warnings.
- `VIEWS` is not on `window` (a top-level `const`), so the bridge uses the literal `'all-songs'` with a comment. Pinned by the engine's own file `ui/07-views.js`.
- Undoing a created playlist calls the engine's `deletePlaylist`, which may switch the view if that playlist is open.

New checks:
| Command | Result |
|---|---|
| `node --test tools/tests/ai-core.test.js` | 28 tests, 28 pass |
| `node --test tools/tests/ai-bridge.test.js` | 7 tests, 7 pass (stand-in engine with the same function names and behavior; not the real engine in a browser) |
| `node tools/tests/run.js unit` | same 5 failures as the untouched zip (3 need `acorn`, 2 scanner cancel tests) |
| `ui-next-adapter-api.test.js` | its line-budget test passes; its 2 browser tests fail the same way on the untouched zip (they time out waiting for the page) |

Not run: the bridge against the real engine in a browser, and any real tag write.

## Round 3 (2026-10-21): signals for shuffle, and translate lyrics (PE-06 core)

Owner answers: lyrics may be sent "if needed"; play counts and favorites are wanted; order left to me. I chose translation first because it needs nobody else's work.

| Change | Detail |
|---|---|
| Shuffle signals | `privacy.js` adds `rating`, `playCount` (columns the engine already has on songs) and `favorite` (added by `ai-bridge.collectSongs` from `getFavorites()`). All read-only: the AI cannot write them. |
| Lyrics rule | Lyrics go to the model **only** in `translate.js`, never in planning. This is the "if needed" case. |
| `electron/ai/translate.js` | Splits lyrics into lines, sends only the text of each translatable line (numbered, 60 per request), and puts the answer back under the original timestamps. Tag lines (`[ar:...]`), blank lines and `[instrumental]` are kept as they are. Works for synced and plain lyrics, and for CRLF. A reply with missing, extra or malformed lines gets one repair try, then fails with no partial result. The target language is checked against a letters-only pattern so it cannot carry instructions. Limit 30,000 characters. |
| IPC | New `ai:translate-lyrics` and `electron.ai.aiTranslateLyrics({ lyrics, targetLanguage })`, returning `{ ok, translation, synced, model, lines }`. Same gate as planning (enabled, privacy accepted, key); shares the busy flag and Cancel. |
| Not done | Where the translation is shown or saved (next to the original in the lyrics view) belongs to Agent C's lyrics views; the call returns the text and the caller decides. |

New checks:
| Command | Result |
|---|---|
| `node --test tools/tests/ai-core.test.js tools/tests/ai-bridge.test.js` | 40 tests, 40 pass |
| `node --test tools/tests/desktop-api.test.js tools/tests/output-dir.test.js tools/tests/main-process-safety.test.js` | 35 tests, 35 pass |
| `node tools/tests/run.js unit` | same 5 failures as the untouched zip |

Not run: translation quality on any real model (no key). The check to run once a key exists: translate one synced song into a language the owner reads and confirm line counts and timing match.

## Round 4 (2026-10-21, on `Source-backup4`): rebase, tag service, Undo notification

Source-backup4 does not contain my earlier patches, so this patch is made against it and replaces 0001 to 0003. The only conflict was one board table hunk, fixed by hand.

| Change | Detail |
|---|---|
| `set_tags` uses the tag service | `adapter/ai-bridge.js` now calls `saveAudioMetadataMany` (Agent D's `electron/tag-service.js` through the new IPC). Each result carries what the file held before the write, so Undo restores the real file values, not the in-memory ones. One song failing keeps the others' undo data; none written gives an error naming the cause. Journal entries now store `fileUrl` instead of a song id for tags. |
| Undo notification (PE-04, button side) | New `src/ui-next/views/ai/apply-plan.js`: `applyPlan(plan, summary)` runs a plan and posts exactly one notification through Agent A's `notify()`. Success: green entry with an Undo button. Stopped halfway: warning that says "Stopped after N of M steps: <cause>" and keeps Undo for what ran. Nothing changed: an important error and no Undo. Undo reverses the entry, removes the Undo entry and posts "Undone" (or a warning listing what could not be restored). `undoLast()` is ready for an Edit > Undo menu item. |
| Bridge size | `ai-bridge.js` is about 184 lines; the 300-line budget (DP9, as approved) is not exceeded. |

New checks, on a tree made from Source-backup4 plus this patch:
| Command | Result |
|---|---|
| `node --test tools/tests/ai-core.test.js tools/tests/ai-bridge.test.js tools/tests/ai-apply-plan.test.js` | 33 + 7 + 5 = 45, all pass |
| `node --test tools/tests/desktop-api.test.js tools/tests/output-dir.test.js` | pass |
| `ui-next-adapter-api` line-budget test, `ui-next-notifications` (23), `ui-next-phase1-gate` (11), `startup-gate` (3) | all pass |
| `node tools/tests/run.js unit` | untouched Source-backup4: 267 tests, 5 fail. With the patch: 312 tests, the same 5 fail (3 need `acorn`, 2 scanner cancel tests) |

Not run: the full `ui-next-*` browser set (it exceeded the time limit here, on both the untouched and patched tree), lint (no ESLint), the page in a real browser or Electron, and any real model call.

## Open issues and follow-ups
- PE-04: the Undo button is built (round 4). Still open: an Edit > Undo menu item (Agent A's menu) calling `undoLast()`, and a journal list screen.
- PE-05 to PE-08 handlers wait for PB-06 and PD-01.
- Journal entries store undo data as the owner of each change sends it; very large tag undo data is capped only by entry count (50) and changes per entry (5,000).
- `ai-journal.json` and `ai-settings.json` live in the user data folder next to the other settings.

## Patch
`0007-ai-agent-e-complete.patch` (made against Source-backup5; replaces 0001 to 0004 and contains everything): all files above plus the screens in round 5. Excludes `node_modules` and generated `__pycache__` files.

## Round 5: screens (PE-09, PE-10, PE-07 command, PE-12 covered)
- `src/ui-next/views/ai/`: settings page (on/off, key, model choice, free-only, limits check, what is sent, recent changes with Undo), chat (scope All/Selected, optional online tag lookup, plan cards with Apply/Discard, Translate lyrics as copy-only text), first-use privacy dialog, plan preview, `ai.css` (tokens only). Registered through A's slots; commands `undo` and `shuffle` (AI shuffle builds a `set_play_order` plan).
- `electron/ai/privacy.js`: new `describePolicy()`; the dialog text comes from it, so the screen cannot drift from what is actually sent.
- Small additive edit in A's files: `shell/ai-slots.js` (`setAiNavigator`, `openAiSettings`) and `shell/ai-chrome.js` (one call). A's slots test 1 was rewritten because real screens are now registered.
- PE-12: covered by MusicBrainz tag lookup ("web" meant tags, owner decision). No downloads.
- Tests added: `ui-next-ai.test.js` (8 browser tests, real engine Apply/Undo), `ui-next-ai-static.test.js` (5), plus ai-core/desktop-api/output-dir updates.
- Run here: all AI files pass (33+7+5+5+8+7 slots); notifications 23, phase1-gate 11, startup-gate 3 pass. `run.js unit`: untouched backup5 272 tests / 5 fail, patched 322 tests / the same 5 fail.
- Not run: real OpenRouter key, real Electron/Windows, full `ui-next-*` browser set, lint. Tag writes still need the Python tag backend until Agent D's Node backend lands. Default model is `openrouter/free` until a real test picks a pinned one.
- Still open: PE-05 (waits on PB-06), PE-11 contextual buttons, the editor's Fill tags button, showing translations in the lyrics view (Agent C), hotkeys Ctrl+Shift+A/S/U to confirm.

## Round 6: owner feedback (pop-up chat, model drop-down, live limits, shuffle list)
- Model: a drop-down (`views/ai/model-picker.js`) in the chat header and in Settings; the typed name moved to "Other model name". Saving goes through `aiSetSettings` as before.
- Limits: `electron/ai/usage.js` counts every chat request attempt (a retry or a failed request counts, as at OpenRouter), per UTC day and per minute, and survives restarts (`ai-usage.json`). New channel `ai:usage` / `aiUsage`. The chat shows "Today N of 50 requests, resets in 5h 12m" and a per-minute line, ticking every second and refreshing itself at each reset; the daily allowance becomes 1,000 once "Check my limits" sees a paid key. It is this app's own count, so use of the same key elsewhere is not seen. Tokens are not shown.
- Pop-up: the chat opens as a small window over the current view (`views/ai/popup.js`), stays open while moving between views, Escape closes it, Expand opens the big view, Make smaller returns. The conversation is shared. Small additive edits in A's `shell/ai-slots.js` (popup slots, `openAiChatView`, `closeAiChatView`, `contextFor` exported) and `shell/ai-chrome.js` (the pop-up layer; the button and Ctrl+Shift+A now toggle the pop-up, falling back to the big view when none is registered). A's slots test now registers `registerAiPopup(null)` to keep covering that fallback.
- Shuffle: the chat card lists the songs in play order, Apply posts a notification "N songs, starting with ..." with a Save as playlist button (also on the card). Saving runs create_playlist + add_to_playlist through the normal runner, so it is journaled and undoable.
- Tests: ai-core 35, ui-next-ai 11 (pop-up, drop-down and limits line, shuffle save added). `run.js unit`: 324 tests, the same 5 failures as untouched backup5.
- Not done: an activity log file (the owner's message was cut off; see the chat), real key and real Electron.

## Round 7: owner feedback on backup6 (limits from OpenRouter, models, chat box, lyrics)
- **Limits are OpenRouter's, not a count of ours.** `electron/ai/usage.js`, the `ai:usage` channel and the per-minute line from round 6 are removed. The chat shows `GET /key` (`free_model_daily_requests` used / limit / remaining, reset at 00:00 UTC; credit used and left for paid models), refreshed when the chat opens, after each request and at the reset. OpenRouter does not report the per-minute limit; a 429 now carries `X-RateLimit-Reset` and the error message says when it resets.
- **Models list:** the drop-down is filled from OpenRouter's `/models` and shared by Settings and the chat (the old datalist hid entries as soon as the box held a name, which is why 20 models were "loaded" but not visible). Load model list refreshes the same list. The typed name is "Other model name".
- **Chat box:** a standard layout: title bar, conversation, message box at the bottom with the model drop-down, scope (All / Selected / Playing now) and switches under it. The compact window moves by its title bar (drag; kept inside the page, remembered for the session).
- **Keeps running:** the request and its "Thinking..." state live in `ai-chat.js` module state, so closing the window or changing views does not lose it; when nothing is showing the chat, a notification says the AI answered.
- **Talk and memory:** the model may answer in `reply` with no actions; the last 8 messages (text only, 600 characters each) go with each request. Prompt now says shuffle / play order / queue means `set_play_order`, not a playlist. Applying a shuffle opens the queue panel; Save as playlist stays on the card and in the notification.
- **Player and screen actions:** `player_control` (play, pause, toggle, next, previous) and `open_panel` (queue, library, search, recents, lyrics, metadata, settings). They do not change data, so they are not journaled.
- **Lyrics:** off by default. The chat switch "AI may read lyrics" sends the first 700 characters (no timestamps) of up to 40 songs for that request only; the "what is sent" screen lists it. Scope "Playing now" sends just the playing song. A row marked `playing=yes` tells the model which song is playing.
- **Translation in the lyrics view:** a synced translation is saved as one more lyrics version named "AI translation (French)" in the engine's own variants (`adapter/ai-lyrics.js`), so the lyrics view shows it with the original timing. The lyrics bar gets Original / Translated, Translate and Auto (`views/ai/lyrics-bar.js`, mounted through the new `registerAiLyricsBar` slot; one line added in `views/tools/lyrics.js`). Plain lyrics without timing cannot be a version; the chat returns them as copyable text. Settings: default translation language and "Translate lyrics automatically" (waits 1.5 s after a song starts, skips songs already translated into that language, one notice per kind of error).
- **Edits outside E's files (small, additive):** `js/lyrics/18-lyrics-editor.js` also publishes `getActiveSyncedLyricsForSong`, `renameSyncedLyricsVariant` and `deleteSyncedLyricsVariant` to `window` (they existed but were not reachable); `shell/ai-slots.js` / `shell/ai-chrome.js` (queue opener, panel opener, lyrics-bar slot, `openAiSettings` now continues to the AI page of the new Settings hub); `views/tools/lyrics.js` (one call).
- **Adapter budget (DP9):** `ai-bridge.js` plus `ai-lyrics.js` together; the static test now sums both against 300.
- **Tests:** ai-core 38, ai-bridge 7, ui-next-ai 18 (browser, real engine), static 5; the Settings tests now go through the new Settings hub. `run.js unit`: the same 5 failures as untouched backup6.
- **Not done / open:** an activity log file (the owner's message was cut off), real key / Electron / Windows, tag writes still need Agent D's Node backend, keyboard-only moving of the pop-up window.
