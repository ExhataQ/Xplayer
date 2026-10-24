# Report: PD-05 Multi tag finder, core

**Task:** PD-05 | **Agent:** D | **Date:** 2026-10-23 | **Status:** In review (core only; no screen, no IPC, nothing is written yet)

## Summary
PD-05 asks for a finder that goes through many songs, applies results above a confidence threshold, queues the rest, and tells the person. This patch builds the part that does not depend on how results are applied: for every song, search releases, pick one with the PD-04 rule, fetch that release's tags, compare with the song's current tags, and return a decision (`auto`, `review`, `none`, `unchanged`, `error`) with the exact tags that would change. The finder cannot write anything (a test enforces it). The screen, the IPC and the notification wait for the owner's answer to the question below.

## Findings
- MusicBrainz is spaced at one request per 1.1 s by `electron/online-metadata.js` (`requestJson`, `rateLimit`), shared by every caller. A song costs three requests (recording search, recording, release), so about 3 to 4 seconds per song: 100 songs is roughly 6 minutes, 1000 songs about an hour. The notification text and any "estimated time" should say so. *Read*
- `getOnlineMetadata` always downloads cover art after the tags (a Cover Art Archive request plus an image). For many songs that is wasted time and disk, so it now takes `skipCover` (default false, nothing changes for existing callers). *Read; tested against the real function with a mocked network*
- The brief says "apply automatically", plan rule 9 says nothing is written without a preview and an undo entry. These conflict unless auto results go through the same review and undo as every other tag-sheet change. See the decision below. *Read*

## Changed files
| File | Change |
|---|---|
| `electron/tag-finder.js` | New. `createTagFinder({ search, getMetadata })` with `findOne` and `findMany`; `compareTags`. Pure logic, dependencies injected, no file or network access of its own |
| `electron/online-metadata.js` | `getOnlineMetadata` accepts `skipCover` (two changed lines) |
| `tools/tests/tag-finder.test.js` | New, 15 tests |
| `tools/tests/online-metadata.test.js` | One new test for `skipCover` on the real function |
| `.agent/BOARD.md` | PD-05 status and the reports table |

## Behavior worth knowing
- `patch` holds only tags that differ and never an empty value, so applying it cannot erase a tag. `changes` has before and after for the review table.
- Title and artist are the question, never the answer. Default fields: album, albumArtist, year, genre, label and the three MusicBrainz ids.
- Multi-value tags split on `;` only and compare as sets (same genres in another order are "unchanged", no file rewrite).
- One song failing does not stop the run. A fatal error (untrusted host, redirect loop) stops it at once. Five failures in a row stop it as "offline", so a dead connection does not spend retries on every remaining song.
- Cancel is checked before every song and what was done is kept. Progress is reported after every song.
- The threshold is the caller's (`autoThreshold`, default 0.85 from PD-04).

## Decisions made or needed
**Needed from the owner (new, DP12):** what does "auto" do?
- **A. Stage, then the usual review.** The finder puts every result into the tag sheet as staged edits. "Auto" results are pre-checked, "review" results are listed in a queue to accept or skip. Nothing is written until the person presses the existing "Review and apply" and the existing Undo covers it. Safest, one more click.
- **B. Write the "auto" results straight away.** Only results at or above the threshold are written, with an Undo button in the notification (needs PD-06's journal first, which needs E's journal, PE-04). Faster, but it writes tags into files without a preview, against plan rule 9.
- **C. A, with a setting** that switches to B later, once the journal exists.
Recommendation: **A now, C later.** Also open: DP6-style question for "most popular" (no popularity source, terms of Deezer and iTunes not checked, offline).

## Checks
| Command or step | Result |
|---|---|
| `node --test tools/tests/tag-finder.test.js` | 15 passed, 0 failed |
| Mutation check on `tag-finder.js`: allow empty values to erase; download covers; remove the offline cutoff; ignore cancel | Each made exactly 1 test fail; restored, 15 pass |
| `node --test tools/tests/online-metadata.test.js` | 12 passed, 0 failed (11 existing, 1 new) |
| Mutation check: ignore `skipCover` | The new test fails; restored, 12 pass |
| `node --test tools/tests/release-rank.test.js tools/tests/tag-service.test.js` (with online-metadata) | 22 passed, 0 failed |

## Not run
- Live MusicBrainz: no network here. The field names the ranking depends on (`status`, `release-group.primary-type`, `release-group.secondary-types`, recording `score`) are still from memory (PD-04). Run one real search on the owner's machine before trusting confidences.
- The full suite, `npm run lint` (ESLint is not installed here), Electron, Windows.
- No screen exists yet, so there is nothing to look at.

## Environment
Node in a container, no network, no Electron, no Python tag libraries. Snapshot of the tree before changes: `archive/D1/Source` in the sandbox (the E:\ archive root is not reachable; the owner still snapshots before applying, PO-02).

## Manual checklist for the owner
Nothing to test in the app yet. When the owner has Node on the machine: `node --test tools/tests/tag-finder.test.js tools/tests/online-metadata.test.js` should print 27 passes and 0 failures.

## Open issues and follow-ups
1. Owner's answer to DP12 (above), then: IPC (a `findTagsMany` handler in `main.js`, the preload entry, `desktop-api.js`, the preload parity test, and a progress event), the queue UI in the tag sheet, the notification (`notifyProgress` with Cancel, then `notify` with counts and a click target to the queue), and the "original or most popular" setting.
2. A live check of the MusicBrainz field names (PD-04 follow-up).
3. PD-06 (journal) is needed before any option that writes without the review step.

## Patch
`0006-agent-d-tag-finder-core.patch`. Contains only the files in the table above. Excludes the shared `tools/CHANGELOG.md` (only the integration owner edits it).
