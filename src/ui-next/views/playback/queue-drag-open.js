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

// Polish A1: the drawer also opens when the pointer lingers in a zone ABOVE the button, on the right side where the drawer
// appears. The zone grows with the queue: a longer queue means a taller drawer, so the zone reaches higher. Pure geometry as well.

/** Estimated heights of the drawer's parts (px): the header, and one queue row. */
export const QUEUE_HEADER_HEIGHT = 48;
export const QUEUE_ROW_HEIGHT = 56;
/** The zone is half the drawer's height, never lower than MIN or higher than MAX (px). */
export const QUEUE_ZONE_MIN = 120;
export const QUEUE_ZONE_MAX = 280;
/** The drawer's width (px): the zone covers the right side by this much. */
export const QUEUE_ZONE_WIDTH = 380;
/** The pointer must stay in the upper zone this long (ms) before the drawer opens, so crossing it on the way elsewhere does nothing. */
export const QUEUE_DWELL_MS = 150;

/** How tall (px) the upper zone is for a queue of `rowCount` rows. An unknown or empty queue gets the minimum. */
export function queueZoneHeight(rowCount) {
    const rows = Number.isFinite(rowCount) && rowCount > 0 ? rowCount : 0;
    const drawer = QUEUE_HEADER_HEIGHT + rows * QUEUE_ROW_HEIGHT;
    return Math.min(QUEUE_ZONE_MAX, Math.max(QUEUE_ZONE_MIN, Math.round(drawer / 2)));
}

/**
 * The upper zone as a rectangle: from the right edge of the window, QUEUE_ZONE_WIDTH wide, from the button's top up by
 * queueZoneHeight(rowCount). `viewportWidth` is the window's inner width. Returns null for a missing or empty button rect.
 */
export function queueOpenZone(buttonRect, rowCount, viewportWidth) {
    if (!buttonRect || !(buttonRect.width > 0 || buttonRect.height > 0) || !(viewportWidth > 0)) return null;
    return {
        left: Math.max(0, viewportWidth - QUEUE_ZONE_WIDTH),
        right: viewportWidth,
        top: Math.max(0, buttonRect.top - queueZoneHeight(rowCount)),
        bottom: buttonRect.bottom
    };
}

/** True when `point` ({clientX, clientY}) is inside `zone` ({left, right, top, bottom}). */
export function isInZone(point, zone) {
    if (!point || !zone) return false;
    return point.clientX >= zone.left && point.clientX <= zone.right && point.clientY >= zone.top && point.clientY <= zone.bottom;
}
