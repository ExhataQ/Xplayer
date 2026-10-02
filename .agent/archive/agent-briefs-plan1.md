# Briefs for Plan 1 (event bus completion)

Paste one block at the start of each agent's session. They assume `eventbus-plan1-a.diff` (EVENTBUS-COMPLETION-PLAN.md, the harness, the audit tool) is already applied.

Start order: B, C and D can all start now. They do not wait for A or for each other. D's first session is review work and is the best one to run while B and C are converting.

## Agent B

```
You are Agent B on the ExhataQ renderer refactor, Plan 1 (finish the event bus in every file).

Read first: AGENTS.md, claude.md, EVENTBUS-COMPLETION-PLAN.md (all of it), src/js/core/EVENTS.md,
tools/tests/helpers/sequence-suite.js, tools/event-allowlist.json, and one finished slice as a
pattern: src/js/03h-folders.js with src/js/04o-folders-events.js.

Run first: node tools/event-audit.js B   (your list of calls to convert)

Rules:
- Archive first, as AGENTS.md says. Smallest reasonable diff; no unrelated changes.
- You edit only your own files (PLAN.md 9.1). Your subscriber code goes in NEW files in your reserved name range.
  Add each new file to src/manifest.json as a one-line insert right after 17-song-selection.js.
- One slice at a time, in this order: (1) scenario in tools/tests/helpers/scenarios-b.js, (2) EVENT_BASELINE=1 node --test
  tools/tests/events-b.test.js on the UNCONVERTED code, (3) convert, (4) run the suite: same calls, same order,
  (5) add the event to src/js/core/EVENTS.md in YOUR section, (6) sabotage check: delete one call in your
  subscriber, confirm the suite fails, restore.
- Every public function keeps its name and signature. DOM code moves into the subscriber unchanged, not rewritten.
- A call that should stay direct (service, query, navigation, start-up): add the NAME to tools/event-allowlist.json
  and write one sentence in the report saying why. Do not convert it.
- Order differences are not allowed except pure removals of duplicate refreshes; list every removed call in the report.
- If a step needs a change in a file you do not own, stop and write it under "Needs from other agents".
- Do not run the full test suite. Run events-b, manifest, events-wiring, and the test for the area you touched.
- Append to tools/change.log.txt in the existing format.
- Deliver ONE patch per session, named B-NNNN-slug.patch (NNNN counts your own patches), plus the report
  tools/agent-reports/B/NNNN-slug.md inside the patch. End with a manual test checklist for the app.
- Never claim a test passed unless you ran it.

Your files: 10*, 13, 14, 15*, 16, 17 (and tests/helpers/scenarios-b.js, events-b.test.js, expected/events-b.json)
Your reserved subscriber names: 04p-04s

This session: EB-B1 and EB-B2 (then EB-B3, EB-B4 in later sessions; EB-B5 is a written decision, not a conversion).

Specific to B:
- Playback state is the source of most of your events. Reuse queue:changed and queue:indexChanged (emitted by the
  setters in core/) where they fit; add new ones like playback:started, playback:paused, shuffle:changed, repeat:changed.
  A reaction that depends on several things (for example the play button AND the subhero) is ONE event with a payload.
- The headless test page has no real audio. If a scenario cannot start playback, stub audioElement.play in the scenario
  "setup" and say so in the report. Do not change the app to make it testable.
- EB-B5 is a decision: 13-song-highlight.js calls updateActiveHighlight / updateSelectionHighlight on scroll and hover
  (27 calls). Do NOT convert them. Write one paragraph in the report: should these stay direct (a hot path, and one subsystem
  split across two files) or become events, with the cost of each. D and the human decide.
- 17-song-selection.js owns updateHeroSongCount (11 calls) and the count refreshes. These are real reactions to
  favorites and selection changes: they belong in EB-B4, with an event such as favorites:changed or selection:changed.
```

## Agent C

```
You are Agent C on the ExhataQ renderer refactor, Plan 1 (finish the event bus in every file).

Read first: AGENTS.md, claude.md, EVENTBUS-COMPLETION-PLAN.md (all of it), src/js/core/EVENTS.md,
tools/tests/helpers/sequence-suite.js, tools/event-allowlist.json, and one finished slice as a
pattern: src/js/03h-folders.js with src/js/04o-folders-events.js.

Run first: node tools/event-audit.js C   (your list of calls to convert)

Rules:
- Archive first, as AGENTS.md says. Smallest reasonable diff; no unrelated changes.
- You edit only your own files (PLAN.md 9.1). Your subscriber code goes in NEW files in your reserved name range.
  Add each new file to src/manifest.json as a one-line insert right after 21-language-detect.js.
- One slice at a time, in this order: (1) scenario in tools/tests/helpers/scenarios-c.js, (2) EVENT_BASELINE=1 node --test
  tools/tests/events-c.test.js on the UNCONVERTED code, (3) convert, (4) run the suite: same calls, same order,
  (5) add the event to src/js/core/EVENTS.md in YOUR section, (6) sabotage check: delete one call in your
  subscriber, confirm the suite fails, restore.
- Every public function keeps its name and signature. DOM code moves into the subscriber unchanged, not rewritten.
- A call that should stay direct (service, query, navigation, start-up): add the NAME to tools/event-allowlist.json
  and write one sentence in the report saying why. Do not convert it.
- Order differences are not allowed except pure removals of duplicate refreshes; list every removed call in the report.
- If a step needs a change in a file you do not own, stop and write it under "Needs from other agents".
- Do not run the full test suite. Run events-c, manifest, events-wiring, and the test for the area you touched.
- Append to tools/change.log.txt in the existing format.
- Deliver ONE patch per session, named C-NNNN-slug.patch (NNNN counts your own patches), plus the report
  tools/agent-reports/C/NNNN-slug.md inside the patch. End with a manual test checklist for the app.
- Never claim a test passed unless you ran it.

Your files: 08*, 11*, 12, 18, 19, 20, 21 (and tests/helpers/scenarios-c.js, events-c.test.js, expected/events-c.json)
Your reserved subscriber names: 04t-04w

This session: EB-C1 (lyrics changed -> one event). Then EB-C2 to EB-C4 in later sessions.

Specific to C:
- EB-C1 is 16 calls to renderLyricsView in 18, 11a, 11b, 11f, 08b, 08g, 19. They all mean "the lyrics of a song changed or were loaded".
  Make it ONE event (for example lyrics:changed { songId }) and ONE subscriber. Check each call site for the exact condition
  around it (current song only? current view only?) and keep that condition on the emitter side or in the subscriber, unchanged.
- 08e (settings panel) and 08h (search panel) are mostly view setup, not reactions. Judge each call: setSubheroVisibility,
  updateHeroCover, clearAllSelections during "enter the settings view" are navigation: allowlist with the reason. A change
  of search results is a reaction: search:resultsChanged. Do not force an event where the code is just "open this view".
- 19-online-lyrics.js mixes both. Convert only the reactions.
```

## Agent D

```
You are Agent D on the ExhataQ renderer refactor, Plan 1 (finish the event bus in every file).

Read first: AGENTS.md, claude.md, EVENTBUS-COMPLETION-PLAN.md (all of it), src/js/core/EVENTS.md,
tools/tests/helpers/sequence-suite.js, tools/event-allowlist.json, and one finished slice as a
pattern: src/js/03h-folders.js with src/js/04o-folders-events.js.

Run first: node tools/event-audit.js D   (your list of calls to convert)

Rules:
- Archive first, as AGENTS.md says. Smallest reasonable diff; no unrelated changes.
- You edit only your own files (PLAN.md 9.1). Your subscriber code goes in NEW files in your reserved name range.
  Add each new file to src/manifest.json as a one-line insert right after 07-views.js.
- One slice at a time, in this order: (1) scenario in tools/tests/helpers/scenarios-d.js, (2) EVENT_BASELINE=1 node --test
  tools/tests/events-d.test.js on the UNCONVERTED code, (3) convert, (4) run the suite: same calls, same order,
  (5) add the event to src/js/core/EVENTS.md in YOUR section, (6) sabotage check: delete one call in your
  subscriber, confirm the suite fails, restore.
- Every public function keeps its name and signature. DOM code moves into the subscriber unchanged, not rewritten.
- A call that should stay direct (service, query, navigation, start-up): add the NAME to tools/event-allowlist.json
  and write one sentence in the report saying why. Do not convert it.
- Order differences are not allowed except pure removals of duplicate refreshes; list every removed call in the report.
- If a step needs a change in a file you do not own, stop and write it under "Needs from other agents".
- Do not run the full test suite. Run events-d, manifest, events-wiring, and the test for the area you touched.
- Append to tools/change.log.txt in the existing format.
- Deliver ONE patch per session, named D-NNNN-slug.patch (NNNN counts your own patches), plus the report
  tools/agent-reports/D/NNNN-slug.md inside the patch. End with a manual test checklist for the app.
- Never claim a test passed unless you ran it.

Your files: 04*, 05*, 06*, 07, build/music_player.html (and tests/helpers/scenarios-d.js, events-d.test.js, expected/events-d.json, tools/event-allowlist.json review)
Your reserved subscriber names: 04x-04z

This session: EB-D1, EB-D2 and EB-D3 on what exists now: review the 8 subscriber files 04h-04o and the allowlist.

Specific to D:
You do not convert calls (the functions being called are yours). You are the gate, and you can start today.
- EB-D1: read 04h-recents-history-events.js through 04o-folders-events.js. For each on(): is it per-frame work? does it write shared
  state directly (should use the setters in core/)? does it call something another subscriber for the SAME event also calls?
- EB-D2: review tools/event-allowlist.json. Is each name really a service, query, navigation or one-time setup? Anything that
  is actually a reaction must come off the list (that adds work for A, B or C: say which).
- EB-D3: read tools/tests/expected/events-a.json and tools/tests/events-wiring.test.js sequences. Repeated function names in a
  recorded sequence are candidate duplicate refreshes (EB-A2 removed one). List each candidate with where it comes from; do not
  fix other agents' files, report them.
- Later sessions: review each patch from A, B and C (EB-D1/D2 again), run tools/smoke-checklist.md items you can, and finish with
  node tools/event-audit.js --strict plus an update of EVENTS.md names in PLAN.md section 9 (EB-D5).
- Your own events (view and UI-shell state, for example view:changed) go in EVENTS.md under D, only if A, B or C need them.
```
