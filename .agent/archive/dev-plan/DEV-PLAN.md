# Dev plan: Source-only, portable, safer (started 2026-11-01)

The base is the portable setup already in place: `npm start` runs from `src/` with data in `.dev-data/`, `npm run dist` makes `dist/Xplayer` with `portable.txt`, the new interface is the default, the old one is a switch. This plan is the next layer: fewer moving parts, a faster dev loop, release by one command, and a safer app.

## Decisions (owner, 2026-11-01)

- The App folder is not used any more. It goes right after phase 3.
- The Python tag fallback and `electron/metadata-editor.py` go once the owner has verified the Node writer on his machine (Windows, Python hidden or uninstalled).
- A Content-Security-Policy and electron-builder fuses are wanted.
- The old interface is retired **when the owner says the new interface's polish is done**, not on a date. Until then it is the stable reference the new one is developed against (engine behaviour, designs). The `src/js` engine stays after that too (the new interface is a shell over it).
- No release is planned. The GitHub repository is only a place to share the project's files; nobody is expected to download or run builds from it, and its history will be archived or removed. So release work is parked (phase 5) and nothing in the repository may hold personal data (library, settings, AI key: `.dev-data/` and `Xplayer-Data/` are ignored and left out of backups).
- Failing tests are not prioritised: a phase never waits on them, but no phase may add a failure. The baseline on 2026-11-01 is 20 failing unit tests (list in "Baseline").
- `tools/backup_source.py` stays Python (dev tool, standard library only). Done 2026-11-01.

## How each phase is delivered

One patch per phase against the zip the owner sends, plus a short "what to do" (commands to run, what to look at). Before a phase: `python tools/backup_source.py`. After: `npm run test:unit` must show no failure outside the baseline, `node tools/dev/gen-web.js --check` passes, and `npm start` opens the new interface.

## Phase 1: foundation (small, do first). Done: applied by the owner 2026-11-02

| # | Step | Detail | Check |
|---|---|---|---|
| 1.1 | Single-instance lock | `app.requestSingleInstanceLock()` at the top of `electron/main.js`; a second launch focuses the first window and exits. Matters most for portable: two copies on one `Xplayer-Data` would both write `songs.json`. A second copy with a different data folder (`XPLAYER_DATA`) must still be allowed for development: key the lock on the data folder (`app.setPath('userData')` is already per data folder, so the lock is too). | Start twice: the second does nothing. Start with another `XPLAYER_DATA`: opens. |
| 1.2 | `.editorconfig`, `engines`, `.nvmrc` | CRLF for text (matches `.gitattributes`), 4 spaces, final newline; `"engines": { "node": ">=22" }`, `.nvmrc` says 24 (what CI uses). Done 2026-11-01. | Open a file in the editor: new lines are CRLF. |
| 1.3 | `songs.json` backups | In `songs-store.js`: before a write that changes the file, keep the last 5 copies as `library/backups/songs-<time>.json` (not on every write: at most one per hour). A corrupt file is already moved aside; also offer the newest backup then. | Unit test with a fake folder; kill the app mid-scan, start: library is back. |
| 1.4 | Logs and "open data folder" | Main process writes `<data>/logs/main.log` (rotating, last 3); Settings > About gets "Open data folder" and "Copy diagnostics" (version, Electron, mode, paths, last 50 log lines; never keys or song paths). | A bug report can be pasted without asking for files. |
| 1.5 | One version | Settings > Data > About shows `app.getVersion()`, the Electron version and "(development run)" in dev. (The window has no OS title bar, so no title change.) | Matches the exe's version in `dist`. |

Built as: `electron/single-instance.js`, `electron/logger.js` (log at `<data>/logs/main.log`, 512 KB, 3 files; console.warn/error, uncaught exceptions and a renderer or helper process dying are logged), `electron/app-info.js`, the `app` group in `preload.js` and `desktop-api.js` (`getInfo`, `openDataFolder`, `copyDiagnostics`), `src/ui-next/shell/about-settings.js`, and `songs-store.js` history (`library/backups/`). Diagnostics text removes paths and file URLs from the log lines (`redact()` in `logger.js`); it holds no song names or keys.

## Phase 2: reorganise tools and docs. Built 2026-11-02, waiting for the owner's check

Moves use `git mv` and a reference sweep (a small script searches the repo for each old path; the unit tests are the second net). No behaviour changes.

| # | Step | Detail |
|---|---|---|
| 2.1 | Folders | `tools/fonts/` (the 4 downloaders, then one `fetch-fonts.js` driven by a list, the Python and `.bat` versions deleted once it works), `tools/icons/` (`build-context-menu-icons.mjs`, `build-ui-next-icons.js`, `make-app-icon.py`), `tools/checks/` (`lint.js`, `lint-globals.js`, `dep-map.js`, `event-audit.js`, `adapter-budget.js`, `event-allowlist.json`), `tools/dev/` (`gen-web.js`, `import-library.js`, `make-portable.js`, `archive-polish-docs.js`, `make-tag-fixtures.js`, `tag-guess-report.js`, `placeholder-test/`). `tools/tests/` and `tools/lib/` stay. `package.json` scripts and `.github/workflows/test.yml` updated in the same patch. |
| 2.2 | Remove what is not needed | Done: `tools/placeholder-test/` (a manual demo page of the old interface's skeleton rows, run by nothing), the four font downloaders (replaced by `tools/fonts/fetch-fonts.js` with a lock file), the empty `tools/CHANGELOG.md` (the root `CHANGELOG.md` is the only one), `tools/prompt.txt` (stale, rewritten as `docs/AGENT-PROMPT.txt`), `tools/smoke-checklist.md` (moved to `docs/SMOKE-CHECKLIST.md`). Kept until phase 4: `tools/rebuild.bat`, `tools/clean_for_share.py`. |
| 2.3 | Docs | New `docs/DEVELOPMENT.md` (run, test, build, data folders, `.agent` layout) and `docs/ARCHITECTURE.md` (app-paths modes, ui-next over the engine, adapters and budgets, tag service). README shortened and linked to them. Update every mention of `App/` and `E:\...` in `claude.md`, `.agent/AGENTS.md`, `.agent/CONTEXT.md`, `tools/tests/README.md`. The "archive before every change" rule in `AGENTS.md` becomes `python tools/backup_source.py`. |
| 2.4 | Polish 1 archive | Run `node tools/dev/archive-polish-docs.js --apply` (the owner has not yet; the script is already in the repo). |

## Phase 3: dev loop. Built 2026-11-02, waiting for the owner's check

Built as: `tools/dev/start.js` (launcher for `npm start` and `npm run dev`; profiles; asks for `real` before opening an existing folder), `electron/dev-tools.js` (DevTools, `fs.watch` on `src/` and `electron/`, the one-time seed; the launcher restarts Electron on exit code 75, so no `electronmon`), `gen-web.js --watch`, `tools/dev/make-sample-library.js` (307 songs: silent MP3s with real tags, covers, 5 playlists, favorites; the page keeps playlists in localStorage, so they travel in `sample-seed.json`). Profiles live in `.dev-data/profiles/`. Tests: `tools/tests/dev-loop.test.js`. Checked against the real Electron: seed applied, DevTools opened, reload on a `src/` change, restart on an `electron/` change.

| # | Step | Detail |
|---|---|---|
| 3.1 | `npm run dev` | In dev mode only (`!app.isPackaged`), main watches `src/` and reloads the window on a change (`webContents.reloadIgnoringCache()`, debounced 200 ms); a change in `electron/` restarts the app (a tiny wrapper, no new dependency if `fs.watch` is enough, otherwise `electronmon`). Generated files (`player.js`, old page) are rewritten by `gen-web.js --watch` when `src/js/99-player.js`, `build/music_player.html` or the manifest change. |
| 3.2 | DevTools | `--devtools` flag and `XPLAYER_DEVTOOLS=1` open DevTools detached; `npm run dev` sets it. |
| 3.3 | Sample library | `tools/dev/make-sample-library.js`: about 300 made-up songs with generated covers and a few playlists, written to a data folder (`npm run sample`, then `npm start` uses it with `XPLAYER_DATA`). Real files are not needed: songs point at short silent files generated once. The browser tests can use it later. |
| 3.4 | Profiles | `npm run start -- --profile=empty\|sample\|real`: `real` points `XPLAYER_DATA` at an existing folder after a confirmation in the console, so the real library is never opened by accident. |

## Phase 4: remove the App folder. Built 2026-11-03, waiting for the owner's check

Built as listed below, with these differences from the plan: `tools/dev/import-library.js` and its `npm run import-library` script are deleted too (it only read an old MusicPlayerOutput folder), `electron/package-lock.json` went with `electron/package.json`, `tools/tests/source-runtime-assets.test.js` (it tested the deleted PowerShell script) is deleted, `output-dir.test.js` became `library-dir.test.js`, the four tests that read `music_player.py` now check `package.json` `build.files` and `src/assets`, `getOutputDir` is `getLibraryDir` (nothing outside the repo used it), and the packaged build leaves out `src/old-ui`.

Order matters: first the things nothing depends on, then the legacy mode, then the tests that exist for it.

1. Delete `Launch-Xplayer-App-UI-Next.bat`, `Launch-Xplayer-UI-Next.bat`, `Prepare-Source-Backed-Runtime.ps1`, `README-SOURCE-RUNTIME.md`, `tools/rebuild.bat`, `tools/clean_for_share.py` (its job is `backup_source.py --share`), `build/music_player.py`, `build/build_manifest.py`, `electron/package.json`.
2. Move `build/music_player.html` to `src/old-ui/music_player.template.html`; `gen-web.js`, `tools/lib/manifest.js` and the tests that read it (about ten, found by `grep -l "build/\|music_player.html" tools/tests`) point at the new place. Remove the now empty `build/`.
3. In `electron/app-paths.js` remove the `legacy` mode (`MUSIC_PLAYER_OUTPUT_DIR`, `MusicPlayerOutput` next to the code). Tests that need a throwaway library use `XPLAYER_DATA` instead (`output-dir.test.js` is rewritten around it; `storage-paths.getOutputDir` is renamed `getLibraryDir`, with the old name kept for one release only if something outside the repo uses it).
4. `ui-entry.js` and `ui-choice.json`: unchanged.
5. README, `claude.md`, `AGENTS.md`: no `App/`.

Check: `git grep -n "App\\\\\|MusicPlayerOutput\|music_player.py"` finds nothing outside the changelog and archives.

## Phase 5: CI, and release work (parked)

Only 5.1 is worth doing now: it proves the portable build still builds. 5.2 to 5.4 wait until a release is planned.

| # | Step | Detail |
|---|---|---|
| 5.1 | Windows build job (built 2026-11-03, waiting for its first run on GitHub) | Its own workflow, `.github/workflows/build.yml` (a path filter works per workflow, not per job), on `windows-latest`: `npm ci`, `npm run dist` (which runs `gen-web.js` first; a `--check` would fail on a fresh checkout), `node tools/dev/check-dist.js`; uploads `dist/Xplayer.zip` as an artifact. Runs on pushes to the main branch and on pull requests that touch `electron/`, `package.json` or `src/`. |
| 5.2 | Release workflow (parked) | On a tag `v*`: build, create a GitHub Release with `Xplayer.zip` and the changelog section. `npm version` bumps `package.json`; the tag is pushed by hand. |
| 5.3 | Update notice (parked) | At most once a day, the main process reads the latest GitHub Release (one request, no data sent) and shows a notification "Version x.y is out" with a link. No automatic download. Off switch in Settings. |
| 5.4 | Signing (parked, investigate only) | Unsigned exes get SmartScreen warnings. Check whether the free open-source signing programmes accept the project (SignPath Foundation is the one to look at; terms to be verified). Decision after the first real release. |

## Phase 6: later, each on its own

| Step | Detail and condition |
|---|---|
| 6.1 Python off (done 2026-11-05 in two steps: step 1 m4a/mp4 in the Node writer plus a cover bug and an ID3v1 bug fixed; step 2 removed `electron/metadata-editor.py`, `tag-backend.js` (the fallback and the `XPLAYER_TAG_BACKEND` switch), the Python runner in `metadata-editor.js`, the Python tests and helpers, the Python setup in the CI `real-tags` job and the README mentions; the app, the tests and the build need no Python. Formats the Node writer cannot edit (WMA, APE, WV and the rest) now answer `unsupported` with a message that lists what can be edited; see `.agent/FORMATS-PLAN.md`) | Python is only left in `tools/backup_source.py` and `tools/icons/make-app-icon.py`, which the owner decided to keep. |
| 6.2 Content-Security-Policy (built 2026-11-03, waiting for the owner's check; built as written, plus: the meta tag could not be tried report-only on `file://`, so a tour of the real app on both interfaces with `--profile=sample` watched the console instead, no violation; the loading window has its own stricter policy; `tools/tests/csp.test.js` and `csp-browser.test.js`) | A `<meta http-equiv="Content-Security-Policy">` in `src/ui-next/index.html` and the old page template, roughly: `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: file:; media-src 'self' blob: file: https:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-src 'none'`. Why those: the renderer makes no web requests of its own (lyrics, metadata and downloads run in the main process), pages use inline `style=` attributes (so `'unsafe-inline'` for styles only), and "Play from URL" needs `https:` for media. Steps: add in report-only mode first (a `Content-Security-Policy-Report-Only` header from `session.webRequest.onHeadersReceived` cannot apply to `file://`, so use the meta tag with the policy and watch the console for violations during one full pass of the app), fix what it finds, then enforce. A test reads the meta tag and the allowlist from both pages. |
| 6.3 Fuses (built 2026-11-04, waiting for the owner's first `npm run dist` / CI run; `check-fuses.js` and `tools/tests/fuses.test.js` added; tried here by flipping the same fuses on a Linux Electron 44 binary: the app started and `npm run smoke` passed) | In `package.json` `build.electronFuses` (electron-builder 26): `enableNodeOptionsEnvironmentVariable: false`, `enableNodeCliInspectArguments: false`, `grantFileProtocolExtraPrivileges` kept (the app loads `file://` pages), `enableCookieEncryption: true`. **Not** `runAsNode: false` yet: `electron/scanner.js` runs the scan as `fork()` with `ELECTRON_RUN_AS_NODE=1`, which that fuse turns off. Moving the scan to `utilityProcess.fork` is the step that allows it (own task, with the scan tests). `onlyLoadAppFromAsar` and asar integrity need asar, which the portable build does not use (`asar: false`); revisit if the build ever packs asar. Check: `npx @electron/fuses read --app dist/Xplayer/Xplayer.exe`. |
| 6.4 Dependency check (done 2026-11-04 from the owner's audit output: 31 findings, 3 root causes, none reachable, none update cleanly, so no dependency changed; the triage is in `docs/DEVELOPMENT.md` > Dependencies; open question: drop `jimp`) | `npm audit --omit=dev` reports problems in the production tree. List them, mark which are reachable (most are in build or scan libraries), update what updates cleanly. Pin Electron by a policy line in `docs/DEVELOPMENT.md` (stay on a supported major; update monthly). |
| 6.5 Hardware acceleration (done 2026-11-04: `XPLAYER_GPU=on` switch and `npm run bench:gpu`; the owner's numbers on i5-10400F, GTX 1660 Super, 16 GB, Windows 11 show no difference, so it stays off; see `docs/DEVELOPMENT.md`) | `main.js` calls `app.disableHardwareAcceleration()`. Measure scrolling and the waveform with it on and off on the owner's machine before deciding. |
| 6.6 Old interface retirement | Trigger: the owner says the new interface's polish is done. Then, in this order: make the new interface the only choice (Settings loses the switch, `ui-entry.js` loses `current`), stop generating `music_player.html` and drop its template, `src/css` and the old-UI-only tests. **`src/js` stays**: the new interface runs on it. Until the trigger nothing changes. |

## Baseline: failing unit tests on 2026-11-01 (same on the unmodified zip)

- Tag parity with real files (9): `tone.mp3`, `tone.flac`, `tone.ogg`, `tone.opus`, reading tags, saving, and covers. Not known whether the sandbox or the reader is at fault; run on the owner's machine first.
- Adapter budget total (`the bridges added by this plan share the 300 lines of DP9`): the owner approved more on 2026-10-30; the number in `tools/checks/adapter-budget.js` and `ui-next-ai-static.test.js` was not updated.
- CSS: `every var() refers to a defined token`, `components.css uses tokens only`.
- `ui/06f-drag-drop-songs.js only exports initSongDragToLeftPanel`, `D-09c: module shape`.
- Right panel and lyrics: `Sync has no bar of its own...`, `the right panel lyrics has a header...`, `the right panel button shows the filled icon...`, `the Lyrics page opens Sync only for a chosen visit...`.
- Scrollbar: colour choice, shape choice, cat scrollbar off, cat scrollbar hides the native bar.

## Open items for the owner

- Retirement of the old interface (6.6): by trigger, no date.
- "Copy diagnostics" (1.4) never includes music folders, song paths or keys (default kept).
- After the first `npm run dist` on Windows: the exe icon, the taskbar icon, the size of `dist/Xplayer`, and the first start time. These numbers decide whether asar packing is worth revisiting.
