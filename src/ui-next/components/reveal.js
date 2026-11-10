// The opening and closing of a box that changes width (a search field in the Library panel or in the list toolbar): the box grows from
// where it was to where it ends up, instead of snapping there. It uses the Web Animations API on the element, so the layout that the
// CSS decides stays the only truth: the animation runs from the old width to the new one and leaves nothing behind (no inline style, no
// fill). No animation at all when the person asks for reduced motion, when the width does not change, or when there is no old width.
//
//   const before = node.getBoundingClientRect().width;
//   ...change the layout (set an attribute, unhide)...
//   growWidth(node, before, { fade: true });
//
// `flex: true` for an item that sizes itself with flex-grow (its `width` is ignored there); then flex-basis is what moves.

import { reducedMotion } from './motion.js';

const EASE = 'cubic-bezier(0.2, 0, 0, 1)'; // the same as --motion-ease
export const REVEAL_MS = 200;

export const prefersReducedMotion = reducedMotion;

/** Animates `node` from `from` px wide to the width it has now. Returns the Animation, or null when nothing animates. */
export function growWidth(node, from, { flex = false, fade = false, duration = REVEAL_MS } = {}) {
    if (!node || typeof node.animate !== 'function' || prefersReducedMotion()) return null;
    const to = node.getBoundingClientRect().width;
    if (!Number.isFinite(from) || !Number.isFinite(to) || Math.abs(to - from) < 2) return null;
    const frame = (px, opacity) => ({ ...(flex ? { flexGrow: 0, flexShrink: 0, flexBasis: `${px}px` } : { width: `${px}px` }), ...(fade ? { opacity } : {}) });
    const grows = to > from;
    // A box that gets narrower fades out as it goes; one that gets wider fades in.
    return node.animate([frame(from, grows ? 0 : 1), frame(to, grows ? 1 : 0)], { duration, easing: EASE });
}
