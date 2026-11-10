# Development guide

Everything is in this folder (Source). You run the app from it, test it from it, and build the portable app from it. There is no second folder to copy files into.

## First time

```powershell
npm install        # Node 22 or newer (.nvmrc says 24, what CI uses)
npm start          # opens the app on the new interface
```

`npm start` writes the generated page files (`tools/dev/gen-web.js`) and runs Electron on `src/`. For everyday work use `npm run dev` instead: it opens DevTools, reloads the window when a file in `src/` changes, restarts the app when a file in `electron/` changes, and rewrites the generated page files when their sources change. Both go through `tools/dev/start.js`.

Python is only needed for one optional thing: `tools/backup_source.py` (and `tools/icons/make-app-icon.py` when the icon is rebuilt). The app, its tests and the build need none.

## Where your data is

| Run | Library (`songs.json`, covers) | Settings, logs |
|---|---|---|
| `npm start` | `.dev-data/library/` | `.dev-data/settings/`, `.dev-data/logs/` |
| `XPLAYER_DATA=<folder> npm start` | `<folder>/library/` | `<folder>/settings/`, `<folder>/logs/` |
| portable build (`portable.txt` beside the exe) | `Xplayer-Data/library/` next to the exe | `Xplayer-Data/settings/`, `Xplayer-Data/logs/` |

`.dev-data/` is git-ignored and never part of a backup zip (it can hold your AI key). To develop on your real library, copy your data folder (the one that holds `library/` and `settings/`, for example the portable `Xplayer-Data`) somewhere and open it with `--profile=real` (below), or work on the sample library.

### Profiles: which data to develop on

| Command | Data |
|---|---|
| `npm start` | `.dev-data/` (as above) |
| `npm start -- --profile=empty` | `.dev-data/profiles/empty/`, wiped on every start: the first-run screens |
| `npm start -- --profile=sample` | `.dev-data/profiles/sample/`: about 300 made-up songs with covers, 5 playlists, favorites, and awkward cases (long names, right-to-left text, no tags, no cover). Made on first use, kept after that; `npm run sample -- --force` makes it again |
| `npm start -- --profile=real --data=<folder>` | an existing data folder (your portable `Xplayer-Data`, say). Asks you to type `real` first (or add `--yes`), because the app writes there: tag edits, scans, deletes |

The profile switches work with `npm run dev` too (`npm run dev -- --profile=sample`). The sample songs are silent files with real tags in `.dev-data/profiles/sample/sample-music/`, so play, the metadata editor and a rescan all work. Playlists and favorites live in the page's localStorage, so the sample writes them as `sample-seed.json`, which the app applies once to a new data folder (`electron/dev-tools.js`); what you change afterwards stays changed.

Settings > Data > About shows the data folder and has "Open data folder" and "Copy diagnostics".

## Commands

| Command | What it does |
|---|---|
| `npm start` | run from `src/` (new interface); `-- --profile=empty\|sample\|real` picks the data |
| `npm run dev` | `npm start` with DevTools, reload on a change in `src/`, restart on a change in `electron/` |
| `npm run start:old` | the same as `npm start`, on the old interface |
| `npm run sample` | make the sample library (`-- --force` to make it again) |
| `npm run gen:web` | write the generated page files only (`-- --check` tells whether they are current) |
| `npm run smoke` | start the real app on a temporary data folder and check the basics (needs a display; about 20 s) |
| `npm run bench:gpu` | measure scrolling and the waveform with hardware acceleration off and on (needs a display; about 10 minutes) |
| `npm run dist` | build the portable app: `dist/Xplayer/` and `dist/Xplayer.zip` |
| `npm test` | all tests (`test:unit` without a browser, `test:browser`, `test:quick` = unit tests and lint) |
| `npm run lint` | ESLint (`lint:strict` also fails on warnings) |
| `npm run fonts:check` | the icon fonts match `tools/fonts/fonts.lock.json` |
| `python tools/backup_source.py` | zip Source to `../Source-backup.zip` (`--share`, `--stamp`, `--out DIR`) |

Test details: `tools/tests/README.md`. A manual pass after bigger changes: `docs/SMOKE-CHECKLIST.md`.

## Tools folder

| Folder | Contents |
|---|---|
| `tools/checks/` | `lint.js`, `lint-globals.js`, `dep-map.js`, `event-audit.js` and its allow-list, `adapter-budget.js` |
| `tools/dev/` | `start.js` (the launcher), `make-sample-library.js`, `gen-web.js`, `make-portable.js`, `smoke-electron.js`, `make-tag-fixtures.js`, `tag-guess-report.js`, `finder-report.js`, `archive-polish-docs.js` |
| `tools/fonts/` | `fetch-fonts.js` (get the icon fonts again, or check them against the lock file) |
| `tools/icons/` | the scripts that build the icon files (`build-ui-next-icons.js`, `build-context-menu-icons.mjs`, `make-app-icon.py`) |
| `tools/lib/` | helpers shared by the tools and the tests |
| `tools/tests/` | the automated tests |
| `tools/backup_source.py` | the backup / share zip |

`tools/tests/tools-layout.test.js` fails if a script named in `package.json` or the CI file is missing, or a file lands loose in `tools/`.

## The portable build

`npm run dist` runs `gen-web.js`, then electron-builder (`package.json` > `build`: unpacked folder, no asar, so the native tag and image libraries load as plain files), then `tools/dev/make-portable.js` (moves `win-unpacked` to `dist/Xplayer`, adds `portable.txt`, zips). CI builds it too (`.github/workflows/build.yml`, on Windows) and `node tools/dev/check-dist.js` looks inside `dist/Xplayer` for the files it must and must not hold, and `node tools/dev/check-fuses.js` compares the exe's fuses with `package.json` > `build.electronFuses` (switches inside Electron: no `NODE_OPTIONS`, no `--inspect` on the command line, cookies encrypted). `runAsNode` stays on until `electron/scanner.js` moves from `fork()` to `utilityProcess`; `onlyLoadAppFromAsar` needs asar, which the portable build does not use. To update a copy in use, replace everything in its folder except `Xplayer-Data`. The exe icon and the window icon come from `src/assets/app-icon/` (see its README).

## The Content-Security-Policy

Both interfaces carry a policy in a `<meta http-equiv="Content-Security-Policy">` (the first thing after the charset in `src/ui-next/index.html` and `src/old-ui/music_player.template.html`; the loading window has a stricter one). The words of it, and why, are in `tools/tests/csp.test.js`. What it means when you write renderer code:

- **No inline script and no inline handler.** `onclick="..."` in a template string does nothing; write `data-action="name"` (recipes in `src/js/core/LEGACY.md`). `ui-handlers.test.js` fails on any `on...=` string in `src/`.
- **No `eval`, `new Function` or string timers**, and no `<script>` with a body: put it in a file.
- **No requests from the page.** Anything that needs the web goes through the main process (lyrics, metadata, downloads). Only media (`Play from URL`) may come from `https:`.
- Inline `style="..."` is fine.
- A violation shows in DevTools as `Refused to ...` (use `npm run dev`). A console without any is the goal.
- **Tests:** the shared browser helpers (`tools/tests/helpers/app-fixture.js`) start Chromium with the policy off, because most tests write an inline stub script into a copy of the page. A test about the policy starts its browser with `launch(pw, { enforceCsp: true })` (see `csp-browser.test.js`).

## Dependencies

- **Electron:** stay on a supported major and update about monthly (`npm outdated electron`, then `npm run test:quick`, `npm run smoke`, `npm run dist`).
- **`npm audit --omit=dev`**, triaged 2026-11-04 (31 findings, 3 root causes). Nothing updates cleanly, so nothing was changed:
  - `uuid` < 11.1.1 (moderate, missing bounds check in `v3`/`v5`/`v6` when a buffer is passed), reached through `node-taglib-sharp` 6.0.3. **Not reachable:** the library calls only `v4()`, `parse()` and `stringify()`. npm's "fix" installs `node-taglib-sharp` 1.0.0, a downgrade to a very old version; do not run `npm audit fix --force`.
  - `zod` < 4.6.6 (high, memory use on oversized constrained collections), 29 of the 31 entries: the chain `jimp` > `@jimp/*` > `zod` 3.x. **Not reachable as far as the code shows:** zod checks jimp's own objects and options (a bitmap object, numbers), not collections read from a file. `jimp` 1.6.1 is the newest release and asks for zod 3; npm's "fix" installs `jimp` 0.22.12, an old major with another API; do not.
  - The one change that would clear 29 of 31 is dropping `jimp`. It is the per-image fallback behind `sharp` (`electron/tag-builder.js`, `scan-folder.js`, `fast-scan.js`). Not done: it needs the decision that `sharp` is enough on every machine the app runs on.
  - Run the audit again about monthly; a finding that is new, or that is reachable, gets its own task.

## Hardware acceleration

`electron/main.js` runs with acceleration off, as it always has. `XPLAYER_GPU=on` turns it on for one run, and `npm run bench:gpu` runs the app both ways, alternating, on a made-up library of 1500 songs (`.dev-data/profiles/bench`, nothing of yours), and prints start-up time, scrolling and waveform frame rates, the slowest 1% of frames and how busy the page was. It writes `.dev-data/bench-gpu-<time>.txt`. Close other windows and leave the mouse alone while it runs. **Decision (2026-11-04): stays off.** Measured by the owner on an i5-10400F, GTX 1660 Super, 16 GB, Windows 11, 3 rounds of 6 s, 120 Hz screen: scrolling 119.7 fps off and 119.4 on, slowest 1% of frames 8.5 ms in both, start-up 1077 ms and 1081 ms, page busy 51% and 48% while scrolling, 20% and 25% with the waveform. No difference worth the risk of graphics-driver problems on other machines (with it on, the GPU was really used: compositing, rasterization and canvas all `enabled`). Measure again only if a slow machine shows a problem; send the `.txt` the benchmark writes.

## Before and after a change

1. `python tools/backup_source.py` (or the snapshot routine in `.agent/AGENTS.md`).
2. Make the change. Source files only: the generated ones (`src/player.js`, `src/music_player.html`, `src/fonts/`, `src/icons/`) and `dist/` are rewritten and git-ignored.
3. `npm run test:quick`, then the focused tests of the area. Never describe a check you did not run as passing.
4. Changed start-up, data folders, the main process or the preload: `npm run smoke`.
5. Update `CHANGELOG.md` (one line) and, for a task, its report in `.agent/reports/`.

## Plans

The plan for the development setup (phases 1 to 6) is finished and lives in `.agent/archive/dev-plan/DEV-PLAN.md`; what it left open is in `.agent/PARKED.md`. `.agent/E-D-REMAINING.md` is what the metadata and AI agents still have to verify. Finished plans are in `.agent/archive/` (see its `README.md`).
