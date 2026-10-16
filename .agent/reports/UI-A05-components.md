# Report UI-A05: component set with all states

**Agent:** A
**Date:** 2026-10-16
**Status:** Ready for review. The manual checklist below is not done yet.

## What changed and why

The shared building blocks every Phase 2 surface will use, so B, C and D do not restyle buttons, menus and dialogs themselves. Plain ES modules and one stylesheet, no framework, no engine access.

Components (`src/ui-next/components/`): button, icon button, chip and chip group, text field (with search variant), tabs, segmented control, tooltip, toast, status indicator and progress bar, dialog, menu with submenus, empty / loading / error state. `index.js` is the only import point for views.

States designed for each: hover, keyboard focus (global ring), active, selected or pressed, disabled, and where they apply loading (buttons, dialog actions, empty state), error (fields, dialogs, toasts, status) and success (fields, toasts, status).

## Bugs the new tests found in my own first draft (all fixed)

- Tooltip: the element was recreated before it was attached, so the first tooltip was blank.
- `[hidden]` was overridden by `display: inline-flex` on icon buttons and icons, so the search clear button and the icon hidden during loading stayed visible. Fixed with one global `[hidden]` rule in `components.css`.
- Dialog: action buttons called a function scoped inside the Promise executor, so no action could close the dialog.
- Dialog: the native element lets Tab leave the dialog; a small handler now wraps it.
- Contrast: menu shortcut text was 3.86:1 on a pressed item; it steps up to primary text while pressed.

## Changed files

New:
- `src/ui-next/components/`: `components.css`, `index.js`, `dom.js`, `button.js`, `field.js`, `tabs.js`, `tooltip.js`, `toast.js`, `status.js`, `dialog.js`, `menu.js`, `empty-state.js`
- `src/ui-next/dev/components.html`, `components-gallery.js` (developer gallery: every state, theme / accent / left-to-right / right-to-left switchers)
- `tools/tests/ui-next-components.test.js` (26 static tests), `tools/tests/ui-next-components-behavior.test.js` (63 browser tests)
- this report

Edited:
- `src/ui-next/tokens.css`: component-layer tokens only (control states, sizes, layers, shadow). No primitive or theme value changed.
- `.agent/BOARD.md`

## Excluded on purpose

- `tools/CHANGELOG.md` (integration owner), `tools/tests/README.md` counts, anything under `src/js/`, `src/css/`, `electron/`, `build/`.
- No new icons. See follow-ups.

## Checks

| Check | Result |
|---|---|
| `node --test tools/tests/ui-next-components.test.js` | 26 of 26 pass: no raw colors or `--c-*` in components.css, every `var()` defined, every state has a style, components import only each other and the icon module, no engine / bridge / storage / innerHTML-of-user-text, index exports everything |
| `node --test tools/tests/ui-next-components-behavior.test.js` (headless Chromium, file URLs) | 63 of 63 pass: button loading and toggles, chip group, field error / success / search clear / Escape, tabs and segmented keyboard (skip disabled, wrap, Home / End, right-to-left mirrored), tooltip delay / hide / focus / Escape / toggle state refresh, toasts (roles, update in place, max, timeout, hover pause, action, plain text), dialog (modal, focus in and back, Escape, action value, Tab wrap, async loading and failure, non-dismissible, menu inside dialog), menu (keyboard, typeahead, submenus, radio / checkbox, outside press, press on opener does not reopen, viewport clamp), status, progress, empty state, and rendered text contrast 4.5:1 across 3 themes x 6 accent settings |
| `ui-next-tokens` and `ui-entry` tests (regression) | pass (56 of 56 together with the new static file) |
| Syntax check of every new `.js` file, and an ad hoc ESLint pass (no-undef, no-unreachable, no-dupe-keys) over `components/` and `dev/` | clean |
| Gallery in headless Chromium | no page errors; screenshots reviewed by eye in dark theme |

## Not run

- Full `npm test` and `node tools/lint.js`: `npm install` is blocked in this environment (registry returns 403), so `acorn`, `acorn-walk` and `globals` are missing and the repo's own lint and `setters` tests cannot run. Playwright and ESLint came from the global install. The project lint does not cover `src/ui-next/` anyway.
- Real Electron window, Windows fonts, and a real mouse / screen reader.
- A build. `build/music_player.py` already copies the whole `src/ui-next/` folder (A-02), and a static test confirms the copy call, but I did not run the build.
- Contrast ignores the 0.88 and 0.74 opacity on pressed primary buttons (computed colors do not include opacity); the difference is small but unmeasured.
- Light themes: the contrast test and tokens cover dark themes only.

## Environment

Cloud container, Node 22, zip `Xplayer-main5.zip`. The Windows project and archive folders were not reachable, so the archive step (AGENTS.md section 1) was not done by me. Snapshot your project before applying the patch.

## Manual checklist (Windows app or any Chromium)

1. Snapshot, apply `ui-components.patch` from the Source folder with `git apply ui-components.patch`.
2. Start with `App\electron.exe App --ui=next`, click the token preview link on the page, or open `src\ui-next\dev\components.html` in Chrome or Edge.
3. Switch theme and accent. Expect every component to recolor and stay readable.
4. Switch Direction to rtl. Expect tabs, menus and fields to mirror, and Left and Right arrows to swap in tabs.
5. Hover "Hover me", wait half a second: tooltip appears. Move away: it disappears at once.
6. Tab to the shuffle icon button: tooltip shows. Click it: state changes from Off to On while the tooltip stays.
7. Open the menu. Use Down, Up, type "f", Right on File, Left, Escape twice. Expect focus to return to "Open menu".
8. Open each dialog. Press Escape (closes except "Not dismissible"). In "Async fails", click Save: spinner, then an error message, dialog stays open.
9. Fire the toasts. Hover one: it does not close. Show "error with action" twice: it updates instead of stacking.

## Follow-ups

- Missing icons for a complete status set: `info`, `circle-check`, `triangle-alert`. The info toast uses the bell and errors use `circle-alert`. Add them with `tools/build-ui-next-icons.js` once the Lucide package can be downloaded (the only copy available here is an older Lucide whose shapes differ from the vendored ones, so I did not mix them).
- Tabs do not scroll or truncate in a very narrow panel yet; decide in the shell task (A-03) or when D-01 needs it.
- The toast region is fixed above the player; A-07 adds the notification center using the `onDismiss` hook.
- Tooltips and menus rely on `position: fixed`; if A-03 puts a transformed ancestor around the shell, re-check placement.
