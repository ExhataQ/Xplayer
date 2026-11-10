// The Rating column of the song list (task B3): a cell of five stars in every row, and a header for it. The rows are the engine's, so this
// adds the cell to each row as it appears (the way the rest of the new interface dresses them) instead of changing every row template.
// Only while the Rating system is on and the column is chosen in the columns menu; otherwise the rows are untouched.
//
// The stars are drawn by the style (song-list.css) from one number; a click on a star sets that rating, a click on the star that is the rating
// clears it. The cell is for the mouse; the keyboard has the song menu (Rate).
import { engineEvent } from '../../adapter/engine-api.js';
import { ratingSystemOn, ratingsForSongs, rateSong } from '../../adapter/ratings-bridge.js';

const STAR = 16; // px: one star's width; the style draws five of them side by side

/** The rating (0.5 to 5, in halves) a click at `x` px from the left edge of the stars sets: the left half of a star is the half star. */
export function starAt(x) {
    return Math.min(5, Math.max(0.5, Math.ceil(x / (STAR / 2)) / 2));
}

const wordsFor = (stars) => (stars === 0 ? 'Not rated' : stars === 1 ? '1 star' : `${stars} stars`);

export function createRatingColumn(host) {
    let wanted = false;
    let hovered = null;
    const active = () => wanted && ratingSystemOn();

    function paint(cell, stars) {
        const span = cell.firstElementChild;
        span.style.setProperty('--stars', String(stars));
        span.setAttribute('aria-label', stars ? `Rating: ${wordsFor(stars)}` : wordsFor(0));
        cell.dataset.stars = String(stars);
    }

    function cellOf(row) {
        let cell = row.querySelector(':scope > .song-rating');
        if (cell) return cell;
        cell = document.createElement('div');
        cell.className = 'song-rating';
        cell.setAttribute('data-stop-dblclick', ''); // a double click on the stars does not play the song
        if (row.classList.contains('lazy-skeleton')) {
            // A row that is still loading shows a bar in this cell, like its other cells (the engine replaces the row when the song is ready).
            const bar = document.createElement('div');
            bar.className = 'skeleton-bar';
            cell.append(bar);
        } else {
            const span = document.createElement('span');
            span.className = 'song-rating__stars';
            span.setAttribute('role', 'img');
            cell.append(span);
        }
        const right = row.querySelector(':scope > .right-song-item');
        row.insertBefore(cell, right || null);
        return cell;
    }

    /** Puts a cell, with the right stars, in each of the rows. One lookup for the whole batch. */
    function decorate(rows) {
        if (host.dataset.ratingColumn !== 'on') return; // a cell exists only while the grid has its fifth column
        const fresh = rows.filter((row) => !row.querySelector(':scope > .song-rating'));
        const ids = fresh.map((row) => row.dataset.songId);
        const loading = (row) => row.classList.contains('lazy-skeleton');
        const known = fresh.length && !fresh.every(loading) ? ratingsForSongs(ids.map((id) => (id === undefined ? '' : id))) : [];
        fresh.forEach((row, i) => {
            const cell = cellOf(row);
            if (!loading(row)) paint(cell, known[i] || 0);
        });
    }

    const allRows = () => [...host.querySelectorAll('.song-item')];

    function sync() {
        const on = active();
        host.dataset.ratingColumn = on ? 'on' : 'off';
        if (on) decorate(allRows());
        else host.querySelectorAll('.song-rating').forEach((cell) => cell.remove());
    }

    const observer = new MutationObserver((mutations) => {
        if (!active() || host.dataset.ratingColumn !== 'on') return;
        const rows = new Set();
        for (const m of mutations) {
            for (const node of m.addedNodes) {
                if (node.nodeType !== 1) continue;
                const own = node.closest('.song-item');
                if (own) rows.add(own);
                else node.querySelectorAll('.song-item').forEach((row) => rows.add(row));
            }
        }
        if (rows.size) decorate([...rows]);
    });
    observer.observe(host, { childList: true, subtree: true });

    // ----- the mouse: hover shows what a click would set, a click sets it -----
    const starsOf = (event) => (event.target instanceof Element ? event.target.closest('.song-rating__stars') : null);
    const starFor = (span, event) => starAt(event.clientX - span.getBoundingClientRect().left);
    const clearHover = () => {
        if (hovered) hovered.style.removeProperty('--preview');
        hovered = null;
    };
    host.addEventListener('pointermove', (event) => {
        const span = starsOf(event);
        if (span !== hovered) clearHover();
        if (!span) return;
        hovered = span;
        span.style.setProperty('--preview', String(starFor(span, event)));
    });
    host.addEventListener('pointerleave', clearHover);
    host.addEventListener('click', (event) => {
        const span = starsOf(event);
        if (!span || !active()) return;
        event.stopPropagation(); // the row is not selected by a click on its stars
        const row = span.closest('.song-item');
        if (!row || row.dataset.songId === undefined) return;
        const picked = starFor(span, event);
        const current = Number(span.parentElement.dataset.stars) || 0;
        rateSong(Number.isNaN(Number(row.dataset.songId)) ? row.dataset.songId : Number(row.dataset.songId), current === picked ? 0 : picked);
    });

    const stops = [
        engineEvent('ratingSettings:changed', sync),
        engineEvent('ratings:changed', (detail) => {
            if (!active() || !detail) return;
            for (const row of host.querySelectorAll(`.song-item[data-song-id="${CSS.escape(String(detail.songId))}"]`)) {
                const cell = row.querySelector(':scope > .song-rating');
                if (cell) paint(cell, Number(detail.rating) || 0);
            }
        })
    ];

    return {
        setOn(flag) {
            wanted = Boolean(flag);
            sync();
        },
        destroy() {
            observer.disconnect();
            stops.forEach((stop) => stop());
        }
    };
}
