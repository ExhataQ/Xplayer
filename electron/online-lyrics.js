const path = require('path');
const fs = require('fs');
const { getDownloadFolder } = require('./downloads');

const LRCLIB_BASE_URL = 'https://lrclib.net/api';
const { USER_AGENT } = require('./user-agent');

function buildUrl(endpoint, params) {
    const url = new URL(`${LRCLIB_BASE_URL}/${endpoint}`);
    for (const [key, value] of Object.entries(params)) {
        if (value !== undefined && value !== null && String(value).trim() !== '') {
            url.searchParams.set(key, String(value));
        }
    }
    return url.toString();
}

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// LRCLIB is a free service run by one person and asks for no key, so the app is polite with it:
//  - every request, from whichever search it belongs to, starts at least `minGapMs` after the one before (a batch of hundreds of songs runs
//    at about six requests a second instead of everything at once);
//  - when LRCLIB says "slow down" (HTTP 429 or 503) every request waits, not just the one that was told: for the time in its Retry-After header,
//    or at least `slowDownMs` for the first, second, third try. A search that is still refused after its tries fails with `rateLimited` set,
//    which the batch uses to stop with a clear message instead of asking for every remaining song.
// `pacing` is exported so that the tests can make the waits short.
const pacing = { minGapMs: 150, slowDownMs: [2000, 5000, 10000], maxRetryAfterMs: 60000 };
let nextStartAt = 0;
let cooldownUntil = 0;
pacing.reset = () => {
    nextStartAt = 0;
    cooldownUntil = 0;
}; // for the tests

async function takeSlot() {
    for (;;) {
        const now = Date.now();
        const start = Math.max(now, nextStartAt, cooldownUntil);
        if (start <= now) {
            nextStartAt = now + pacing.minGapMs;
            return;
        }
        await sleep(start - now);
    }
}

function retryAfterMs(response) {
    const header = response.headers && response.headers.get ? response.headers.get('retry-after') : null;
    if (!header) return 0;
    const seconds = Number(header);
    if (Number.isFinite(seconds)) return Math.min(pacing.maxRetryAfterMs, Math.max(0, seconds * 1000));
    const date = Date.parse(header);
    return Number.isNaN(date) ? 0 : Math.min(pacing.maxRetryAfterMs, Math.max(0, date - Date.now()));
}

async function requestJson(url, options = {}) {
    const maxRetries = Number.isInteger(options.maxRetries) ? options.maxRetries : 3;
    const retryDelays = [400, 900, 1600];
    let lastError = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        let slowDown = false;
        try {
            await takeSlot();
            const response = await fetch(url, {
                headers: {
                    'User-Agent': USER_AGENT,
                    Accept: 'application/json'
                }
            });

            if (response.status === 404) return null;

            if (response.ok) return response.json();

            const error = new Error(`LRCLIB returned HTTP ${response.status}`);
            error.status = response.status;
            if (response.status === 429 || response.status === 503) {
                slowDown = true;
                error.rateLimited = true;
                error.message = `LRCLIB asked us to slow down (HTTP ${response.status})`;
                const wait = Math.max(retryAfterMs(response), pacing.slowDownMs[Math.min(attempt, pacing.slowDownMs.length - 1)]);
                cooldownUntil = Math.max(cooldownUntil, Date.now() + wait);
            }

            // Do not repeat malformed requests. Retry only temporary/server failures.
            const retryable = response.status === 408 ||
                response.status === 429 ||
                response.status === 500 ||
                response.status === 502 ||
                response.status === 503 ||
                response.status === 504;

            if (!retryable || attempt >= maxRetries) throw error;
            lastError = error;
        } catch (error) {
            const status = error && error.status;
            const retryableStatus = status === 408 || status === 429 || status === 500 ||
                status === 502 || status === 503 || status === 504;

            // Network failures are also worth retrying. HTTP 400/404 and other
            // non-transient responses are returned immediately.
            if (status && !retryableStatus) throw error;
            if (attempt >= maxRetries) throw error;
            lastError = error;
        }

        // after a "slow down" the shared wait above is the pause; the next attempt waits for it in takeSlot()
        if (!slowDown) await sleep(retryDelays[Math.min(attempt, retryDelays.length - 1)]);
    }

    throw lastError || new Error('Could not connect to LRCLIB');
}

function getSearchQuery({ artist, title, album }) {
    return [title, artist, album].filter(value => String(value || '').trim()).join(' ').trim();
}

// `need` ('lrc' or 'lyrics') is sent by the batch, which wants one result of that kind and no list to choose from: when the exact match already has it,
// the broader search is not made. An exact match without it (say, only plain lyrics when synced are wanted) goes on to the search, as before.
// The Find page sends no `need` and always gets the exact match and the list.
function hasNeeded(track, need) {
    if (!track) return false;
    const text = need === 'lrc' ? track.syncedLyrics : need === 'lyrics' ? track.plainLyrics : null;
    return text !== null && String(text || '').trim() !== '';
}

async function searchLyrics({ artist, title, album, duration, need }) {
    const hasArtist = String(artist || '').trim() !== '';
    const hasTitle = String(title || '').trim() !== '';

    // /api/get expects a track and artist. Skip it when the user intentionally
    // searches with only one field, otherwise LRCLIB responds with HTTP 400.
    let exact = null;
    if (hasArtist && hasTitle) {
        const exactUrl = buildUrl('get', {
            artist_name: artist,
            track_name: title,
            album_name: album,
            duration: duration
        });
        try {
            exact = await requestJson(exactUrl);
        } catch (error) {
            // A rate limit is not hidden: asking again straight away only makes it worse.
            if (error && error.rateLimited) throw error;
            // Any other exact-match failure should not prevent the broader search from
            // running. The search endpoint may still return useful results.
            exact = null;
        }
        if (hasNeeded(exact, need)) return { exact: true, results: [exact] };
    }

    const searchParams = {
        artist_name: hasArtist ? artist : undefined,
        track_name: hasTitle ? title : undefined
    };

    // With only one field, use LRCLIB's broad q search instead of sending an
    // incomplete artist/title filter combination.
    if (!hasArtist || !hasTitle) {
        searchParams.artist_name = undefined;
        searchParams.track_name = undefined;
        searchParams.q = getSearchQuery({ artist, title, album });
    }

    const searchUrl = buildUrl('search', searchParams);
    const searchResults = await requestJson(searchUrl);
    const results = Array.isArray(searchResults) ? searchResults : [];

    if (exact) {
        const exactId = exact.id;
        const withoutDuplicate = results.filter(result => {
            if (exactId !== undefined && result && result.id !== undefined) {
                return result.id !== exactId;
            }
            return !(
                result &&
                result.trackName === exact.trackName &&
                result.artistName === exact.artistName &&
                result.duration === exact.duration
            );
        });
        return {
            exact: true,
            results: [exact, ...withoutDuplicate]
        };
    }

    return {
        exact: false,
        results
    };
}

function sanitizeFileName(name) {
    return String(name || 'lyrics')
        .replace(/[<>:"/\\|?*\x00-\x1F]/g, '_')
        .replace(/[. ]+$/g, '')
        .trim() || 'lyrics';
}

function makeUniquePath(folder, fileName) {
    let target = path.join(folder, fileName);
    if (!fs.existsSync(target)) return target;

    const ext = path.extname(fileName);
    const base = path.basename(fileName, ext);
    let i = 2;
    while (fs.existsSync(target)) {
        target = path.join(folder, `${base} (${i})${ext}`);
        i++;
    }
    return target;
}

async function downloadLyricsFile({ title, artist, type, contents }) {
    const folder = getDownloadFolder();
    fs.mkdirSync(folder, { recursive: true });

    const extension = type === 'lrc' ? '.lrc' : '.txt';
    const artistPart = sanitizeFileName(artist || 'Unknown Artist');
    const titlePart = sanitizeFileName(title || 'Unknown Title');
    const fileName = `${artistPart} - ${titlePart}${extension}`;
    const filePath = makeUniquePath(folder, fileName);

    fs.writeFileSync(filePath, String(contents || ''), 'utf8');
    return { success: true, filePath };
}

module.exports = {
    searchLyrics,
    downloadLyricsFile,
    pacing // for the tests
};
