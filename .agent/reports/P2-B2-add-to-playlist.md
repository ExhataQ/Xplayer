# Report: B2 Add to playlist in the song menu

**Task:** B2 (POLISH-PLAN.md) | **Agent:** B | **Date:** 2026-11-05 | **Status:** In review (needs a look in the running app)

## Summary
"Add to playlist" in the song context menu is a **real submenu**: it opens on hover like the other submenus, shows a search field, **Add to new playlist** on top and the playlists (pinned first, then recent). It acts on the whole selection when several songs are selected.

## Fix round 1 (owner's findings) and what the investigation showed
The first version was a separate floating box opened by a click on a plain menu row. Findings about the engine's menus (src/js/ui/06a-context-menus.js, adapter/legacy-overlays.css):
- A submenu is pure CSS: `.submenu-parent:hover > .context-submenu { display: block }`. It sits **inside** `.context-menu`, so hovering opens it, leaving closes it, and it needs no code.
- `positionSubmenus()` measures each submenu once, 10 ms after the menu opens, and adds `right-aligned` / `bottom-aligned` when it would leave the window. So the content must be there before that.
- The whole menu counts as one thing for "press outside" and for clearing the song selection (`.closest('.context-menu')`): anything inside it is safe, anything outside it closes the menu or clears the selection.
- A click on an item with `data-action` runs `contextMenuAction`, which **always closes the whole menu**. That is why the click version made the main menu disappear, and why it never opened on hover (it was not a submenu).
- Shortcut keys are ignored while an input has focus (06k), Escape closes the whole menu.

So the picker now **fills the engine's own submenu** (`.playlist-picker-submenu`) instead of floating: hover opens it, the main menu stays, a choice closes the whole menu, Escape and outside presses behave like every other submenu. Pointer entering the row focuses the search field so typing starts at once. The list has a minimum height of seven rows (up to ten, never taller than the window), so a short list is not a thin strip.

## Fix round 2 (styles broken, too wide)
The picker sits inside the "Add to playlist" menu item, and the engine rule `.context-menu-item span { flex: 1 }` (adapter/legacy-overlays.css) applied to every span in it: the search icon, the check column and the labels each took an equal share, which broke the rows. The icon helper makes spans, so this hit all of them. Fixed in `legacy-overlays.css` with rules that beat it for the picker only (icons and the check column keep their size, the label takes the rest). The submenu is now 220px wide (was 260px plus a 240px minimum inside it), and the floating variant 240px. This was checked by reading the CSS cascade only: **there is no browser here, so the look is still to be confirmed by you.**

## Behaviour
- Choosing a playlist adds the songs, shows the usual notification and closes the menu. A playlist that already has all the songs shows a check.
- **Add to new playlist** makes a playlist, adds the songs, and keeps the submenu open so the list shows again with the new one on top, marked. The name is what is typed in the search field, else "New playlist", "New playlist 2", and so on.
- Keyboard: type to filter, Up/Down/Home/End, Enter chooses, Escape closes the menu.
- Where the new interface is not loaded the old hover submenu is built exactly as before.

## Decisions I made (say if you want them the other way)
1. "Shows the playlists" read as: the submenu stays open after Add to new playlist and shows the list again.
2. The new playlist's name comes from the search text, else "New playlist N", with no name dialog.
3. The picker is a generic component (`components/picker.js`: `mountPicker` inside a host, `openPicker` floating), so the drag menu can use it. The playlist parts are in `views/library/`.

## Changed files (this round on top of the first patch)
| File | Change |
|---|---|
| `src/ui-next/components/picker.js` | `mountPicker(host, options)` added; `openPicker` kept (floating); shared core. |
| `src/ui-next/components/components.css`, `adapter/legacy-overlays.css` | Inline/floating picker styles, minimum list height; the submenu box for it. |
| `src/ui-next/views/library/playlist-picker.js` | `mountPlaylistPicker(host, songIds, onDone)`, replaces `openPlaylistPicker`. |
| `src/ui-next/adapter/playlist-picker-bridge.js`, `shell/shell.js` | Registers the mount function. |
| `src/js/ui/16-context-menu-actions.js` | `mountPlaylistPickerInto` replaces `openPlaylistPickerFromMenu`; `addSongsToPlaylistFromMenu` unchanged. |
| `src/js/ui/06a-context-menus.js` | "Add to playlist" is a submenu parent with an empty `.playlist-picker-submenu`, filled right after the menu is on the page; shared `songIdsForMenu()`. |

## Checks
| Step | Result |
|---|---|
| `node --test tools/tests/playlist-picker-model.test.js` | 4 pass |
| Syntax check of every changed JS file | clean |
| `node tools/tests/run.js unit`, compared with the unchanged zip | **same failures as before, none new** (11 before; now 10: the adapter-budget test passes since the limit was raised) |

## Not run
- **The app and every browser test** (no browser here): the picker's look, position beside the menu, keyboard use and the multi-select add are **untested**.
- ESLint and acorn are not installed, so lint and the gates that need them did not run.
- Archive step of AGENTS.md (`E:\Backup`): not possible here.

## Needs the owner
- Pre-existing unit failures (10, same as in the unchanged zip) are untouched.

## Manual checklist
1. Right-click a song and **hover** "Add to playlist": the submenu opens beside the menu, the main menu stays, the search field has focus.
2. Type part of a playlist name: the list filters, names that start with it first. Enter adds to the first row and the whole menu closes.
3. Select 3 songs, right-click one of them, add to a playlist: one notification "Added 3 songs to X".
4. **Add to new playlist** with an empty field, then with text typed: new playlist on top, marked; submenu still open.
5. Move the pointer out of the submenu and over other rows: it closes like the other submenus. Escape closes the menu.
6. Right-click near the right and bottom window edges: the submenu opens to the left / upward and stays on screen.
7. The list is at least about seven rows tall even with one or two playlists.
8. Old interface (if you still run it): the hover submenu is unchanged.

## Patch
`P2-B2b-fix-and-B7-apply.patch`, made against `Source-backup (14)`.
