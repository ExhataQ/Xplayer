// ==============================================================================
// THEME SWITCHER
// The theme buttons in Settings (.settings-theme-btn, data-theme="green|pink|purple|yellow|white").
// This file is an ES module (see "modules" in src/manifest.json). It touches the page only
// inside the two functions, so Node can import it without a DOM; tests pass a fake document.
// ==============================================================================
export function initThemeButtons(doc = document) {
    doc.querySelectorAll('.settings-theme-btn').forEach((btn) => {
        btn.removeEventListener('click', themeClickHandler);
        btn.addEventListener('click', themeClickHandler);
    });
}

// Runs as a click listener, so `this` is the clicked button.
export function themeClickHandler(e) {
    e.stopPropagation();
    const theme = this.getAttribute('data-theme');
    const doc = this.ownerDocument;

    doc.querySelectorAll('.settings-theme-btn').forEach((b) => {
        b.classList.remove('active');
    });
    this.classList.add('active');

    doc.body.classList.remove('theme-pink', 'theme-purple', 'theme-yellow', 'theme-white');

    if (theme !== 'green') {
        doc.body.classList.add(`theme-${theme}`);
    }

    this.setAttribute('aria-label', `${theme} theme active`);
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ initThemeButtons });
}
