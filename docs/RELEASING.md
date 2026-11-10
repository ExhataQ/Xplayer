# Releasing

The plan and its reasons: `.agent/PRERELEASE-PLAN.md`. This file is the runbook.

## What a release is

A tag `vX.Y.Z[-suffix]` makes `.github/workflows/release.yml` build, on Windows, and attach to a **draft** GitHub Release:

| File | What |
|---|---|
| `Xplayer-<version>-win-x64.zip` | the portable app: unzip anywhere, run `Xplayer.exe`; the library and settings stay in `Xplayer-Data` beside it |
| `Xplayer-Setup-<version>-x64.exe` | the installer (NSIS, per user, no administrator needed, choose the folder, Start menu and desktop shortcuts); the library and settings are in `%APPDATA%\Xplayer`; uninstalling keeps them |
| `SHA256SUMS.txt` | the hashes of both |

A tag with a `-` in it (`-beta.1`, `-rc.1`) is marked Pre-release. The Release stays a draft until you press Publish.

Neither file is signed (see "Signing" below), so Windows shows a SmartScreen warning.

## Steps

1. Check `docs/KNOWN-PROBLEMS.md` is still true.
2. `node tools/dev/make-notices.js` if `package-lock.json` changed (a test fails when the notices are out of date).
3. `node tools/dev/release-tools.js prepare 1.0.0-beta.1`: the CHANGELOG's "Unreleased" becomes the version's section (with today's date), a new empty "Unreleased" goes above it, and `package.json` and `package-lock.json` get the version.
4. `npm run test:quick`, then `npm test`; the failures must be the known ones.
5. Optional dry run: GitHub > Actions > release > Run workflow. It builds and keeps the files for 7 days without making a Release. Try both files on a clean Windows profile (`.agent/PRERELEASE-PLAN.md` step D).
6. Commit, then `git tag v1.0.0-beta.1` and `git push origin main --tags`.
7. When the workflow is green, open Releases: the draft has the notes, the two files and the hashes. Read the notes, then **Publish**.
8. Download from the published page on a clean profile, check the hash with `certutil -hashfile <file> SHA256`, run both.

A mistake after publishing: delete the Release and the tag, fix, and use the next number (`-beta.2`). A tag is never reused.

## Installer and portable: where the data goes

`electron/app-paths.js` decides. The portable zip has `portable.txt` beside the exe (added by `tools/dev/make-portable.js`), so it keeps data in `Xplayer-Data`. The installer does not have that file (`release-tools.js installer` checks), so the app uses the user profile folder. The two do not share a library.

## Signing

Not done. An unsigned exe makes SmartScreen warn until enough people have run it. The free route to look at is the SignPath Foundation programme for open-source projects (terms to be verified by the owner). Until then the README and the release notes say what the warning looks like.
