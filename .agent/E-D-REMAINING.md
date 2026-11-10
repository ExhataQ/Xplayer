# Agents D and E: what is left (plan and board)

Polish 1 is closed for A, B and C; the rest of its files are archived (`node tools/dev/archive-polish-docs.js --apply`, they go to `.agent/archive/polish-1/`). This is the only Polish 1 file that stays: D (metadata) and E (AI) still have things to verify or decide. Everything else about those two agents is in their reports under `archive/polish-1/reports/` (`P1-PD-*`, `P1-PE-*`).

When an item here is finished, move its row to "Closed" with the date. When the list is empty, archive this file too.

## How to read the state

"In review" in the old board meant: built, tests written, not yet looked at by the owner in the real app. Almost every open row below is that. What is missing is **running it in Electron on the owner's machine**, not code.

## Agent D: metadata

| Task | Real state (checked against the code 2026-10-31, rows changed 2026-11-09 say so) | What is left |
|---|---|---|
| PD-04 Original or most popular release | Rule and confidence are built in `electron/release-rank.js` and used by the multi tag finder (PD-05). **Run live on 2026-11-09** with `tools/dev/finder-report.js` on a spread of 20 songs of the owner's library (11 shown to the reviewer). MusicBrainz's fields work (compilation kinds, dates, status) and ListenBrainz answered with popularity. Nothing wrong was ever picked: "Go Tell It On the Mountain" went to *Wednesday Morning, 3 A.M.* (1964) as auto, "Breakthru" to *The Miracle* (1989) as review, "Khune" to its 2024 release. Weaker: 5 songs "no releases found" (Persian and other small artists, probably not in MusicBrainz, plus "In My Life (Remastered 2009)"), 2 "compilation release skipped" ("Fuck You", "The Sound of Silence (Acoustic Version)"), 1 "no track in that release matches" shown as a failure. **Changed after that run:** a title with a remaster, mono or deluxe note is asked again without it when nothing is found; the finder looks through 25 recordings per song instead of 8 (the single-song editor still uses 8); a release that names the song differently is a result ("none", with the reason), no longer an error that counts toward stopping a run as "offline". The report now also prints what MusicBrainz offered (how many releases, which kinds, the earliest three). | Run the same command again (the 20 songs are the same unless you add `--seed`) and send the output: it shows whether the wider search found the real albums for "Fuck You" and "The Sound of Silence", and the new "MusicBrainz offered" lines say why where it still does not. Whether a late reissue should ever beat the original is a rule decision (see `release-rank.js`), not a bug. Then mark Done. |
| PD-06 Undo journal | Built and integrated (`electron/ai/journal.js`). **Checked 2026-11-09 by tests (`tools/tests/journal-write-failure.test.js`, `ai-core.test.js`, `ai-apply-plan.test.js`):** entries survive a restart, are capped, a damaged file is kept aside. **Two bugs found and fixed:** a journal that could not be written (read-only folder, full disk) made `executePlan` throw after the changes had been made, and left the Undo button of an AI plan with no entry to undo; and a finished undo that could not be written down was reported as an error. Now the change is reported, the entry is held in memory, Undo works until the app closes and the notification says so. | Windows and a large library, once: in the portable build the journal lives in `Xplayer-Data/settings`; make a tag-sheet change, restart, Undo it. (A read-only journal folder needs no manual check any more.) |
| Not run in Electron | Metadata editor, tag sheet, "Fill with AI…" sheet hand-off, finder review queue. | One pass in the real app, new interface only (the old one keeps its own editor): the steps are under "Owner pass for D" below. |

### Owner pass for D (about 15 minutes, on copies of a few songs)

1. `node tools/dev/finder-report.js "<data folder>" --count 20` (PD-04, needs the internet, writes nothing).
2. `set XPLAYER_REQUIRE_REAL_TAGS=1` and `node --test tools/tests/tag-parity.test.js` (PD-08).
3. In the app, new interface, on copies of one MP3 and one FLAC: edit title, artist, a genre and the cover; save; close and reopen the song: the values stay.
4. Edit several songs in the tag sheet, apply, press Undo in the notification: the old values come back. Apply again, restart the app, Edit > Undo (or the journal list in Settings): the change is still offered and undoes (PD-06).
5. From the tag sheet, "Fill with AI…": the hand-off opens the sheet with the proposals staged, nothing is written until you apply.
6. Run the multi tag finder on a few songs: the review queue shows each pick with its confidence and reasons; applying one writes only the changed tags.

## Agent E: AI

Twelve tasks were "In review"; PE-08 and PE-12 are closed (see Closed), ten are left (PE-01 to PE-07, PE-09, PE-10, PE-11). The assistant needs the owner's own OpenRouter key and a network, so none of it can be checked from the build sandbox.

| Task | Real state | What is left |
|---|---|---|
| PE-01 OpenRouter investigation | Report `P1-PE-01-openrouter.md`. The free-model list and limits it names were not verifiable offline. | Open the model list in Settings > AI with a real key; confirm the default models still exist and that the structured-action format is returned by at least two of them (check the schema errors in the chat). Update the default list. |
| PE-02 Provider, key storage, settings | Built. The key is stored by the main process only. | Check where the key is saved in portable mode (`Xplayer-Data/settings`) and that it is **not** inside the zip you share (the data folder is not part of the build, but a copied portable folder carries it). |
| PE-03, PE-04 Actions, preview, execute, Undo | Built with the shared journal. | Run a real plan (create playlist, add songs, move) and Undo it. |
| PE-05 Organize library | Built 2026-10-30. | Not run in Electron. Try on a copy of the library (copy it into a data folder and start with `--profile=real`, or use `--profile=sample`). |
| PE-06 Translate lyrics, PE-07 AI shuffle | Built. | Not run in Electron. |
| PE-09 Privacy screen, AI settings | Built in the slot. | Read the wording once: what is sent (title, artist, album, duration; lyrics only for translation; no file paths). |
| PE-10 Chat UI, expanded window | Reworked 2026-10-30. The expanded chat opens in its own window (`?tool=ai`). | Check that window with the new path setup: it loads through the same web root and cover route (it uses `window-manager.js`'s tool-window path, now `app-paths.entryPath`). |
| PE-11 Contextual AI buttons | Built. | Not run in Electron. |

## Open decisions that still belong to D or E

None open. (DP8b, what "download through chat" means, is answered by closing PE-12; DP14, the adapter budget, was already settled; DP7, when Python goes, is done and `metadata-editor.py` no longer exists.)

## Closed

| Task | What it was | Closed |
|---|---|---|
| PD-01 Tag service without a system Python (DP7) | The Node writer is the only tag backend (`electron/tag-node-backend.js`, `tag-lib-adapter.js`, `tag-rules.js`); the Python fallback and `metadata-editor.py` are gone (phase 6.1); M4A / MP4 / M4B are editable. Which file types can be edited: `.agent/FORMATS-PLAN.md`. | 2026-11-09 (built 2026-11-05) |
| PD-03, PD-05, PD-07, PD-09 | Done, nothing left. | 2026-11-09 |
| PD-08 Real writer tests on the owner's machine | The owner ran the tag tests with the real library: 25 tests, 0 skipped, 0 failed (`tag-parity.test.js`). The 9 failures an earlier check saw in its own sandbox were that sandbox. The CI job `real-tags` (`.github/workflows/test.yml`) keeps it so. | 2026-11-09 |
| PE-08 AI metadata and web search | `set_tags` writes through D's tag service, and the "web search" is the free MusicBrainz lookup (it answered live on 2026-11-09, see PD-04). OpenRouter's paid web-search plugin is not used: the project rule is free only. Closed under that rule; if paid web search is ever wanted, reopen it as a new task (a plugin option in `electron/ai/`, a cost note in the privacy screen). | 2026-11-09 |
| PE-12 Download from the web through chat | Covered by the existing Downloads and Play from URL; nothing to add through chat (DP8b). Closed on the owner's word. | 2026-11-09 |
| DP14 Adapter budget | The AI adapters may grow (owner, 2026-10-30), and the plan limit in `tools/checks/adapter-budget.js` was raised to 700 lines on 2026-11-05. Checked 2026-11-09: `node tools/checks/adapter-budget.js` prints `plan: 620 of 700` and `tools/tests/ui-next-ai-static.test.js` passes. This file's row was out of date; nothing needed changing. | 2026-11-09 |
