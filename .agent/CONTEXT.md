# Xplayer project context

Xplayer is a local Electron music player for Windows. This repository is the
development source tree and the whole project: run it with `npm start`, build it
with `npm run dist`.

## Current layout

- `electron/` contains the main process, preload/IPC boundary, audio scanner,
  metadata, lyrics, downloads, and window management.
- `src/old-ui/` contains the old interface's HTML template (`gen-web.js` renders it).
- `docs/` contains the development guide (`DEVELOPMENT.md`), the architecture
  notes (`ARCHITECTURE.md`), the manual smoke checklist and the agent prompt.
- `src/js/` contains renderer ES modules. `main.js` is the single entry point;
  its import order is the load order. Modules are grouped under `core/`,
  `api/`, `library/`, `playlists/`, `search/`, `playback/`, `lyrics/`, and
  `ui/` (including `ui/subscribers/`). Keep the existing numeric filename
  prefixes.
- `src/js/99-player.js` is a data template, not the runtime library.
  `tools/dev/gen-web.js` writes it as `src/player.js`; `core/build-data.js` reads
  it; the library is `songs.json` in the data folder.
- `src/css/` and `src/assets/` hold renderer styles and static resources.
- `tools/tests/` contains the automated tests, runner, test documentation,
  helpers, and expected sequence data. The other folders of `tools/` hold the
  checks (`checks/`), developer utilities (`dev/`), font and icon builders
  (`fonts/`, `icons/`) and shared helpers (`lib/`).
- `.agent/` contains agent workflow instructions, project orientation, the dev
  list of what is parked (`PARKED.md`), what agents D and E still have to do
  (`E-D-REMAINING.md`), the plans still open, task reports and the archive of
  finished plans (`archive/README.md` says what is in it).
- `CHANGELOG.md` is the concise integrated history; per-task reports hold
  detailed verification evidence.

## Architecture boundaries

- `electron/scan-folder.js` is the runtime audio scanner. Do not confuse it
  with `tools/dev/gen-web.js` and the build, which only write page files.
- The Electron app uses `nodeIntegration: false` and `contextIsolation: true`;
  renderer-to-main operations pass through preload/contextBridge APIs and IPC.
- The app loads its pages from `src/` and keeps the library and settings in a
  data folder (`.dev-data/` in development, `Xplayer-Data/` beside the exe in the
  portable build): see `electron/app-paths.js` and `docs/ARCHITECTURE.md`. Edit
  source files, not generated ones.

This file is an orientation, not a second set of workflow rules. Read
[`AGENTS.md`](./AGENTS.md) before making changes and the root
[`claude.md`](../claude.md) for detailed architecture ownership, testing, and
contribution guidance. Test commands and requirements are in
[`tools/tests/README.md`](../tools/tests/README.md).
