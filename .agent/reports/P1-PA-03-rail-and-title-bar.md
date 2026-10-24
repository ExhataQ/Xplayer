# P1-PA-03: rail and title bar merge, Home rule, Library icon, icon motion, active bar

Agent A, 2026-10-23. Status: in review. Brief 2.1, 2.3 to 2.8 (2.2 is PA-01, decided: keep today's colors).

## What changed
- **Round 4 (owner, 2026-10-24):** same 68 px width, smaller parts: buttons 44 px (the hover area) and icons 20 px (`--rail-button`, new `--rail-icon`). The icons start closer to the title bar (4 px instead of 8). The active bar is 36 px tall, a little shorter than the hover area. The X logo moved to the far left (12 px) and stays level with the other title bar buttons, so it no longer sits over the rail's icons.
- **Round 3 (owner, 2026-10-24):**
  - The rail is wider (56 to 68 px, token `--rail-width`) with 48 px buttons (new token `--rail-button`, was 40) and 24 px icons (was 20). The logo stays centered over the icons, and the active bar sits on the rail's edge.
  - The rule under Home is 32 px wide and sits at the rail's normal 4 px gap under Home, with 8 px before Library (it was equally far from both).
  - Colors: the title bar, the rail and the panels (left, right, player) use one color, `--surface-panel`. Only the main view keeps `--surface-ground`, so it is darker. This changes DP1's "keep today's colors" for the title bar and the rail, as the owner asked.
  - Hover motion on the rail waits 160 ms before it starts (so passing over an icon does nothing) and then always runs to its end, even if the pointer leaves. `playOnHover` in `shell/shell.js` sets `data-play` on the button while it runs; `rail.css` keys the motion on that mark instead of `:hover`. The title bar's bell, AI and URL buttons were left as they were.
- **One bar (2.1):** the title bar and the rail share `--surface-ground`. Both lines stay: the rail keeps its right border, and the title bar's bottom line is drawn by `::after` starting where the rail ends, so the seam between the logo and Home is open (no line there). The logo is centered over the rail's icons.
- **Home apart (2.3):** a 24 px rule under Home (`.rail-sep`, `aria-hidden`) with extra space above and below. Home is marked `solo` in `VIEWS`.
- **Library icon (2.4):** `icons/custom-icons.js` (new, hand drawn, not from Lucide): an upright book with one spine band and a leaning book. `icon()` and the generator (`tools/build-ui-next-icons.js`) read it next to the generated set; the Lucide "library" bars are dropped.
- **Icon motion (2.5), revised after the owner's feedback:** nothing moves on its own. On **hover** Home hops, Library tilts, Search nudges and Recents turns its clock hands once, then each returns to where it started. On **click** (while its page is open) Settings turns its gear a quarter turn, Lyrics bounces its five waveform bars one after another, and Metadata swings its tag. Hover icons do nothing on click and click icons do nothing on hover. All off with reduced motion.
- **Icons:** Settings uses a gear like the previous interface's (drawn again, not copied) and Lyrics a five bar waveform (`gear`, `waveform` in `custom-icons.js`).
- **Title bar buttons:** the bell keeps its own swing (`notifications.css`, now off with reduced motion). The AI chat button gets a matching hover motion (the sparkles pop and settle, `ai-pop`), and the bell takes the accent while the notification center is open, as the AI button does while its chat is open.
- **Active bar (2.6):** 28 px tall (was 20), 3 px wide, grows in from its middle and fades; the bar of the page you leave shrinks away.
- **Home fills (2.7):** the house is filled with the accent from the bottom up (420 ms); the door turns into a gap in the fill. Icon `rail-house` (custom).
- **Icons while their page is open (2.8):** Home, Lyrics and Metadata take the accent color and change shape: Home fills from the bottom (and loses the fill at once when you leave), Lyrics and Metadata take the accent, Metadata fills its tag. Library, Search, Recents and Settings grow 8 % and get a bolder line.
- Files: `shell/rail.css` (new, linked after `shell.css`), `shell/shell.css`, `shell/shell.js`, `icons/custom-icons.js`, `icons/icons.js`, `tools/build-ui-next-icons.js`, `index.html`.
- Tests: `ui-next-rail.test.js` (15, including the delay, the finish after leaving, the sizes and the colors); `ui-next-phase1-gate.test.js` reads the custom icons too.

## Not done
- Settings is a main-view item (DP2) but brief 2.8 names only Home, Metadata and Lyrics, so it only gets the small change.
- Player and list icons are not animated.
- The icon motion and the fill were checked in headless Chromium by computed style and screenshots, not on real Electron or at 60 fps on a slow machine.
