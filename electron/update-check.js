'use strict';

// "Check for updates" in Settings > About: asks GitHub for the project's releases and says whether one is newer than this version.
// It runs only when the person presses the button; nothing is checked in the background. Nothing is downloaded or installed.

const { USER_AGENT, PROJECT_URL } = require('./user-agent');

const REPO_PATH = PROJECT_URL.replace('https://github.com/', '');
const RELEASES_API = `https://api.github.com/repos/${REPO_PATH}/releases?per_page=20`;
const RELEASES_PAGE = `${PROJECT_URL}/releases`;
const TIMEOUT_MS = 10000;

// 1.2.3 or 1.2.3-beta.4 (a leading "v" is allowed). Anything else is not a version.
function parseVersion(text) {
    const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?(?:\+[0-9A-Za-z.-]+)?$/.exec(String(text || '').trim());
    if (!m) return null;
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]), pre: m[4] ? m[4].split('.') : [] };
}

// Negative when a is older than b, 0 when equal, positive when newer. A version with a pre-release part is older than the same one without it.
function compareVersions(a, b) {
    const x = typeof a === 'string' ? parseVersion(a) : a;
    const y = typeof b === 'string' ? parseVersion(b) : b;
    if (!x || !y) return 0;
    for (const key of ['major', 'minor', 'patch']) if (x[key] !== y[key]) return x[key] - y[key];
    if (!x.pre.length && !y.pre.length) return 0;
    if (!x.pre.length) return 1;
    if (!y.pre.length) return -1;
    for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
        const p = x.pre[i];
        const q = y.pre[i];
        if (p === undefined) return -1;
        if (q === undefined) return 1;
        const pn = /^\d+$/.test(p);
        const qn = /^\d+$/.test(q);
        if (pn && qn) {
            if (Number(p) !== Number(q)) return Number(p) - Number(q);
        } else if (pn !== qn) {
            return pn ? -1 : 1;
        } else if (p !== q) {
            return p < q ? -1 : 1;
        }
    }
    return 0;
}

// The newest release this version could move to. A person on a pre-release (every build until 1.0.0) is offered pre-releases too;
// a person on a stable version only hears about stable ones. Drafts are never offered.
function pickLatest(releases, current) {
    const cur = parseVersion(current);
    const wantPre = !cur || cur.pre.length > 0;
    let best = null;
    for (const r of Array.isArray(releases) ? releases : []) {
        if (!r || r.draft) continue;
        const v = parseVersion(r.tag_name);
        if (!v) continue;
        if (r.prerelease && !wantPre) continue;
        if (!best || compareVersions(v, best.version) > 0) best = { version: v, release: r };
    }
    return best;
}

// Only a page of this project's releases is ever opened, whatever the answer said.
function safeReleaseUrl(url) {
    return typeof url === 'string' && url.startsWith(`${PROJECT_URL}/releases/`) ? url : RELEASES_PAGE;
}

async function checkForUpdates({ current, fetchImpl = globalThis.fetch, timeoutMs = TIMEOUT_MS } = {}) {
    if (!parseVersion(current)) return { success: false, error: 'This build has no version number to compare.' };
    if (typeof fetchImpl !== 'function') return { success: false, error: 'No network access in this build.' };
    let response;
    try {
        response = await fetchImpl(RELEASES_API, {
            headers: { 'User-Agent': USER_AGENT, Accept: 'application/vnd.github+json' },
            signal: typeof AbortSignal !== 'undefined' && AbortSignal.timeout ? AbortSignal.timeout(timeoutMs) : undefined
        });
    } catch (error) {
        return { success: false, error: 'Could not reach GitHub. Check the internet connection and try again.' };
    }
    if (!response || !response.ok) {
        const limited = response && (response.status === 403 || response.status === 429);
        return { success: false, error: limited ? 'GitHub asked for a pause. Try again in a few minutes.' : `GitHub answered with an error${response && response.status ? ` (${response.status})` : ''}.` };
    }
    let releases;
    try {
        releases = await response.json();
    } catch (error) {
        return { success: false, error: 'GitHub sent an answer that could not be read.' };
    }
    const best = pickLatest(releases, current);
    if (!best) return { success: true, current, latest: null, updateAvailable: false, url: RELEASES_PAGE };
    const latest = String(best.release.tag_name).replace(/^v/, '');
    return {
        success: true,
        current,
        latest,
        updateAvailable: compareVersions(best.version, current) > 0,
        prerelease: Boolean(best.release.prerelease),
        url: safeReleaseUrl(best.release.html_url)
    };
}

module.exports = { parseVersion, compareVersions, pickLatest, safeReleaseUrl, checkForUpdates, RELEASES_PAGE, RELEASES_API };
