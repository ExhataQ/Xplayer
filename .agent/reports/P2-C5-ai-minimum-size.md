# Report: C5 AI view keeps a minimum size (first part)

**Task:** C5 (POLISH-PLAN.md) | **Agent:** C | **Date:** 2026-11-07 | **Status:** In review (needs a look in the running app). The ratings part is not done: it needs B3.

## Summary
The AI chat now has a minimum conversation height (160 px) and scrolls inside itself when the window is too short for everything. Before, at the smallest window the "Set up AI first" card squeezed the conversation to a 26 px sliver and pushed the box to type in below the player bar, out of reach.

## Findings
- **Reproduced.** The main window cannot be smaller than 800 by 600, and at that size with AI ready the chat is fine (conversation 228 px). It breaks when "Set up AI first" is showing (no key, or AI turned off): the card is 230 to 251 px tall, the conversation shrinks to 26 px and the box ends 37 px below the chat. The same happens in the pop-up at 800 by 600 and in the chat's own window at 380 by 480 and 560 by 480 (that window may be smaller than the main one: minimum 380 by 480). *reproduced* (headless Chromium, measured and screenshotted before and after)
- Cause: the conversation is the only part that may shrink (`flex: 1; min-height: 0`), so it gives up all its height, and the chat itself did not scroll.
- With AI ready nothing changes at any size I tried (800 by 600 view, pop-up, the AI window at 380 by 480). *reproduced*

## How it works
`views/ai/ai.css`: the chat scrolls vertically (`overflow-y: auto`, `overscroll-behavior: contain`), nothing in it shrinks, and the conversation has `flex: 1 0 160px` (it still grows to take free room). When everything fits there is no scroll bar. When it does not, the card with **Open Settings** stays in view at the top and the rest is reached by scrolling the chat. The same rule covers the big view, the pop-up and the chat's own window (one class).

## Changed files
| File | Change |
|---|---|
| `src/ui-next/views/ai/ai.css` | The scroll and minimum height rules. |
| `tools/tests/ui-next-ai-minimum-size.test.js` | New: 1 static + 10 browser tests (3 shapes x ready / no key / off, plus room to spare). Seven of them fail without the fix. |
| `.agent/POLISH-PLAN.md` | Status table. |

## Decisions made or needed
1. **While AI is not set up, the empty conversation, the (disabled) ready-made messages and the (disabled) box still show under the card**, as before; at small sizes you scroll past them. I kept the design and only made it hold together. Hiding them until AI is set up would be a small follow-up if you prefer it.
2. **The AI reading ratings** is not done: the plan says it needs B3. I will not touch it before B3 exists.

## Checks
| Command or step | Result |
|---|---|
| `node tools/tests/run.js ui-next-ai-minimum-size` | 11 of 11 pass; against the version without the fix 7 fail (all the "no key / turned off" cases and the static rule) |
| `ui-next-ai ui-next-ai-static ui-next-ai-quickrow ui-next-ai-apply ui-next-appearance` | the same failures as before my change (8), subtest by subtest; 11 more pass |
| A first version used a new custom property, which the "every var() is a token" test in `ui-next-ai-static` rejected; it now uses the plain value | fixed |
| Screenshots before and after (view, no key, 800 by 600) | looked at |

## Not run
- **ESLint**: not installed.
- **Real Electron**, and Windows display scaling (125 or 150 percent makes the window "shorter" in CSS pixels; the 160 px minimum and the inner scroll are what protect that case, but I did not run it).
- **Light theme**.

## Environment
Linux sandbox, Node v22, Playwright with its bundled Chromium. No network, no ESLint.

## Manual checklist for the owner
1. Turn AI off (or remove the key). Open the AI chat in the big view and make the window as small as it goes. **Expected:** the "Set up AI first" card and **Open Settings** are fully visible; the conversation panel below it is a normal box, not a sliver; the rest can be reached by scrolling inside the chat.
2. Click **Open Settings**. **Expected:** the AI settings open.
3. Set AI up (key, privacy) and return to the chat at the same size. **Expected:** no card, and everything fits without a scroll bar, as before.
4. Repeat 1 in the pop-up and in the chat's own window made small (Pop out, then shrink).
5. With a long conversation at the smallest window. **Expected:** the conversation scrolls inside its box; the box to type in stays in view.
