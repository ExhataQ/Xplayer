# Report: B8 step 1 (stable sizes): the scan, not yet the measurement

**Task:** B8 (POLISH-PLAN.md) | **Agent:** B | **Date:** 2026-11-05 | **Status:** Started, **not done**. The browser measurement the plan asks for first could not be built or run here.

## Why this is partial
The plan's first step is a browser test that measures every item before and after each state and lists what moves. There is no browser in my environment, so I cannot write that test and see it work, and a test I have never run could fail on your machine (the plan says no package may add failing tests). What I could do from the source is a **style sheet scan**, which finds the rules that *can* move something.

## What was done
- `tools/dev/state-size-scan.js` (new): reads every style sheet of the new UI (`src/ui-next`) and the engine's sheets it reuses (`src/css`) and lists each state rule (hover, focus, pressed, selected, playing, open, and the like) that sets font size or weight, line height, letter spacing, padding, margin, border width, width, height, gap or display to something different from the plain rule of the same element. `--write` makes `.agent/archive/polish-2/STATE-SIZE-LIST.md`, `--count` prints the number. Rules on `::before` and `::after` are counted, not listed (they are drawn over the box).
- `.agent/archive/polish-2/STATE-SIZE-LIST.md` (generated): 111 candidates. Most are noise: popups and panels that show and hide (`display`), and the engine's old left and right panel sheets, which the new UI mostly does not use. It narrows the search, it does not prove anything moves.
- **One fix:** in high-contrast mode (`@media (forced-colors: active)`), the selected rail button and pressed icon buttons got a 2px **border** when the state turned on, which takes room from the box. Now an inset **outline** (`shell/shell.css`). Nothing changes in normal mode.

## What the scan found about the two cases you named
- **Lyrics, the playing line growing:** in both lyric sheets (`src/css/lyrics.css`, `ui-next/views/tools/lyrics.css`) the playing line (`synced-active`) changes only colour and opacity, no size. So the growth is **not** in the style rules; it may come from script (an inline style) or a different view (Sync, Write, or the right panel's lyrics). It needs the measurement or a screenshot to find.
- **Main list, a hovered row slightly taller:** the prime suspect is the number column. On hover, keyboard focus or selection, the number is hidden with `font-size: 0` and a play or pause mark is drawn in its place (`adapter/songlist-rows.css` lines 117 to 143). If the row's height depends on that cell's text line, the swap changes it. Not changed, because I cannot see the effect.

## Needs the owner
- To finish B8 properly I need the measurement: either I write the measuring script and you run it on your machine and send me the list it prints (that list is then the work list), or you send screenshots or short videos of the lyrics line and the hovered row. Which do you prefer?

## Checks
| Step | Result |
|---|---|
| `node tools/dev/state-size-scan.js --write` | 111 candidates, repeatable |
| Syntax check | clean |
| Browser, lint, other tests | not run (no browser, no ESLint here) |

## Patch
`P2-B8a-state-size-scan.patch` (on top of `P2-B2c-picker-style-fix.patch`).

---

# Step 2 (this patch): the measuring tool and the lyrics line

**Status:** the measuring tool is written but **has never been run** (no browser in my environment). Expect that its first run on your machine may need a small fix; send me its output or the error.

## Your question: the lyrics text still gets bigger, is that a problem?
**Yes.** By the B8 rule a state may change colour and brightness, never size, so a line must not grow or wrap when it becomes the playing one. I went through every rule and script that touches a lyric line (`src/css/lyrics.css`, `src/ui-next/views/tools/lyrics.css`, the right panel's lyrics in `right-panel.css`, the engine's `11a` and `08c` code that sets the playing line, and the font-size setter in `01-sizes.js`) and **found nothing that changes the size**: the playing line gets only a colour and an opacity (0.65 to 1), and the hovered line an underline. So I cannot name the cause from the source, and I will not claim a cure I cannot see. What I did:
- **A guard** in `ui-next/views/tools/lyrics.css`: in every line state (plain, playing, past, hovered) font size, weight, letter spacing, transform and zoom are pinned to inherit or none, so no rule, now or later, can change them. It changes nothing visually if nothing was changing them.
- **The measurement** covers this exactly (below). If the text still grows after this patch, the output of `node tools/dev/measure-states.js --only lyrics` will say which line, by how much, and whether it is the box, the number of rows or the font. One thing to know before you run it: when the brightness goes from 0.65 to 1 the same letters can *look* larger, because the browser draws text in a dimmed layer slightly lighter. That is a brightness effect, not a size change, and the measurement will show no movement for it. If that is what you see, tell me and I will change how the playing line is emphasised (for example a left bar or a colour step instead of an opacity jump).

## The measuring tool (`tools/dev/measure-states.js`)
Opens the real new interface in a browser (same fixtures as the other browser tests), puts items into each state and measures box size, number of text rows, place of the first text and font before and after. It lists whatever moved.
- Song list rows: hover, keyboard focus, pressed, selected, playing.
- Library panel rows: the same four without playing.
- Song menu rows: hover, focus.
- Lyrics lines on the View page: each line in turn as the playing one (set the way the engine does it: it adds the classes `synced-active` and `synced-past`), and hover. The test lyrics include long lines that run close to the end of the row, so a change in width shows as an extra row.
- A scenario that cannot run says why and the others go on.
- Run: `node tools/dev/measure-states.js` (add `--write` for `.agent/STATE-SIZE-MEASURED.md`, `--only lyrics` for one scenario, `--strict` to exit 1 when anything moved, which is how it becomes the guard test once the list is empty). Needs Playwright and a browser, like the other browser tests.
- `tools/tests/measure-states.test.js`: 4 unit tests for its comparison and report (no browser). They pass.

## Not covered yet
Queue drawer rows, the right panel's lyrics, Home shelves, settings rows, the dialogs. They are easy to add as scenarios once the first run works.

## Needs the owner
1. Run `node tools/dev/measure-states.js --write` and send me `.agent/STATE-SIZE-MEASURED.md` (or the error). That list is B8's work list.
2. Does the lyrics line still look bigger after this patch? If yes: is it also taller or wrapping to a new row (a size change), or only brighter (see above)?

## Checks
| Step | Result |
|---|---|
| `node --test tools/tests/measure-states.test.js` | 4 pass |
| Syntax check of both tools | clean |
| The measuring tool in a browser | **not run** |
| Browser tests, lint | not run |

## Patch
`P2-B8b-measure-and-lyrics-guard.patch` (on top of `P2-B8a-state-size-scan.patch`).

---

# Step 3: the first measurement, and the right-panel lyrics

**Status:** in review. The tool ran on the owner's machine; I have still not seen the app run.

## What the first run said
- **Library panel rows:** nothing moves (hover, focus, pressed, selected).
- **Lyrics lines, View page:** nothing moves in any state (playing, past, hover): no size, no rows, no font change.
- **Song menu rows:** one hit, "Add to playlist" hover, text lines 1 to 3. **A false reading by the tool**: the row contains the submenu that opens on hover, and its text was counted. The tool now ignores text inside a submenu.
- **Song list rows:** did not run (the list was not in view when the tool looked for it). The tool now opens All songs first and waits for the rows; failures now take seconds and say which item went away.
- The list in `STATE-SIZE-LIST.md` (109 candidates): almost all are panels and popups that show or hide on purpose (`display` on `.active`), the old collapsed-panel layouts of the engine, and the search boxes that open on purpose. The ones that matter for lists are the song number column (`font-size: 0` plus a play mark on hover, focus and selection) and `font-weight: bold` of the playing number while the scrollbar is dragged: the second measurement will say if they move anything.

## The right-panel lyrics: "bigger or bolder when selected"
Neither the View page nor the style rules change a size, so this is not layout. The cause is how the browser draws **dimmed** text: a line with `opacity` below 1 is drawn in its own layer with lighter text smoothing (no ClearType on Windows). The engine dims the lyrics that way (0.65 upcoming, 0.48 past in the View page; 0.6 upcoming and 0.9 on hover in the right panel). When the playing line returns to full opacity the same letters are drawn fuller, so they look bigger and bolder. Fixed in `ui-next/views/tools/lyrics.css`: the lines are now dimmed **by colour** (the same brightness, `color-mix` of the text tokens), opacity is 1 in every state, and the engine's own opacity rules are overridden for both places (the right panel's lines get the same, with sizes pinned as in step 2). Letters now keep the same smoothing in every state. The look of the hierarchy (playing, upcoming, past, hover) stays the same brightness as before.
- Test: `tools/tests/lyrics-no-opacity-dimming.test.js` (3 unit tests) keeps opacity dimming out of the lyric rules.
- The tool has a new scenario **Lyrics lines (right panel)**, and the lyric scenarios now also measure a click (select and seek).

## Needs the owner
1. Apply, then look at the right panel's lyrics while a synced song plays: does the playing line still look bigger or bolder? And the View page?
2. Run `node tools/dev/measure-states.js --write` again and send the output (it now covers the song list and the right panel).

## Checks
| Step | Result |
|---|---|
| `node --test tools/tests/lyrics-no-opacity-dimming.test.js` | 3 pass |
| Unit run compared with before this change | same failures, none new |
| Browser tool, browser tests, lint | **not run here** |

## Patch
`P2-B8c-lyrics-colour-dimming.patch` (on top of `P2-B8b-measure-and-lyrics-guard.patch`).

---

# Step 4: the right-panel lyrics (found), a better measurement, a guard

**Status:** in review. The tool was run by the owner; the fix below is read from the source and not yet seen in the app.

## The right-panel lyrics bug: found
The right panel of the new interface is not the engine's lyrics box: it is `views/playback/right-panel-content.js`, its lines are `.rp-line` and their states are in `views/playback/player-bar.css`. There:
`.rp-line--active { color: var(--text-primary); font-weight: 600; }`
The playing line gets a **heavier weight**. Heavier letters are wider, so the line grows and a line near the edge of the panel wraps onto another row when it starts playing, which is exactly what the owner saw. **Fixed:** the playing line changes colour only (the weight stays). (My earlier opacity change was about the View page and the engine's box, which this panel does not use; it is harmless there and keeps those dim by colour.)

## Why my scanner missed it
It only knew state classes written `.active`, `.selected` and the like, not BEM modifiers like `.rp-line--active`. It now knows `--active`, `--past`, `--on`, `--playing`, `--selected`, `--open` and the rest (114 findings now, `.agent/archive/polish-2/STATE-SIZE-LIST.md`).

## What the second measurement said, and what was wrong with the tool
- Song list row #0 "moved" in all five states with identical numbers (text rows 4 to 3, text x 57 to 133). That is not the row moving: the tool took the first piece of text, and in every state the number is replaced by a play mark, so the "first text" became the title. The box of the row did not change. **The tool now measures each inner element separately** (its place, size, text rows, font) and ignores an element that is not drawn in the other state, so a swap is not reported but a shifted title would be.
- Rows #1 to #5 "went away": playing a song redrew the page and the next rows were gone. The tool now sets the page up again when the rows are missing.
- Right panel lyrics: could not run because I used the wrong selectors (the engine's box). Now it measures `.rp-now__lyrics .rp-line`, putting each line in the playing state the way `right-panel-content.js` does (`rp-line--active`, `rp-line--past`).

## The guard
`tools/tests/states-keep-size.test.js` (2 unit tests): no state rule in `src/ui-next` may change `font-size`, `font-weight`, `letter-spacing` or `line-height`, except the song number cell (`font-size: 0` to show a play mark in a fixed box). It fails on the bug above if it comes back, and it is how B8 stays done.

## Needs the owner
1. Look at the right panel lyrics with a synced song: the playing line should no longer get heavier or wrap.
2. Run `node tools/dev/measure-states.js --write` again and send me the output (song list, library rows, menu, right panel and View page lyrics).

## Checks
| Step | Result |
|---|---|
| `node --test tools/tests/states-keep-size.test.js tools/tests/measure-states.test.js` | 2 + 4 pass |
| Unit run compared with the zip you sent | same failures, none new |
| Browser tool, browser tests, lint | not run here |

## Patch
`P2-B8d-right-panel-lyrics-and-guard.patch`, made against `Source-backup (15)`.
