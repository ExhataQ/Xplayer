# P1-PA-12 App icon from the X logo

Status: In review. Task: brief 18.1, 10.3. The creative redesign (10.2) stays on hold.

## What was built
- `src/assets/app-icon/`: `xplayer.ico` (7 sizes, 16 to 256), PNGs (16, 24, 32, 48, 64, 128, 256, 512, 1024), `xplayer.svg` and a README.
- `tools/make-app-icon.py`: draws everything from the logo's geometry (two ink strokes with a gap, one accent stroke across, round caps) on a rounded tile (radius 22.4 percent, like the old icon). Colors are the theme's `--c-ground`, `--c-ink` and `--c-accent`. At 32 px and below the mark is drawn bolder so it stays readable.

## Not done on purpose
- Nothing is wired into Electron or the installer (packaging is outside this repo). The README says how.
- `electron/icon.png` is referenced by `window-manager.js` and `loading-window.js` but missing; that is an existing gap, noted for the owner.

## Checked
Sizes read back from the .ico; each PNG viewed at 512 and in a strip down to 16 px.
