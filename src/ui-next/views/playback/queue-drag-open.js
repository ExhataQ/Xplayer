// PC-11: opening the queue drawer while a song is dragged toward it. Pure geometry, so it can be tested without a browser.

/** How close (px) the pointer must come to the queue button before the drawer opens. */
export const QUEUE_NEAR_DISTANCE = 72;

/** True when `point` ({clientX, clientY}) is inside `rect` grown by `margin` on every side. A missing or empty rect is never near. */
export function isNearRect(point, rect, margin = QUEUE_NEAR_DISTANCE) {
    if (!point || !rect || !(rect.width > 0 || rect.height > 0)) return false;
    return (
        point.clientX >= rect.left - margin &&
        point.clientX <= rect.right + margin &&
        point.clientY >= rect.top - margin &&
        point.clientY <= rect.bottom + margin
    );
}
