# P1-PA-15 Old-screen audit: shell and chrome

Status: In review. Task: brief 20, Agent A's area. Compared the old screen (`build/music_player.html`, `src/js/ui/06c to 06k`, `window-controls.js`, `layout.js`, `08a`, `core/startup.js`, `electron/window-manager.js`) with the new shell. Behavior was read from the code and the common ones were run in the real shell (probe, 2026-10-24). Areas owned by B (lists, hover, selection), C (player, cover, lyrics) and E (AI) are left to their own audits.

## Found and fixed
| Old behavior | New shell | Fix |
|---|---|---|
| Dragging audio files over the list drew a dashed "Drop files to import" overlay (`song-list.css`, `.content-wrapper.drag-over::after`). The engine still adds the class and imports on drop. | No rule for it: the drop worked with no sign that it would. | Rule added to `adapter/engine-view.css`, tokens only, covers the whole list. Test `ui-next-audit-shell.test.js` |

## Checked, works the same or better (no action)
| Old behavior | In the new shell |
|---|---|
| Minimize, Maximize with a Restore icon that follows the window state, Close | The adapter keeps `#maximize-icon` and the engine's `updateMaximizeIcon` still runs on `window-maximized`. The icon at 10 px is in the same place. Not run in a real Electron window |
| Title bar drag, window minimum 800 x 600, saved size, position and maximized state | `electron/window-manager.js` is untouched; the new bar has `-webkit-app-region: drag` and its buttons `no-drag` |
| Tooltips: 300 ms, flip under the target, clamp to the window, none on disabled controls | `components/tooltip.js`: 250 ms, instant between neighbours, flips and clamps, hides on press, scroll, blur and Escape, shows on keyboard focus |
| Keyboard: arrows seek 5 s (Shift 30 s), Ctrl+Up/Down volume, PageUp/Down/Home/End, Space, M, S, R, L, Ctrl+D | The engine's handler still runs. PageDown scrolls `.content` (run: 0 to 200 px). Space has the shell's own rule. The Shortcuts page lists them |
| Notifications panel with a number badge | PA-06: toasts, a dot on the bell and the center |
| Play from URL button | PA-08 |
| Settings button | Rail item and menu |
| Auto-collapse of the library panel under a width, remembered collapsed state | Panel gives its space below 1000 px; state is remembered under its own key (the old key is not read, so switching between the two screens does not carry it over; skipped on purpose) |
| Mouse back and forward | PA-13 |
| Search box in the top bar | Search rail item and panel (PB-02) |
| Library folder back button | `closeLibraryFolder` in `library-bridge.js`, used by the library panel |
| Taskbar thumbnail buttons, media keys | Main process; not part of the screen |

## Different on purpose (reason to skip)
| Old | New | Reason |
|---|---|---|
| Lyrics / LRC Search button in the top bar | The Find mode of the Lyrics view (`lyrics.js`) | Rail owns tools; one place for lyrics work. Owner can ask for a top-bar button again |
| Five color themes (green, pink, purple, yellow, white), `06i-theme-switcher.js` | Appearance settings; themes are PA-14 (last) | Themes only swap token values (D3, D60) |
| Custom scrollbar widget (`06c`) | Browser scrollbar | PA-10 was built and reverted at the owner's request; the idea is kept on the board |
| Panel widths scaled by the screen width (`SCREEN_WIDTH` ratios in `01-sizes.js`) | Pixel widths with a drag range (PB-05) | Simpler; not needed with the min window of 800 |
| `.tracklist-header.scrolled` background effect | The new list has its own sticky header | B's list |
| `suppress-tooltips` while the notification panel animates | Not needed: tooltips hide on press | |

## Open for the owner
- Files dropped outside the list (rail, title bar, Home, Settings) are ignored, and the window does not navigate to them (`will-navigate` is denied in `window-manager.js`). The old screen did the same. A drop anywhere would need a shell-level drop zone; say if wanted.
- The maximize icon swap was not run in a real window (no Electron here).
