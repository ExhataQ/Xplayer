# Project Agent Instructions

## 1. Archive Before Every Change

Before modifying, creating, deleting, renaming, or moving any project file, create a complete snapshot of the current project.

The project is located at:

`E:\Programming\Music Player\Workbench\Electron music player`

The archive root is:

`E:\Programming\Music Player\Workbench\Archive`

### Archive selection

Do not assume that `G` is permanently the active archive folder.

Before every change:

1. Inspect the contents of the archive root.
2. Identify the latest archive group/folder using alphabetical ordering.
3. Use the latest existing archive group as the active archive group.
4. Inspect its existing numbered snapshots such as `G1`, `G2`, `G3`, etc.
5. Determine the next unused snapshot number.
6. Create the new snapshot inside the active archive group.
7. Copy the entire current project folder into that snapshot before making any modification.

For example, if the latest archive group is:

`Archive\G`

and it contains:

`G1`
`G2`
`G3`

create:

`Archive\G\G4\Source`

If a newer alphabetically ordered archive group exists, use that group instead.

The snapshot must contain the complete project source state before the requested change, not only the files expected to be modified.

### Archive safety

Never:

* overwrite an existing archive snapshot,
* reuse an existing snapshot number,
* modify the archived copy after creating it,
* skip the archive because the requested change appears small,
* edit the project before the archive has been successfully created and verified.

After copying, verify that the snapshot exists and contains the expected project structure.

If the archive root cannot be accessed, the latest archive group cannot be determined, the next snapshot already exists, or the archive cannot be successfully created/verified:

**STOP. Do not modify the project. Report the exact problem.**

The archive must be completed before any project modification.

---

## 2. Project Structure

This is an Electron desktop music player.

Important source locations:

* `Source/electron/` — Electron main-process code, scanner, metadata systems, downloads, windows, IPC, etc.
* `Source/electron/scan-folder.js` — runtime music scanner and metadata/cover extraction.
* `Source/src/js/` — renderer JavaScript.
* `Source/src/css/` — renderer CSS.
* `Source/build/music_player.py` — build-time application assembly.
* `Source/build/music_player.html` — build template.
* `Source/tools/tests/` — the canonical automated test suite.
* `Source/tools/change.log.txt` — project change log.
* `Source/tools/` — development tools, test pages, playgrounds, and supporting files.
* `App/` — generated/deployed application output.

`Source/` is the source of truth.

Do not make the primary implementation by editing generated files under `App/`.

The application uses Electron with:

* `nodeIntegration: false`
* `contextIsolation: true`

Preserve the existing security architecture and IPC/contextBridge boundaries.

Renderer JavaScript files are numerically ordered. Preserve their existing load-order assumptions.

---

## 3. Important Architecture Rules

`Source/electron/scan-folder.js` is the runtime scanner.

Changes involving things such as:

* supported audio formats,
* scanned metadata,
* duration,
* embedded cover extraction,
* cover hashing,
* cover/file URLs,
* scanner behavior,

normally belong in `scan-folder.js`.

`Source/build/music_player.py` is a build-time assembly script. It is not the runtime scanner.

Do not move runtime scanning logic into the build script just because the build script is involved in generating the application.

The project currently uses Sharp as the primary cover-thumbnail engine with Jimp as a fallback. Do not replace or restructure this system unless the requested change requires it.

Existing online systems include MusicBrainz/Cover Art Archive metadata and LRCLIB lyrics. Preserve their existing caching, retry, fallback, and failure-handling behavior unless the task specifically changes it.

---

## 4. Start Implementing, Do Not Waste Time Rechecking the Baseline

When the user gives a change request:

1. Understand the requested behavior.
2. Inspect only the relevant files and code paths.
3. Start implementing the change.
4. Do not run the entire test suite merely to prove that the untouched baseline works.

The user already maintains and tests the working application.

Do not repeatedly rediscover the project architecture or reread unrelated files.

Prefer:

* targeted searches,
* exact symbol/function searches,
* relevant file sections,
* existing tests,
* existing helpers,
* focused code inspection.

Avoid unnecessary full-file reads when the relevant code can be located directly.

---

## 5. Preserve Existing Work

Before modifying a file, understand whether it already contains work unrelated to the current request.

Never:

* overwrite unrelated changes,
* revert existing user changes,
* replace an entire file unnecessarily,
* perform a broad refactor simply because the surrounding code could be cleaner.

If unrelated changes are already present, preserve them.

If the requested change conflicts with existing work and cannot safely be separated, stop and report the conflict instead of silently overwriting it.

---

## 6. Make Focused Changes

Implement the smallest clean change that satisfies the request.

Prefer existing architecture and helpers over creating duplicate systems.

Do not introduce:

* unnecessary abstractions,
* duplicate helper functions,
* redundant state,
* unnecessary dependencies,
* unrelated UI changes,
* unrelated refactors.

Do not add comments unless they explain genuinely non-obvious behavior.

Do not rewrite functioning code merely to make it stylistically different.

Preserve existing:

* UI dimensions,
* spacing,
* layout,
* button behavior,
* tooltips,
* keyboard behavior,
* existing data formats,
* compatibility behavior,

unless the requested change explicitly modifies them.

---

## 7. Testing

Testing is performed after implementation.

Do not automatically run the complete test suite at the beginning of every task.

After making changes:

1. Inspect the modified code.
2. Run the smallest relevant automated tests.
3. Fix failures caused by the implementation.
4. Re-run the relevant tests.
5. Expand testing only when the change affects shared/core functionality or focused tests indicate a wider problem.

Examples:

Scanner change:

* run scanner/tag/metadata tests.

Online metadata change:

* run online metadata tests.

Metadata editor change:

* run metadata/backend tests.

Pure UI/CSS change:

* automated tests may not be useful; inspect the affected code and provide manual testing instructions.

Do not run the same expensive test suite repeatedly after every small edit. Batch related changes first.

Clearly distinguish:

* failures caused by the new change,
* pre-existing failures,
* unrelated environmental problems.

Never claim that a test passed unless it was actually run.

---

## 8. Build Verification

Do not rebuild the entire application after every change.

Build verification is required when the requested change affects:

* the build system,
* generated output,
* source-to-output copying,
* build-time data injection,
* packaging/deployment,
* or another behavior that specifically depends on the build process.

For ordinary renderer, scanner, metadata, or CSS changes, focused tests and code inspection are normally sufficient.

If a build is necessary, perform the relevant build verification and report the result.

Do not spend time rebuilding the application solely for ceremony.

---

## 9. Manual Verification

After implementation, provide a concise manual test checklist whenever the change affects behavior that should be tested in the actual application.

The checklist must be specific to the change.

For example:

1. Open the application.
2. Open the Metadata Editor.
3. Select a song with multiple artists.
4. Change the artist value.
5. Save it.
6. Reopen the editor.
7. Confirm the exact value remains intact.
8. Rescan if relevant.
9. Confirm the displayed metadata is still correct.

Do not say only:

> Test the feature.

Tell the user exactly what to do and what result should be expected.

Manual verification belongs to the user when the actual application/runtime is not available to the agent.

Do not claim the entire task is verified until the required manual checks have actually been performed.

---

## 10. Change Log

When modifying project source code, update:

`Source/tools/change.log.txt`

Keep the entry concise.

Describe what actually changed rather than writing a long explanation.

Do not modify the change log for unrelated reasons.

---

## 11. Patch Deliverables

When a completed change needs to be delivered for application elsewhere, prefer a `.patch` file or patch-ready diff.

Do not create a ZIP unless the user explicitly requests a ZIP.

A patch should:

* contain only the intended changes,
* preserve unrelated files,
* include the change-log update when appropriate,
* identify all changed files,
* clearly identify anything intentionally excluded.

Do not dump complete modified source files into the response when a patch is sufficient.

---

## 12. No Git/Commit Workflow

The user handles Git personally.

Do not:

* create commits,
* push commits,
* configure Git,
* manage branches,
* reset/revert the user's repository,
* treat Git history as the project's backup system.

The archive system described above is the required pre-change safety mechanism.

If the user explicitly asks for Git-related work, follow that separate request.

---

## 13. Final Report

After completing the implementation, re
