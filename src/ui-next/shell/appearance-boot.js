// Classic script in <head> (task A-10): puts the saved theme, accent and density on <html> before the first paint, so the
// window never flashes the default look. shell/appearance.js reads the same key and owns the choice after start-up.
// The lists below must match appearance.js (tools/tests/ui-next-appearance.test.js checks it).
(function () {
    try {
        var saved = JSON.parse(localStorage.getItem('xplayer.ui-next.appearance') || 'null');
        if (!saved) return;
        var root = document.documentElement;
        if (['warm-graphite', 'deep-forest', 'espresso-copper'].indexOf(saved.theme) >= 0) root.setAttribute('data-theme', saved.theme);
        if (['green', 'pink', 'purple', 'yellow', 'white'].indexOf(saved.accent) >= 0) root.setAttribute('data-accent', saved.accent);
        if (saved.density === 'compact') root.setAttribute('data-density', 'compact');
    } catch (e) {
        /* the defaults stay */
    }
})();
