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

// ---- ranking the recordings a search found (the single-song editor) ------------------------------------------------------------------------
// MusicBrainz already scores every recording against the words that were searched (`score`, 0 to 100). That score knows nothing about the FILE,
// so it is combined with what the file says about itself: the title, the artist and above all the length (two recordings of one song rarely
// last the same), and a live, remix, demo or acoustic version is held back unless the file is one. The result is `match` (0 to 1) with the
// reasons in words, best first.
// The notes a release adds after a song's name that are not part of the song: "Song (Remastered 2013)", "Song - 2011 Remaster", "Song [Deluxe Edition]",
// "Song (Mono)", "Song (feat. Someone)". A live, remix, demo or acoustic note is a different recording and is kept. MusicBrainz usually holds the plain name.
const EDITION_WORDS = 'remaster(?:ed)?|re-?master|deluxe|bonus(?: track)?|mono|stereo|anniversary|edition|expanded|re-?issue|explicit|radio edit|single version|album version|original version|digital|\\d{4} (?:version|mix)';
const BRACKET_NOTE = new RegExp(`\\s*[\\(\\[][^)\\]]*\\b(?:${EDITION_WORDS}|feat\\.?|ft\\.?|featuring)\\b[^)\\]]*[\\)\\]]`, 'gi');
const DASH_NOTE = new RegExp(`\\s+[-–—]\\s+[^-–—]*\\b(?:${EDITION_WORDS})\\b.*$`, 'i');
function stripEditionNotes(title) {
    const text = String(title || '').trim();
    const bare = text.replace(BRACKET_NOTE, '').replace(DASH_NOTE, '').replace(/\s{2,}/g, ' ').trim();
    return bare || text; // never an empty name
}

const normText = (value) => String(value || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[‘’`´]/g, "'").replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const withoutBrackets = (value) => String(value || '').replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\b(feat|ft|featuring)\.?\s.*$/i, ' ');

/** 'm:ss', 'h:mm:ss' or a number of seconds -> seconds, or null. */
function secondsOf(value) {
    if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : null;
    const parts = String(value || '').trim().split(':');
    if (parts.length < 2 || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null;
    const seconds = parts.reduce((total, p) => total * 60 + Number(p), 0);
    return seconds > 0 ? seconds : null;
}

/** How alike two titles or names are, 0 to 1; null when one of them is empty (nothing to compare). */
function textSimilarity(a, b) {
    const left = normText(a);
    const right = normText(b);
    if (!left || !right) return null;
    if (left === right) return 1;
    const bareLeft = normText(withoutBrackets(stripEditionNotes(a)));
    const bareRight = normText(withoutBrackets(stripEditionNotes(b)));
    if (bareLeft && bareLeft === bareRight) return 0.9; // "Song (Remastered 2013)" and "Song"
    if (left.includes(right) || right.includes(left)) return 0.75;
    const tokensLeft = new Set(left.split(' '));
    const tokensRight = new Set(right.split(' '));
    const shared = [...tokensLeft].filter((t) => tokensRight.has(t)).length;
    return (shared / new Set([...tokensLeft, ...tokensRight]).size) * 0.7;
}

/** How many of the file's artists are credited on the recording, 0 to 1; null when the file names none. */
function artistSimilarity(fileArtist, creditedArtist) {
    const names = String(fileArtist || '').split(/;|\/|,|&|\band\b|\bfeat\.?\b|\bft\.?\b/i).map(normText).filter(Boolean);
    const credit = normText(creditedArtist);
    if (!names.length || !credit) return null;
    return names.filter((name) => credit.includes(name)).length / names.length;
}

/** 1 within two seconds, fading to 0 at twenty-five; null when either length is unknown. */
function lengthSimilarity(fileSeconds, recordingMs) {
    const recording = Number(recordingMs) / 1000;
    if (!fileSeconds || !(recording > 0)) return null;
    const gap = Math.abs(recording - fileSeconds);
    return gap <= 2 ? 1 : gap >= 25 ? 0 : 1 - (gap - 2) / 23;
}

const VERSION_WORDS = [['live', /\blive\b/], ['remix', /\bremix(ed)?\b|\bmix\b/], ['demo', /\bdemo\b/], ['acoustic', /\bacoustic\b/], ['instrumental', /\binstrumental\b/], ['karaoke', /\bkaraoke\b/], ['cover', /\bcover\b/], ['a cappella', /\ba cappella\b/]];

function rankRecordings(recordings, { title = '', artist = '', album = '', duration = null } = {}) {
    const fileSeconds = secondsOf(duration);
    const fileText = `${normText(title)} ${normText(album)}`;
    const scored = (recordings || []).map((recording, index) => {
        const signals = [
            [0.4, Math.min(100, Math.max(0, Number(recording.score) || 0)) / 100],
            [0.2, textSimilarity(title, recording.title)],
            [0.15, artistSimilarity(artist, recording.artist)],
            [0.25, lengthSimilarity(fileSeconds, recording.length)]
        ].filter(([, value]) => value !== null);
        const weight = signals.reduce((sum, [w]) => sum + w, 0) || 1;
        let match = signals.reduce((sum, [w, value]) => sum + w * value, 0) / weight;
        const reasons = [];
        if (signals.find(([w]) => w === 0.2)?.[1] === 1) reasons.push('same title');
        if ((signals.find(([w]) => w === 0.15)?.[1] ?? 0) >= 0.99) reasons.push('same artist');
        const length = signals.find(([w]) => w === 0.25)?.[1];
        if (length >= 0.95) reasons.push('same length');
        else if (length !== undefined && length < 0.3) reasons.push('different length');
        if ((Number(recording.score) || 0) >= 95) reasons.push('top MusicBrainz match');
        const versionText = normText(`${recording.title} ${recording.disambiguation || ''}`);
        for (const [name, pattern] of VERSION_WORDS) {
            if (pattern.test(versionText) && !pattern.test(fileText)) { match *= 0.7; reasons.push(`${name} version`); break; }
        }
        return { recording, index, match: Number(Math.min(1, Math.max(0, match)).toFixed(3)), reasons };
    });
    scored.sort((a, b) => b.match - a.match || (b.recording.releases?.length || 0) - (a.recording.releases?.length || 0) || a.index - b.index);
    return scored.map((item, position) => ({ ...item.recording, match: item.match, matchReasons: item.reasons, ...(position === 0 && item.match >= 0.55 ? { isBest: true } : {}) }));
}

/** Adds the ranked pick to an answer of searchOnlineMetadata, for the single-song editor (it used to call the earliest date "original").
 *  scope 'release': `recommended` = { id, confidence, decision, reasons } for the best release in `results`.
 *  scope 'recording': each recording gets `recommendedReleaseId` and `recommendedConfidence` for its own releases.
 *  Returns a new object; the answer that was passed in (which may be cached) is not changed. */
function annotateSearch(answer, { title = '', album = '', artist = '', duration = null, scope = 'recording' } = {}) {
    if (!answer || !answer.success || !Array.isArray(answer.results)) return answer;
    const file = { title, album };
    if (scope === 'release') {
        const pick = pickRelease(answer.results, { file });
        if (!pick.best) return answer;
        // Best first: every release takes the rank of its release group (a reissue sits next to its original), the rest keep their order.
        const rankOf = new Map(pick.ranked.map((r) => [r.releaseGroupId || `release:${r.id}`, r.score]));
        const results = answer.results.map((release, index) => ({ release, index, score: rankOf.get(release.releaseGroupId || `release:${release.id}`) ?? 0 }))
            .sort((a, b) => b.score - a.score || a.index - b.index)
            .map(({ release, score }, position) => ({ ...release, match: Number(score.toFixed(3)), ...(position === 0 ? { isBest: true } : {}) }));
        return { ...answer, results, recommended: { id: pick.best.id, confidence: pick.confidence, decision: pick.decision, reasons: pick.reasons } };
    }
    return {
        ...answer,
        results: rankRecordings(answer.results, { title, artist, album, duration }).map((recording) => {
            const pick = pickRelease(recording.releases || [], { file: { title: recording.title || title, album } });
            return pick.best ? { ...recording, recommendedReleaseId: pick.best.id, recommendedConfidence: pick.confidence } : recording;
        })
    };
}

module.exports = { stripEditionNotes, fileKinds, rankReleases, rankRecordings, secondsOf, pickRelease, annotateSearch, AUTO_THRESHOLD, REVIEW_THRESHOLD };
