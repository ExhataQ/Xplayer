# Xplayer project context

Xplayer is a local Electron music player for Windows. This repository is the
development source tree; the generated/runtime application is in the sibling
`App/` directory in the full project checkout.

## Current layout

- `electron/` contains the main process, preload/IPC boundary, audio scanner,
  metadata, lyrics, downloads, and window management.
- `build/` contains the Python build/assembly script and HTML template.
- `src/js/` contains renderer ES modules. `main.js` is the single entry point;
  its import order is the load order. Modules are grouped under `core/`,
  `api/`, `library/`, `playlists/`, `search/`, `playback/`, `lyrics/`, and
  `ui/` (including `ui/subscribers/`). Keep the existing numeric filename
  prefixes.
- `src/js/99-player.js` is a build-time data template, not the runtime library.
  `core/build-data.js` reads it; the deployed library is `songs.json`.
- `src/css/` and `src/assets/` hold renderer styles and static resources.
- `tools/tests/` contains the automated tests, runner, test documentation,
  helpers, and expected sequence data. Other `tools/` files provide audits,
  build/developer utilities, and manual checks.
- `.agent/` contains agent workflow instructions, project orientation, the
  active plan and board, and task reports.
- `tools/CHANGELOG.md` is the concise integrated history; per-task reports hold
  detailed verification evidence.

## Architecture boundaries

- `electron/scan-folder.js` is the runtime audio scanner. Do not confuse it
  with `build/music_player.py`, which assembles the deployed application.
- The Electron app uses `nodeIntegration: false` and `contextIsolation: true`;
  renderer-to-main operations pass through preload/contextBridge APIs and IPC.
- Build output is generated under `App/MusicPlayerOutput/` and launched through
  `App/electron.exe`. Edit source files here, not generated output.

This file is an orientation, not a second set of workflow rules. Read
[`AGENTS.md`](./AGENTS.md) before making changes and the root
[`claude.md`](../claude.md) for detailed architecture ownership, testing, and
contribution guidance. Test commands and requirements are in
[`tools/tests/README.md`](../tools/tests/README.md).
