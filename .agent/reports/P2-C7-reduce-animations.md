# Report: C7 Reduce animations setting

**Task:** C7 (POLISH-PLAN.md) | **Agent:** C | **Date:** 2026-11-05 | **Status:** In review (needs a look in the running app)

## Summary
A **Reduce animations** switch (Settings > General > Appearance, On / Off). One attribute on `<html>`, `data-motion="reduced"` or `"full"`, now decides every animation in the new interface: the CSS reads it, the scripts read it through one helper, and nothing else asks the system. Until the person chooses, it starts as the system's "reduce motion" (Windows "show animations"), and follows the system live. Once the person chooses On or Off, the choice is saved and stays.

## How it works
- **Attribute:** `shell/appearance-boot.js` sets it before the first paint (saved choice, else the system's setting; always set, even with nothing saved). `shell/appearance.js` keeps it current and listens to the system setting only while no choice has been made. New saved field: `reduceMotion` = `'on'` / `'off'` in the existing appearance key; anything else is ignored and the system decides.
- **CSS:** all 25 `@media (prefers-reduced-motion: ...)` blocks in `src/ui-next` were rewritten as plain rules under `:where(:root[data-motion='reduced'])` (was `reduce`) and `:where(:root:not([data-motion='reduced']))` (was `no-preference`). `:where()` has specificity 0, so every rule keeps exactly the specificity and order it had. The blanket rule in `base.css` (animations and transitions cut to 0.01 ms, loops to one pass) is under the same attribute, so it also stops animations nobody gated, and covers the panel, fade and loop work coming in C8.
- **Scripts:** the new `components/motion.js` exports `reducedMotion()` (reads the attribute, exported from `components/index.js`). The seven places that used `matchMedia('(prefers-reduced-motion...')` now call it: cat scrollbar, reveal (`growWidth`), chip strip, Home shelf, cover viewer, right-panel lyrics scroll, settings page scroll.
- **Not touched:** `src/css/*` (the old interface). It does not load the boot script and retires in phase 6.6; its one `no-preference` block stays as it was.

## Findings
- The waveform's "motion" is one CSS transition on the canvas (`player-bar.css`), covered by the blanket rule. The playhead drawing per frame while a song plays is the position, not decoration, and is not switched off. *read*
- The cat's walking and looks stop through the CSS gate; its script timers already asked `reduceMotion()` on every tick, which now reads the attribute, so a change takes effect at the next tick. *read*, and checked running (no looping animation with the cat on).

## Changed files
| File | Change |
|---|---|
| `src/ui-next/components/motion.js` | New: `reducedMotion()`. |
| `src/ui-next/components/index.js`, `reveal.js` | Export / use it (`prefersReducedMotion` kept as an alias). |
| `src/ui-next/shell/appearance-boot.js`, `appearance.js` | Attribute before first paint; `reduceMotion` field, `MOTIONS`, `effectiveMotion()`, live system follow. |
| `src/ui-next/shell/appearance-settings.js` | The Reduce animations row. |
| `src/ui-next/shell/cat-scrollbar.js`, `settings-layout.js`, `views/home/shelf.js`, `views/library/chip-strip.js`, `views/playback/cover-viewer.js`, `views/playback/right-panel-content.js` | Use the helper instead of `matchMedia`. |
| 16 stylesheets under `src/ui-next` | Media blocks rewritten as above (selectors and declarations unchanged). Two comments that named the old query were reworded. |
| `tools/tests/ui-next-motion.test.js` | New: 5 static + 6 browser tests. |
| `tools/tests/ui-next-components|main-playlists|rail|reveal|scrollbar|url-button.test.js` | Assertions that named the old media query now name the attribute (same intent; the reveal test sets the attribute instead of mocking `matchMedia`). |
| `tools/tests/ui-next-appearance.test.js` | The list of radio groups in the Appearance section gains `'Reduce animations'`. |
| `.agent/POLISH-PLAN.md` | Status table: C7 row. |

## Decisions made or needed
1. **Two values, not three.** The plan says the system setting is the *starting* value, so the control is On / Off. The cost: after choosing, a person cannot go back to "follow the system". A third value, System, is a small addition if you want it.
2. **Specificity kept** with `:where()` rather than the simpler `:root[data-motion]` prefix, so no existing rule can be outranked by the rewrite.

## Checks
| Command or step | Result |
|---|---|
| `node tools/tests/run.js ui-next-motion` | 11 of 11 pass (static rules; boot value before first paint; saved On beats the system, saved Off beats the system; bad value ignored; no looping animation with the cat on, including an ungated probe loop; the Settings row, live, saved, kept after reload; the system change carries over until a choice is made) |
| `node tools/tests/run.js ui-next-reveal ui-next-components ui-next-scrollbar main-playlists ui-next-url-button ui-next-rail` | 126 pass, 11 fail before the line-ending fix, then the same 10 that fail on the unmodified zip (see below); the scrollbar test passes |
| `node tools/tests/run.js ui-next-startup-wiring volume-control ui-next-open-animations ui-next-scrollbar ui-next-theme` | 63 pass, 4 fail: identical to the unmodified zip |
| `node tools/tests/run.js unit` | 799 pass, 9 fail, 26 skipped: identical to the unmodified zip (834 tests both) |
| `node tools/tests/run.js ui-next-appearance` | 18 pass, 4 fail: the same 4 as the unmodified zip |

**Failures that are not from this change** (same on the unmodified zip, same sandbox): components `menu` (3), `components.css uses tokens only`, `index.js` (reveal.js not exported), rail (4: Home fill, accent, hover motion, reduced motion), url-button static (index.html wiring), startup-wiring/designer, volume-control (3), appearance (4), and the unit group: scan cancel (2), tag round trip, sample library, drag-drop-modules, lint.test, state setters, DP14 adapter budget. I did not look into them.

## Not run
- **ESLint / `npm run lint:strict`**: `node_modules` has no packages and the network is closed, so ESLint is not installed. Syntax of the changed scripts was checked with `node --check`.
- **Real Electron** (`npm run smoke`, a real window): not available. The browser tests use headless Chromium with a stubbed Electron API.
- **The new row's label list in `ui-next-appearance.test.js`** is not reached: that test fails earlier on both trees (the Appearance section is found 5 times, expected 1). The row itself is covered by `ui-next-motion.test.js`.
- `node tools/dev/gen-web.js --check`, `npm run dist`: not needed (no generated file, packaging or main-process change).

## Environment
Linux sandbox, Node v22.23.4, Playwright with its bundled Chromium. No network, no ESLint.

## Manual checklist for the owner
1. Start the app (`npm start`), open Settings > General > Appearance. **Expected:** a "Reduce animations" row with On / Off. It matches Windows: with "Show animations in Windows" off, it reads On.
2. Turn it **On**. Hover the title-bar link button and the rail icons. **Expected:** nothing moves; clicking Settings or Lyrics in the rail does not play the icon animation; panels and menus appear without a fade.
3. Turn the cat scrollbar on (Settings > The cat) with Reduce animations On. **Expected:** the cat stays but its tail, blinking and walking stop; scrolling a long list does not walk it.
4. Turn it **Off** while Windows has animations off. **Expected:** motion comes back at once, without a restart.
5. Close and reopen the app. **Expected:** the choice stays and there is no flash of motion at start-up.
6. Change the Windows setting while the app is open, before ever choosing in the app. **Expected:** the row and the motion follow it within a moment.

## Open issues and follow-ups
- Decision 1 above (a System value).
- C8 (panel animations) must be written under `:where(:root:not([data-motion='reduced']))` or rely on the blanket rule; either way it is covered.
- Existing failures listed above: someone may want to look at them separately.

## Patch
`C-1-reduce-animations.patch`. Excludes: `src/css/*` (old interface), any change to `CHANGELOG.md` (the integration owner's).
