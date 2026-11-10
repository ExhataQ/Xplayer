# Polish plan (written 2026-11-05)

Source: the owner's brainstorm of 2026-11-05 (plus the themes and stable-size items added the same day), sorted into work packages. The old UI retires (phase 6.6) only when the owner says polish is done, so this plan is also the list that decides "done". Nothing here is started.

## How the work is split: three agents

The split follows the code each job touches, so two agents rarely edit the same file.

| Agent | Area | Why it is one job |
|---|---|---|
| **A: Drag and navigation** | Everything that is dragged, where it can be dropped, and back/forward | One drag system (`06f`/`06g` in the engine, the new-UI drop targets, the Electron drop from Windows) and one history stack |
| **B: Library, rating and metadata** | The song list, its menus, the rating system, the metadata sheet, the waveform | They all read and write the song record and share the list and menu code |
| **C: Tools, AI and motion** | Play from URL, notifications, the AI chat, Find, the animation switch and panel animations | Separate screens with little shared code, plus the one setting that reaches every animation |

Order: A and B start together. C starts together with them, except C5 (AI reads ratings), which waits for B3. Each package is its own patch with its own "what to do", as before. No package may add failing tests.

---

## Agent A: Drag and navigation

| ID | Job | Notes |
|---|---|---|
| A1 | **Queue opens sooner while dragging.** Today the queue section opens only when the item is low on the screen. Open it when the item is higher, and scale the trigger zone with the queue's own size (a bigger or taller queue gets a bigger zone) | Decide the formula with the owner's feel: measure first, then offer 2 values to try |
| A2 | **One drag look.** The main view and the left panel use different drag styles. Make one shared drag image and one set of rules for both | One shared module, both places import it |
| A3 | **Check the drag data saved after closing.** The owner suspects it is wrong. First find out what is saved (the queue, the drag state, a position) and what a restart restores. Report before changing anything | Investigation first. A fix only if it is really wrong |
| A4 | **Drag from Windows into the app.** (a) dropping onto different playlists in the left panel, (b) dim the places that cannot take the drop, the same dimming as dragging inside the app (for example the left panel while dragging from the main view), (c) dropping into the queue | The dim rule is shared with A5. Files are imported first, then added to the target |
| A5 | **Dim the places that cannot accept the dragged item**, for inside-app drags too | One function: "can this target take this item", used by every drop target and by the dimming |
| A6 | **Rail hover while dragging.** Hovering a dragged item over a rail item changes the view after a short delay | The hover-to-switch part only. Dropping a song into Sync or the metadata editor is **later**, see "Decided, for later" below |
| A7 | **Back and forward** work for the rail items and everything else, not only the library | Today history records only library views. Needs one history entry type for "rail view + its state" |
| A8 | **Covers are not draggable** | Small. Also check the right panel and the player cover |

Order inside A: A3 (look), A5, A2, A1, A4, A8, A7, A6 last.

### A3 finding: what is saved after a drop from Windows (2026-11-05)

Read from the code, not run with a real library.

- A file dropped from Windows (or a song added by link) is **added to the saved library** (`songs.json`, through `scanDroppedFiles` and `mergeNewSongs`), with its real path. It is still there after a restart.
- **The wrong part:** the library's full rebuild (`rebuild-from-folders`, used by Rebuild and after folder changes) writes only the songs found in the **music folders**. A dropped file outside those folders **disappears at the next rebuild**, and a playlist that held it keeps an id that no longer exists.
- Smaller: a new song gets `id = number of songs + index`, so ids depend on the list length at that moment. It works while nothing is removed from the list, and a rebuild renumbers everything.

**Owner's decision (2026-11-05): leave it for now.** The two options were: (1) keep such songs through rebuilds (store them as "extra files" next to the folders; a rebuild adds them back if the file still exists), or (2) leave it and tell the person in the drop message that the file is outside the library folders. Suggested: (1). It belongs with A4 (the Windows drop work), because that is where the drop gets its target playlist.

### Decided, for later: Sync and Metadata work on their own song (owner, 2026-11-05)

The owner wants these tools independent of playback: edit or sync a song while a different song plays. So each tool needs its **own loaded song**, separate from the playing one, and a way to load it: drop a song on the tool (or on its rail item, which is what A6's hover leads to), plus an "Open in Sync" and "Open in Metadata" item in the song menu. Today the Lyrics page opens Sync with the playing song (PC-07), so this changes that rule. It is its own package, written when the owner starts it. Nothing in A, B or C may assume that Sync or Metadata always follow the playing song.

Tests: unit tests for the "can this target take this item" function and for the trigger-zone formula; browser tests for the dim state, the queue opening, and back/forward on three rail views.

---

## Agent B: Library, rating and metadata

| ID | Job | Notes |
|---|---|---|
| B1 | **The column and row button becomes a multi-function menu.** Today it only adjusts column and row height. It becomes a menu of sections, each opening smaller sections: **View** (sort by time, album, title and the like), **Rows** (remove or add the extra lines of information in the list), **Columns** (which columns show), **Size** (the row height it has now) | **Rows** is the name of a section of this menu: it adds or removes things shown in the main list (what the owner said: "remove or add rows which adds or removes some stuff in the main list"). The exact list of what can be added is decided when B1 starts, from what the list can show today. The old height control stays inside Size |
| B2 | **Add to playlist in the context menu**: a good looking place with a search field for playlists, and an **Add to new playlist** item that creates the playlist, adds the selected songs, and shows the playlists | One component, reused by the drag menu if useful |
| B3 | **Rating system.** Included in: smart shuffle, the list, Home (shown as a playlist: Top rated, Not rated and the like). A setting to turn it off. **Off by default**. The AI can read ratings | See the rating notes below |
| B4 | **Metadata for one song uses the space better.** Tags such as genre and artist go into text boxes of their own instead of one single row | Keep the multi-song layout as it is |
| B5 | **Show metadata: text can be highlighted and copied** | Plain text selection on the read-only view, plus a "Copy" on each value |
| B6 | **Waveform for songs longer than 10:00** | Find out what stops it today (a length cut-off, memory, or decode time) before choosing. Likely a lower resolution for long files and decoding in chunks |
| B7 | **Tooltip list for the owner to decide.** One simple table of every tooltip with its text, and for each one: keep, remove, or new text. The owner marks it; the agent applies only the marked changes | The table is a generated file, so it never goes stale. Nothing is removed before the owner answers |
| B8 | **Stable sizes: a state never moves the layout.** Selecting, hovering or playing an item must not change its size or the position of its text. Seen today: in lyrics, when a line becomes the playing one its text grows and part of it drops to a second row; in the main list, hovering sometimes makes a row slightly taller. Fix every list the same way | **Major.** See the notes below. Does first, because every other list change builds on it |

### Stable sizes notes (B8)

- **Rule:** a state (hover, selected, playing, focused, pressed) may change colour, background, opacity, a transform (scale or translate, which move nothing else) or an outline that sits outside the box. It may not change font size, font weight, padding, margin, border width, line height or the content.
- **Likely causes to look for:** a bolder or larger font on the playing or selected item; a border that appears only on hover (so the box grows by its width); an icon or button that appears on hover and has a different height from the text; a wider text that wraps because the bold version is wider.
- **Fixes in order of preference:** keep the same border all the time and only change its colour (transparent when idle); for a playing line use a transform scale from the left edge instead of a bigger font size; where bold is wanted, reserve its width (a hidden bold copy of the text in the same cell) or use a colour change instead of a weight change; give hover controls a fixed slot that exists when idle.
- **Where:** the song list, the queue, the left panel lists and playlists, the recents and search panels, the lyrics in the right panel, in Sync and in Write, the menus, and the settings rows. The engine lists that the new UI still uses are included.
- **First step:** a browser test that measures every item before and after each state (box size and number of text lines) and lists what moves. That list is the work list, and the same test stays as the guard so a later change cannot bring the problem back.

### Rating notes (B3)

- Where it shows: stars in the list (a column, hidden when the system is off), the song's context menu, the player, and the metadata sheet.
- Stored in the song record, and in the tag where the format has a rating field, so a rating survives a library rebuild. **Decided (owner):** where a file format has a rating field, the rating is written there too. The app keeps its own copy as well, for formats with no field. Because this changes the owner's files, it has its own switch under Rating system (**Write ratings into file tags**, on when the rating system is on), and it uses the same safe pipeline as tag edits: copy, write, read back, verify, restore on failure. First step: check with real files which formats have a usable field (ID3 POPM for MP3, a rating comment for FLAC, OGG and Opus, the MP4 rating atom for M4A) and how other players read them, then write only for the ones that round-trip
- Smart shuffle: a weight by rating, with a switch to ignore it. Songs without a rating count as neutral, never as bad.
- Home: the playlists Top rated and Not rated, only while the system is on.
- Setting: **Rating system**, off by default. Off means no stars, no menu item, no Home playlists, no weight, and the AI is not told about ratings.
- AI: the rating of a song is part of what the AI sees when the setting is on (C5).

Order inside B: **B8 first** (everything else edits these lists), B7 next (it needs the owner's answer, so it should wait the longest), then B2, B3, B1, B4, B5, B6.

Tests: unit tests for the rating rules, the shuffle weight, and the "off means invisible" rule; browser tests for the menu search, the new-playlist item, the stars, and the no-layout-shift measurement (B8).

---

## Agent C: Tools, AI and motion

| ID | Job | Notes |
|---|---|---|
| C1 | **Play from URL: paste on open.** When the dialog opens and the clipboard holds a link in the right shape, fill the field with it. Never read the clipboard for anything that is not a link | Clipboard access needs a user action in Chromium. Opening the dialog is one, so this should work. Check it in the real app |
| C2 | **Play from URL: show what will be fetched** (title, length, size, stream or download) when it is known cheaply, before the owner starts it | Only what a light request gives. If it cannot be known, show nothing instead of a guess |
| C3 | **Notifications: an "Open file location" action** for downloaded files | Select the file in Explorer. Not shown for streams |
| C4 | **AI chat arrows.** Arrows to scroll sideways between messages, like the tag sections in the left panel | Reuse the left panel's arrow component |
| C5 | **AI view keeps a minimum size.** Today the AI view breaks when the app is shrunk vertically. It gets a minimum height and scrolls inside itself instead of breaking | Also covers "set up AI first": the first-run set-up must stay usable at that size. Then: the AI reads ratings (needs B3) |
| C6 | **Find: a button that opens the LRCLIB website** | Opens in the normal browser, never inside the app |
| C7 | **Setting: fewer animations** (a Reduce animations switch) for better performance. It turns off the cat, the waveform motion, panel motion, fades and loops. Follows the system "reduce motion" as its starting value | Must reach every animation, including the new ones from C8. One attribute on the root that all CSS reads |
| C8 | **Panel toggle animations**: small, clear, simple moving motions (owner's choice) when the left panel, right panel and queue open and close, plus the chosen ones below | Transform and opacity only. All of it respects C7. **Owner, 2026-11-09: closing has no animation**; only opening moves |
| C9 | **Themes: two main themes, more themes you can load, and your own.** (a) **Dark and Light** as the two main choices at the top of the appearance settings. Today all 12 built-in themes are dark and there is no light theme. (b) The 12 built-in themes stay as **more themes**, below the two main ones. (c) **Load a theme** from a file, and **save your own as a file** to share or keep. (d) **Make your own**: the builder exists, and it now keeps a list of several own themes instead of one, and can start from Light or Dark | See the theme notes below |

### Theme notes (C9)

- **Light needs every token.** First step: an audit of anything that is not a token (raw colours, images and icons made for a dark ground, the cover placeholder, the waveform, the cat scrollbar, shadows). Those are the places that will look wrong in light. The "tokens only" test for the component styles already guards part of this.
- **Contrast is checked, not guessed.** Light uses the same contrast helpers the builder uses (`theme-math.js`), with the same minimum ratios as the dark themes.
- **Before the first paint.** The saved mode is applied by `appearance-boot.js` like the theme is today, and `color-scheme` follows the mode (it is fixed to dark now), so native controls, scrollbars and the focus ring match.
- **Loading a file is untrusted input.** A loaded theme goes through the same normalising as a saved custom theme: only well-formed colour values are kept, anything else is dropped, and it can never inject CSS or scripts. A bad file shows a clear message and changes nothing.
- **Optional, owner decides:** a third choice **System** that follows Windows.

### Motion chosen (owner: simple moving motions)

1. The right panel and the queue slide in from their own edge, 150 to 200 ms, with a soft ease-out; the left panel does the same.
2. The list shifts instead of jumping when a panel opens (the width change eases).
3. The play button swaps its icon with a short scale-and-fade.
4. A song added to a playlist: the playlist item in the left panel gives one short pulse.
5. A dragged item dropped on a valid target settles into it; on an invalid one it eases back.
6. Dialogs and menus rise by a few pixels while they fade in.

Left out for now: the stars filling in order, and the cross fade between rail views (not simple moving motions). All of it goes through C7.

Order inside C: C7 first (so every later animation has the switch), then C9 (the theme work is the biggest and touches the most CSS), then C1 to C3, C6, C4, C5, C8.

Tests: unit tests for the link check and the clipboard rule; browser tests for the AI view at a small window height, for "Reduce animations on means no running animation", and for the themes (every theme keeps the text contrast, a bad theme file changes nothing, the mode is set before the first paint).

---

## Things shared between agents

- **Files two agents may both touch:** the song list and its context menu (A and B), the settings page (B3, C7 and C9), the AI context (B3 and C5), and the styles of every list (B8 and C9: B8 changes how states are drawn, C9 changes the colours they use, so B8 goes first). When two packages need the same file, the package that comes first in the order above goes first and the other builds on its patch.
- **Settings added by this plan:** Rating system (off by default), Reduce animations, the Dark and Light choice and the loaded themes. Both are saved with the other appearance and library settings, and both are checked by the same "Copy diagnostics" rule: no music folders, song paths or keys.
- **Not in this plan:** the formats work (see `FORMATS-PLAN.md`), the DP14 bridge total (waits for the owner), the old UI retirement (phase 6.6), and the check of the real app on the owner's computer (memory, speed, what only real Electron shows; see `REAL-APP-CHECK-PLAN.md`).

## Questions for the owner

Answered 2026-11-05: Sync and Metadata become independent of playback and come later (A6 note); "Rows" is a section name in the B1 menu; ratings are written into file tags where the format has a field (B3); the motion is the simple moving ones (C8).

Still open:
1. **A1:** after the measurement, which of the two trigger values feels right?
2. **B1:** what the Rows section can add and remove (we decide it from what the list can show).

## Status

| ID | State |
|---|---|
| A1 | done (patch A-1). The trigger zone is half the drawer's height (120 to 280 px), on the right, above the button, after 150 ms. The queue's size is read from the rows the engine list holds, so it is the minimum until the drawer was opened once. Tune the numbers in `queue-drag-open.js` if it does not feel right |
| A2 | done for what was found (patch A-1): both drags already used the same ghost, cursor and body classes; the difference was that only left-panel drags dimmed the source. Song rows are dimmed too now. Tell us if something else looks different |
| A3 | reported; owner decided to leave it for now (see "A3 finding"). Comes back with A4 if wanted |
| A4 | done (patch A-2): (a) files dropped on any playlist or on Liked Songs in the left panel go there, (b) the places that cannot take files are dimmed, (c) files can be dropped into the queue, which opens while they rest above its button. Not done: a drop line that shows the exact place in the queue (they go after the songs added by hand), and dropping files on the Sync and Metadata tools (waits for the owner, see "Decided, for later") |
| A5 | done (patch A-2): `ui/06l-drop-rules.js` is the one rule (`acceptsDrop`, `dropTarget`) used by the song drag (06f) and the file drag (06m) |
| A7 | done (patch A-3). The title-bar Back and Forward buttons use the shell's complete history (the one the mouse buttons use) and show its state; `createNavHistory` got an `onChange` callback and `installNavButtons` |
| A6 | done (patch A-4): `shell/rail-drag-hover.js`. A song or file drag resting on a rail item for 450 ms opens it (ring while waiting); an item already open is skipped. Dropping into Sync or Metadata stays deferred. Not tried with a real Windows drag: only simulated |
| A8 | done (patch A-1): `img` and `svg` have `-webkit-user-drag: none` in `base.css` |
| B1 to B8 | not started |
| C1 to C3 | built (patch C-3, report `P2-C1-C3-play-from-url.md`), not yet seen in the running app. A link on the clipboard is pasted and selected when the dialog opens; a light HEAD request shows name, size and type when the server tells them; a saved download keeps its notification with an "Open file location" button. Length is not shown (it needs the file itself) |
| C4 | built (patch C-5b, report `P2-C4-ai-chat-arrows.md`), not yet seen in the running app. The ready-made messages above the AI chat box sit in the left panel's chip strip: an arrow on each side that has more, a fade, the wheel; dragging still works |
| C5 | built, first part only (patch C-6, report `P2-C5-ai-minimum-size.md`), not yet seen in the running app. The AI chat keeps a minimum conversation height and scrolls inside itself, so "Set up AI first" stays usable at the smallest window. **Still open: the AI reads ratings.** It waited for B3; the rating core (slice 1 of B3) is now in, so it can start |
| C6 | built (patch C-4, report `P2-C6-lrclib-button.md`), not yet seen in the running app. A "LRCLIB website" button in the Find page header opens `https://lrclib.net` in the normal browser through one fixed call in the main process (no address comes from the page) |
| C7 | built (patch C-1, report `P2-C7-reduce-animations.md`), not yet seen in the running app. One attribute on the root, `data-motion`, set before the first paint; all CSS motion rules and every script read it. The control has two values (On, Off); it starts as the system's setting and follows it until you choose. Older `@media (prefers-reduced-motion)` blocks in `src/ui-next` are gone: write new motion under `:where(:root:not([data-motion='reduced']))` |
| C8 | built (patch C-7, changed by C-8, report `P2-C8-panel-motion.md`), not yet seen in the running app. The six chosen motions, transform and opacity only, all behind the Reduce animations switch. **Opening is animated, closing is not** (owner's decision, 2026-11-09); see the report for what the system's own drag picture cannot do |
| C9 | built (patch C-2, report `P2-C9-themes.md`), not yet seen in the running app. Dark and Light are the two main cards, then More themes; Light is a new built-in theme (contrast floor checked); `data-mode` is set before the first paint and drives `color-scheme`, shadows and scrims; themes can be saved as a file and loaded from a file (untrusted input, whitelisted); the builder starts from Light too. Open: the optional System choice, and your eye on Light's palette |
