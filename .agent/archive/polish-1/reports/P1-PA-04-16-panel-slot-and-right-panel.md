# P1-PA-04 and PA-16: panel slot API and right panel slot

Agent A, 2026-10-21. Status: in review.

## What changed
- `shell/panels.js` (new): `registerPanel(id, { mount(body) -> { show, hide }, collapsible })`, `showPanel`, `hasPanel`, `currentPanel`. Library registers itself. B adds Search and Recents the same way (PB-02).
- `shell/shell.js`, `shell.css`: bottom rail group (Lyrics, Metadata, Settings), clicking the active panel item closes or reopens its panel, collapse button only for collapsible panels, main-view items leave the panel as it is (DP2).
- `shell/right-panel.js` (new, PA-16/DP11): `registerRightPanel({ mount(body) })`. One provider (Agent C: lyrics plus big cover, or cover and track info when there are no lyrics, PC-13). Until it registers there is no button and no panel. Button uses the new `panel-right` icon, placed before the bell.
- Push layout: a 4th grid column; the list gets narrower. Width 280 to 420, default 320, set by dragging the left edge, arrow keys, Home/End, Enter or double-click (reset). Width and open state are saved in localStorage.
- Narrow windows: the list keeps at least 420 px. If the window cannot spare that, the panel hides (saved choice kept, comes back on widening) and the button opens it as an overlay; Escape closes it.
- Colour: panel surface token (DP1: keep today).
- Icon: one `panel-right` entry added to `icons.js` by hand (a regenerate changed an unrelated icon).
- Tests: `ui-next-panels.test.js` (6) and `ui-next-right-panel.test.js` (6); `ui-next-library.test.js` expectation updated for DP2.

## Checked
- Every `ui-next-*.test.js` run one by one: no failures. Lint: no errors.
- Run only in headless Chromium through the test fixture.

## Not run
- Real Electron and Windows: window resizing with the native frame, DPI scaling, mouse drag at the window edge.
- Full `node --test tools/tests/*.test.js` after these changes.

## Open
- DP11 (b) minimum list width (420 assumed) and (c) relation to the Lyrics rail item.
- C must provide the provider; nothing shows until then.
