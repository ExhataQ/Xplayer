# Report: C1-C3 Play from URL: paste a link, show what it fetches, open the file location

**Task:** C1, C2, C3 (POLISH-PLAN.md) | **Agent:** C | **Date:** 2026-11-06 | **Status:** In review (needs a look in the real app)

## Summary
When **Play from URL** opens, a link on the clipboard is pasted and selected. Under the field, one quiet line shows what the link would fetch: file name, size and type, only the parts the server tells. A download that was **saved** now keeps its notification (toast and bell list) with an **Open file location** button that selects the file in Explorer. Streams have no such button.

## Findings
- The clipboard can be read in the renderer with `navigator.clipboard.readText()`; the app sets no permission handler, so Electron grants it. A browser would ask for permission, so the read is done only in the desktop app. *read* (not run in real Electron)
- The "Saved: ..." message was popup-only (`TOAST_ONLY_NOTIFICATIONS`), so it would vanish before a button could be used. A message with a file now goes to the bell list as well. *read, tested*
- The download saves under the last part of the link after redirects (`safeDownloadFileName`), so the preview shows exactly that name, not a name from the server's headers. *read, tested*
- The plan also lists **length**. It is not known without the file itself, so it is not shown (nothing is better than a guess).

## How it works
- **C1** (`06b-modals.js`, `setupLinkHelpers`): once, when the dialog opens, the clipboard is read. The text is used only if it is a single http(s) link of at most 2048 characters with no spaces, and only if the box is still empty (so what the person typed meanwhile is kept). A refused read is silent. Nothing is stored or logged.
- **C2**: after 500 ms without typing, and only for a real http(s) link, the page calls `probeUrl` (new IPC `probe-url`; preload, desktop-api table and main all check). Main sends a **HEAD** request (5 s limit, up to 5 redirects), writes nothing, and returns `{ success, name, size?, type? }`; a refusal, error or timeout is `{ success: false }` and the line stays empty. An answer for an older value is dropped. The line is set with `textContent`, so a hostile file name cannot become markup. Style `.link-preview` in `views/tools/dialogs.css`, tokens only.
- **C3**: `showNotification(message, type, duration, { file })` keeps the full path as `_file` and shows the entry in the bell list. `adapter/notifications-bridge.js` turns `_file` into `action: { label: 'Open file location', onClick }` that calls the existing `files.showFileInExplorer`. The center already draws an `action` on the row and on the toast. Only `Saved:` (not `Streaming:`) passes the file.

## Changed files
| File | Change |
|---|---|
| `electron/downloads.js`, `electron/main.js`, `electron/preload.js` | `probeUrl` and the `probe-url` call. |
| `src/js/api/desktop-api.js` | `library.probeUrl`. |
| `src/js/ui/06b-modals.js` | Clipboard paste, preview line, `{ file }` on the Saved message. |
| `src/js/ui/06j-notification-system.js` | `options.file` (kept in the bell list, `_file`). |
| `src/ui-next/adapter/notifications-bridge.js` | `action` from `_file` (+2 code lines, 48 of 60 allowed by its own test). |
| `src/ui-next/views/tools/dialogs.css` | `.link-preview`. |
| `tools/tests/play-from-url-probe.test.js` | New: 5 unit tests with a real local server. |
| `tools/tests/ui-next-play-from-url.test.js` | New: 3 static + 7 browser tests. |
| `tools/tests/desktop-api.test.js` | `probeUrl` in the name list. |
| `.agent/POLISH-PLAN.md` | Status table. |

## Decisions made or needed
1. **The request starts before you choose.** The HEAD request goes to the same host you are about to fetch from, as soon as you paste or type a full link and pause. If you would rather it only ran on a button, say so.
2. **Only the desktop app reads the clipboard** (a browser would show a permission question).
3. The old (non-ui-next) bell panel has no button; only the new shell shows it.

## Checks
| Command or step | Result |
|---|---|
| `node tools/tests/run.js play-from-url-probe` | 5 of 5 pass |
| `node tools/tests/run.js ui-next-play-from-url` | 10 of 10 pass (clipboard link pasted and selected; non-links, a refused read and late reads leave the box alone; one request for the last value; a late old answer dropped; failure leaves the line empty; hostile name stays text; closing mid-request is quiet; Saved keeps a button that calls Explorer with that path, a stream and a plain Saved do not) |
| `node tools/tests/run.js desktop-api` | 15 of 15 pass |
| `ui-next-notifications ui-next-url-button ui-next-adapter-budget cancel-running-work main-process-safety manifest lint` | the same failures as the unmodified backup 9, subtest by subtest (not mine) |
| Screenshots of the dialog and the notification | looked at (dark; the light run stayed dark because of how my script set the mode) |

## Not run
- **ESLint**: not installed, no network.
- **Real Electron**: the clipboard read, the real HEAD request to a real site and Explorer opening were not run; the tests use stand-ins and a local server.
- **Light theme** screenshots of these two screens.

## Environment
Linux sandbox, Node v22, Playwright with its bundled Chromium. No network, no ESLint.

## Manual checklist for the owner
1. Copy a link to an audio file, open **Play from URL**. **Expected:** the field holds the link, selected; after a moment a line shows name, size and type.
2. Copy ordinary text, open it again. **Expected:** the field is empty and nothing is requested.
3. Type a link. **Expected:** the line appears after you stop typing, and disappears when you clear the box.
4. Use a link whose server refuses HEAD. **Expected:** no line, everything else works.
5. **Download & Stream** a file. **Expected:** a "Saved: ..." popup and a bell entry, both with **Open file location**; clicking it opens Explorer with the file selected.
6. **Stream Only**. **Expected:** "Streaming: ..." with no such button.
