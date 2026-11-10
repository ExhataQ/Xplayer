# Architecture notes

A short map. Rules for people and agents who change files are in `claude.md` and `.agent/AGENTS.md`; the day-to-day commands are in `DEVELOPMENT.md`.

## Processes

- **Main process** (`electron/`): windows, the scanner, tags, downloads, lyrics lookups, the AI client, the library file. The renderer never gets Node: `nodeIntegration: false`, `contextIsolation: true`. It reaches the main process through `electron/preload.js` only, in named groups (`window`, `app`, `library`, `metadata`, `files`, `lyrics`, `ai`). `src/js/api/desktop-api.js` lists the same groups for the page; `tools/tests/desktop-api.test.js` fails if they differ.
- **Scan process**: `electron/scanner.js` forks `scan-folder.js` as a separate Node process (`ELECTRON_RUN_AS_NODE`), so a long scan never blocks the window. It cannot ask Electron for folders, so the main process hands over the library folder as an argument and the settings folder in `MUSIC_PLAYER_CONFIG_DIR`.
- **Renderer** (`src/`): two interfaces on one engine. The engine is ES modules under `src/js/` (`main.js` imports them in load order). The old interface is `src/old-ui/music_player.template.html` plus `src/css/`, rendered to `src/music_player.html` by `tools/dev/gen-web.js`. The new interface is `src/ui-next/`, a shell that sits on the engine and talks to it only through `src/ui-next/adapter/` (budgeted in lines, `tools/checks/adapter-budget.js`).

## Where things live: `electron/app-paths.js`

One module decides, in one place, where the pages are (code side) and where the library and settings are (data side), so the code can be replaced on update and the data survives.

| Mode | When | Pages | Library | Settings |
|---|---|---|---|---|
| dev | `npm start` | `src/` | `<data>/library` | `<data>/settings` |
| portable | packaged, `portable.txt` beside the exe | `<app>/src` | `Xplayer-Data/library` | `Xplayer-Data/settings` |
| installed | packaged, no marker | `<app>/src` | beside Electron's user-data folder | Electron's user-data folder |

`<data>` is `XPLAYER_DATA`, else `.dev-data/` in Source. In every mode with a settings folder `app.setPath('userData')` points at the settings folder, so the page's own storage (theme, panel sizes) and the single-instance lock follow the data folder.

Pages ask for covers as `covers/<file>` (relative to `<base href="../">`). The library is never the web root, so `installCoverRoute()` redirects those file requests to `<library>/covers`, only for that exact folder and never twice.

## The generated page files

`tools/dev/gen-web.js` writes, from sources in the repository: `src/player.js` (from `src/js/99-player.js`), `src/music_player.html` (the template plus the manifest's CSS and script tags), `src/fonts/` (from `src/assets/fonts/`) and `src/icons/` (from `src/assets/icons/`). They are git-ignored. `npm start`, `npm run dist` and `npm run smoke` run it first.

## Which interface opens

`electron/ui-entry.js`: `--ui=` flag, `XPLAYER_UI`, then the choice saved by Settings (`ui-choice.json` in the settings folder), then the new interface. The old interface stays until the owner says the new one is done; the engine under `src/js/` stays after that.

## Library file

`songs.json` in `<data>/library/`, written only through `electron/songs-store.js`: temporary file then rename, a lock between the main process and the scan, `songs.json.bak` (the previous version), and a dated copy at most once an hour in `library/backups/` (last five). A damaged file is set aside and the newest good copy is used.

## Tags

`electron/tag-service.js` sits on `electron/metadata-editor.js`, which is the Node writer: `tag-node-backend.js` (copy, write, read back, check, restore) over `tag-lib-adapter.js` (the only file that touches `node-taglib-sharp`) and `tag-rules.js` (which tags are read, written and cleared, per kind: ID3, Vorbis comment, MP4). There is no Python fallback any more (removed in phase 6.1). Formats it cannot edit answer `reason: 'unsupported'` with a message that lists what can be edited; see `.agent/FORMATS-PLAN.md`.

## Logs and diagnostics

`electron/logger.js` writes `<data>/logs/main.log` (512 KB, three files). `electron/dev-tools.js` is the development help (DevTools, reload and restart on a file change, the one-time sample seed); it does nothing in a packaged build, and `tools/dev/start.js` is what passes it the switches. `electron/app-info.js` builds what Settings > About shows and the diagnostics text, which has paths and file URLs removed.
