const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const https = require('https');

const MB_BASE = 'https://musicbrainz.org/ws/2';
const CAA_BASE = 'https://coverartarchive.org';
const USER_AGENT = 'ExhataQ-MusicPlayer/1.0 (local music player)';

// Keep one persistent HTTPS connection instead of opening a new connection for
// every metadata request. This also makes the MusicBrainz request pacing more
// predictable and reduces the chance of transient 503 responses.
const httpsAgent = new https.Agent({
    keepAlive: true,
    maxSockets: 1,
    maxFreeSockets: 1,
    keepAliveMsecs: 10000
});

let lastMusicBrainzRequestAt = 0;
let musicBrainzRequestChain = Promise.resolve();

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function buildUrl(base, params) {
    const u = new URL(base);
    Object.entries(params || {}).forEach(([k, v]) => {
        if (v !== undefined && v !== null && String(v).trim()) {
            u.searchParams.set(k, String(v));
        }
    });
    return u.toString();
}

function requestJson(url, { rateLimit = false, maxRetries = 4 } = {}) {
    const run = async () => {
        let lastError = null;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                if (rateLimit) {
                    const wait = Math.max(0, 1100 - (Date.now() - lastMusicBrainzRequestAt));
                    if (wait) await sleep(wait);
                    lastMusicBrainzRequestAt = Date.now();
                }

                const result = await new Promise((resolve, reject) => {
                    const req = https.get(url, {
                        agent: httpsAgent,
                        headers: {
                            'User-Agent': USER_AGENT,
                            'Accept': 'application/json'
                        },
                        timeout: 15000
                    }, (response) => {
                        let body = '';
                        response.setEncoding('utf8');
                        response.on('data', chunk => { body += chunk; });
                        response.on('end', () => {
                            const status = response.statusCode || 0;
                            if (status >= 200 && status < 300) {
                                try {
                                    resolve(JSON.parse(body));
                                } catch (e) {
                                    e.status = status;
                                    reject(e);
                                }
                                return;
                            }

                            const error = new Error(`Request returned HTTP ${status}`);
                            error.status = status;
                            const retryAfter = Number(response.headers['retry-after']);
                            error.retryAfter = Number.isFinite(retryAfter) ? retryAfter : 0;
                            reject(error);
                        });
                    });
                    req.on('timeout', () => req.destroy(new Error('Request timed out')));
                    req.on('error', reject);
                });

                return result;
            } catch (error) {
                lastError = error;
                const status = Number(error?.status || 0);
                const retryable = !status || status === 408 || status === 429 ||
                    status === 500 || status === 502 || status === 503 || status === 504;

                // A 400 is a malformed/unsupported query, not a transient
                // connection failure. The caller can fall back to a simpler query.
                if (!retryable || attempt >= maxRetries) throw error;

                const retryAfterMs = Number(error?.retryAfter || 0) * 1000;
                const backoff = Math.min(8000, 700 * Math.pow(2, attempt));
                await sleep(Math.max(retryAfterMs, backoff));
            }
        }

        throw lastError || new Error('Could not connect');
    };

    // Serialize MusicBrainz calls. This guarantees that concurrent clicks from
    // the UI cannot accidentally violate the API request interval.
    if (rateLimit) {
        const next = musicBrainzRequestChain.then(run, run);
        musicBrainzRequestChain = next.catch(() => {});
        return next;
    }
    return run();
}

function mbFetch(url) {
    return requestJson(url, { rateLimit: true });
}

function genericFetch(url, accept = '*/*') {
    return new Promise(async (resolve, reject) => {
        let lastError = null;
        for (let attempt = 0; attempt <= 3; attempt++) {
            try {
                const result = await new Promise((res, rej) => {
                    const req = https.get(url, {
                        agent: httpsAgent,
                        headers: { 'User-Agent': USER_AGENT, 'Accept': accept },
                        timeout: 15000
                    }, response => {
                        const chunks = [];
                        response.on('data', chunk => chunks.push(chunk));
                        response.on('end', () => {
                            const status = response.statusCode || 0;
                            if (status >= 200 && status < 300) {
                                res({
                                    status,
                                    headers: response.headers,
                                    body: Buffer.concat(chunks)
                                });
                            } else {
                                const e = new Error(`Request returned HTTP ${status}`);
                                e.status = status;
                                const retryAfter = Number(response.headers['retry-after']);
                                e.retryAfter = Number.isFinite(retryAfter) ? retryAfter : 0;
                                rej(e);
                            }
                        });
                    });
                    req.on('timeout', () => req.destroy(new Error('Request timed out')));
                    req.on('error', rej);
                });
                return resolve(result);
            } catch (e) {
                lastError = e;
                const status = Number(e?.status || 0);
                const retryable = !status || status === 408 || status === 429 || status === 500 ||
                    status === 502 || status === 503 || status === 504;
                if (!retryable || attempt >= 3) return reject(e);
                const retryAfterMs = Number(e?.retryAfter || 0) * 1000;
                await sleep(Math.max(retryAfterMs, 600 * Math.pow(2, attempt)));
            }
        }
        reject(lastError || new Error('Could not connect'));
    });
}

function cacheDir() { return path.join(require('electron').app.getPath('userData'), 'metadata-cache'); }
function keyFor(fileUrl) { return crypto.createHash('sha256').update(String(fileUrl || '')).digest('hex').slice(0, 24); }
function ensureCache() { fs.mkdirSync(cacheDir(), { recursive: true }); return cacheDir(); }
function saveJson(fileUrl, payload) {
    const dir = ensureCache();
    const p = path.join(dir, `${keyFor(fileUrl)}.json`);
    fs.writeFileSync(p, JSON.stringify(payload, null, 2), 'utf8');
    return p;
}
function sanitizeExt(contentType, url) {
    const type = String(contentType || '').toLowerCase();
    if (type.includes('png')) return '.png';
    if (type.includes('webp')) return '.webp';
    if (type.includes('gif')) return '.gif';
    if (type.includes('jpeg') || type.includes('jpg')) return '.jpg';
    const ext = path.extname(new URL(url).pathname).toLowerCase();
    return ['.jpg','.jpeg','.png','.webp','.gif'].includes(ext) ? ext : '.jpg';
}
async function downloadCover(fileUrl, imageUrl) {
    const response = await genericFetch(imageUrl, 'image/*');
    const ext = sanitizeExt(response.headers['content-type'], imageUrl);
    const p = path.join(ensureCache(), `${keyFor(fileUrl)}-cover${ext}`);
    fs.writeFileSync(p, response.body);
    return p;
}
function artistText(credits) {
    return (credits || []).map(x => `${x.name || x.artist?.name || ''}${x.joinphrase || ''}`).join('').trim();
}
function first(arr) { return Array.isArray(arr) && arr.length ? arr[0] : null; }
function releaseInfo(release) {
    if (!release) return {};
    const media = release.media || [];
    const tracks = media.flatMap(m => m.tracks || []);
    return {
        album: release.title || '',
        albumArtist: artistText(release['artist-credit']) || '',
        year: release.date ? String(release.date).slice(0,4) : '',
        label: release['label-info']?.map(x => x.label?.name).filter(Boolean).join(', ') || '',
        publisher: release['label-info']?.map(x => x.label?.name).filter(Boolean).join(', ') || '',
        country: release.country || '',
        releaseId: release.id || '',
        releaseGroupId: release['release-group']?.id || '',
        track: tracks.length ? String((tracks.find(t => t.recording?.id) || tracks[0]).position || '') : ''
    };
}

function escapeLucene(value) {
    return String(value || '').replace(/([+\-!(){}\[\]^"~*?:\\/])/g, '\\$1');
}

async function searchOnlineMetadata({ fileUrl, title, artist, album, duration, scope='recording' }) {
    const cleanTitle = String(title || '').trim();
    const cleanArtist = String(artist || '').trim();
    const cleanAlbum = String(album || '').trim();
    if (!cleanTitle && !cleanArtist && !cleanAlbum) {
        throw new Error('Title or artist is required for online metadata search');
    }

    // Release mode should identify releases that actually contain this recording.
    // MusicBrainz's /release search does not support the `recording` field, so using
    // recording:"..." there causes HTTP 400. Search recordings first and use their
    // associated releases; this also gives us the correct original-release candidates.
    if (scope === 'release') {
        const recordingParts = [];
        if (cleanTitle) recordingParts.push(`recording:"${escapeLucene(cleanTitle)}"`);
        if (cleanArtist) recordingParts.push(`artist:"${escapeLucene(cleanArtist)}"`);

        let recordingResult = null;
        if (recordingParts.length) {
            try {
                recordingResult = await mbFetch(buildUrl(`${MB_BASE}/recording`, {
                    query: recordingParts.join(' AND '),
                    fmt: 'json',
                    limit: 8
                }));
            } catch (error) {
                if (Number(error?.status) !== 400) throw error;
                recordingResult = await mbFetch(buildUrl(`${MB_BASE}/recording`, {
                    query: [cleanTitle, cleanArtist, cleanAlbum].filter(Boolean).join(' '),
                    fmt: 'json',
                    limit: 8
                }));
            }
        }

        const releaseMap = new Map();
        for (const recording of (recordingResult?.recordings || [])) {
            for (const release of (recording.releases || [])) {
                if (!release?.id || releaseMap.has(release.id)) continue;
                releaseMap.set(release.id, {
                    id: release.id,
                    title: release.title || '',
                    artist: artistText(release['artist-credit']) || cleanArtist,
                    date: release.date || '',
                    country: release.country || '',
                    releaseGroupId: release['release-group']?.id || '',
                    firstReleaseDate: release.date || '',
                    recordingId: recording.id || ''
                });
            }
        }

        let releases = [...releaseMap.values()];
        const albumNeedle = cleanAlbum.toLowerCase();
        if (albumNeedle) {
            releases.sort((a, b) => {
                const aTitle = a.title.toLowerCase();
                const bTitle = b.title.toLowerCase();
                const aExact = aTitle === albumNeedle ? 0 : (aTitle.includes(albumNeedle) ? 1 : 2);
                const bExact = bTitle === albumNeedle ? 0 : (bTitle.includes(albumNeedle) ? 1 : 2);
                if (aExact !== bExact) return aExact - bExact;
                return String(a.date || '9999').localeCompare(String(b.date || '9999'));
            });
        } else {
            releases.sort((a, b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
        }

        // If recording search did not provide releases, use the release endpoint with
        // only fields that are valid for release search (release + artist).
        if (!releases.length) {
            const releaseParts = [];
            if (cleanAlbum) releaseParts.push(`release:"${escapeLucene(cleanAlbum)}"`);
            if (cleanArtist) releaseParts.push(`artist:"${escapeLucene(cleanArtist)}"`);
            let result;
            try {
                result = await mbFetch(buildUrl(`${MB_BASE}/release`, {
                    query: releaseParts.join(' AND ') || [cleanAlbum, cleanArtist].filter(Boolean).join(' '),
                    fmt: 'json',
                    limit: 8
                }));
            } catch (error) {
                if (Number(error?.status) !== 400) throw error;
                result = await mbFetch(buildUrl(`${MB_BASE}/release`, {
                    query: [cleanAlbum, cleanArtist].filter(Boolean).join(' '),
                    fmt: 'json',
                    limit: 8
                }));
            }
            releases = (result.releases || []).map(r => ({
                id: r.id,
                title: r.title || '',
                artist: artistText(r['artist-credit']) || '',
                date: r.date || '',
                country: r.country || '',
                releaseGroupId: r['release-group']?.id || '',
                firstReleaseDate: r.date || ''
            }));
        }

        const payload = { source: 'musicbrainz', query: { title, artist, album, duration, scope }, results: releases.slice(0, 25), fetchedAt: new Date().toISOString() };
        const cachePath = saveJson(fileUrl, payload);
        return { success: true, results: releases.slice(0, 25), cachePath };
    }

    // Prefer a precise fielded recording search. If MusicBrainz rejects the Lucene query
    // with 400, retry with a simple free-text query.
    const exactParts = [];
    if (cleanTitle) exactParts.push(`recording:"${escapeLucene(cleanTitle)}"`);
    if (cleanArtist) exactParts.push(`artist:"${escapeLucene(cleanArtist)}"`);
    let result;
    try {
        result = await mbFetch(buildUrl(`${MB_BASE}/recording`, { query: exactParts.join(' AND '), fmt: 'json', limit: 8 }));
    } catch (error) {
        if (Number(error?.status) !== 400) throw error;
        const fallback = [cleanTitle, cleanArtist, cleanAlbum].filter(Boolean).join(' ');
        result = await mbFetch(buildUrl(`${MB_BASE}/recording`, { query: fallback, fmt: 'json', limit: 8 }));
    }

    const recordings = (result.recordings || []).map(r => ({
        id: r.id,
        title: r.title || '',
        artist: artistText(r['artist-credit']) || '',
        length: r.length || 0,
        score: r.score || 0,
        firstReleaseDate: r['first-release-date'] || '',
        disambiguation: r.disambiguation || '',
        releases: (r.releases || []).slice(0, 25).map(x => ({ id: x.id, title: x.title, date: x.date || '', country: x.country || '' }))
    }));
    const payload = { source: 'musicbrainz', query: { title, artist, album, duration, scope }, results: recordings, fetchedAt: new Date().toISOString() };
    const cachePath = saveJson(fileUrl, payload);
    return { success: true, results: recordings, cachePath };
}

async function getOnlineMetadata({ fileUrl, recordingId, releaseId, title='' }) {
    if (!recordingId && !releaseId) throw new Error('MusicBrainz recording or release ID is required');
    if (!recordingId && releaseId) {
        const relOnly = await mbFetch(buildUrl(`${MB_BASE}/release/${encodeURIComponent(releaseId)}`, { inc:'artist-credits+recordings+labels+release-groups', fmt:'json' }));
        const wanted=String(title||'').trim().toLowerCase();
        const tracks=(relOnly.media||[]).flatMap(m=>m.tracks||[]).filter(t=>t.recording?.id);
        const track=tracks.find(t=>String(t.title||t.recording?.title||'').trim().toLowerCase()===wanted)||tracks[0];
        recordingId = track?.recording?.id || '';
        if (!recordingId) throw new Error('No recording was found in that release');
    }
    const recordingUrl = buildUrl(`${MB_BASE}/recording/${encodeURIComponent(recordingId)}`, { inc: 'artist-credits+releases+genres+tags+isrcs', fmt: 'json' });
    const recording = await mbFetch(recordingUrl);
    let release = null;
    const selectedReleaseId = releaseId || recording.releases?.[0]?.id;
    if (selectedReleaseId) {
        release = await mbFetch(buildUrl(`${MB_BASE}/release/${encodeURIComponent(selectedReleaseId)}`, { inc: 'artist-credits+labels+recordings+release-groups+genres+tags', fmt: 'json' }));
    }
    let coverPath = '';
    let coverUrl = '';
    if (selectedReleaseId) {
        try {
            const coverMeta = await requestJson(`${CAA_BASE}/release/${encodeURIComponent(selectedReleaseId)}`, { maxRetries: 3 });
            const image = (coverMeta.images || []).find(x => x.front) || first(coverMeta.images);
            coverUrl = image?.image || image?.thumbnails?.['1200'] || '';
            if (coverUrl) coverPath = await downloadCover(fileUrl, coverUrl);
        } catch (_) {}
    }
    const rel = releaseInfo(release);
    const releaseCandidates = (recording.releases || []).filter(x => x?.id).slice().sort((a,b) => String(a.date || '9999').localeCompare(String(b.date || '9999')));
    const originalReleaseId = releaseCandidates[0]?.id || selectedReleaseId || '';
    const tags = (recording.tags || []).map(x => x.name).filter(Boolean);
    const genres = (recording.genres || []).map(x => x.name).filter(Boolean);
    const metadata = {
        title: recording.title || '',
        artist: artistText(recording['artist-credit']) ? artistText(recording['artist-credit']).split(/,\s*/).filter(Boolean) : [],
        album: rel.album || recording.releases?.[0]?.title || '',
        albumArtist: rel.albumArtist ? [rel.albumArtist] : [],
        composer: [],
        genre: genres.length ? genres : tags,

        year: rel.year || (recording['first-release-date'] || '').slice(0,4),
        track: '', trackTotal: '', discNumber: '', discTotal: '',
        label: rel.label || '', publisher: rel.publisher || '', copyright: '',
        comment: recording.disambiguation || '', conductor: '', remixer: '',
        sortTitle: recording.title || '',
        sortArtist: artistText(recording['artist-credit']) || '',
        sortAlbum: rel.album || '', grouping: '', bpm: '', compilation: '',
        isrc: first(recording.isrcs)?.isrc || '',
        musicBrainzTrackId: recording.id || '',
        musicBrainzAlbumId: selectedReleaseId || '',
        musicBrainzOriginalAlbumId: originalReleaseId,
        musicBrainzArtistId: recording['artist-credit']?.[0]?.artist?.id || '',
        encodedBy: ''
    };
    const cachePath = saveJson(fileUrl, { source: 'musicbrainz', recording, release, coverUrl, metadata, fetchedAt: new Date().toISOString() });
    return { success: true, metadata, coverPath, coverUrl, cachePath, source: 'musicbrainz' };
}

module.exports = { searchOnlineMetadata, getOnlineMetadata };
