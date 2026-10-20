> Input to `PLAN.md`. Where the plan or board differs (decision numbers DP1 to DP10, agent split, task ids), the plan and board win. Round 2 of the owner's notes is in sections 14 to 20.

# Polish phase 1: brief

This is the owner's brainstorm, rewritten for grammar and clarity. Nothing was dropped and nothing was decided on the owner's behalf.

- These notes were written after Phase 2 ended, so some items may already be fixed. Items tagged **(verify first)** are the likely ones. Check them before building anything.
- "Past UI" and "old UI" mean the earlier UI. Use it as a reference for ideas. Where an item below says "port" (section 14, item 1), bring the working approach over and improve it. Do not paste code that does not fit the new architecture.
- Items tagged **(investigate)** are questions to answer, with a recommendation, before any building starts.
- Items tagged **(unclear)** need the owner to confirm the wording.
- **Round 2:** the owner added 20 more items. Sections 1 to 13 are the original brief with a few inline updates marked "Update (round 2)". Sections 14 to 19 are the new items, grouped by area. Each new item keeps its original number from the owner's list in brackets, like [#7].

---

## 1. Tooltips

1. Change how tooltips load. The dynamic hover between buttons is good, so keep it, but shorten the delay after hovering. Aim for something like Discord's tooltip.
2. Add a short flash to the tooltip box when it appears. Use Discord as the reference, but make it something new, not a copy.
3. Style the hotkey text in the tooltip like keyboard keys.
4. Reduce the spacing between the label and the hotkey, and make the box smaller overall. It should not become tiny. It should still read as a proper tooltip.
5. Remove the tooltips from the Windows window buttons.

## 2. Left panel and top bar structure

1. Merge the fixed left rail with the top bar, so they read as one unified top-to-left bar without borders.
2. **(investigate)** Use the same color for the fixed rail and the dynamic panel. If the top bar and the rail share one color, the main view and the right panel need different colors from it.
3. Separate the Home icon from the others with a border, more spacing, or a different color. It should not look special, but it should still have contrast.
4. Redesign the Library icon. Give the bars that represent books more depth.
5. Add small, cycling animations to all the icons.
6. The colored bar on the rail that marks the active page should animate in, and should be somewhat taller (not by much).
7. Home uses a filling animation when it becomes active.
8. Because Home, Metadata and Lyrics open in the main view, their icons should change while they are active (like Home filling up). The other icons only need small changes.

## 3. Left panel behavior

**Model.** The fixed rail represents what is in the dynamic panel. Home and Settings are the exceptions. Pressing Library, Search or Recents opens that content in the dynamic panel. The current behavior feels odd and the owner is unsure how it works.

| Rail item | Dynamic panel shows |
|---|---|
| Library | Playlists |
| Search | Search results for songs and playlists |
| Recents | Playlists played recently. Expanding one shows the songs played and when |

1. Metadata and Lyrics move above Settings in the rail. They are tools, and they open in the main view.
2. Home has its own view in the main view. All other items use the dynamic panel. This allows Home and one other view to be open at the same time. Use visual contrast to show which is which.
3. Add a button that moves search results, or recently played playlists, from the panel to the main view.
4. The collapsed version is only available for Library. Remove collapsing from the other views, and review every condition that depended on it. *Update (round 2): the collapsed state is also broken today. See 17.5.*
5. Clicking the active rail item closes its panel completely.
6. Make the panel lists bigger: larger covers in the main list and a wider left panel. Attach the panel's scroll bar to its right wall and make it wider.
7. Dragging items near the queue opens the queue automatically, so items can be dropped into it.
8. The list filters (A to Z, Recents) need animation.

## 4. Tools: Lyrics and Metadata

1. In the rail, Lyrics should open the actual Sync tool, not the general lyrics page. Design (or find) a good "edit and make LRC" icon for it. *Update (round 2): the icon is a simple waveform. See 15.1.*
2. Alternative to consider: show big boxes in the main view for the lyrics tools: Sync, Write, Find, and Multi-song search.
3. Redesign the metadata editor so the layout is logical. *Update (round 2): see section 16, which expands this.*
4. Find lyrics: rename "Find lyrics & LRC" to a name. When searching, leave the album field blank on purpose.
5. Write tab: add an option to add lyrics or LRC from a paste, in case someone copied them.
6. Keep the song finder's state when the person leaves that view. Currently it resets.

## 5. Player layout and cover art

The owner wants a large cover on screen without replacing the lyrics in the right panel. **(investigate)** Compare these cases and predict how each would change the rest of the design.

1. Keep the left player section. Show the cover, with some track info, at the top right or bottom right. Lyrics fill the rest of the right side. Open question: what is shown if the person does not want lyrics? Possibly basic track info and what plays next. This is closest to the current design and to Spotify's layout, which the owner dislikes as a "part".
2. Remove the left player section and show a big cover at the bottom left. The owner sees good potential here.
3. Rework the player bar. Instead of filling the bottom, it sticks to the bottom with rounded corners and is not attached to the walls. It could even float freely, and because it is lower in height, it could float over the right or left side. This changes the whole design. Investigate it thoroughly and predict how the other views would change.
4. No permanent big cover at all.

Also rework the player section in general. *Update (round 2): big picture mode should use the old UI's design. See 15.2. The investigation must account for it.*

## 6. Progress bar, volume and waveform

1. **(verify first)** The waveform takes a while to appear after a song starts playing.
2. The waveform bars sit near maximum height for most music, which looks wrong. Fix the scaling. Update the bar design too: smaller bars, and fix the contrast.
3. Add a setting to turn the audio waveform on or off. The default is off.
4. The volume bar thumb (and maybe the progress bar thumb) disappears when it reaches zero. It should not.
5. Fix the highlighting problems when changing the progress and volume bars, and when dragging, resizing or scrolling. Look at the past UI for help. Also make some elements not selectable.

## 7. Lists

1. The column-resize line in the track list should be white.
2. Add list ordering from the track list: by album (A to Z), by title (A to Z), and by time (top to bottom or reversed).
3. Make the virtual search results display better. Also highlight the original release.
4. Add a context menu or floating menu for shuffle mode, create folder, and playlists. *Update (round 2): folder and playlist creation is missing from the new app. See 17.4.*
5. Add simple, creative static icons to the context menu.
6. Default SVG cover: use the one from the past UI, and improve it if wanted.

## 8. Bugs

1. **(verify first)** Select, scroll and hover break again in virtual rendering on lists. *Update (round 2): this is now a full investigation. See 14.1.*
2. Unnecessary updates when changing a single item inside a list.
3. No border while moving pinned items, and some other related bugs.
4. Mouse back and forward buttons do not change views correctly.

## 9. Notifications

1. The first notification that arrives should open the notification center automatically. Not every notification, only important ones.
2. Some notifications should be clickable and take the person there. Examples: "LRC found" or "scan completed" opens the lyrics view of that song, the Find lyrics page, or the main list. A playlist-created notification opens that playlist.
3. Some notifications should appear in both places (popup and center), such as small errors or moved songs.
4. Animate the notification button when a new notification arrives and on hover.
5. Separate the window buttons from the notification button.
6. Add a little more space below the popup notifications when hovering.

## 10. Top bar, logo and window

1. Add "Play from URL" to the top bar, with an animation.
2. Make the X logo more creative. Keep the color and the primary style, but try different curves, lines and thicknesses. Use logical sources. Animate it on hover. **Update (round 2): on hold. Keep the current X logo for now. See 18.1.**
3. Design an X logo for the Windows icon, for a future installer `.exe`. *Update (round 2): use the current logo.*
4. **(unclear)** "Subhero design (creative)": confirm what this means.

## 11. Settings

1. New settings layout with a menu bar (a floating bar in the center).
2. Move every setting to its proper place in the new layout.
3. Add a hotkeys page to the application menu.
4. Add a custom scroll bar with theme colors. Include the default theme. Use the past UI as a reference.

## 12. Themes

Suggest more themes and gradients to make the app look modern.

## 13. Hotkeys

Included under Settings (item 3 above).

---

# Round 2 additions

## 14. Lists: rendering, interaction and text

1. **(investigate, then port)** [#1] Virtual loading, the link between scrolling and hovering, placeholders, and hover and selection styling while scrolling all have problems in the new UI. The old UI's systems worked. Find how the old UI did each of these, apply the same approach to the new UI, and improve it where possible. This replaces and widens bug 8.1. The investigation should answer, per system:
   - How rows are windowed and recycled while scrolling, and what the placeholders show.
   - What stops hover and selection styles from flickering or sticking during a scroll (for example, pausing hover while scrolling and recomputing it when scrolling stops).
   - Why the new UI differs, and the smallest change that restores the old behavior.
2. [#7] When list text is right-to-left, it jumps to the right side of the row. It should stay on the left. Text direction can still be handled per string, but the row alignment stays left.
3. [#8] The selection circle (the focus indicator) pops up on the last focused item when the person presses Space. It should not. Keep it for Tab. So Space should not make the indicator appear, while Tab navigation keeps its visible focus. Check how Space is used elsewhere (it is probably also the play/pause hotkey) so the two do not collide.

## 15. Player, lyrics and big picture

1. [#12] Sync tool logo: a simple waveform. This settles the Sync icon in 4.1.
2. [#6] Big picture mode uses the old UI's design. Feed this into the cover layout investigation (section 5), because the chosen layout decides how big picture mode is entered and exited.
3. [#20, lyrics half] Add a notification for the multi lyrics finder: started, progress, finished (with counts of found, not found and failed). Clicking it opens the results. Follows the rules in section 9.

## 16. Metadata

Everything here belongs to one agent that works only on metadata (Agent D).

1. [#9] Change the design of the metadata editor. This is the same work as 4.3. One redesign, not two.
2. [#10] Add a multi metadata editor: choose multiple songs, then apply tags, genres, artists and so on to all of them. Fields that differ between the songs should show as "mixed" and stay untouched unless the person edits them.
3. [#10] **Python problem.** Writing tags to audio files normally needs a tag library, and the common one is a Python library (mutagen). The owner does not have Python, so the owner cannot work on that part. Solution: do not use Python at all. Use a library in the app's own language, and confirm the app's stack first, because the right choice depends on it. Suggested options, in order of preference:
   - **Electron or Node:** a Node tag library that reads and writes the common formats (for example `node-taglib-sharp`, with `music-metadata` as a read-only fallback). Verify format coverage and maintenance status before choosing.
   - **Tauri or Rust:** the `lofty` crate, which reads and writes tags for the common formats from Rust.
   - **Fallback if no native library fits:** ship a prebuilt helper executable built once by someone else (or by CI) and call it from the app. The owner then never needs Python installed. This is the last option, because it adds a bundled binary to maintain.
   - Whichever is chosen, write a thin "tag service" interface (`read`, `write`, `writeMany`) so the library can be swapped later without touching the UI.
4. [#11] Automatically find the original release, or the most popular release, of a song and apply its metadata. Many songs have lots of releases (singles, compilations, deluxe editions, live versions), so the rules matter:
   - **Sources to evaluate (investigate):** MusicBrainz for release and release-group data (needs a descriptive User-Agent and respect for its rate limit, which is about one request per second), Cover Art Archive for covers, AcoustID/Chromaprint if matching by audio fingerprint is wanted, and Deezer or iTunes search for popularity hints. Verify current terms and limits before building.
   - **"Original release" rule (proposal):** prefer the earliest official album release. Skip compilations, live and remix releases unless the file itself is one.
   - **"Most popular release" rule (proposal):** use a popularity signal from one of the sources above, and fall back to the original-release rule.
   - **Safety:** show a confidence score, apply automatically only above a threshold, queue the rest for review, and always support undo (see 19.1).
   - The setting should let the person choose "original" or "most popular".
5. [#20, metadata half] Add a notification for the multi metadata tag finder, with the same states and click behavior as the lyrics one (15.3).

## 17. Library, folders and playlists

1. [#1] See 14.1 (virtual rendering). Agent B owns it.
2. [#7] See 14.2 (right-to-left alignment).
3. [#8] See 14.3 (Space selection circle).
4. [#4] Add folder and playlist creation. It is not visible in the new app. It should be reachable from the context menu (7.4), from the Library panel header, and from the application menu (18.2). The AI organizer (19.2) will create folders and playlists through the same functions, so build them as plain functions the UI and the AI both call.
5. [#19] Fix the collapsed state. It is Library only (3.4). **(unclear)** The owner has not said what is broken. The first step is to reproduce and list the broken cases (width, hover, scroll bar, click to open or close, interaction with the panel closing in 3.5), then fix them.

## 18. Shell, menus and home

1. [#3] Keep the X logo for now. Item 10.2 is on hold. The hover animation can wait. The installer icon (10.3) uses the current logo.
2. [#2] Complete the application menu with the standard set, and give every item its hotkey. Proposed structure (confirm with the owner):
   - **File:** Open file, Open folder, Play from URL, New playlist, New folder, Import and export, Exit.
   - **Edit:** Undo, Redo, Select all, Find.
   - **View:** Home, Library, Search, Recents, Queue, Big picture mode, Zoom, Full screen.
   - **Playback:** Play and pause, Next, Previous, Shuffle, Repeat, Volume, AI shuffle.
   - **Tools:** Lyrics (Sync, Write, Find, Multi search), Metadata, Multi metadata editor, AI chat.
   - **Window:** Minimize, Maximize, Always on top.
   - **Help:** Hotkeys, About, Check for updates, Open logs.
3. [#5] Add a new home page. **(unclear)** What goes on it is not decided. Candidates: continue listening, recently played playlists, newly added songs, quick actions (create playlist, play from URL, open the AI chat), library stats. Decision D-P5 covers this. It uses Home's own main view from 3.2.
4. [#16, top bar part] Add the main chatbot icon to the top bar, next to the notification button. See 19.5.

## 19. AI

One agent works only on connecting AI to the app (Agent E).

1. [#17] **Undo.** Add undo for the AI abilities below, and for batch metadata changes (16.4) and the library reorganization. Design:
   - Every AI or batch action is recorded as one journal entry holding what it changed and the previous values (old tags, old folder and playlist layout, original lyrics).
   - Undo restores from the journal. Journal entries are saved to disk so undo survives a restart, with a cap on how many are kept.
   - A finished action sends a notification (section 9) with an Undo button.
   - Undo applies to actions that change data. A web search or a chat reply has nothing to undo.
2. [#13, #14] **Provider.** For now, add OpenRouter only. Investigate and answer:
   - Free chatbots: OpenRouter lists some free models with usage limits. Confirm what is free today, the rate limits, and what happens when they run out. The person supplies their own OpenRouter key, stored securely, never in the repo.
   - Using free chatbots through their web pages (scraping or driving a browser) is fragile and likely against their terms. The recommendation is not to do this. Use the API.
   - **Prompt, then act:** the owner's idea is to prompt the chatbot so its reply becomes something the app executes. Do it with a fixed list of allowed actions. The model replies with structured data (for example JSON naming an action and its arguments), the app validates it against a schema, shows a preview, then runs it. The app never runs code the model writes. This is safer and makes undo possible, because each action is known in advance.
   - Free models vary in how well they follow structured output. The investigation should test a couple, and the app should retry or show an error when a reply does not validate.
   - Keep the provider behind an interface so other providers can be added later.
3. [#15] **First abilities.** The AI can:
   - **Reorganize the library:** create folders and playlists and move songs, based on an explanation the person writes. Always show a preview of the plan before applying.
   - **Translate lyrics:** produce a translation next to the original, and keep timing for LRC lyrics.
   - **Search the web** to support AI shuffle and metadata editing. **(investigate)** How web search is provided (OpenRouter offers a web option, which must be verified) and what song data is sent out.
   - **AI shuffle:** build a play order from a description (mood, era, similar to a song).
   - **Metadata editing:** suggest or fill tags, hooked into Agent D's tag service rather than a second writer.
4. **Privacy.** Decide and show what leaves the device (song titles, artists, lyrics, file paths). Send the minimum needed. Show it in the settings and in the first-use screen. Decision D-P6.
5. [#16] **Chat UI.**
   - The main chatbot icon sits in the top bar next to the notification button.
   - Chat can start a download from the web. **(unclear)** The owner has not said what to download, from which sources, or how it relates to Play from URL (10.1). Confirm before building, including which sources are acceptable.
   - Add contextual AI buttons through the app so specific things are one click: translate on the lyrics view, "fill tags" in the metadata editor, "organize" in the Library panel, "AI shuffle" in the player. Each opens the chat with the right context, or runs the action with a preview.
6. [#14] The AI settings page (provider, key, model, privacy) goes into the new settings layout owned by Agent A.

## 20. Old UI audit

[#18] Investigate things that were fixed in the old UI but not in the new one. Each agent audits its own area against the old UI and lists differences. The list goes into that agent's investigation, with a fix or a reason to skip. Agent B also owns the shared list rendering audit (14.1).

---

# Phase plan: Polish 1, five agents

*This replaces the earlier four-agent plan. The owner asked for one agent only on metadata and one only on AI, so the original Agent D (tools, notifications, settings, themes) was split up and its work moved to A and C.*

Investigations come first, because their answers change the layout work. Agents A and B should not start building the rail and panel until decisions D-P1 and D-P2 are made.

## Decisions needed from the owner

| ID | Question | Why it blocks |
|---|---|---|
| D-P1 | Same color for top bar, rail and panel, with the main view and right panel different? | Sets every surface color. |
| D-P2 | Home as main view plus one panel at the same time: which wins when a tool (Lyrics, Metadata) is also a main view? | Defines the rail's states. |
| D-P3 | Which cover layout (cases 1 to 4), given that big picture mode uses the old design? | Decides the player and the right panel. |
| D-P4 | What does "subhero design" mean? | Not buildable as written. |
| D-P5 | What goes on the new home page (18.3)? | Home page content and layout. |
| D-P6 | What data may the AI send out, and is the person's own OpenRouter key acceptable? | Defines the AI settings and privacy screens. |
| D-P7 | What is the app's stack (Electron, Tauri or other)? | Picks the tag library (16.3). Agent D can answer this from the code. |
| D-P8 | What is broken in the collapsed state (17.5), and what does "download from web to chat" mean (19.5)? | Both are not buildable as written. |

## Agent board

Status for every task starts as **Todo**. Update the column as work moves: Todo, Investigating, Building, Review, Done.

### Agent A: Shell, chrome, settings and themes (heaviest load)

| ID | Task | Refs | Tag | Status |
|---|---|---|---|---|
| A1 | Investigation: unified color for top bar, rail and panel | 2.2 | investigate | Todo |
| A2 | Tooltips: delay, flash, key-style hotkeys, spacing, none on window buttons | 1.1 to 1.5 | | Todo |
| A3 | Merge top bar and rail, Home separation, Library icon, icon animations, active bar, Home fill, tool icon states | 2.1 to 2.8 | | Todo |
| A4 | Separate window buttons from notification button | 9.5 | | Todo |
| A5 | Notification behavior: auto-open, clickable, both places, animation, hover space | 9.1 to 9.4, 9.6 | | Todo |
| A6 | Notification API that other agents use (types, click target, undo button, progress) | 15.3, 16.5, 19.1 | | Todo |
| A7 | Play from URL in the top bar, with animation | 10.1 | | Todo |
| A8 | Complete the application menu with hotkeys | 18.2 | | Todo |
| A9 | New home page | 18.3 | blocked by D-P5 | Todo |
| A10 | Custom scroll bar with theme colors | 11.4 | | Todo |
| A11 | New settings layout, move all settings, hotkeys page, host page for AI settings | 11, 13, 19.6 | | Todo |
| A12 | Keep the current X logo, installer icon from it | 18.1, 10.3 | | Todo |
| A13 | Themes and gradients (last) | 12 | after new surfaces exist | Todo |
| A14 | Old UI audit for shell and chrome | 20 | investigate | Todo |

*If A becomes the bottleneck, the first things to hand off are A9 (home page, to Agent B) and A11 (settings, to Agent C).*

### Agent B: Library and lists

| ID | Task | Refs | Tag | Status |
|---|---|---|---|---|
| B1 | Investigation: old UI virtual rendering, scroll and hover, placeholders, hover and selection styles. Then port and improve | 14.1, 8.1 | investigate, verify first | Todo |
| B2 | Panel model: Library, Search, Recents in the dynamic panel, move-to-main-view button | 3 | blocked by D-P1, D-P2 | Todo |
| B3 | Collapsed mode for Library only, click-active-to-close, review old conditions | 3.4, 3.5 | | Todo |
| B4 | Fix the collapsed state | 17.5 | unclear, blocked by D-P8 | Todo |
| B5 | Wider panel, bigger covers, scroll bar on the right wall, filter animation, drag-to-queue auto-open | 3.6 to 3.8 | | Todo |
| B6 | Folder and playlist creation as shared functions, plus the context menu and panel entry points | 17.4, 7.4 | | Todo |
| B7 | Context menu icons, floating menu, default cover | 7.4 to 7.6 | | Todo |
| B8 | Sorting by album, title and time | 7.2 | | Todo |
| B9 | Search results display and original release highlight | 7.3 | | Todo |
| B10 | White column-resize line | 7.1 | | Todo |
| B11 | Right-to-left text stays left | 14.2 | | Todo |
| B12 | Space no longer shows the selection circle, Tab keeps it | 14.3 | | Todo |
| B13 | Bugs: unnecessary updates, pinned border, mouse back and forward | 8.2 to 8.4 | | Todo |
| B14 | Old UI audit for lists and library | 20 | investigate | Todo |

### Agent C: Player, lyrics and big picture

| ID | Task | Refs | Tag | Status |
|---|---|---|---|---|
| C1 | Investigation: the four cover layouts, with a prediction for each, including big picture mode from the old UI | 5, 15.2 | investigate, blocked by D-P3 | Todo |
| C2 | Chosen layout build and player section rework | 5 | after C1 | Todo |
| C3 | Big picture mode in the old UI's design | 15.2 | | Todo |
| C4 | Waveform: delay, scaling, bar design, contrast, setting (default off) | 6.1 to 6.3 | verify first | Todo |
| C5 | Volume and progress thumb at zero | 6.4 | | Todo |
| C6 | Highlight and selection problems on bars, dragging, resizing, scrolling | 6.5 | | Todo |
| C7 | Lyrics in the rail opens the Sync tool, waveform icon | 4.1, 15.1 | | Todo |
| C8 | Lyrics tool boxes (Sync, Write, Find, Multi search) | 4.2 | | Todo |
| C9 | Find lyrics: rename, blank album field. Write tab: paste lyrics or LRC | 4.4, 4.5 | | Todo |
| C10 | Keep the song finder's state when leaving the view | 4.6 | | Todo |
| C11 | Multi lyrics finder notification | 15.3 | needs A6 | Todo |
| C12 | Move Lyrics above Settings in the rail (Metadata is D's) | 3.1 | needs A3 | Todo |
| C13 | Old UI audit for player and lyrics | 20 | investigate | Todo |

### Agent D: Metadata only

| ID | Task | Refs | Tag | Status |
|---|---|---|---|---|
| D1 | Confirm the app's stack and choose the tag library, with a "tag service" interface. No Python | 16.3 | investigate | Todo |
| D2 | Redesign the single metadata editor so the layout is logical | 4.3, 16.1 | | Todo |
| D3 | Multi metadata editor: select songs, apply tags, genres, artists, with "mixed" fields | 16.2 | after D1 | Todo |
| D4 | Investigation: sources and rules for original and most popular release | 16.4 | investigate | Todo |
| D5 | Automatic original or most popular release lookup and apply, with confidence and review queue | 16.4 | after D1, D4 | Todo |
| D6 | Multi metadata tag finder notification | 16.5 | needs A6 | Todo |
| D7 | Journal of previous tag values so changes can be undone (shared with Agent E) | 19.1 | | Todo |
| D8 | Move Metadata above Settings in the rail | 3.1 | needs A3 | Todo |
| D9 | Old UI audit for metadata | 20 | investigate | Todo |

### Agent E: AI only

| ID | Task | Refs | Tag | Status |
|---|---|---|---|---|
| E1 | Investigation: OpenRouter free models, limits, structured output quality, web search option | 19.2, 19.3 | investigate | Todo |
| E2 | Provider interface and OpenRouter connection, secure key storage | 19.2 | after E1 | Todo |
| E3 | Action schema, validation, preview and execute pipeline | 19.2 | | Todo |
| E4 | Undo journal and Undo notifications | 19.1 | needs A6, shares with D7 | Todo |
| E5 | Library reorganization from the person's description | 19.3 | needs B6 | Todo |
| E6 | Translate lyrics | 19.3 | | Todo |
| E7 | AI shuffle | 19.3 | | Todo |
| E8 | AI metadata editing and web search | 19.3 | needs D1 | Todo |
| E9 | Privacy screen and AI settings page | 19.4, 19.6 | blocked by D-P6, needs A11 | Todo |
| E10 | Chatbot icon in the top bar and chat UI | 18.4, 19.5 | needs A3 | Todo |
| E11 | Contextual AI buttons across the app | 19.5 | after E5 to E8 | Todo |
| E12 | "Download from web" through chat | 19.5 | unclear, blocked by D-P8 | Todo |

## Order

1. **Week 0:** owner answers D-P1 to D-P8. Agents write investigations (A1, B1, C1, D1 and D4, E1). Old UI audits (A14, B14, C13, D9) run at the same time.
2. **Then:** A builds the chrome and rail (A2 to A4, A6). B and C start the rail-dependent work once A's rail states are fixed. B1 (list rendering) does not depend on the rail, so it starts straight away.
3. **In parallel:** D builds metadata, E builds the provider, action pipeline and undo, and A works on notifications, menu and settings.
4. **Integration:** E5 waits for B6 (folder and playlist functions). E8 waits for D1 (tag service). E4, C11 and D6 wait for A6 (notification API). E9 waits for A11 (settings).
5. **Last:** themes and gradients (A13), after the new surfaces exist.

## Shared rules for all agents

- The tag service (D1) is the only code that writes tags. The AI and the multi editor call it.
- Folder and playlist functions (B6) are the only code that changes library structure. The UI and the AI call them.
- The notification API (A6) is the only way to show notifications.
- Anything that changes data on a large scale shows a preview first and records a journal entry for undo.
