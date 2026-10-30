// Classic script in <head> (task A-10): puts the saved theme and density on <html> before the first paint, so the
// window never flashes the default look. shell/appearance.js reads the same key and owns the choice after start-up.
// The lists below must match appearance.js (tools/tests/ui-next-appearance.test.js checks it).
(function () {
    try {
        var saved = JSON.parse(localStorage.getItem('xplayer.ui-next.appearance') || 'null');
        var root = document.documentElement;
        // the defaults: a neutral, standard scrollbar (shell/appearance.js DEFAULTS); a saved choice of the theme color or the flush bar replaces them
        root.setAttribute('data-scrollbar', 'neutral');
        root.setAttribute('data-scrollbar-shape', 'standard');
        if (!saved) return;
        if (['warm-graphite', 'pure-black', 'graphite-gold', 'carbon-honey', 'deep-forest', 'espresso-copper', 'midnight-blue', 'aubergine-rose', 'ocean-teal', 'crimson-noir', 'violet-night', 'high-contrast'].indexOf(saved.theme) >= 0) root.setAttribute('data-theme', saved.theme);
        if (saved.theme === 'custom' && saved.custom && saved.custom.vars) {
            // the built theme: its saved values, only well-formed ones (shell/appearance.js derives and saves them)
            var names = ['ground', 'surface', 'raised', 'selected', 'line', 'line-strong', 'ink', 'ink-dim', 'ink-faint', 'accent', 'accent-hover', 'accent-own', 'accent-rgb', 'on-accent', 'danger'];
            var ok = names.every(function (n) { return typeof saved.custom.vars[n] === 'string' && /^(#[0-9a-f]{6}|\d{1,3} \d{1,3} \d{1,3})$/i.test(saved.custom.vars[n]); });
            if (ok) {
                root.setAttribute('data-theme', 'custom');
                names.forEach(function (n) { root.style.setProperty('--c-' + n, saved.custom.vars[n]); });
            }
        }
        if (saved.density === 'compact') root.setAttribute('data-density', 'compact');
        if (saved.scrollbar === 'theme') root.setAttribute('data-scrollbar', 'theme');
        if (saved.scrollbarShape === 'bar') root.setAttribute('data-scrollbar-shape', 'bar');
        if (saved.scrollbarCat === 'on') root.setAttribute('data-scrollbar-cat', 'on');
    } catch (e) {
        /* the defaults stay */
    }
})();
