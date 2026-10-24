# Xplayer app icon (PA-12)

The approved X mark (same strokes as `src/ui-next/startup/logo.js`) on a dark rounded tile, in the warm-graphite theme colors.

| File | Use |
| --- | --- |
| `xplayer.ico` | Windows installer, exe and shortcut icon. Holds 16, 24, 32, 48, 64, 128 and 256 px, each drawn for its size (the small ones have a bolder mark). |
| `xplayer-16.png` ... `xplayer-1024.png` | Taskbar, tray, window icon, store and web uses. `xplayer-512.png` can replace `src/assets/icon.png`. |
| `xplayer.svg` | Editable source at 1024 px. |

Rebuild after a logo or color change: `python -m pip install pillow` then `python tools/make-app-icon.py`.

Not wired in: packaging lives outside this repo (`App/`), and `electron/window-manager.js` and `loading-window.js` still point at `electron/icon.png`, which does not exist. Copy `xplayer-256.png` there (or point the paths at this folder) when the owner wants it.
