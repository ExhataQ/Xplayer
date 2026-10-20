# Report UI-D06: skin for the engine's dialogs

**Agent:** D
**Date:** 2026-10-17
**Status:** In review. Manual checklist not done yet.

## What changed and why

In the new shell the engine's own dialogs (create playlist, shuffle mode, confirm and others) rendered unstyled below the visible window, so a button such as Shuffle looked like it did nothing (ENGINE-CONTRACT.md L-10). This task gives them the new look: token colors, the primary and outline buttons from DIRECTION.md, the field style, a scrim, and a surface and radius that match the component dialog.

Why this first: it is the only D task that does not need the adapter API or the view host, and it removes a defect that anyone using the new shell hits right away (see "Blockers for D-01 to D-05").

Covered dialogs, all built by `createModal()` in `js/ui/06b-modals.js` or its callers: create and edit playlist, create and rename folder, create new, play from URL, play history, confirm, welcome, import choice (`03l`), shuffle mode (`15b`).

Not covered (own tasks): song metadata modal (D-04), lyrics and sync editors (D-03), extended info.

## Design notes

- The engine writes inline styles that use the old token names (`--bg-card`, `--border`, `--bg-hover`, `--bg-modal`). Inside `.playlist-modal-overlay` the file gives those four names values from the new tokens. Nothing outside the overlay is affected, and the engine is untouched.
- `.playlist-modal-create-btn` is the primary fill, `.playlist-modal-cancel-btn` is outlined. The shuffle dialog uses the create class for two stacked options, so they are both primary; the disabled Smart option dims through the shared disabled opacity.
- z-index 80, above the tooltip layer (70). The engine still sets 100060 inline over the sync editor, which wins as before.
- Engine inline styles such as `style="flex-direction: column"` are respected; one attribute selector keeps those stacks from wrapping.

## Changed files

New:
- `src/ui-next/views/tools/dialogs.css`
- `tools/tests/ui-next-dialogs.test.js` (5 static, 7 browser)
- this report

Edited: `.agent/BOARD.md`, D-06 row, Reports table and Blockers section only (later patch edits more rows; see D-05). No Phase 1 row or decision touched.

No change to `src/js/`, `src/css/`, `electron/`, `build/`, `adapter/`, `components/`, `shell/`, `index.html`.

## Request to A

Done by D with the owner's permission (see UI-D05-settings.md): `index.html` now links `views/tools/dialogs.css`. A `--layer-dialog` token is still a nice-to-have, not blocking.

## Checks

| Check | Result |
|---|---|
| `node --test tools/tests/ui-next-dialogs.test.js` (headless Chromium, real engine, real Shuffle click) | 12 of 12 pass |
| Same file with `dialogs.css` emptied (mutation check) | 9 fail, 3 pass (the static tests that need no rules) |
| `ui-next-components`, `ui-next-tokens`, `ui-entry` tests | 56 of 56 pass |
| Screenshots at 1000x640 of the create-playlist and shuffle dialogs | reviewed by eye, dark theme |

The browser tests check: overlay covers the window and the dialog is fully inside it with a surface; input, primary and outline buttons are styled; theme change changes the dialog; the Shuffle button opens the dialog and Smart is disabled and dimmed under 50 songs; confirm shows the engine text, Escape closes it and resolves `false`; a click on the backdrop closes, a click inside does not; 800x600 with 300 words of text stays inside; text contrast 4.5:1 for title, body, outline button and primary button in three themes.

## Not run

- Full `npm test` and `node tools/lint.js` (no `acorn`/`eslint` here; the project lint does not cover `src/ui-next/` anyway).
- Electron, real Windows fonts, a screen reader, light themes.
- Dialogs not opened in the tests: edit playlist, folder dialogs, play from URL, play history, welcome, import choice. They share the same classes; open each once in the manual checklist.
- No build run: this change is source only (A-02 copies the whole `ui-next/` folder).

## Environment

Cloud container, Node 22, Playwright 1.56 (global), zip `Xplayer-main (4).zip`. The Windows archive folder is not reachable, so the archive step (AGENTS.md section 1) was not done by me; snapshot before applying.

## Blockers for D-01 to D-05

Resolved: the owner told D to build what A has not yet delivered. D wrote the view bridge (`adapter/engine-view.js`) and decided D14, D16 (S3) and D18. See UI-D05-settings.md.

## Manual checklist (Windows app, `--ui=next`, after A adds the link)

1. Snapshot, apply the patches.
2. Click Shuffle in the player bar. Expect a centered dialog with "Normal Shuffle" (light fill) and "Smart Shuffle v1" dimmed when the view has 50 songs or fewer. Click Normal: dialog closes, Shuffle button is marked.
3. Trigger Create playlist (context menu or any action that calls it). Expect a centered dialog, the field focused-ring on Tab, Cancel outlined, Create filled. Type a name and press Create: dialog closes.
4. Open the dialog again, press Escape: it closes. Open again, click outside it: it closes. Click inside: it stays.
5. Open Play from URL and Play history (right-click a song, Play history). Expect the same look; the history stats row uses the field color, the numbers use the accent.
6. Switch theme (Deep Forest, Espresso and Copper). Expect the dialog to recolor.
7. Shrink the window to the minimum (800x600). Expect the dialog fully on screen.

## Follow-ups

- The Welcome dialog sets `pointer-events: none` on the overlay inline, so the page behind stays usable; the scrim still draws. Decide in D-06b whether a non-blocking dialog should have a scrim at all.
- Engine dialogs have no focus trap and no `role="dialog"`/`aria-modal`. Fixing that is an engine change; it is a candidate for the later cleanup, not part of this skin.
- `showConfirmDialog` puts `options.title` and `options.message` into `innerHTML` unescaped (callers pass static text today). Not changed here; recorded for the engine owner.
