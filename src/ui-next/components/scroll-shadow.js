// A shadow under the top edge of a list, shown only while the list is scrolled down (so something has gone up under that edge), and, when
// asked, one over the bottom edge while more of the list is still below. The CSS is in components.css (.scroll-shadow--overlay) and
// shell.css (the lyrics header); this sets data-scrolled (and data-more) from the scroll position.
//
//   scrollShadow(wrapper, '.the-scroller')     `wrapper` carries class "scroll-shadow--overlay" and the shadow is drawn over its top, full width
//   scrollShadow(scroller)                     the scroller itself gets data-scrolled, for a shadow that something else draws (the lyrics header)
//   scrollShadow(wrapper, '.the-scroller', { bottom: true })
//                                              also data-more on the wrapper; with class "scroll-shadow--bottom" the bottom edge gets its shadow.
//                                              Kept up to date when the list grows or shrinks, not only when it scrolls.

/** Returns a function that stops listening. */
export function scrollShadow(target, scrollerSelector = null, { bottom = false } = {}) {
    let queued = false;
    let source = null;
    const read = (scroller) => {
        source = scroller;
        if (!queued) {
            queued = true;
            requestAnimationFrame(paint);
        }
    };
    const paint = () => {
        queued = false;
        if (!source) return;
        target.dataset.scrolled = String(source.scrollTop > 1);
        if (bottom) target.dataset.more = String(source.scrollTop + source.clientHeight < source.scrollHeight - 1);
    };
    // scroll does not bubble: listening in the capture phase also hears a scroller inside `target`, even one the engine draws again later.
    const onScroll = (event) => {
        const found = event.target;
        if (scrollerSelector ? !(found instanceof Element && found.matches(scrollerSelector)) : found !== target) return;
        read(found);
    };
    target.addEventListener('scroll', onScroll, { capture: true, passive: true });
    target.dataset.scrolled = 'false';
    let resize = null;
    let mutations = null;
    if (bottom) {
        target.dataset.more = 'false';
        // A list that grows (songs added) or is cut short has no scroll event: look again when its size or its content changes.
        const scroller = scrollerSelector ? target.querySelector(scrollerSelector) : target;
        if (scroller) {
            resize = new ResizeObserver(() => read(scroller));
            resize.observe(scroller);
            mutations = new MutationObserver(() => read(scroller));
            mutations.observe(scroller, { childList: true, subtree: true });
            read(scroller);
        }
    }
    return () => {
        target.removeEventListener('scroll', onScroll, { capture: true });
        if (resize) resize.disconnect();
        if (mutations) mutations.disconnect();
    };
}
