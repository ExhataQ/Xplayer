# Report: PA-06 Notification behavior and API

**Task:** PA-06 | **Agent:** A | **Date:** 2026-10-21 | **Status:** In review

## Summary
Brief items 9.1 to 9.4 and 9.6, plus the API other agents asked for (progress, click target, Undo button). A new module `shell/notify.js` holds shell-owned entries; the notification center shows them next to the engine's own. The bell swings on arrival and on hover, and the toast stack has more room below and lifts on hover.

## Findings (investigations)
- The center was fed only by `adapter/notifications-bridge.js` (the engine's `notificationHistory`), so no other agent could post an entry, a progress bar, a link or a button. *Read.*
- Engine entries have numeric ids and no target or action. Shell entries use string ids (`s1`), so the two never clash. *Read.*
- The bell was already an `icon-btn` with `aria-controls="notification-center"`, which is what the new CSS hooks into. *Read.*

## What the API does (for agents B to E)
- `notify({ title, detail?, kind?, where?: 'both' | 'center' | 'toast', important?, target?: { label?, view? | go? }, action?: { label, onClick } })` returns `{ id, update, dismiss }`.
- `notifyProgress({ title, kind?: 'download' | 'cover' | 'job', onCancel?, target? })` returns `{ id, update({ percent, status, title }), done(opts), fail(opts), dismiss }`. A running entry sits under "In progress" with a bar and a Cancel button (only when `onCancel` is given); `done` and `fail` turn it into a finished entry with a toast.
- `target.view` is a rail view id (opened through `showView`); `target.go` is any function. Clicking the entry, or its button, closes the center and opens the target.
- Behavior: the first important entry of a session (any `important: true`, any error) opens the center by itself, without moving focus, and gets no toast. Later ones are normal. A `center` entry is quiet (bell dot only). A `toast` entry leaves nothing in the center.

## Changed files
| File | Change |
|---|---|
| `src/ui-next/shell/notify.js` | New: shell-owned entries, `notify`, `notifyProgress`, navigator hook |
| `src/ui-next/shell/notification-center.js` | Merges both sources; target and action buttons; auto-open once; bell ring; shell cancel and dismiss |
| `src/ui-next/shell/shell.js` | Registers the navigator (`target.view` opens a rail view) |
| `src/ui-next/shell/notifications.css` | Entry buttons, clickable rows, bell swing on arrival and hover |
| `src/ui-next/components/components.css` | Toast stack 8 px higher; a hovered toast lifts 4 px |
| `tools/tests/ui-next-notifications.test.js` | Static import list now includes `./notify.js`; the failure-wording test changed (the first failure opens the center); 6 new PA-06 tests |

## Decisions made or needed
- **Reading of 9.1 (please confirm):** "the first notification that arrives ... only important ones" is implemented as: the first *important* entry per session opens the center (once). Important means an error or `important: true`. If you meant that every important entry should open it, it is a one-line change.
- **Reading of 9.6 (please confirm):** "a little more space below the popup notifications when hovering" is implemented as more space under the stack plus a 4 px lift on the hovered toast. If you meant something else (for example space between stacked toasts), say so.
- Engine notifications have no target yet. Agents B and C should post shell entries (or ask A for a wording rule) where they want "LRC found" or "playlist created" to be clickable. Engine messages stay as they are.
- The adapter budget (DP9) is not touched: no adapter file changed.

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/ui-next-notifications.test.js` | 23 of 23 passed (17 existing, 6 new) |
| All 26 `tools/tests/ui-next-*.test.js` files, one by one | All passed, none failed or skipped |
| `node tools/lint.js` | 0 errors, 0 warnings (139 files) |
| Headless Chromium screenshot with a running job, a target entry, an Undo entry and an error | Layout as intended: center opened by the error, toasts with buttons below |

## Not run
- Real Electron on Windows; the full suite outside `ui-next-*` (engine tests are unaffected: no engine file changed).
- The swing animation as motion (a still screenshot cannot show it); reduced motion is covered by the global rule.
- `tools/event-audit.js`: no engine event was added.

## Environment
Linux container, Node v22.22.0, headless Chromium through Playwright. No Python.

## Manual checklist for the owner
1. Start the app with `--ui=next`. In Library, do something that fails (for example, add a folder that does not exist). Expected: the bell swings and the notification center opens by itself, with no toast for that entry.
2. Close it, trigger another failure. Expected: a toast, no auto-open.
3. Hover the bell. Expected: a short swing.
4. Hover a toast. Expected: it rises a few pixels, and the stack sits a little higher above the player bar.
5. Agents using the API: post `notify({ title: 'LRC found', target: { view: 'lyrics' } })` and click it. Expected: the center closes and Lyrics opens.

## Open issues and follow-ups
- Engine notifications cannot be clickable until someone posts them through `notify` (task owners B, C, D).
- Undo needs the journal from agent E (PE-04); the button side is ready.

## Patch
`P1-A-wave1-notifications.patch`. It excludes `tools/CHANGELOG.md` and the board status line.
