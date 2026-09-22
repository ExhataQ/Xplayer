# ExhataQ Music Player — Project Instructions

## Project

Public repository: https://github.com/ExhataQ/ExhataQ
Keep the repository public when sharing it.

This is a free, local Electron music player for Windows.

The repository root contains `Source/`, which is the development source, and `App/`, which contains the built/runtime application.

Main source structure:

* `Source/build/` — Python build system and HTML template.
* `Source/src/js/` — renderer JavaScript.
* `Source/src/css/` — renderer CSS.
* `Source/electron/` — Electron main process, IPC, scanner, metadata, downloads, lyrics, and other backend functionality.
* `Source/tools/` — tests, development utilities, fonts, icons, playgrounds, and change log.

The application is built by running:

`Source/build/music_player.py`

The build script generates the application under:

`App/MusicPlayerOutput/`

The runtime is launched through:

`App/electron.exe`

Do not confuse build-time processing with runtime processing.

### Important architecture mapping

`Source/electron/scan-folder.js` is the runtime audio scanner. It uses `music-metadata` and handles importing files, changing folders, downloads, rebuilds, and metadata scanning.

`Source/build/music_player.py` is the build system. It does not perform audio metadata scanning. It generates the deployed application and preserves existing song data when appropriate.

The Electron files under `Source/electron/` are copied into the built application.

The renderer files under `Source/src/js/` and `Source/src/css/` are copied into `App/MusicPlayerOutput/`.

`Source/src/js/99-player.js` is the renderer bootstrap/template containing generated song data placeholders.

`Source/tools/change.log.txt` is the append-only project change log.

`Source/tools/tests/` contains the project's tests.

The UI playground under `Source/tools/ui-playground/` is a Vite-based visual development environment. Its Vite config, Node dependencies, and package manifest remain under `more tools/ui-playground/`. It uses the production CSS and mock data without requiring the Electron runtime.

### Important file ownership

Before changing something, identify which layer owns the behavior.

* Audio scanning / tag extraction / supported formats / cover extraction → `electron/scan-folder.js`
* Metadata reading/writing → `electron/metadata-editor.py` and its Node wrapper
* MusicBrainz / Cover Art Archive → `electron/online-metadata.js`
* LRCLIB → `electron/online-lyrics.js` and `src/js/19-online-lyrics.js`
* Electron IPC / application bootstrap → `electron/main.js`
* Window behavior → `electron/window-manager.js`
* Renderer playback / queue / shuffle → `src/js/10-playback.js`
* Playback controls → `src/js/15-playback-controls.js`
* Metadata editor UI → `src/js/20-metadata-editor.js`
* Storage / settings → `src/js/03-storage.js`
* Views → `src/js/07-views.js`
* Panels/settings/search → `src/js/08-panels.js`
* Virtual scrolling → `src/js/05-lazy-load.js`
* Main renderer UI → `src/js/04a-ui-render-core.js` and `04b-ui-render-views.js`
* Lyrics parsing/sync → `src/js/11-lrc.js`
* Online lyrics UI → `src/js/19-online-lyrics.js`
* Language detection → `src/js/21-language-detect.js`
* Styling → the appropriate file in `src/css/`

Do not duplicate functionality into another file merely because it is convenient. Follow the existing architecture.

## Workflow

### 1. Understand first

When I give you code, a patch, an error, or a requested change:

* Inspect the relevant existing implementation first.
* Identify the actual code path responsible for the behavior.
* Make the smallest reasonable change.
* Preserve existing behavior unless the requested change requires otherwise.
* Do not refactor unrelated code.
* Do not redesign working systems unnecessarily.

Do not run the entire test suite at the beginning of every conversation.

I normally provide code from a state that I have already tested.

### 2. Implement first, test after changes

When I provide code and ask for a modification:

1. Inspect the relevant code.
2. Make the requested changes.
3. Then run the tests relevant to the changed functionality.
4. Report what was tested and the result.

Do not test the unchanged baseline simply to prove that it worked before the conversation.

If a test is expensive, unrelated, or known to be irrelevant, do not run it unless there is a reason.

Prefer focused tests over the entire test suite.

For example:

* Scanner change → scanner tests.
* Metadata/cover change → metadata/online-metadata tests.
* Storage change → storage tests.
* Shuffle change → shuffle tests.
* Virtual scrolling/layout change → scroll test.
* Renderer-only change with no applicable automated test → perform the appropriate static/syntax checks and explain what was verified.

If a relevant test does not exist, consider adding a focused regression test when appropriate.

### 3. Do not waste tokens

Optimize for useful work rather than lengthy narration.

Before editing, spend tokens understanding the relevant code, not explaining obvious things to me.

Do not repeatedly restate the project architecture.

Do not explain unchanged code.

Do not dump entire files.

Do not regenerate code that has not changed.

Do not perform broad searches or inspect unrelated files unless necessary.

Keep responses concise and report only:

* what changed
* why it changed
* what was tested
* any remaining issue

### 4. Comments

Do not add comments to code unless the comment is genuinely useful for explaining non-obvious behavior, an important constraint, or a deliberate workaround.

Do not add comments that merely restate what the code does.

Do not add large explanatory comment blocks.

### 5. Change log

Whenever you modify a source file, update:

`Source/tools/change.log.txt`

Use the existing format:

* date on its own line
* file name on its own line
* bullet list describing the changes

Only describe actual changes made.

Do not rewrite old entries.

### 6. Prompt/project documentation

If a file's responsibility or architecture materially changes, update the corresponding project documentation/reference so the description remains accurate.

Do not rewrite the entire project description after every small code change.

Only update the relevant mapping when its responsibility actually changes.

## Git and patches

Git is the source of truth.

Before creating a commit, inspect:

`git status`

and the relevant diff.

Keep unrelated changes separate.

Do not accidentally include existing user changes in a commit.

When I ask for a patch or when changes need to be transferred between environments, provide a `.patch` file rather than a ZIP containing modified source files.

Prefer Git patches generated from the actual repository changes.

Use clear patch filenames describing the change, for example:

`0001-fix-cover-art.patch`
`0002-fix-scanner-tags.patch`

If multiple independent changes are being delivered, keep them as separate patches when practical.

If I give you a patch file, inspect/apply it against the current Git state rather than assuming the patch still matches the current source.

After applying a patch, verify:

* what files changed
* whether unrelated files were touched
* whether conflicts occurred
* whether the resulting diff is correct

Do not force a patch through conflicts without first understanding what changed.

### Commits

Use focused commit messages.

Do not create commits containing unrelated work.

Before committing:

* inspect `git status`
* inspect the relevant diff
* run relevant tests
* check `git diff --check`

After committing, report the commit hash and summary.

## Build verification

When a change affects the built application or build process, run:

`Source/build/music_player.py`

when appropriate, then verify the generated output.

Do not rebuild unnecessarily for changes that are purely source/test/documentation changes.

Remember that changing source files does not automatically change `App/MusicPlayerOutput/` until the build is run.

## Testing philosophy

Tests are for validating changes, not for repeatedly validating the unchanged starting point.

Do not begin every new task with:

`npm test`

or another full-suite run.

Instead:

* modify
* run the smallest relevant test(s)
* expand testing only if the change warrants it

If a test fails, investigate whether it is caused by the current change before modifying unrelated code.

Never modify tests simply to make a legitimate implementation failure disappear.

## Output style

When explaining implementation changes, be direct.

For code changes, prefer showing only the changed section rather than the entire file.

However, when changes are being delivered as Git patches, the patch is the primary artifact; do not waste tokens reproducing large code blocks in the response.

When useful, explain changes as:

`Changed: ...`
`Reason: ...`
`Tested: ...`

Do not provide generic praise or lengthy explanations unless I ask for them.

## Important constraints

* Preserve the existing UI unless the task specifically changes the UI.
* Preserve existing functionality unless the task specifically changes it.
* Avoid unnecessary dependencies.
* Prefer existing project utilities and architecture.
* Do not introduce paid services or premium functionality.
* Do not replace working systems with a different architecture without a reason.
* Keep changes incremental and reversible.
* Treat performance regressions seriously, especially scanning, cover processing, rendering, virtual scrolling, and playback.

If uncertain about an architectural decision, inspect the existing implementation and explain the tradeoff before making a large change.

When I provide code and say to proceed, start working on the requested change rather than asking me to repeat the project context.

## Ready state

The project context above is the baseline.

When I send code, inspect it and begin the requested change.

Do not run baseline tests before making the change unless I specifically ask for that.

After making the change, run the relevant tests and report the results.
# Music Player Development Workflow

## Role

Work directly on the requested change in the Electron music-player project. Start implementing the requested change rather than spending the beginning of the task repeatedly testing or re-verifying the already-working baseline.

The user will handle Git, commits, pushes, and patch application on their own. Do not perform or instruct Git/commit workflows unless specifically requested.

The goal is to make correct, focused changes while minimizing unnecessary token usage, tool calls, repeated testing, and large code dumps.

## Project Structure

The project is an Electron desktop music player.

Important source areas:

* `Source/electron/` — Electron main-process code, scanner, metadata backends, downloads, windows, etc.
* `Source/electron/scan-folder.js` — runtime music scanner and metadata/cover extraction. Changes involving supported formats, scanned metadata fields, duration, cover extraction, cover hashing, and file URLs normally belong here.
* `Source/src/js/` — renderer JavaScript. Files are numerically ordered and their load order matters.
* `Source/src/css/` — renderer styles.
* `Source/build/music_player.py` — build-time script that assembles the application. It is not the runtime music scanner.
* `Source/build/music_player.html` — build template.
* `Source/tools/tests/` — automated tests.
* `Source/tools/change.log.txt` — project change log.
* `Source/tools/` — development tools, test pages, playgrounds, and supporting files.
* `App/` — generated/deployed output. Do not treat generated `App` files as the source of truth or edit them instead of `Source`.

The application uses Electron with `nodeIntegration: false` and `contextIsolation: true`.

The renderer is split across multiple numbered JavaScript files. Preserve the existing load-order architecture.

Current relevant systems include:

* local music scanning
* metadata editing
* MusicBrainz / Cover Art Archive metadata lookup
* LRCLIB online lyrics
* cover extraction and thumbnail generation
* Sharp as the primary thumbnail engine with Jimp as fallback
* playback, queue, recents, search, and shuffle systems

## Implementation Rules

Start implementing the requested change after understanding the relevant code.

Do not begin every task by running the entire test suite or rebuilding the application. The user has already verified the existing baseline.

Before editing:

* Inspect only the files relevant to the requested change.
* Search for the relevant functions, symbols, selectors, or data flow instead of reading unrelated large files.
* Preserve existing behavior outside the requested scope.
* Do not perform broad refactors unless they are necessary for the requested change.
* Preserve existing UI dimensions, spacing, behavior, and styling unless the request specifically changes them.
* Do not add unnecessary comments.
* Do not duplicate existing functionality. Reuse existing helpers and systems when appropriate.
* Do not modify generated `App` output as the primary implementation.
* Protect unrelated existing/uncommitted work.

When a change affects scanner behavior, treat `electron/scan-folder.js` as the primary runtime location unless the architecture clearly requires another file.

When a change affects build-time assembly, use `build/music_player.py`.

When a change affects renderer behavior, modify the appropriate numbered file in `src/js/` and preserve its dependency/load-order assumptions.

## Token-Efficient Investigation

Prefer targeted inspection:

* Search for exact function names, selectors, variables, and event handlers.
* Read only the relevant sections of large files.
* Use existing tests and existing utilities instead of creating redundant infrastructure.
* Do not repeatedly rediscover project architecture that is already established above.
* Do not repeatedly summarize the entire project.
* Do not paste complete files into the response.
* Do not generate large explanations when a concise implementation summary is sufficient.

Make multiple related edits before testing rather than testing after every tiny edit.

## Testing Strategy

Testing happens AFTER implementation, not as a baseline ritual.

Run the smallest relevant automated tests after the requested changes.

Examples:

* Scanner changes → scanner/tag/metadata tests.
* Online metadata changes → online metadata tests.
* Metadata editor changes → metadata editor/backend tests.
* Playback changes → relevant playback tests or focused runtime checks.
* Pure CSS/UI changes → automated tests only if relevant; otherwise inspect the affected UI logic and provide a manual test checklist.
* Changes touching shared/core functionality → expand testing when justified.

Do not repeatedly run the same test suite after every small correction. Batch related fixes and test again.

Run broader tests only when:

* the focused tests fail,
* a shared/core system was changed,
* the change crosses multiple subsystems,
* or broader verification is specifically useful.

Use `git diff --check` only if Git is available and useful for checking the edited diff; do not make Git operations part of the normal workflow.

## Build Verification

Do NOT automatically rebuild the entire application after every change.

Perform build verification only when the requested change affects:

* the build process,
* generated output,
* packaging/deployment behavior,
* source-to-output copying,
* build-time data injection,
* or another area where the build itself is part of the requested behavior.

For ordinary renderer, scanner, metadata, or UI changes, focused tests plus code inspection are normally sufficient.

If a build is actually required, state why it is required and verify the relevant result.

## Change Log

When modifying project source code, update:

`Source/tools/change.log.txt`

Keep the entry concise and describe what actually changed.

Do not create lengthy documentation for small fixes.

## Manual Verification

After implementation and automated testing, ALWAYS provide a concise manual inspection checklist when the change affects behavior that the user can test in the actual application.

The checklist should contain concrete actions and expected results.

For example:

Manual test:

1. Open the application.
2. Open the Metadata Editor.
3. Select a song containing multiple artists.
4. Change the artist field and save.
5. Reopen the editor.
6. Confirm the exact value remains unchanged.
7. Reload/rebuild the library if relevant.
8. Confirm the scanner still displays the expected metadata.

Do not give generic instructions such as "test everything."

The checklist should specifically target the risks introduced by the change.

If there are several independent areas affected, separate them into short test groups.

## Final Verification Flow

After implementation:

1. Inspect the changed code for obvious regressions.
2. Run the smallest relevant automated tests.
3. Fix failures caused by the implementation.
4. Re-run the relevant tests after fixes.
5. If a build is genuinely required, perform the relevant build verification.
6. Give the user a short manual-testing checklist.
7. Clearly state what was tested automatically and what still requires manual testing.
8. Do not claim the feature is fully verified until the manual checks have been performed by the user.

The user will decide whether the manual results are acceptable and will handle Git/commits themselves.

## Patch Files

When delivering completed changes for the user to apply elsewhere, prefer a `.patch` file or patch-ready diff as the primary deliverable.

Do NOT package completed source changes into a ZIP unless the user explicitly asks for a ZIP.

If producing a patch:

* include only the intended changes,
* do not include unrelated files,
* include `tools/change.log.txt` when it was part of the requested source changes,
* clearly state which files the patch changes,
* clearly state whether any changes were intentionally excluded.

The patch should be usable for applying the actual implementation, not merely a conceptual example.

## Reporting Results

Keep the final report concise.

Use this structure:

Implementation:

* What changed.
* Exact relevant file paths.

Automated tests:

* Tests run.
* Pass/fail result.
* Important failures, if any.

Build:

* Only mention build verification if it was actually necessary/performed.

Manual testing:

* Concrete steps the user should perform.
* Expected results.

Deliverable:

* Patch file if one was requested/created.
* Any important notes or known limitations.

Do not include long code listings unless specifically requested.

## Important Principle

Prioritize implementation and useful verification over ceremony.

Do not:

* test the untouched baseline just because a new conversation started,
* rebuild unnecessarily,
* repeatedly reread the whole project,
* repeatedly run the same tests,
* dump entire files into responses,
* perform Git/commit operations,
* create ZIPs when a patch is sufficient,
* refactor unrelated code.

Implement → focused automated test → inspect → manual test checklist → user verifies.
