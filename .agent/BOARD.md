# Board

Edited by the human only. Update it after each patch is applied and verified. Plan: `.agent/PLAN.md`. Reports: `.agent/reports/`. The finished event bus plan is in `.agent/archive/`.

Status values: `todo`, `in progress`, `patch received`, `applied + verified`, `blocked`.

## Next actions for you

- [ ] Run `node --test tools/tests/*.test.js` with Playwright and the smoke checklist (`tools/smoke-checklist.md`). If both pass, change the rows marked `patch received` to `applied + verified`.
- [ ] Run the module spike (A-04) in Electron; paste the DevTools output into a new A report. Only Phase 3 and later need it.
- [ ] Give B, C and D their briefs (`.agent/PLAN.md` section 9.4) at the same time: B-01 to B-04, C-01, D-01 and D-02 do not depend on each other. The handler bridge exists, so B-07, C-04 and D-05 can also start; tell them to read `src/js/core/LEGACY.md` first.

## Steps

### Agent A: Foundation and data

| ID   | Phase | Step                                       | Needs            | Status             | Patch                                                                 |
| ---- | ----- | ------------------------------------------ | ---------------- | ------------------ | --------------------------------------------------------------------- |
| A-01 | 0     | Add the analysis tool                      | -                | applied + verified | A report 1                                                            |
| A-02 | 0     | Record test baselines                      | -                | applied + verified | A report 1                                                            |
| A-03 | 0     | Add the smoke checklist                    | -                | applied + verified | A report 1                                                            |
| A-04 | 0     | Module-loading spike                       | -                | applied + verified               |                                                                       |
| A-05 | 0.5   | Event bus check                            | -                | applied + verified | first plan (A report 1)                                               |
| A-06 | 1     | Create the owner and setter files          | -                | applied + verified | A report 1                                                            |
| A-07 | 1     | Replace writes in A's own files            | A-06             | applied + verified        | writes done (A report 1); removing variables from 00-state.js is open |
| A-08 | 2     | Emit events from data changes              | A-07             | applied + verified | first plan (A reports 2, 3)                                           |
| A-09 | 2     | Remove direct render calls from A's files  | -                | applied + verified | first plan (A reports 2, 3)                                           |
| A-10 | 3     | Build the handler bridge                   | A-04             | todo               |                                                                       |
| A-11 | 4     | Split `99-player.js`                       | A-04, A-07       | todo               |                                                                       |
| A-12 | 4     | Convert storage, recents and search engine | A-10             | todo               |                                                                       |
| A-13 | 5     | Storage module                             | A-12             | todo               |                                                                       |
| A-14 | 5     | `api/` wrapper and preload                 | A-10             | todo               |                                                                       |
| A-15 | 6     | Convert core and library to modules        | A-13, A-14, A-11 | todo               |                                                                       |
| A-16 | 6     | Final flip                                 | B-10, C-07, D-09 | todo               |                                                                       |

### Agent B: Playback

| ID   | Phase | Step                                    | Needs                  | Status             | Patch                       |
| ---- | ----- | --------------------------------------- | ---------------------- | ------------------ | --------------------------- |
| B-01 | 1     | Review A's playback setters             | A-06                   | todo               |                             |
| B-02 | 1     | Replace writes in `10c` and `10d`       | A-06, B-01             | todo               |                             |
| B-03 | 1     | Replace writes in `10b`, `15b`, `15c`   | A-06                   | todo               |                             |
| B-04 | 1     | Replace writes in the remaining B files | A-06                   | todo               |                             |
| B-05 | 2     | Emit playback events                    | B-02                   | applied + verified | first plan (B 0001 to 0005) |
| B-06 | 2     | Replace cross-subsystem render calls    | -                      | applied + verified | first plan (B 0001 to 0005) |
| B-07 | 3     | Convert inline handlers                 | A-10                   | todo               |                             |
| B-08 | 4     | Shuffle modules                         | A-10, B-03             | todo               |                             |
| B-09 | 5     | Swap storage and API calls              | A-13, A-14             | todo               |                             |
| B-10 | 6     | Convert playback to modules             | A-15, A-11, B-09, B-08 | todo               |                             |

### Agent C: Lyrics, metadata, panels

| ID   | Phase | Step                                           | Needs            | Status             | Patch                       |
| ---- | ----- | ---------------------------------------------- | ---------------- | ------------------ | --------------------------- |
| C-01 | 1     | Replace writes in the panel files              | A-06             | applied + verified               |                             |
| C-02 | 2     | Emit lyrics and settings events                | -                | applied + verified | first plan (C 0001 to 0005) |
| C-03 | 2     | Panels react to events                         | -                | applied + verified | first plan (C 0001 to 0005) |
| C-04 | 3     | Convert inline handlers                        | A-10             | todo               |                             |
| C-05 | 4     | Lyrics leaf modules                            | A-10             | todo               |                             |
| C-06 | 5     | Swap storage and API calls                     | A-13, A-14       | todo               |                             |
| C-07 | 6     | Convert lyrics, metadata and panels to modules | A-15, C-05, C-06 | todo               |                             |

### Agent D: UI shell

| ID   | Phase | Step                                   | Needs                        | Status             | Patch                       |
| ---- | ----- | -------------------------------------- | ---------------------------- | ------------------ | --------------------------- |
| D-01 | 1     | Replace writes in the smaller UI files | A-06                         | applied + verified               |                             |
| D-02 | 1     | Replace writes in `07-views`           | A-06                         | applied + verified               |                             |
| D-03 | 2     | Renderers subscribe to events          | -                            | applied + verified | first plan (D 0001 to 0004) |
| D-04 | 2     | Remove D's own cross-subsystem calls   | -                            | applied + verified | first plan (D 0001 to 0004) |
| D-05 | 3     | Convert inline handlers                | A-10                         | todo               |                             |
| D-06 | 5     | Replace the one generic `invoke`       | A-14                         | todo               |                             |
| D-07 | 4     | Theme switcher module                  | A-10                         | todo               |                             |
| D-08 | 5     | Swap storage and API calls             | A-13, A-14                   | todo               |                             |
| D-09 | 6     | Convert the UI shell to modules        | A-15, B-10, C-07, D-08, D-05 | todo               |                             |
