# V0: what a full-width visualizer costs (measured 2026-11-07)

Part of `.agent/archive/visualizer/VISUALIZER-PLAN.md`. Tool: `node tools/dev/bench-visualizer.js` (about 2 minutes; writes `.dev-data/bench-visualizer-<time>.txt`).

## What was measured

A plain page, no app code: a made-up sound (noise) through an `AnalyserNode` (fft 2048), and a canvas as wide as the window and 88 px tall (the player section), drawing 64 or 128 bars that rise from the bottom edge (fast rise, slow fall, log-spaced bins). Chromium with the graphics card off (`--disable-gpu`, `--disable-gpu-compositing`, no accelerated canvas), so drawing and blending are done in software, as in the app. Each row ran 6 seconds. "cpu" is the whole browser (page, raster and graphics threads), as a share of one core, with the idle page taken off.

Two machines are reported below: the sandbox, and the owner's Windows PC (section after the sandbox result).

Sandbox machine: a 2-thread 2.1 GHz Xeon in a sandbox with no real screen. Read the numbers as relative; the owner's machine decides the absolute ones (run the tool there).

## Result

| Window width | Screen scale | 30 fps | 60 fps |
|---|---|---|---|
| 1400 | 1 | 3.3 % | 5.0 % |
| 1400 | 1.5 | 4.3 % | 8.5 % |
| 1400 | 2 | 5.7 % | 8.7 % |
| 1920 | 1 | 3.0 % | 4.5 % |
| 1920 | 1.5 | 5.8 % | 9.0 % |
| 1920 | 2 | 6.3 % | 10.7 % |

- 128 bars instead of 64: no difference (6.0 % against 5.8 %).
- With a translucent veil and nine button-like shapes over the canvas (1920, scale 1.5): 6.8 % at 30 fps and 10.8 % at 60 fps, about one point more than the canvas alone.
- Reading the sound and drawing the bars: 0.1 ms per frame in the page (95th percentile 0.2 to 0.3 ms). It is not the drawing in the page that costs.

## What it means

1. The cost is the **software compositing of the canvas layer**, not the JavaScript: it grows with the canvas's pixels (width x scale squared) and with the frame rate, and hardly at all with the bar count.
2. **30 frames per second is the right default**: about 3 to 6 % of one core on this machine, against 4.5 to 11 % at 60. The bars look smooth enough at 30 with the slow fall.
3. High screen scales (150 %, 200 %) cost twice what 100 % does. The renderer should be able to draw the canvas at a **lower resolution than the screen** (for example scale 1, stretched by CSS): bars are plain rectangles and the veil softens the edges, so nothing is lost. That would bring every row near the 3 to 5 % of scale 1.
4. Bar count is free: use what looks best (64 is plenty).
5. The controls on top add little (about one point).

## Owner's Windows result (i5-10400F, 12 threads, graphics card off)

The sandbox numbers above are too optimistic at large sizes. On the real machine:

- 1400 wide: **2 to 4 %** of one core at 30 fps. Fine.
- 1920 wide at screen scale 1.5 or more: **16 to 32 %** of one core (the highest at 60 fps). Too much for a decoration.
- Drawing in the page: still 0.1 to 0.4 ms per frame. The cost is the compositing of a big canvas in software, so it grows with the canvas's pixels (width x scale squared) and with the frame rate.

## Decision (replaces the sandbox-only decisions below where they differ)

1. **The canvas's own resolution is capped at scale 1** (it may be 1.25 if it looks too soft; decide by eye in V4), and CSS stretches it to the screen. Bars are plain rectangles, so nothing visible is lost. This takes a 1920 wide, scale 2 window from the cost of 3840 pixels wide to 1920.
2. **30 fps default.** If the capped rows below are still above about 5 %, drop to 24 or 20 fps (bars with a slow fall hold up well).
3. Bar count stays free (design uses about one bar per 11 px, 120 at 1440).
4. The loop stops whenever it is not seen (V3), and the setting is off by default, so nobody pays unless they turn it on.

## Owner's second Windows run (the capped rows, 2026-11-07)

Same machine. The canvas capped at scale 1 is the fix; the first run's "idle page with the analyser, nothing drawn" cost (4.2 % of a core) was taken off the numbers below.

| width | screen scale | fps | bars | canvas cap | cpu (of one core) |
|---|---|---|---|---|---|
| 1920 | 1.5 | 30 | 64 | none | 9.2 % |
| 1920 | 2 | 30 | 64 | none | 9.9 % |
| 1920 | 1.5 | 30 | 64 | 1 | **3.9 %** |
| 1920 | 2 | 30 | 64 | 1 | **6.5 %** |
| 1920 | 1.5 | 30 | 64 | 1.25 | 12.3 % |
| 1920 | 2 | 30 | 64 | 1.25 | 8.3 % |
| 1920 | 1.5 | 24 | 64 | none | 6.0 % |
| 1920 | 1.5 | 20 | 64 | none | 6.7 % |
| 1920 | 1.5 | 20 | 64 | 1 | 3.4 % |
| 1920 | 1.5 | 30 | 128 | none | 13.3 % |
| 1920 | 1.5 | 30 | 64 | none, with the veil and buttons over it | 14.9 % |
| 1920 | 1.5 | 60 | 64 | none, with the veil and buttons over it | 29.9 % |

What it means (decisions, all built): the cap at scale 1 is what makes it cheap (9.2 to 3.9 % at scale 1.5); a cap of 1.25 is worse than none (fractional resampling), so it is not used; the frame rate matters much less once capped (20 fps with the cap: 3.4 %); a translucent veil over the canvas costs about 5 points, so the player bar gets none; 128 bars cost more than 64 on this machine (13.3 against 9.2 %, partly noise), so the bar count stays about one per 11 pixels (131 at 1440) and is the first thing to lower if a machine struggles. The run is noisy (the idle case varied between 4 and 6 %), so read the rows as a ranking, not as exact values.

## To confirm: run again with the new rows

`node tools/dev/bench-visualizer.js` now also measures, at 1920 wide: scale 1.5 and 2 with the canvas capped at 1 and at 1.25, 24 and 20 fps uncapped, and capped at 1 with 20 fps. Send the new .txt. The target: every capped row at about 5 % of one core or less. If not, the fps drops further before the design changes.

## Decisions for the later packages (sandbox, kept for the record)

- V2: draw at 30 fps, bar count 64, canvas resolution capped at scale 1 to 1.25 (decide by eye in V4). Keep the loop stopped whenever it is not seen (V3).
- The budget of the plan ("a few percent of one core at 30 fps") holds: 3 to 6 %.
- Still to confirm on the owner's machine (run the tool there and send the .txt): the real numbers, and that the real Electron window behaves like this page.
- Not measured here: the routing through the media protocol (V1), and a real song's sound. Neither changes the drawing cost; V1 has its own tests.
