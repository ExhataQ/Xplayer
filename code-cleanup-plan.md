# Code Cleanup & File-Split Plan (4-agent serial handoff)

> **Update:** switched from 10 parallel agents to **4 agents working one after another**, each handing off a tested, committed checkpoint to the next. See "Serial Execution Plan" below — that's the version to actually use. The original parallel/worktree version is kept further down for reference in case you want to go back to it later.

---

## Serial Execution Plan (use this one)

Because only one agent touches the code at a time, there's no file-ownership collision risk — every agent can edit any file, including the shared `build/music_player.html` script list, directly. No worktrees, no manifest-fragment handoff trick needed. The only rule that matters now is: **don't start the next agent until the current one's checkpoint is green.**

### Agent 1 — Foundation + Backend (Electron)
- Phase 0 foundation work:
  - Delete `electron/tests/` (dead — not wired into `npm test`)
  - Add `.gitattributes` (`* text=auto eol=crlf`)
  - Add README/AGENTS.md note: `tools/tests/` is canonical
  - Add `getSongById(id)` to `src/js/00-state.js`:
    ```js
    function getSongById(id) {
      return typeof SONGS_DATA !== 'undefined' ? SONGS_DATA.find((s) => s.id === id) : null;
    }
    ```
- `electron/scan-folder.js` (1445 ln) — extract `buildSongFromTags()` from the 4 near-identical tag-building blocks (flag any real differences between them instead of silently merging), then split by strategy: `full-scan.js`, `incremental-scan.js`, `fast-scan.js`, `single-file-rescan.js`, `tag-builder.js`, thin orchestrator left behind. Keep exports identical so `main.js` needs no changes.
- `electron/metadata-editor.py` (311 ln) — audit `write_id3` for hand-rolled frame writes that bypass `set_text`/`set_multi`/`set_txxx`; consolidate. Decide `ID3_UNSUPPORTED`'s fate (recommend: keep as documented extension point).
- **Checkpoint:** `tools/tests/*` passes, diff reviewed, commit. This is the base every later agent builds on.

### Agent 2 — Data & Storage layer
- `src/js/03-storage.js` (1944 ln) → split, extending the pattern already started by `03a-recents.js` / `03b-search-engine.js` (e.g. playlists, albums/artists as their own files)
- `src/js/04b-ui-render-views.js` (1263 ln) → split by view type
- `src/js/05-lazy-load.js` (1173 ln) → split by responsibility
- In all three, replace local `SONGS_DATA.find((s) => s.id === x)` calls with `getSongById(x)`
- **Checkpoint:** tests pass, diff reviewed, commit.

### Agent 3 — UI: Panels & Widgets
- `src/js/08-panels.js` (2235 ln) → split along the existing `// ====` section banners (layout toggle/collapse, album art, track-info box, track-lyrics box, etc.)
- `src/js/06c-ui-widgets.js` (2075 ln) → split by widget type
- Same `getSongById()` swap in both files
- **Checkpoint:** tests pass, diff reviewed, commit.

### Agent 4 — Playback & Lyrics
- `src/js/10-playback.js` (1509 ln) → split core playback engine vs. queue/favorites/history helpers
- `src/js/15-playback-controls.js` (1140 ln) → split by responsibility
- `src/js/11-lrc.js` (1879 ln) → split lyrics-sync-editor concerns
- Same `getSongById()` swap in all three
- **Final checkpoint:** full `tools/tests/*` run + manual smoke test of the app (this agent's work is the last piece, so this is the real "is everything still working" gate)

### How to actually hand off between agents
1. Finish Agent N's session, confirm its checkpoint is green, commit.
2. Start a **fresh** Claude/Claude Code session for Agent N+1, pointed at the now-updated repo (the commit from step 1).
3. Give it only its own section above — it doesn't need to know about the other 3 agents' internal work, just that the foundation/helpers already exist.
4. Repeat through Agent 4.

---



## TL;DR (plain English)

The code works fine — this is purely tidying. Three kinds of mess:

1. **Dead weight** — a whole test folder (`electron/tests/`) that's never actually run.
2. **Copy-paste duplication** — the "find a song by its ID" pattern is repeated **43 times across 20 files** instead of being written once. Same story with a "build song object from tags" block repeated 4x in one file.
3. **Giant files** — 9 files are 1,100–2,200+ lines long and need to be chopped into smaller files, grouped by what the code actually does.

None of this changes what the app *does*. Same buttons, same behavior — just cleaner guts underneath.

**Why this matters for using multiple AIs at once:** if two AI agents edit the same file at the same time, their changes collide, like two people editing one Word doc simultaneously. So this plan gives each agent its own file(s) that nobody else touches, and saves the one unavoidable shared file (the app's list of which scripts to load) for a single agent to stitch together at the very end.

### How to hand this to an agent

Tell it which phase it's on and point it at the right section — e.g. *"We're on Agent 2 of the Serial Execution Plan below, starting from a clean checkpoint after Agent 1. Do only Agent 2's section."* Each section is written to be self-contained, so that's all it needs.

**If the agent can edit files directly** (Claude Code, or any tool with real file access): let it edit in place, then you review the diff and run the test suite yourself before moving to the next agent.

**If the agent can only chat — no file access (a plain chat session, e.g. claude.ai without a coding tool):** it cannot see or change your actual files, so tell it explicitly to work as a patch generator instead of an editor:

```
You do not have access to my files. For every file you'd normally edit, instead output
a unified diff (git diff format: --- a/path, +++ b/path, @@ hunks) for that file, based
on the content I paste you. Do not paraphrase or describe the change — output an actual
applicable patch. If you need to see a file's current content before patching it, ask
me to paste it rather than assuming its contents.
```

Then, on your machine:
1. Save what it gives you as a `.patch` file (e.g. `agent2-storage-split.patch`).
2. Review it — read the diff before applying it, same as you'd review a PR.
3. Apply it with `git apply agent2-storage-split.patch` (or `git apply --check ...` first to make sure it applies cleanly without touching anything).
4. Run `tools/tests/*`, commit if green, move to the next agent.

One catch worth knowing: a chat-only agent is patching against whatever file content *you pasted it*, not against your real working copy — if the two drift (you made an edit it didn't see), the patch can fail to apply or apply in the wrong spot. Always paste it the current, exact file content right before asking for a patch, not from memory of an earlier message.

---

 — Code Quality Findings (run only after Map 1 is fully done and merged)

These were found by actually grepping the repo, not guessed. Paste the block below to a fresh Claude/Claude Code session as its own "Agent 5" once all 4 Map 1 agents have finished and the full test suite is green on the cleaned-up code.

### Ready-to-paste prompt for Agent 5

```
You're doing a targeted code-quality pass on this repo. Map 1 (dedup + file-splitting)
is already done and merged — do not re-do or second-guess that work. This pass is
behavior-preserving only: no logic changes, no feature changes, just quality fixes.
Run tools/tests/* before you start and after every checkpoint below; stop and report
if anything goes from passing to failing.

Checkpoint 1 — Centralize storage keys
- Find every raw string literal passed to localStorage.getItem/setItem across src/js/.
- Create one place (e.g. src/js/00-state.js or a new small file loaded early) defining
  a STORAGE_KEYS object, e.g. STORAGE_KEYS.FAVORITES = 'favorites'.
- Replace every hardcoded key string with a reference to STORAGE_KEYS.*.
- Known duplicated keys to look for as a starting point (confirm the full list yourself,
  don't assume this is exhaustive): favorites, rightPanelCollapsed, playHistory,
  searchHistory, leftPanelCollapsed, recentlyPlayed, folderPinnedItems, customLyrics,
  customSyncedLyrics, minimizeOnClose, hideRightPanelLyrics, extendedMetadataEnabled,
  virtualScrollThreshold, smartShuffleSettings, playlists.
- Commit + verify tests pass.

Checkpoint 2 — Centralize view name strings
- Find every raw string literal passed to switchView(...) and any other place view
  names ('all-songs', 'favorites', 'history', 'playlists', 'lyrics', 'online-lyrics',
  'smart-lyrics', 'search-history', etc.) are compared or passed around as strings.
- Define a VIEWS constant object once, replace the raw strings with VIEWS.ALL_SONGS
  etc. across every file that uses them.
- Commit + verify tests pass.

Checkpoint 3 — Fix silent error swallowing
- Find every catch block that does nothing or only has an empty body (catch (e) {}).
- For each one, add at minimum a console.warn or console.error logging what was caught,
  including enough context to identify where it happened. Do not change what the code
  does after the catch — only make the failure visible instead of silent.
- If a catch is intentionally silent for a good reason (e.g. a known-safe optional
  operation), add a one-line comment explaining why instead of just logging, so the
  next person doesn't "fix" it by mistake.
- Commit + verify tests pass.

Checkpoint 4 — Clean up debug logging in electron/scan-folder.js
- This file has significantly more console.log calls than anywhere else in the repo
  (leftover from development). Audit every one: delete pure debug noise, and for
  anything genuinely useful for troubleshooting scans, gate it behind a single
  DEBUG_SCAN flag/env var instead of always logging.
- Commit + verify tests pass.

Checkpoint 5 — innerHTML / escaping audit
- escapeHtml() already exists (src/js/99-player.js) and is used in most places that
  render song metadata into the DOM via innerHTML. Audit every innerHTML assignment
  across src/js/ (there are roughly 90+ across ~15 files) and confirm any dynamic
  value coming from song metadata, ID3 tags, or online lyrics content is passed
  through escapeHtml() (or escapeOnlineLyricsAttribute() for attribute contexts)
  before being interpolated. Flag and fix any that aren't. Pay special attention to
  src/js/19-online-lyrics.js since it renders content fetched from the internet.
- Commit + verify tests pass.

Checkpoint 6 (optional, lower priority) — CSS audit
- Check whether the 13 files in src/css/ share color/spacing values via CSS custom
  properties (variables) or repeat hardcoded hex/px values across files. If the latter,
  propose (but don't necessarily execute without confirming scope first) consolidating
  shared values into CSS variables in one place.

Final: run the full test suite one more time, do a manual smoke test of the app,
and summarize exactly what changed per checkpoint.
```

---

## Original Parallel Version (reference only — not the current plan)

### Ground rules for every agent/track

- **Pure refactor only.** Renaming, deduplication, splitting, extraction. No logic changes, no new behavior, no "while I'm in here" fixes.
- **Each track owns a disjoint set of files.** This is what makes true parallel work safe — no two agents touch the same file.
- **No track renames a function/variable used outside its own files** without leaving the old name as a thin alias/wrapper.
- **Every track's deliverable is a patch** scoped only to its owned files, plus (for the big-file tracks) a small "manifest fragment" — see Phase 1.
- **Gate:** `tools/tests/*` must pass before and after every track's patch is applied.
- The app is plain `<script>` tags in `build/music_player.html`, loaded in order, all in global scope (no bundler, no ES modules). Functions resolve when *called*, not when the file loads — so splitting a file into pieces is safe as long as the relative script order is preserved and there's no top-level code that depends on a not-yet-loaded file.

---

## Phase 0 — Foundation (one agent, lands first, ~minutes)

Fully independent of everything else — could even run in parallel — but land it first so later tracks have something to call.

- Delete `electron/tests/` (confirmed dead: `electron/package.json`'s test script only runs `../tools/tests/*.test.js`; nothing wires `electron/tests/` in).
- Add a `.gitattributes` line for CRLF (`* text=auto eol=crlf`).
- Add a one-line note to README/AGENTS.md: `tools/tests/` is the canonical test suite.
- Add `getSongById(id)` to `src/js/00-state.js` — mirrors the existing defensive style already used at `06b-modals.js:79`:
  ```js
  function getSongById(id) {
    return typeof SONGS_DATA !== 'undefined' ? SONGS_DATA.find((s) => s.id === id) : null;
  }
  ```

**Files touched:** `electron/tests/*`, `.gitattributes`, `README.md`, `AGENTS.md`, `src/js/00-state.js`. None overlap with anything below — zero conflict risk.

---

## Phase 1 — Fully parallel tracks (one agent per file/module)

Answering the earlier open question directly: **fold the dedup/naming pass into the file-splitting pass, per file.** Splitting each of these files is already a naturally disjoint track — doing dedup and splitting as two separate passes on the same file just doubles the diff and the conflict risk for no benefit.

| Track | File(s) | Scope |
|---|---|---|
| A | `electron/scan-folder.js` (1445 ln) | Extract `buildSongFromTags()` from the 4 near-identical tag-building blocks (full scan / incremental / fast-pass / single-file rescan). **Flag any field-order or fallback differences found between the 4 blocks instead of silently merging them.** Then split by strategy: `full-scan.js`, `incremental-scan.js`, `fast-scan.js`, `single-file-rescan.js`, `tag-builder.js`, with a thin orchestrator left in `scan-folder.js`. Keep its exports identical so `main.js` needs no changes. |
| B | `electron/metadata-editor.py` | Audit `write_id3` for any hand-rolled frame writes that bypass `set_text`/`set_multi`/`set_txxx`; consolidate onto the helper. Decide the fate of `ID3_UNSUPPORTED` (now an empty set) — recommend keeping it as a documented extension point rather than deleting it, but this is your call to confirm. |
| C | `src/js/08-panels.js` (2235 ln) | Split along the existing `// ====` section banners already in the file (layout toggle/collapse, album art, track-info box, track-lyrics box, etc). |
| D | `src/js/06c-ui-widgets.js` (2075 ln) | Split by widget type. |
| E | `src/js/03-storage.js` (1944 ln) | Extend the pattern already started by `03a-recents.js` / `03b-search-engine.js` — e.g. split out playlists and albums/artists into their own files. |
| F | `src/js/11-lrc.js` (1879 ln) | Split lyrics-sync-editor concerns. |
| G | `src/js/10-playback.js` (1509 ln) | Split core playback engine vs. queue/favorites/history helpers. |
| H | `src/js/04b-ui-render-views.js` (1263 ln) | Split by view type. |
| I | `src/js/05-lazy-load.js` (1173 ln) | Split by responsibility. |
| J | `src/js/15-playback-controls.js` (1140 ln) | Split by responsibility. |

**Every track (C–J especially) also replaces its own file's local `SONGS_DATA.find((s) => s.id === x)` occurrences with `getSongById(x)`** (from Phase 0). This is how the 43-site duplication gets cleaned up without any track ever touching another track's file.

### Each track's patch has two parts:

1. **The file diff** — new split files added, old monolith file removed/reduced.
2. **A manifest fragment** — NOT applied directly to `build/music_player.html`. Just the replacement `<script>` lines, handed to the Phase 2 integrator. Example from Track C:

```html
<!-- replaces line 787: <script src="js/08-panels.js"></script> -->
<script src="js/08a-panel-layout.js"></script>
<script src="js/08b-panel-album-art.js"></script>
<script src="js/08c-panel-track-info.js"></script>
<script src="js/08d-panel-track-lyrics.js"></script>
```

This is the trick that lets 9 agents work at once without fighting over the one shared HTML file.

---

## Phase 2 — Integration (one agent, serial, after Phase 1 lands)

- Apply each track's manifest fragment into `build/music_player.html`, in the original relative order — mechanical, low-risk since each fragment is an independent line range.
- Grep all of `src/js/` for duplicate top-level `function` names introduced across the new files (collision check).
- Run `tools/tests/*` in full.
- Manual smoke test of the app.

---

## Notes / corrections from the original plan

- The `getSongById` duplication is bigger than first estimated: **43 call sites across 20 files**, not ~10 across 3. Several of those files are also split targets, which is why the dedup work is folded into each split track rather than done as a separate pass.
- Confirmed `electron/tests/` is genuinely dead (not referenced by `npm test`), safe to delete outright.
- Confirmed the app has no bundler/module system — everything is global-scope `<script>` tags — which is what makes file-splitting low-risk as long as script order and exported function names are preserved.
