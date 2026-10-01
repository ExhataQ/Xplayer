# Board

Edited by the human only. Update it after each patch is applied and verified.

Status values: `todo`, `in progress`, `patch received`, `applied + verified`, `blocked`.

## Next actions for you

- [ ] Give Agent A the brief with step A-01 (see PLAN.md section 9.4).

## Steps

### Agent A: Foundation and data

| ID | Phase | Step | Needs | Status | Patch |
|---|---|---|---|---|---|
| A-01 | 0 | Add the analysis tool | - | todo | |
| A-02 | 0 | Record test baselines | - | todo | |
| A-03 | 0 | Add the smoke checklist | - | todo | |
| A-04 | 0 | Module-loading spike | - | todo | |
| A-05 | 0.5 | Event bus check | - | todo | |
| A-06 | 1 | Create the owner and setter files | A-05 | todo | |
| A-07 | 1 | Replace writes in A's own files | A-06 | todo | |
| A-08 | 2 | Emit events from data changes | A-05, A-07 | todo | |
| A-09 | 2 | Remove direct render calls from A's files | D-03, A-08 | todo | |
| A-10 | 3 | Build the handler bridge | A-04 | todo | |
| A-11 | 4 | Split `99-player.js` | A-04, A-07 | todo | |
| A-12 | 4 | Convert storage, recents and search engine | A-10 | todo | |
| A-13 | 5 | Storage module | A-12 | todo | |
| A-14 | 5 | `api/` wrapper and preload | A-10 | todo | |
| A-15 | 6 | Convert core and library to modules | A-13, A-14, A-11 | todo | |
| A-16 | 6 | Final flip | B-10, C-07, D-09 | todo | |

### Agent B: Playback

| ID | Phase | Step | Needs | Status | Patch |
|---|---|---|---|---|---|
| B-01 | 1 | Review A's playback setters | A-06 | todo | |
| B-02 | 1 | Replace writes in `10c` and `10d` | A-06, B-01 | todo | |
| B-03 | 1 | Replace writes in `10b`, `15b`, `15c` | A-06 | todo | |
| B-04 | 1 | Replace writes in the remaining B files | A-06 | todo | |
| B-05 | 2 | Emit playback events | A-05, B-02 | todo | |
| B-06 | 2 | Replace cross-subsystem render calls | D-03, B-05 | todo | |
| B-07 | 3 | Convert inline handlers | A-10 | todo | |
| B-08 | 4 | Shuffle modules | A-10, B-03 | todo | |
| B-09 | 5 | Swap storage and API calls | A-13, A-14 | todo | |
| B-10 | 6 | Convert playback to modules | A-15, A-11, B-09, B-08 | todo | |

### Agent C: Lyrics, metadata, panels

| ID | Phase | Step | Needs | Status | Patch |
|---|---|---|---|---|---|
| C-01 | 1 | Replace writes in the panel files | A-06 | todo | |
| C-02 | 2 | Emit lyrics and settings events | A-05 | todo | |
| C-03 | 2 | Panels react to events | B-05, C-02 | todo | |
| C-04 | 3 | Convert inline handlers | A-10 | todo | |
| C-05 | 4 | Lyrics leaf modules | A-10 | todo | |
| C-06 | 5 | Swap storage and API calls | A-13, A-14 | todo | |
| C-07 | 6 | Convert lyrics, metadata and panels to modules | A-15, C-05, C-06 | todo | |

### Agent D: UI shell

| ID | Phase | Step | Needs | Status | Patch |
|---|---|---|---|---|---|
| D-01 | 1 | Replace writes in the smaller UI files | A-06 | todo | |
| D-02 | 1 | Replace writes in `07-views` | A-06 | todo | |
| D-03 | 2 | Renderers subscribe to events | A-05 | todo | |
| D-04 | 2 | Remove D's own cross-subsystem calls | D-03, A-08, B-05 | todo | |
| D-05 | 3 | Convert inline handlers | A-10 | todo | |
| D-06 | 5 | Replace the one generic `invoke` | A-14 | todo | |
| D-07 | 4 | Theme switcher module | A-10 | todo | |
| D-08 | 5 | Swap storage and API calls | A-13, A-14 | todo | |
| D-09 | 6 | Convert the UI shell to modules | A-15, B-10, C-07, D-08, D-05, D-04 | todo | |
