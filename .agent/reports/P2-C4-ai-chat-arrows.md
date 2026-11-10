# Report: C4 AI chat arrows

**Task:** C4 (POLISH-PLAN.md) | **Agent:** C | **Date:** 2026-11-07 | **Status:** In review (needs a look in the running app)

## Summary
The ready-made messages above the AI chat box ("Translate the song playing", "Tell me about this song", ...) now have **arrows** to move sideways, like the filter chips in the left panel. It is the same component, not a copy: an arrow appears on each side that has more messages, the row fades under it, the wheel moves it, and dragging still works.

## Findings
- The row already scrolled by wheel and by dragging but had no arrows and drew its own fade. The left panel's filter chips use `chipStrip()` (`views/library/chip-strip.js`), which has exactly the arrows, the fade and the wheel the plan asks for. *read*
- Used as it is, `chipStrip` and the old drag helper would both handle the wheel and move the row twice per turn, so the drag helper got a `wheel: false` option. *reproduced in the design, covered by a test*
- In the chat window the row is 1116 px of buttons in a 394 px box, so the arrows show there from the start (forward only). *measured*

## How it works
- `views/ai/ai-chat.js`: `chipStrip(prompts, { label: 'ready-made messages' })` wraps the row; the strip goes into the chat where the row was. `sidewaysScroll(strip.row, { wheel: false })` keeps the drag (a drag is still not a click).
- `views/ai/sideways-scroll.js`: the `wheel` option (default on, so nothing else changes).
- `views/ai/ai.css`: the row only lays its buttons out in one line; the old fade rules are gone (the strip draws the fade, with the same tokens as the left panel). The arrows' look comes from `library-panel.css`, unchanged.
- The arrows are named "Scroll ready-made messages back" and "... forward", are real buttons, and hide when everything fits or when that side has nothing more.

## Changed files
| File | Change |
|---|---|
| `src/ui-next/views/ai/ai-chat.js` | The row goes through `chipStrip`. |
| `src/ui-next/views/ai/sideways-scroll.js` | `wheel` option. |
| `src/ui-next/views/ai/ai.css` | Strip layout, drag cursor; old fade rules removed. |
| `tools/tests/ui-next-ai-quickrow.test.js` | New: 1 static + 4 browser tests. |
| `tools/tests/ui-next-ai-static.test.js` | The line that named the old call now names the strip. |
| `.agent/POLISH-PLAN.md` | Status table. |

## Decisions made or needed
1. "Messages" is read as the ready-made messages row. If you meant arrows to jump between the messages in the conversation itself, tell me and I will add those too.

## Checks
| Command or step | Result |
|---|---|
| `node tools/tests/run.js ui-next-ai-quickrow` | 5 of 5 pass (arrows only on the side with more, they page to both ends; no arrows when all fit; one wheel turn moves the row once; a drag moves it and does not press a button; keyboard on an arrow) |
| `ui-next-ai-static` | all pass |
| `ui-next-ai ui-next-ai-static ui-next-ai-apply ui-next-library ui-next-components` | 142 pass, 12 fail: the same 12 as the unmodified backup (subtest by subtest) |
| Screenshots of the chat window at the start and after pressing forward | looked at |

## Not run
- **ESLint**: not installed.
- **Real Electron** and the separate AI window (it is the same page and styles; I tested the pop-up).
- **Light theme**: the arrows and fade use the same tokens as the left panel, which was checked in C9; I did not look at this row in Light.

## Environment
Linux sandbox, Node v22, Playwright with its bundled Chromium. No network, no ESLint.

## Manual checklist for the owner
1. Open the AI chat. **Expected:** under the conversation, the ready-made messages in one line; the right side fades and a **>** arrow shows; no arrow on the left.
2. Click **>** a few times. **Expected:** the row moves by about its width each time; a **<** arrow appears on the left; at the end the **>** disappears.
3. Turn the mouse wheel over the row, and drag it with the mouse. **Expected:** it moves sideways once per turn; a drag does not send a message.
4. Press a message after moving the row. **Expected:** it is sent as before.
5. Make the chat wide enough for all messages (big view, wide window). **Expected:** no arrows.
6. Turn on Reduce animations (Settings > Appearance), click the arrows. **Expected:** the row jumps instead of gliding.
