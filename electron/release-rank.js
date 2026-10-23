// Which release is "the original" (task PD-04). Pure logic: no network, no files. Given the releases MusicBrainz lists for a recording
// and what the file says about itself, it ranks them, says why, and gives a confidence and a decision:
//   'auto'   confident enough to apply without asking (default threshold 0.85)
//   'review' plausible, put it in the review queue (0.5 and up)
//   'none'   not enough evidence
//
// Rule "original" (owner's brief 16.4): the earliest OFFICIAL album release. Singles and EPs rank below albums; compilations, live,
// remix, DJ-mix, demo, soundtrack and similar releases are skipped unless the file itself is one (its album or title says so, or its
// album equals that release). Releases of the same release group (reissues, regional editions) count as one album, represented by
// the earliest official one.
// Rule "popular": needs a popularity signal from outside MusicBrainz, passed in as `popularity` ({ [releaseGroupId]: 0..1 }). Without
// it, this falls back to "original", as the brief says. No popularity source is connected yet (to investigate: Deezer, iTunes).
//
// Candidate shape (what electron/online-metadata.js returns for scope 'release'):
//   { id, title, date, releaseGroupId, status, primaryType, secondaryTypes: [], recordingScore? }
// MusicBrainz field names (status, primary-type, secondary-types) were not checked against the live service from the sandbox.

const AUTO_THRESHOLD = 0.85;
const REVIEW_THRESHOLD = 0.5;
const SKIPPED_TYPES = ['compilation', 'live', 'remix', 'dj-mix', 'demo', 'soundtrack', 'spokenword', 'interview', 'audiobook', 'audio drama', 'mixtape/street'];
const TYPE_SCORE = { album: 1, ep: 0.7, single: 0.7, broadcast: 0.3, other: 0.4 };
const STATUS_SCORE = { official: 1, promotion: 0.4, bootleg: 0.1, 'pseudo-release': 0.1 };

const lower = (value) => String(value || '').trim().toLowerCase();
const yearOf = (date) => {
    const year = parseInt(String(date || '').slice(0, 4), 10);
    return Number.isFinite(year) ? year : null;
};

/** Which of the skipped kinds the file itself is (so a live recording may match a live release). */
function fileKinds(file = {}) {
    const text = `${lower(file.title)} ${lower(file.album)}`;
    const kinds = new Set();
    if (/\blive\b|\(live|\blive at\b|\blive in\b/.test(text)) kinds.add('live');
    if (/\bremix\b|\bmix\)|\bedit\)/.test(text)) kinds.add('remix');
    if (/\bdemo\b/.test(text)) kinds.add('demo');
    if (/\b(greatest hits|best of|compilation|anthology|collection|the very best|essential)\b/.test(text)) kinds.add('compilation');
    if (/\bsoundtrack\b|\bost\b|\bo\.s\.t\b/.test(text)) kinds.add('soundtrack');
    return kinds;
}

function baseScore(candidate, file, kinds) {
    const reasons = [];
    const type = TYPE_SCORE[lower(candidate.primaryType)] ?? 0.5;
    const status = STATUS_SCORE[lower(candidate.status)] ?? 0.7;
    let score = type * status;
    if (lower(candidate.status) && lower(candidate.status) !== 'official') reasons.push(`status ${candidate.status}`);
    if (type < 1) reasons.push(`${candidate.primaryType || 'unknown type'}, not an album`);
    const sameAlbum = lower(candidate.title) && lower(candidate.title) === lower(file.album);
    for (const secondary of (candidate.secondaryTypes || []).map(lower)) {
        if (!SKIPPED_TYPES.includes(secondary)) continue;
        if (kinds.has(secondary) || (sameAlbum && secondary === 'compilation')) reasons.push(`${secondary}, and the file is one`);
        else {
            score *= 0.25;
            reasons.push(`${secondary} release skipped`);
        }
    }
    return { score, reasons };
}

/** One entry per release group: the earliest official release stands for it. */
function byGroup(candidates) {
    const groups = new Map();
    for (const candidate of candidates) {
        const key = candidate.releaseGroupId || `release:${candidate.id}`;
        const current = groups.get(key);
        const better = !current
            || (lower(candidate.status) === 'official' && lower(current.status) !== 'official')
            || (lower(candidate.status) === lower(current.status) && (yearOf(candidate.date) ?? 9999) < (yearOf(current.date) ?? 9999));
        if (better) groups.set(key, candidate);
    }
    return [...groups.values()];
}

function rankReleases(candidates, { file = {}, rule = 'original', popularity = null } = {}) {
    const kinds = fileKinds(file);
    const groups = byGroup((candidates || []).filter((candidate) => candidate && candidate.id));
    const scored = groups.map((candidate) => ({ candidate, ...baseScore(candidate, file, kinds) }));
    const years = scored.filter((s) => s.score >= 0.5).map((s) => yearOf(s.candidate.date)).filter((y) => y !== null);
    const earliest = years.length ? Math.min(...years) : null;
    const usePopularity = rule === 'popular' && popularity && Object.keys(popularity).length > 0;
    for (const item of scored) {
        const year = yearOf(item.candidate.date);
        let dateFactor;
        if (year === null) {
            dateFactor = 0.4;
            item.reasons.push('no release date');
        } else if (earliest === null || year <= earliest) {
            dateFactor = 1;
            item.reasons.push('earliest');
        } else {
            dateFactor = Math.max(0.5, 1 - (year - earliest) * 0.05);
            item.reasons.push(`${year - earliest} year${year - earliest === 1 ? '' : 's'} after the earliest`);
        }
        item.original = item.score * dateFactor;
        const popular = usePopularity ? Number(popularity[item.candidate.releaseGroupId] ?? 0) : null;
        item.final = usePopularity ? 0.6 * popular + 0.4 * item.original : item.original;
        if (usePopularity) item.reasons.push(`popularity ${Math.round(popular * 100)}%`);
    }
    return scored.sort((a, b) => b.final - a.final || (yearOf(a.candidate.date) ?? 9999) - (yearOf(b.candidate.date) ?? 9999)).map((item) => ({ ...item.candidate, score: Number(item.final.toFixed(3)), reasons: item.reasons }));
}

/** The pick, with a confidence between 0 and 1 and a decision. Confidence drops when the next best album is close, or when MusicBrainz
 *  itself was unsure the recording is the right one (recordingScore 0 to 100, optional). */
function pickRelease(candidates, options = {}) {
    const ranked = rankReleases(candidates, options);
    if (ranked.length === 0) return { decision: 'none', confidence: 0, best: null, ranked, reasons: ['no releases found'] };
    const [best, next] = ranked;
    const margin = next && best.score > 0 ? (best.score - next.score) / best.score : 1;
    const match = Number.isFinite(Number(best.recordingScore)) && best.recordingScore !== undefined ? 0.5 + 0.5 * Math.min(100, Math.max(0, Number(best.recordingScore))) / 100 : 1;
    const lone = ranked.length === 1 ? 0.9 : 1; // a single candidate has nothing to be compared with
    const confidence = Number(Math.min(1, best.score * (0.6 + 0.4 * margin) * match * lone).toFixed(3));
    const decision = confidence >= (options.autoThreshold ?? AUTO_THRESHOLD) ? 'auto' : confidence >= REVIEW_THRESHOLD ? 'review' : 'none';
    return { decision, confidence, best, ranked, reasons: best.reasons };
}

module.exports = { fileKinds, rankReleases, pickRelease, AUTO_THRESHOLD, REVIEW_THRESHOLD };
