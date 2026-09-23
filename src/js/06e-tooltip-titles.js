// ==============================================================================
// TOOLTIP TITLES
// ==============================================================================
document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[title]').forEach((el) => {
        const titleText = el.getAttribute('title');
        if (titleText) {
            el.setAttribute('data-original-title', titleText);
            el.removeAttribute('title');
        }
    });

    const backBtn = document.getElementById('back-btn');
    if (backBtn) backBtn.setAttribute('data-original-title', 'Go back');

    const forwardBtn = document.getElementById('forward-btn');
    if (forwardBtn) forwardBtn.setAttribute('data-original-title', 'Go forward');

    const queueToggleBtn = document.querySelector('.queue-toggle-btn');
    if (queueToggleBtn) queueToggleBtn.setAttribute('data-original-title', 'Queue');

    const subheroPlayBtnTooltip = document.getElementById('subhero-play-btn');
    if (subheroPlayBtnTooltip) subheroPlayBtnTooltip.setAttribute('data-original-title', 'Play all songs');

    const subheroShuffleBtnTooltip = document.getElementById('subhero-shuffle-btn');
    if (subheroShuffleBtnTooltip) subheroShuffleBtnTooltip.setAttribute('data-original-title', 'Shuffle');

    const shuffleBtnTooltip = document.getElementById('shuffle-btn');
    if (shuffleBtnTooltip) shuffleBtnTooltip.setAttribute('data-original-title', 'Shuffle');

    const repeatBtnTooltip = document.getElementById('repeat-btn');
    if (repeatBtnTooltip) repeatBtnTooltip.setAttribute('data-original-title', 'Repeat');

    const prevBtnTooltip = document.getElementById('prev-btn');
    if (prevBtnTooltip) prevBtnTooltip.setAttribute('data-original-title', 'Previous');

    const nextBtnTooltip = document.getElementById('next-btn');
    if (nextBtnTooltip) nextBtnTooltip.setAttribute('data-original-title', 'Next');

    const playBtnTooltip = document.getElementById('play-btn');
    if (playBtnTooltip) playBtnTooltip.setAttribute('data-original-title', 'Play');

    const createPlaylistBtn = document.querySelector('.create-playlist-header-btn');
    if (createPlaylistBtn) createPlaylistBtn.setAttribute('data-original-title', 'Create Playlist');

    const subheroSearchIcon = document.getElementById('subhero-search-icon');
    if (subheroSearchIcon) subheroSearchIcon.setAttribute('data-original-title', 'Search in All Songs');

    const collapsePanelBtn = document.getElementById('collapse-panel-btn');
    if (collapsePanelBtn) {
        if (!collapsePanelBtn.hasAttribute('data-original-title')) {
            collapsePanelBtn.setAttribute('data-original-title', 'Collapse your library');
        }
    }
});
