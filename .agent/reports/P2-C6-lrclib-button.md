# Report: C6 Find: a button that opens the LRCLIB website

**Task:** C6 (POLISH-PLAN.md) | **Agent:** C | **Date:** 2026-11-07 | **Status:** In review (needs a look in the real app)

## Summary
The Find page header (next to "Search many songs") has a new **LRCLIB website** button. It opens `https://lrclib.net` in the person's normal browser, never inside the app. If the browser cannot be opened, a notification says so.

## Findings
- The app had no way to open an outside address: the window denies new windows and blocks navigation (`electron/window-manager.js`), and there was no `shell.openExternal` anywhere. *read*
- A general "open this address" call would let any page code open any address, so the call is narrow: it takes nothing, and the address is written in the main process. *design choice*

## How it works
- `electron/main.js`: `ipcMain.handle('open-lrclib-site')` calls `shell.openExternal('https://lrclib.net')` and answers `{ success }`; a failure answers `{ success: false, error }`.
- `electron/preload.js` and `src/js/api/desktop-api.js`: `lyrics.openLrclibSite()` (no arguments).
- `src/js/lyrics/19-online-lyrics.js`: the button (`data-action="openLrclibSite"`), drawn only when the call exists (so a browser build shows no dead button); a failed or refused open shows "Could not open the browser".
- No CSS needed: the button uses the same class and layout as its neighbour.

## Changed files
| File | Change |
|---|---|
| `electron/main.js`, `electron/preload.js` | The fixed call. |
| `src/js/api/desktop-api.js` | `lyrics.openLrclibSite`. |
| `src/js/lyrics/19-online-lyrics.js` | Button and `openLrclibSite` action. |
| `tools/tests/ui-next-lyrics-find-site.test.js` | New: 1 static + 3 browser tests. |
| `tools/tests/desktop-api.test.js` | `openLrclibSite` in the name list. |
| `.agent/POLISH-PLAN.md` | Status table. |

## Decisions made or needed
1. The button is on the **Find** page only, not on the Batch tab. Say if you want it there too.
2. The label is "LRCLIB website" and its tooltip says "Opens lrclib.net in your browser".

## Checks
| Command or step | Result |
|---|---|
| `node tools/tests/run.js ui-next-lyrics-find-site` | 4 of 4 pass (the address is fixed and the only `openExternal` in the main process; one call with no argument, no navigation, no popup; a refused or failed open is reported; no button without the call) |
| `node tools/tests/run.js desktop-api` | 15 of 15 pass |
| `ui-next-lyrics-find` | 14 pass, 3 fail: the same 3 as the unmodified backup 10 |
| Screenshot of the Find page | looked at |

## Not run
- **ESLint**: not installed.
- **Real Electron**: `shell.openExternal` was not run; the test replaces the call. In the screenshots the small icon in the button does not show because the icon font is not loaded in my sandbox (all buttons of that row are the same).

## Environment
Linux sandbox, Node v22, Playwright with its bundled Chromium. No network, no ESLint.

## Manual checklist for the owner
1. Lyrics > Find. **Expected:** a **LRCLIB website** button beside "Search many songs".
2. Click it. **Expected:** your normal browser opens lrclib.net; the app stays on the Find page and no window of the app opens.
3. Turn the internet off or change your default browser to nothing, click again. **Expected:** the browser may open an error page itself; if Windows cannot open anything, the app shows "Could not open the browser".
