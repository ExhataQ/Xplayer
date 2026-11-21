// The player bar's center stays in the middle of the window. Its two sides are equal columns (shell.css), so the center is centered as long as
// the right-hand buttons fit in their column; when they do not, they spill into the center. This measures the right-hand controls as they are
// now (the volume bar folds away in a narrow window, a button may be added or hidden) and writes their width as --player-side-min, which both
// sides use as their minimum. The center then gives way (it is allowed to shrink to 300 px) and is never pushed off the middle.

const MIN_SIDE = 180;

export function mountPlayerBalance() {
    const container = document.querySelector('.player-host .player-container');
    const right = container && container.querySelector('.player-right-controls');
    if (!right) return () => {};

    let frame = 0;
    function measure() {
        frame = 0;
        const shown = [...right.children].filter((child) => child.getClientRects().length > 0);
        const gap = parseFloat(getComputedStyle(right).columnGap) || 0;
        const width = shown.reduce((sum, child) => sum + child.getBoundingClientRect().width, 0) + gap * Math.max(0, shown.length - 1);
        container.style.setProperty('--player-side-min', `${Math.max(MIN_SIDE, Math.ceil(width))}px`);
    }
    const schedule = () => {
        if (!frame) frame = requestAnimationFrame(measure);
    };

    const sizes = new ResizeObserver(schedule);
    const watch = () => [...right.children].forEach((child) => sizes.observe(child));
    watch();
    const changes = new MutationObserver(() => {
        watch();
        schedule();
    });
    changes.observe(right, { childList: true, subtree: true, attributes: true, attributeFilter: ['hidden', 'style', 'class'] });
    window.addEventListener('resize', schedule);
    measure();

    return () => {
        if (frame) cancelAnimationFrame(frame);
        sizes.disconnect();
        changes.disconnect();
        window.removeEventListener('resize', schedule);
        container.style.removeProperty('--player-side-min');
    };
}
