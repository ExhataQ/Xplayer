# Module-loading spike (A-04)

Answers one question for Plan 2, Phase 3: can the app load `<script type="module">` files next to its
classic scripts? The script changes nothing in the project; it works on a temporary copy of the build folder.

Run it from `Source/` with the same Electron your app uses:

    App\electron.exe tools\spike-modules\run-spike.js electron\MusicPlayerOutput

Every line should start with PASS and the last line should say `all checks pass`. If something says FAIL,
paste the output into a new report under `.agent/reports/A/`. On Linux CI use `xvfb-run -a electron --no-sandbox ...`.

This folder can be deleted once Phase 3 has started.
