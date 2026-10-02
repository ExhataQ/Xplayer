// ==============================================================================
// RIGHT PANEL - UI REACTIONS
// ==============================================================================
// Subscribes to 'rightPanel:tabChanged' (emitted by switchRightPanelTab in 08d after the
// header and buttons were updated) and draws the content of tabs that are built on demand.
// Moved unchanged from switchRightPanelTab(); the tab check used to be an if there.

on('rightPanel:tabChanged', (e) => {
    if (e.detail.tab === 'recently-played') {
        renderPortableRecentlyPlayed();
    }
});
