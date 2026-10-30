# Report: PA-11 Settings menu bar (rework)

**Task:** PA-11 | **Agent:** A | **Date:** 2026-10-27 | **Status:** In review

## Summary
Owner request: a menu bar for Playback, AI and the other groups instead of the items (the hub of cards). Settings now opens on General with a bar of tabs under the title: General, Playback, Library, AI (when registered), Data, and More only if the engine adds a section this file does not know. A tab shows its own sections. The hub, its cards and the Back button are gone; Escape no longer has a hub to return to.

## What it does
- Built with the shared `tabs` component (the one the Lyrics mode bar uses), so arrow keys, Home and End move between tabs and show the page. Each tab carries `data-page="<group id>"`.
- The bar is sticky at the top of the scroll area and has the page background, so it stays in reach on a long tab. In a narrow window it scrolls sideways inside itself; the page does not.
- The title stays "Settings"; the line under it follows the open tab ("Playback: Crossfade, fades, ..."). The page container is a `tabpanel` labelled by the selected tab.
- Opening Settings from the rail starts on the first tab; an engine redraw (Advanced Settings > Back) keeps the tab you were on, as before.
- The engine still draws every setting; sections are moved and shown or hidden only, as in the earlier PA-11.

## Findings
- The hub, back button, focus handoff to the title and the Escape rule were all in `shell/settings-layout.js` (PA-11 rework of 2026-10-23); the only other code that reached into the hub was `openAiSettings` in `shell/ai-slots.js`. *Read.*
- The earlier floating bar (first PA-11) scrolled one long page and was removed on 2026-10-23. This one switches pages like the hub did, it just keeps the choices in view. If you wanted the scroll-to-section kind back, say so.

## Changed files
| File | Change |
|---|---|
| `src/ui-next/shell/settings-layout.js` | Hub, Back and Escape replaced by the tab bar; `resetSettingsPage` kept (`appearance-settings.js` is unchanged) |
| `src/ui-next/views/tools/settings.css` | Hub, card and back-button rules replaced by `.settings-menu`; header comment updated |
| `src/ui-next/shell/ai-slots.js` | `openAiSettings` clicks the AI tab (`.settings-menu [data-page="ai"]`) |
| `tools/tests/ui-next-settings-layout.test.js` | Hub tests rewritten for tabs (3 tests), the others reopened by tab; stale expectations fixed: the AI tab is always there, and the engine's order is Player bar, Playback & Audio, Smart Shuffle |
| `tools/tests/ui-next-settings.test.js`, `-appearance`, `-ai`, `-ai-slots`, `-tooltips`, `-startup-wiring` | `.settings-card[data-page=...]` clicks became `.settings-menu [data-page=...]`; the Back clicks, the hub measure and the hub contrast pass were removed; the contrast test now also checks the tab colours |
| `.agent/BOARD.md` | A note on the PA-11 row |

## Decisions made or needed
- **Tab icons:** the bar shows each group's icon next to its label (same icons as the old cards). Say if you want text only.
- **Sticky bar:** kept on. It is one rule in `settings.css` (`.settings-menu`) to turn off.

## Checks
A browser (Chromium with Playwright) was available in this sandbox, so the browser suites ran, before and after the change, on the same tree.
| Command or step | Result |
|---|---|
| `ui-next-settings-layout.test.js` | 5 of 8 pass (before: 4 of 8, on the old hub tests). The 3 that fail only fail on the page-error check: `Cannot read properties of null (reading 'enabled')` from the AI views, because the test stub answers every `electronAPI` call with null. The same error fails the old hub tests |
| `ui-next-settings`, `-appearance`, `-ai`, `-ai-slots`, `-tooltips`, `-startup-wiring` | Same pass and fail counts as the untouched tree (12/16, 19/22, 17/18, 7/7, 15/17, 15/16); every failure there also fails without this change |
| 800 x 600 test and the contrast test (3 themes, every tab, tabs included) | Pass |
| Page with the real `settings-layout.js` and the real CSS, Chromium | Tab per group, correct sections per tab, arrow keys, bar stuck at the top after scrolling 400 px, menu scrolls sideways at 420 px, no page scroll at 800 and 420 px |

## Not run
- Real Electron and Windows. The sticky bar was seen in the real shell only as a position check (stuck to the top of the scroll area), not by eye on a long page.

## Environment
Linux container, Node v22.22.2, Chromium through Playwright, no Python.

## Manual checklist for the owner
1. Open Settings from the rail. Expected: the title, a one-line summary and a bar with General (underlined), Playback, Library, AI, Data; the General sections below.
2. Click Playback. Expected: only the playback sections, the summary line changes, the page is back at the top.
3. Press the right arrow on the bar. Expected: the next tab opens and keeps focus.
4. On General, scroll down. Expected: the bar stays at the top of the page.
5. Narrow the window to about 600 px. Expected: the bar scrolls sideways; the page does not.
6. Data > Advanced Settings > Back. Expected: you return to the Data tab.
7. Open the AI chat while AI is not set up and press "Open Settings" (in the chat banner). Expected: Settings opens straight on the AI tab.

## Open issues and follow-ups
- Pressing Escape on a tab does nothing now (it used to go back to the hub).

## Patch
`P1-PA-11-settings-menu-bar.patch` and the same files in `P1-PA-11-changed-files.zip`. It is made against your tree with PC-09 applied. It excludes the board's status line and `CHANGELOG.md`. Snapshot first (PO-02).
