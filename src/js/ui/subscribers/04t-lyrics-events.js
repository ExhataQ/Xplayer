// ==============================================================================
// LYRICS - UI REACTIONS
// ==============================================================================
// Subscribes to 'lyrics:changed' and redraws the Lyrics view. Replaces 16 direct
// renderLyricsView() calls in 08b, 08g, 11a, 11b, 11f, 18 and 19. Each emitter keeps the
// exact condition it had before (14 emit only while the Lyrics view is open; the two
// editor buttons in 18 saveLyricsFromEditor / clearLyricsForCurrentSong never had one).

on('lyrics:changed', () => {
    renderLyricsView();
});

// Nothing to register: this file only subscribes to events while it loads. The empty export makes it a module.
export {};
