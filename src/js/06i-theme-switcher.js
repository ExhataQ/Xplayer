// ==============================================================================
// THEME SWITCHER
// ==============================================================================
function initThemeButtons() {
    document.querySelectorAll('.settings-theme-btn').forEach((btn) => {
        btn.removeEventListener('click', themeClickHandler);
        btn.addEventListener('click', themeClickHandler);
    });
}

function themeClickHandler(e) {
    e.stopPropagation();
    const theme = this.getAttribute('data-theme');

    document.querySelectorAll('.settings-theme-btn').forEach((b) => {
        b.classList.remove('active');
    });
    this.classList.add('active');

    document.body.classList.remove('theme-pink', 'theme-purple', 'theme-yellow', 'theme-white');

    if (theme !== 'green') {
        document.body.classList.add(`theme-${theme}`);
    }

    this.setAttribute('aria-label', `${theme} theme active`);
}
