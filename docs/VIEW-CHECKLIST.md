# New view or list: the checklist

Every new main view (a line in `VIEWS`), every new list, and every new screen inside a view must pass this list before it is delivered. It is
the set of things the other views already do, so a new one does not feel different or break something the person relies on. `claude.md`
points here.

**How an agent uses it.** Copy section 1 into the task report. Mark each item done, or "n/a" with a one-line reason. An item that is neither is
not finished. Items marked (test) need an automated test; the others need a look at the real window.

## 1. The checklist

> **Public beta snapshot:** The automated test suite (`tools/tests/`) is intentionally excluded from this repository snapshot. The test-related items below describe the full local development tree and cannot be run from a clean public clone until the suite is restored. Keep the local tests available for pre-release verification.

### A. Registered and routed
- [ ] One line in `VIEWS` (`src/ui-next/shell/shell.js`), one line only (two rail tests read the table as text). See `src/ui-next/shell/VIEWS.md`.
- [ ] `engineViews` if the engine can change page under the view; `canEnter` if the view can be unavailable; `leave()` if it can hold unsaved work.
- [ ] `reenter` chosen on purpose (`keep` for forms, `rebuild` for pages that are cheap to show again).
- [ ] State for the CSS lives in `data-*` on the host (the shell clears them between views). Nothing else survives in the host.
- [ ] A throw in `mount()` leaves the person able to leave (the shell shows a plain page); do not catch it silently.

### B. Back and Forward
- [ ] Mouse back/forward and the title-bar buttons come back to this view (the shell records it by itself) (test).
- [ ] A screen inside the view that a person would call "another page" (a card's list, a detail, a tab that changes what the page is about) calls
  `setPlace()` and listens with `onGoPlace()` (`src/ui-next/shell/places.js`). Back from it goes to the first screen; Forward returns (test).
- [ ] Back after leaving the view lands on the same screen, not the first (test). A place is a short string the view itself understands.
- [ ] Controls inside the page (a "back" button) do the same as the history: they call `setPlace()`, they do not hide and show things on their own.
- [ ] A view that is left with unsaved work asks through `leave()`, and Back/Forward ask the same question.

### C. Coming back
- [ ] Choosing the same view again (rail button) does not reload, flash a loading state or lose the screen without a reason (test: no loading
  state appears on the second visit).
- [ ] Results that cost something are kept between visits and shown at once. When the library changed since, the old answer stays on screen and is
  swapped quietly when the new one is ready (stale-while-revalidate). The library changed = the engine events `songs:changed`,
  `library:rebuilt`, `duplicates:changed`, `data:imported`.
- [ ] Scroll position needs nothing from the view: the shell notes the page's main scroller and puts it back on Back and Forward
  (`src/ui-next/shell/scroll-memory.js`). Keep one main scroller per screen, as wide as the view, so it can be found (test).

### D. Loading, empty and error
- [ ] Three separate states: loading (a placeholder in the shape of the content, never a blank page), empty (`emptyState()`, one short line and
  the next step), error (one sentence, what happened and what to do; one failing part must not blank the page).
- [ ] The loading placeholder has the size of the real content, so nothing jumps when it arrives.
- [ ] Work that can take longer than a frame shows progress or a placeholder and never blocks input (see E).

### E. Lists and performance
- [ ] More than 200 rows are virtual (the app's own threshold for the song list); rows exist only while on screen. Today use
  `src/ui-next/views/tools/health/virtual-rows.js` or the engine's list (test: row count stays small for 3,000 items).
- [ ] No work per row that scans the library: never `getArtists()`, `getAlbums()` or a `SONGS_DATA.find` per row. Build one lookup per pass.
  (Hiding one song froze the app for 6 seconds because of this.)
- [ ] Work over the whole library is done in chunks that give the page a turn (see `src/ui-next/views/tools/health/health-checks.js`).
- [ ] Measured with a 20,000-song library (`buildApp(20000)` in `tools/tests/helpers/app-fixture.js`): the view opens, scrolls and takes one
  action (hide, delete) without a visible stall. Put the numbers in the report.
- [ ] Changing one item redraws that item, not the list; an action on many items does one redraw at the end.
- [ ] Hidden and deleted songs are honoured (`deletedSongIds`); the list is correct right after the action, without a reload.

### F. Selection and actions
- [ ] If rows can be acted on: click toggles, Shift+click selects a range, the header box selects all, Ctrl+A, Esc clears; a bar says how many
  are selected and what can be done (test).
- [ ] Destructive actions ask once, name the count, and prefer reversible ones (hide, Recycle Bin) over permanent ones.
- [ ] Every action is also available for a single row with an icon button that has a label.

### G. Look and layout
- [ ] Colours, spacing, radii, type and motion come from `src/ui-next/tokens.css`. No new hex or rgb except over a cover image.
- [ ] Rows in a list use the song list's row height, hover and selection colours so a list looks like a list of this app.
- [ ] The scroller is the view's full width: no wrapper with padding around it, so the scrollbar sits on the view's right edge (test: scroller
  right edge equals the host's). Only one vertical scroller per screen. Sticky bars have an opaque background.
- [ ] Looks right in the dark and light themes, at 900 px wide and in a narrow window, with long and right-to-left text (`dir="auto"` on user text).
- [ ] Motion respects reduced motion (`reducedMotion()` in the components, or the media query).
- [ ] Works with the cat scrollbar on and off.

### H. Keyboard and accessibility
- [ ] Everything reachable by Tab; a visible focus ring (`--focus-ring`); Esc closes or goes back one step; icon buttons have `aria-label`.
- [ ] A list has `role="list"` and rows `role="listitem"`; counts and states are text, not only colour.

### I. Settings, privacy and naming
- [ ] A view that is not for every day is off the rail by default, with a Settings > Library option to show it.
- [ ] Anything that leaves the computer is listed in `docs/PRIVACY.md` and is off until the person turns it on.
- [ ] A new feature carries a "Beta" mark until its checks have settled.
- [ ] Short text. No explanatory paragraphs in the page; a hint is one line.

### J. Tests and delivery
- [ ] Pure logic (checks, windowing, ranking) lives in a file with no DOM and has a plain Node test.
- [ ] A browser test in the real shell (`tools/tests/helpers/app-fixture.js`) for the behaviour above marked (test).
- [ ] `tools/tests/guards/ui-next-adapter-budget.test.js` still passes (logic goes under `views/`, not `adapter/`).
- [ ] The full unit suite fails exactly the tests it failed before the change; the report says which.
- [ ] Files keep the repository's line endings (CRLF). The patch applies to the zip it is based on (`git apply --check`).
- [ ] `docs/DEVELOPMENT.md`, `src/ui-next/shell/VIEWS.md` and `CHANGELOG.md` mention what a later agent needs.

## 2. Where the app stands today (audit, 2026-11-17)

Read from the source, not run. "Shared" means one implementation that views reuse; "per view" means each view does it its own way.

| Area | State | Verdict |
| --- | --- | --- |
| View registration and routing | One table, checked at start, one router for every way of changing view | Ordered, shared |
| Back and Forward between views | One history (`src/ui-next/shell/nav-history.js`), one router | Ordered, shared |
| Back and Forward inside a view | Only Library health (`places.js`, added now). Settings tabs, Metadata's One/Many switch, Lyrics modes and the duplicate finder's Review/Hidden tabs are not steps | **Not ordered**: only a system, not yet adopted |
| Coming back to a view | Per view. Library health keeps its results (module cache); nothing generic | **Not ordered** |
| Scroll position on return | The shell restores the main scroller on Back and Forward for every view, the engine's song list included (`scroll-memory.js`) | Ordered, shared |
| Loading placeholders | Song list skeleton rows, search, lyrics tools, AI each draw their own; no shared component | **Per view** |
| Empty states | One component (`emptyState`), used by most views | Ordered, shared |
| Error states | One generic page for a view that throws; no shared pattern for "one part failed" | Partly |
| Virtual lists | Engine main list, engine left panel, lyrics tool, Library health: four implementations, two of them in the engine | **Not ordered** |
| Selection | Engine's selection for the song list; Library health has its own (click, Shift, Ctrl+A, Esc) | **Per view** |
| Escape and keyboard | Each view and popup handles Esc itself | **Per view** |
| Tokens, reduced motion, `dir="auto"` | Tokens everywhere; reduced motion and `dir="auto"` mostly in components | Ordered for components, patchy in views |
| Settings entry and rail option | Library health, Duplicates before it: one pattern (`health-rail.js`, a Settings section) | Ordered for new views only |
| Tests | A browser fixture and per-view tests, and one contract test over every view in the rail (`tools/tests/guards/ui-next-view-contract.test.js`) | Ordered for B, C and G; D to J stay per view |

## 3. Shared systems: what was done, what waits, what is not worth it

A shared system pays off when several views need exactly the same thing and the thing is stable. A system written from one example fits the
second example badly, so the rule is three: copy the nearest view the first time, extract when a second view needs it, and do not extract
at all where the risk is larger than the gain.

**Done**
1. **The view contract test** (`tools/tests/guards/ui-next-view-contract.test.js`). It walks every view in the rail in the real shell and checks, the same
   way for each, that it opens without an error, that Back and Forward walk the views in order, that choosing a view again brings no loading
   state back, and that the main scroller ends at the view's right edge. A new view is covered when it is in the table. A view that cannot meet
   a rule yet is named in the `KNOWN` list with the reason; the test fails when it starts to pass, so the list only shrinks. (It was checked by
   breaking Library health twice: once with its cache off, once with a padded wrapper; both were reported.) Items D to J of the checklist
   are still per view.
2. **Places** (`src/ui-next/shell/places.js`): Back and Forward walk the screens inside a view. Library health uses it.
3. **Scroll position** (`src/ui-next/shell/scroll-memory.js`): the shell notes the page's main scroller in the history entry and puts it back
   on Back and Forward, for every view and for the engine's song list, and gives up as soon as the person scrolls.

**Do when a second view needs it (copy Library health until then)**
4. **Places in the views that have screens**: Settings tabs and the duplicate finder's Review/Hidden tabs are the candidates. Metadata's One/Many
   switch and the Lyrics modes are the owner's call: are they "pages" that Back should walk?
5. **A view cache helper** (the stale-while-revalidate rules of item C). Library health keeps its cache in the module: about 20 lines.
6. **A selection model** (anchor, range, select all, Esc) and its header bar. Library health has the only one outside the engine.
7. **A loading placeholder component** next to `emptyState()`.

**Not worth it now**
8. **One virtual list replacing the engine's.** The engine's song list is the performance-critical part of the app and is tied to its own hover
   layer, selection layer and scroll math; rewriting it risks the lag that was just fixed. New views in the new interface may share
   `src/ui-next/views/tools/health/virtual-rows.js` (move it to `src/ui-next/components/` when a second view uses it; the duplicate finder, which
   draws every group, is the likely one). The engine's lists stay as they are.
9. **An Esc stack.** Each popup closing itself works; the gain is small.

Open decisions for the owner: item 4 (which modes count as pages).
