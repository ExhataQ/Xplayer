// ==============================================================================
// LYRICS - UI REACTIONS
// ==============================================================================
// Subscribes to 'lyrics:changed' and redraws the Lyrics view. Replaces 16 direct
// renderLyricsView() calls in 08b, 08g, 11a, 11b, 11f, 18 and 19. 14 emitters send it only while the
// Lyrics view is open; the two editor buttons in 18 (saveLyricsFromEditor / clearLyricsForCurrentSong)
// send it always, and the guard below keeps them from drawing the Lyrics page over another page.

on('lyrics:changed', () => {
    if (typeof bumpSmartLyricsHaveVersion === 'function') bumpSmartLyricsHaveVersion(); // the Batch list's "has lyrics" answers are kept until a lyric changes
    if (currentView === VIEWS.LYRICS) renderLyricsView(); // never over another page: see renderLyricsView
});

// Another song starts while the Find page is open: the page is left as it is, only the "Use playing song" button is updated, unless "Auto" is ticked (then the new song is loaded).
on('queue:indexChanged', () => {
    if (currentView === VIEWS.ONLINE_LYRICS) followPlayingSongInOnlineLyrics();
});

// Nothing to register: this file only subscribes to events while it loads. The empty export makes it a module.
export {};
