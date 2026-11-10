# Manual checks, one place (Agent C and the real-app tools)

Everything the sandbox tests could not see, in the order of the plan. Tick each box in the running app (a packaged build, or `npm start`) and write what looked wrong next to it. Send the notes back; each line says what to expect.

## Before you start

1. Everything of Agent C up to C-9 is in this version. This patch (C-10) adds the memory read-out, the recording and this sheet.
2. **Start with the recorder on** so the numbers collect while you test: set `XPLAYER_PERF=1` before starting (in `Start-Xplayer.bat`: `set XPLAYER_PERF=1`), or start it later with the button in Settings > About > **Memory recording**. It adds one line every 30 seconds to `logs/perf.csv` in the data folder: memory per part of the app, CPU, DOM size, and the name of the open view. Numbers only; nothing leaves the computer.
3. Write the machine line: Windows version, RAM, display scale, library size, SSD or hard disk.

## While you work (X2: the recording)

- [ ] Settings > About > **Memory recording** shows **Start recording** at each start of the app (it is off by default). Press it: the button reads **Stop recording**.
- [ ] After a minute, open the data folder (About > Open data folder) > `logs` > `perf.csv`. **Expected:** a header and a line about every 30 seconds, with plain numbers and a view name such as `library` or `settings`; no song names or paths.
- [ ] Use the app normally for as long as you like: browse, play, open the AI, the queue, lyrics, Settings.
- [ ] Press **Copy summary** and paste it. **Expected:** the number of samples and the length, total memory first, last and highest, the change per hour, CPU, DOM nodes, the share of time playing, and the views seen.
- [ ] Press **Stop recording**. **Expected:** no new line is added afterwards.
- [ ] A rise of memory per hour that does not stop after the first 10 to 15 minutes is a leak: send the summary and `perf.csv`.

## C1 to C3: Play from URL and "Open file location"

- [ ] Copy a link to an audio file, open **Play from URL**. **Expected:** the field holds the link, selected; after a moment a line shows name, size and type.
- [ ] Copy ordinary text, open it again. **Expected:** the field is empty and nothing is requested.
- [ ] Type a link. **Expected:** the line appears after you stop typing, and disappears when you clear the box.
- [ ] Use a link whose server refuses HEAD. **Expected:** no line, everything else works.
- [ ] **Download & Stream** a file. **Expected:** a "Saved: ..." popup and a bell entry, both with **Open file location**; clicking it opens Explorer with the file selected.
- [ ] **Stream Only**. **Expected:** "Streaming: ..." with no such button.

Report: `.agent/reports/P2-C1-C3-play-from-url.md`. Seen OK: [ ]   Notes: 

## C4: AI chat arrows

- [ ] Open the AI chat. **Expected:** under the conversation, the ready-made messages in one line; the right side fades and a **>** arrow shows; no arrow on the left.
- [ ] Click **>** a few times. **Expected:** the row moves by about its width each time; a **<** arrow appears on the left; at the end the **>** disappears.
- [ ] Turn the mouse wheel over the row, and drag it with the mouse. **Expected:** it moves sideways once per turn; a drag does not send a message.
- [ ] Press a message after moving the row. **Expected:** it is sent as before.
- [ ] Make the chat wide enough for all messages (big view, wide window). **Expected:** no arrows.
- [ ] Turn on Reduce animations (Settings > Appearance), click the arrows. **Expected:** the row jumps instead of gliding.

Report: `.agent/reports/P2-C4-ai-chat-arrows.md`. Seen OK: [ ]   Notes: 

## C5: AI view minimum size

- [ ] Turn AI off (or remove the key). Open the AI chat in the big view and make the window as small as it goes. **Expected:** the "Set up AI first" card and **Open Settings** are fully visible; the conversation panel below it is a normal box, not a sliver; the rest can be reached by scrolling inside the chat.
- [ ] Click **Open Settings**. **Expected:** the AI settings open.
- [ ] Set AI up (key, privacy) and return to the chat at the same size. **Expected:** no card, and everything fits without a scroll bar, as before.
- [ ] Repeat 1 in the pop-up and in the chat's own window made small (Pop out, then shrink).
- [ ] With a long conversation at the smallest window. **Expected:** the conversation scrolls inside its box; the box to type in stays in view.

Report: `.agent/reports/P2-C5-ai-minimum-size.md`. Seen OK: [ ]   Notes: 

## C6: LRCLIB button in Find

- [ ] Lyrics > Find. **Expected:** a **LRCLIB website** button beside "Search many songs".
- [ ] Click it. **Expected:** your normal browser opens lrclib.net; the app stays on the Find page and no window of the app opens.
- [ ] Turn the internet off or change your default browser to nothing, click again. **Expected:** the browser may open an error page itself; if Windows cannot open anything, the app shows "Could not open the browser".

Report: `.agent/reports/P2-C6-lrclib-button.md`. Seen OK: [ ]   Notes: 

## C7: Reduce animations

- [ ] Start the app (`npm start`), open Settings > General > Appearance. **Expected:** a "Reduce animations" row with On / Off. It matches Windows: with "Show animations in Windows" off, it reads On.
- [ ] Turn it **On**. Hover the title-bar link button and the rail icons. **Expected:** nothing moves; clicking Settings or Lyrics in the rail does not play the icon animation; panels and menus appear without a fade.
- [ ] Turn the cat scrollbar on (Settings > The cat) with Reduce animations On. **Expected:** the cat stays but its tail, blinking and walking stop; scrolling a long list does not walk it.
- [ ] Turn it **Off** while Windows has animations off. **Expected:** motion comes back at once, without a restart.
- [ ] Close and reopen the app. **Expected:** the choice stays and there is no flash of motion at start-up.
- [ ] Change the Windows setting while the app is open, before ever choosing in the app. **Expected:** the row and the motion follow it within a moment.

Report: `.agent/reports/P2-C7-reduce-animations.md`. Seen OK: [ ]   Notes: 

## C8: Panel motion (opening animates, closing does not)

- [ ] Click the left panel button in the title bar. **Expected:** the panel is gone at once and the view does not move. Click again: the panel slides in from the left and the view settles a few pixels.
- [ ] Same with the right panel (slides in from the right) and with the queue button (rises from the player; closes at once).
- [ ] Start the app. **Expected:** nothing slides at start-up.
- [ ] Shrink the window until a panel steps aside. **Expected:** no slide, as before.
- [ ] Turn on Reduce animations. **Expected:** every panel opens and closes at once with no movement, and none of the other motions below happen.
- [ ] Press play and pause. **Expected:** the icon swaps with a short grow-and-fade.
- [ ] Add a song to a playlist from the song menu or by dropping it on the playlist. **Expected:** that playlist's row in the left panel pulses once. Remove a song: no pulse.
- [ ] Drag a song over a playlist and drop. **Expected:** the playlist row settles. While dragging, rows that cannot take it fade to dim instead of snapping.
- [ ] Open a menu, a context menu and a dialog (Play from URL). **Expected:** each rises a few pixels as it fades in.

Report: `.agent/reports/P2-C8-panel-motion.md`. Seen OK: [ ]   Notes: 

## C9: Themes (Dark, Light, files)

- [ ] Settings > General > Appearance. **Expected:** two cards, Dark and Light; under "More themes" the other 11 themes and Custom; exactly one card ticked.
- [ ] Click **Light**. **Expected:** the whole app turns light at once (rail, panels, lists, player bar, menus); text readable everywhere; scrollbars light. Open a menu, a dialog, the notification center and the queue: shadows soft, no dirty dark smudges.
- [ ] Restart the app. **Expected:** it opens light, with no dark flash.
- [ ] In the builder, choose **Start from… > Light**. **Expected:** the four colors become light ones; changing the accent updates the app live; the app stays in Light mode.
- [ ] Click **Save as file**, name it, choose where to keep it. **Expected:** Windows asks where to save; the file is named like `my-paper.xplayer-theme.json`.
- [ ] Click **Load from file** and pick that file. **Expected:** the theme appears under "Your saved themes" as "my paper (2)" (the name was taken) and is applied.
- [ ] Load a file that is not a theme (any `.json` or `.txt`). **Expected:** a message says why and ends "Nothing was changed."; the look and your saved themes stay as they were.
- [ ] Switch to Dark. **Expected:** the original look, unchanged.

Report: `.agent/reports/P2-C9-themes.md`. Seen OK: [ ]   Notes: 

## X1: Memory read-out in Copy diagnostics

- [ ] Start the app, wait until the song list shows. Settings > About > **Copy diagnostics**, paste into a text file. **Expected:** the new "Memory" and "Data on disk" blocks, between the data folder line and the log lines, with one row per process.
- [ ] Open the AI window or a popup and copy again. **Expected:** one more `Page ...` row; close it and copy again: the row is gone (a row that stays means the window is kept in memory).
- [ ] Check the text for your song names or folder paths. **Expected:** none.
- [ ] Do the moments M0 to M3 of the plan and paste each text.

Report: `.agent/reports/P2-X1-memory-readout.md`. Seen OK: [ ]   Notes: 

## What to send back

1. The notes from the boxes above that did not match.
2. The machine line.
3. The summary from **Copy summary**, and `logs/perf.csv` if the memory kept rising.
4. Three **Copy diagnostics** texts: just after start, after the first scroll through the whole list, and after a long session.
