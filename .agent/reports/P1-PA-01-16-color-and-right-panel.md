# Report: PA-01 unified color and PA-16 right panel (investigations)

**Task:** PA-01, PA-16 | **Agent:** A | **Date:** 2026-10-21 | **Status:** In review (recommendations; DP1 and DP11 need the owner)

## Summary
Both are investigations. I rendered the real new screen with each color option and with a mock right panel (screenshots `color-*.png`, sent with this report). Findings: the current colors, a problem with using the "raised" color for the right panel and player, a token plan, and a layout plan for the right panel including narrow windows.

## Findings (PA-01)
- **Now (read in `shell/shell.css`, seen running):** title bar, rail and main view use `--surface-ground` (darkest). Library panel and player use `--surface-panel` (one step lighter). So the panel does not match the rail or title bar. *Reproduced*
- **The ladder per theme** (`tokens.css`, warm graphite): ground `#0e1013`, panel `#13161b`, raised `#1a1e25`, selected `#20252d`. Only 4 steps, and `selected` is also the hover and chip color. *Read*
- **Problem with "raised" for the right panel and player:** `--surface-raised` is the color of tooltips, menus, toasts, dialogs and the notification center (`--tooltip-bg`, `--menu-bg`, `--toast-bg`). If the right panel and player were raised, a popup over them would be separated only by its border, and `selected` (hover) would barely show on them (`#20252d` on `#1a1e25`). The mock images use raised only to show the idea. *Read; visible in the mock*
- **Text contrast** is not the issue: primary text `#ece9e3` is far above 4.5:1 on all four steps. The secondary text (`#959aa5`) is fine on the first three; it must be rechecked on a new "side" step (do it in PA-14).

## Recommendation (PA-01)
Add semantic tokens only, in `tokens.css`, no component change except where a surface is chosen:
| Token | Used by | Warm graphite value (proposal) |
|---|---|---|
| `--surface-chrome` | title bar, rail, library/search/recents panel | `#0e1013` (same as ground) |
| `--surface-main` | main view | `#13161b` (same as panel today) |
| `--surface-side` (new primitive `--c-side`) | right panel, player | `#161a20` (between panel and raised) |
`--surface-raised` and `--surface-selected` stay for popups and hover. Each of the three themes needs its own `--c-side`. This is "option 1" in the images. Options 2 and 3 are the same idea with other orders; they only differ in which step each area gets.

## Findings (PA-16, right panel)
- **Grid:** `.app` has three columns (`rail`, `panel`, `view`) and three rows (`shell/shell.css`). A fourth column `right` fits without touching the rows (the mock does exactly this). `min-width` of the window is 800. *Read; reproduced in the mock*
- **The engine already has a right panel** with tabs for queue, now playing (`#tags-content`: cover and track details), metadata and recently played (`legacy-dom-adapter.js`). ui-next already moves the metadata tab into its Metadata view (`showEnginePanel`) and draws its own queue (`views/playback/queue-panel.js`). *Read*
- **Lyrics:** the engine's lyrics display is one node (`lyrics-view-root`), shown in the Lyrics view. A single node cannot be in two places, so the right panel cannot reuse it while the Lyrics view is open. The panel should have a small read-only lyrics display of its own (C, PC-13, with `lyrics/lrc-parser.js`), and the Lyrics rail view keeps Write and Sync. *Read, not yet verified in running code*
- **Space:** at the 800 px minimum, rail (56) + library panel (300) + right panel (320) leave 124 px for the list. *Calculated*

## Recommendation (PA-16)
1. A shell-owned slot (`right-host`) with an open/close button in the title bar, a draggable left edge (reuse `shell/panel-resizer.js`), width 280 to 420, default 320, remembered.
2. It pushes the list narrower (owner's choice). The list keeps at least 420 px: below that the right panel closes by itself and the button opens it as an overlay; the saved choice is not changed (same rule the left panel already uses when narrow).
3. Slot API for C: `mountRightPanel(factory)`; C provides lyrics plus the big cover (old design). Empty state when there are no lyrics (DP11a).
4. Colors from PA-01: right panel and player use `--surface-side`.

## Changed files
No source changed. Only this report and the board status.

## Decisions made or needed
- DP1 (which of the three color options), DP11 (what shows with no lyrics, minimum list width, button place) and DP2 (how Home and tools share the screen with panels).

## Checks
| Step | Result |
|---|---|
| Rendered `current`, `opt1-dark-frame`, `opt2-mid-frame`, `opt3-light-frame` in headless Chromium with a mock right panel | Four screenshots; no console errors |

## Not run
Contrast ratios were not measured by script for the new `--surface-side` values; the proposal values are placeholders until DP1 is answered. Real Electron not available.

## Environment
Linux container, Node v22.22.0, headless Chromium through Playwright.

## Manual checklist for the owner
1. Look at the three option images next to each other.
2. Say which one (DP1), or give a different order.

## Open issues and follow-ups
- PA-03, the panel work and PA-14 wait for DP1.
- Whether the player should keep its current color on a light theme is not decided.

## Patch
Included in the next full patch.
