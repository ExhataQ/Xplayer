# Prerelease plan (GitHub)

Goal: a first public build on GitHub, marked **Pre-release**, that a person can download, unzip and run on Windows, with honest notes about what is unfinished. Not a polished 1.0: the old interface's retirement, the formats plan and the Home creativity round stay future work.

**Status 2026-11-11:** steps A and C are built (one patch: version `1.0.0-beta.1`, `LICENSE`, `THIRD-PARTY-NOTICES.txt`, `tools/dev/release-tools.js`, `release.yml`, the installer, `docs/RELEASING.md`, `docs/KNOWN-PROBLEMS.md`, README). The owner's decisions D1 to D6 below were taken at their suggested answers except D1, which waits for B. Still to do by hand: C1, B1, D, E. The installer is part of the release (C2): NSIS, per user, no administrator, data in `%APPDATA%\Xplayer`, uninstall keeps it; the portable zip stays.

Written 2026-11-11. Everything under "What exists" was read from the repository on that day; what could not be checked from here is listed under "Not known".

## What exists

| Piece | State |
|---|---|
| Portable Windows build | `npm run dist` makes `dist/Xplayer/` and `dist/Xplayer.zip` (plain files, no asar, `portable.txt` marker, data in `Xplayer-Data` beside the exe). `check-dist.js` and `check-fuses.js` look inside the result. |
| CI | `.github/workflows/test.yml` (unit + lint on Linux, browser tests on Windows in 3 shards). `.github/workflows/build.yml` builds the portable zip and keeps it 7 days as an artifact. |
| Safety work already done | single-instance lock, `songs.json` backups, logs and "Copy diagnostics" in Settings > About, CSP, Electron fuses, version shown in About, `.dev-data/` and `Xplayer-Data/` git-ignored. |
| Version | `package.json` says `1.0.0`. |
| Not there | a release workflow, a `LICENSE` file (`package.json` says ISC, README says "check before redistributing"), third-party notices, an update notice, code signing, a download section in the README. |

## Not known (must be checked, not assumed)

- Whether `build.yml` has ever run green on GitHub (the dev plan says "waiting for its first run").
- Whether the zip runs on a clean Windows profile (no Node, no earlier `.dev-data`), and how big it is.
- Whether the tests workflow is green: the unit suite has 8 known failures (list in `.agent/archive/dev-plan/DEV-PLAN.md`, "Baseline", plus the DP14 adapter budget), and one browser test (plain lyrics) fails on the plain zip too.
- Licences of everything shipped (see step A2).
- Whether any personal data or key is in the git history (see step B).

## Decisions only the owner can make (blocking, small)

| # | Decision | Suggested answer |
|---|---|---|
| D1 | Make the repository public, and keep its history? The dev plan says history "will be archived or removed". | Decide after step B shows the history is clean; a fresh single-commit repository is the safe fallback. |
| D2 | Licence. | Keep ISC if the dependency check (A2) allows it; add the file. |
| D3 | Version and tag. | `1.0.0-beta.1`, tag `v1.0.0-beta.1`, GitHub "Pre-release" ticked. |
| D4 | The old interface in the release: ship it with the Settings switch, or hide the switch. | Ship as is; the plan to retire it waits for "polish is done". |
| D5 | Platforms. | Windows x64 only; nothing else was tried. |
| D6 | The 8 failing unit tests and the failing browser test: fix first, or release with them listed. | List them in the release notes under "Known problems"; the release workflow itself must still pass (it does not run the tests). |

## Steps

Who: **me** = a patch from me; **you** = something only you can do (Windows, GitHub).

### A. Repository ready (me, one patch; blocks the tag)

| # | Step | Detail | Done when |
|---|---|---|---|
| A1 | Version | `package.json` and `package-lock.json` to `1.0.0-beta.1` (D3). About shows it. | `npm run dist` makes a folder whose exe reports that version. |
| A2 | Licence and notices | Add `LICENSE` (D2). `tools/dev/make-notices.js` writes `THIRD-PARTY-NOTICES.md` from `package-lock.json` (production tree only), `tools/fonts/fonts.lock.json` and the Lucide icons (ISC). It lists each package, version and licence and fails on a licence it does not know. Electron's own `LICENSE` and `LICENSES.chromium.html` already ship in the folder; the check keeps them. One to verify by name: `node-taglib-sharp` (I believe LGPL-2.1: if so the notice must say so and the zip must stay replaceable, which plain files already are). | Notices file generated and in the zip; the list has no "unknown". |
| A3 | `tools/dev/check-release.js` | Fails when: the tag does not match `package.json`, `CHANGELOG.md` has no section for the version, `LICENSE` or the notices are missing from `dist/Xplayer`, or the zip holds `Xplayer-Data`, `.dev-data`, `.env`, a `.log`, a `songs.json` or a path under `C:\Users`. Run by the release workflow and by hand. | Test for each failure with a fake folder. |
| A4 | CHANGELOG | Rename "Unreleased" to `1.0.0-beta.1 - <date>`; a short "Known problems" list under it (A6). A new empty "Unreleased" above. | `check-release.js` passes. |
| A5 | README | A **Download** section (where the zip is, unzip anywhere, run `Xplayer.exe`, first run needs a music folder), **Where my data is** (`Xplayer-Data` beside the exe), **Update** (close, replace everything except `Xplayer-Data`), **Windows warning** (SmartScreen "More info, Run anyway": the build is not signed), **Report a problem** (Settings > About > Copy diagnostics, paste in an issue). Remove "Project status: under active development" wording that now clashes, keep it honest: "pre-release". | A person who has never seen the project can follow it. |
| A6 | Known problems list | From `PARKED.md` and the tests: formats the tag writer cannot edit (WMA, APE, WV ...), the old interface still present, the failing tests, "no automatic update", "Windows only". | Same list in README and the release notes. |

### B. Personal data and secrets (you run, I read the output; blocks D1)

| # | Step | Detail |
|---|---|---|
| B1 | Scan the working tree and the whole git history | `git log --all -p` searched for: `C:\Users\`, your user name, the AI provider key patterns (`sk-`, `AIza`, `Bearer `), `songs.json`, `Xplayer-Data`, `.dev-data`, e-mail addresses, absolute `E:\` paths. I give the exact commands in a small script (`tools/dev/scan-history.js`, read-only) so the output is one list. |
| B2 | Decide D1 from the list | Clean: publish with history. Anything found: new repository with one commit, or rewrite history first. |
| B3 | Issue templates | A bug template that asks for the version and "Copy diagnostics" output, and says never to paste song paths or keys (the diagnostics already remove paths; say so). |

### C. Build and release automation (me, one patch; you click)

| # | Step | Detail | Done when |
|---|---|---|---|
| C1 | Prove today's build | Push; open Actions; `build` must pass; download the artifact. If it fails, that is the first fix and it blocks everything below. | You tell me green or send the log. |
| C2 | `release.yml` | Runs on tag `v*` and on manual start. `windows-latest`, Node 24, `npm ci`, `npm run dist`, `check-dist.js`, `check-fuses.js`, `check-release.js`. Renames the zip to `Xplayer-<version>-win-x64.zip`, writes `SHA256SUMS.txt`, takes the notes from the CHANGELOG section, then `gh release create <tag> --prerelease --notes-file ... <zip> <sums>`. A tag with `-` in it (beta, rc) is always a pre-release. `permissions: contents: write`, nothing else. Manual start without a tag only uploads the artifact (a dry run). | A dry run makes the zip and the sums; a tag makes a Pre-release. |
| C3 | Pin and cache | Actions pinned to a major version (already `@v4`); `npm ci` only; no `npm install` in release. | Review of the file. |
| C4 | Test gate | The release workflow does not run the browser tests (they are slow and 8 unit tests fail on purpose). Before tagging, you run `npm run test:quick` and `npm test` locally, and I compare the failures to the known list; nothing new is allowed. | Failure list equals the known list. |

### D. Check the real build on Windows (you; blocks the tag)

Use the zip from C1 or the dry run, **not** your development folder. A second Windows user account or a clean virtual machine is best; at least rename `.dev-data` and use a new folder with a space in its name.

| # | Check |
|---|---|
| D-1 | Unzip, run `Xplayer.exe`. No Node, no repository needed. It starts, no console error window, the start-up screen goes away. |
| D-2 | First run with nothing: the empty Home and Library are sensible, "add a folder" works, a scan of a real folder finishes, songs play. |
| D-3 | `Xplayer-Data` appears beside the exe and nothing is written to your user profile except what Electron itself needs. |
| D-4 | `docs/SMOKE-CHECKLIST.md` end to end. Plus the new things of this month: visualizer (on, left side, song info Hide/Keep), Home hero and pick up where you left off, plain and synced lyrics. |
| D-5 | Close and reopen mid-song: Home offers the pick-up; the library is intact; `Xplayer-Data/library/backups` exists after a while. |
| D-6 | Update test: put a newer build over the folder keeping `Xplayer-Data`: library and settings survive. |
| D-7 | Second launch while open: the first window comes forward. |
| D-8 | Windows warnings: note exactly what SmartScreen and Defender show (screenshot) for the README wording. If Defender quarantines the exe, tell me: that changes the plan (signing moves up). |
| D-9 | Idle CPU and memory with the visualizer off and on (Task Manager), and `node tools/dev/bench-visualizer-app.js` once. |
| D-10 | Portable: uninstall = delete the folder; nothing left behind except what D-3 expects. |
| D-11 | Installer: run `Xplayer-Setup-...exe` (no administrator prompt), pick a folder with a space in it, Start menu and desktop shortcuts work, the app starts and keeps its data in `%APPDATA%\Xplayer` (not beside the exe: no `portable.txt`). Install a newer build over it: library and settings survive. Uninstall from Windows Settings: the program goes, `%APPDATA%\Xplayer` stays. Note the SmartScreen text for the setup exe too. |

### E. Publish (you, about ten minutes once A to D are done)

1. Merge the patches, run `npm run test:quick`, commit.
2. `git tag v1.0.0-beta.1` and `git push origin main --tags`.
3. Watch the release workflow; open the Release page: ticked **Pre-release**, zip and `SHA256SUMS.txt` attached, notes read well.
4. Download the zip **from GitHub** on the clean profile, check the hash (`certutil -hashfile <zip> SHA256`), run D-1 and D-2 again.
5. If it is wrong: delete the release and the tag, fix, tag `v1.0.0-beta.2`. Never reuse a tag.

### F. After the first pre-release (not blocking)

| # | Step | Note |
|---|---|---|
| F1 | Update notice (dev plan 5.3) | Once a day, one read of the latest GitHub Release, a "Version x is out" note with a link, no download, off switch. Worth doing before a second pre-release. |
| F2 | Signing (5.4) | Check the free open-source signing programmes (SignPath Foundation first; terms to be verified) after you see how SmartScreen and Defender behave (D-8). |
| F3 | Installer polish | The installer itself is in the release now (C2). Later: a licence page, a custom icon for the setup exe, an uninstaller survey of leftovers. |
| F4 | Feedback loop | Read issues for a week; collect "Copy diagnostics" outputs; fix before beta.2. |

## Order and size

C1 first (it can fail and it costs nothing), in parallel B1 (you) and A1 to A6 (me, one patch). Then C2 to C4 (me, one patch), then D (you), then E. Realistic total: two patches from me, one evening of checks from you, if C1 and B1 are clean.

## Blocking summary

Blocks the tag: D1 to D6 answered, C1 green, B1 clean, A patch applied, C patch applied, D-1 to D-8 passed.
Does not block: F1 to F4, the Home creativity round, the formats plan, the old interface's retirement, the DP14 total (listed as a known problem).
