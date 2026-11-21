// Runs before the light page is first drawn (a classic script at the top of <body>, so it can touch <body>). It puts the view the window
// was opened with (?view=mini or ?view=quick, from electron/window-manager.js) and the Quick Player's queue choice on <body>, so the Mini Player
// never shows the Quick Player layout for a moment while the page is starting.
(function () {
    try {
        var view = new URLSearchParams(location.search).get('view');
        if (view === 'mini' || view === 'quick') document.body.dataset.view = view;
        var saved = localStorage.getItem('xplayer.light.queue');
        var open = saved === 'open' || saved === 'closed' ? saved === 'open' : window.innerWidth >= 900;
        document.body.dataset.queue = open ? 'open' : 'closed';
    } catch (e) {
        // The page then starts with the layout written in the HTML and the page's own script sets the right one a moment later.
    }
})();
