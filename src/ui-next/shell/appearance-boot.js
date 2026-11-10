// Classic script in <head> (task A-10): puts the saved theme, density and motion choice on <html> before the first paint, so the
// window never flashes the default look. shell/appearance.js reads the same key and owns the choice after start-up.
// The lists below must match appearance.js (tools/tests/ui-next-appearance.test.js checks it).
(function () {
    function luminance(hex) {
        var channels = [1, 3, 5].map(function (i) { var c = parseInt(hex.slice(i, i + 2), 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
        return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
    }
    var root = document.documentElement;
    try {
        var saved = JSON.parse(localStorage.getItem('xplayer.ui-next.appearance') || 'null');
        // Reduce animations (C7): the saved choice, or the system's "reduce motion" until the person chooses. Every animation reads this attribute.
        var choice = saved && (saved.reduceMotion === 'on' || saved.reduceMotion === 'off') ? saved.reduceMotion : null;
        var system = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
        root.setAttribute('data-motion', (choice ? choice === 'on' : system) ? 'reduced' : 'full');
        // the defaults: a neutral, standard scrollbar (shell/appearance.js DEFAULTS); a saved choice of the theme color or the flush bar replaces them
        root.setAttribute('data-mode', 'dark');
        root.setAttribute('data-scrollbar', 'neutral');
        root.setAttribute('data-scrollbar-shape', 'standard');
        if (!saved) return;
        if (['warm-graphite', 'pure-black', 'graphite-gold', 'carbon-honey', 'deep-forest', 'espresso-copper', 'midnight-blue', 'aubergine-rose', 'ocean-teal', 'crimson-noir', 'violet-night', 'high-contrast', 'light'].indexOf(saved.theme) >= 0) root.setAttribute('data-theme', saved.theme);
        if (saved.theme === 'light') root.setAttribute('data-mode', 'light');
        if (saved.theme === 'custom' && saved.custom && saved.custom.vars) {
            // the built theme: its saved values, only well-formed ones (shell/appearance.js derives and saves them)
            var names = ['ground', 'surface', 'raised', 'selected', 'line', 'line-strong', 'ink', 'ink-dim', 'ink-faint', 'accent', 'accent-hover', 'accent-own', 'accent-rgb', 'on-accent', 'danger'];
            var ok = names.every(function (n) { return typeof saved.custom.vars[n] === 'string' && /^(#[0-9a-f]{6}|\d{1,3} \d{1,3} \d{1,3})$/i.test(saved.custom.vars[n]); });
            if (ok) {
                root.setAttribute('data-theme', 'custom');
                root.setAttribute('data-mode', luminance(saved.custom.vars.ground) < 0.35 ? 'dark' : 'light'); // the same cut-off as theme-math.js isDark
                names.forEach(function (n) { root.style.setProperty('--c-' + n, saved.custom.vars[n]); });
            }
        }
        if (saved.density === 'compact') root.setAttribute('data-density', 'compact');
        if (saved.scrollbar === 'theme') root.setAttribute('data-scrollbar', 'theme');
        if (saved.scrollbarShape === 'bar') root.setAttribute('data-scrollbar-shape', 'bar');
        if (saved.scrollbarCat === 'on') root.setAttribute('data-scrollbar-cat', 'on');
    } catch (e) {
        /* the defaults stay */
        if (!root.hasAttribute('data-motion')) root.setAttribute('data-motion', 'full');
        if (!root.hasAttribute('data-mode')) root.setAttribute('data-mode', 'dark');
    }
})();
