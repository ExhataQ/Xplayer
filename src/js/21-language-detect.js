// ==============================================================================
// OFFLINE LANGUAGE DETECTION (dev-mode)
// ==============================================================================
// Lightweight script-based + stopword classifier. Returns a BCP-47 code.
// Not fastText-grade for Latin-script languages, essentially exact for
// non-Latin scripts (Hangul, Kana, Han, Cyrillic, Arabic, Hebrew, Greek,
// Thai, Devanagari). Used as a signal for Smart Shuffle v2.
//
// This file is intentionally standalone: no dependency on SONGS_DATA, no
// DOM access at module scope, no localStorage. Callers pass song objects in
// and get results back.

const LANGUAGE_SCRIPT_RANGES = [
    { code: 'ko', name: 'Korean', regex: /[\uAC00-\uD7AF\u1100-\u11FF]/ },
    { code: 'ja', name: 'Japanese', regex: /[\u3040-\u309F\u30A0-\u30FF]/ },
    { code: 'zh', name: 'Chinese', regex: /[\u4E00-\u9FFF\u3400-\u4DBF]/ },
    { code: 'ru', name: 'Russian', regex: /[\u0400-\u04FF]/ },
    { code: 'fa', name: 'Persian', regex: /[\u067E\u0686\u0698\u06AF\u06CC\u06A9]/ },
    { code: 'ur', name: 'Urdu', regex: /[\u0679\u0688\u0691\u06BA\u06BE\u06C1\u06D2]/ },
    { code: 'ar', name: 'Arabic', regex: /[\u0600-\u06FF\u0750-\u077F]/ },
    { code: 'he', name: 'Hebrew', regex: /[\u0590-\u05FF]/ },
    { code: 'el', name: 'Greek', regex: /[\u0370-\u03FF\u1F00-\u1FFF]/ },
    { code: 'th', name: 'Thai', regex: /[\u0E00-\u0E7F]/ },
    { code: 'hi', name: 'Hindi', regex: /[\u0900-\u097F]/ },
    { code: 'ka', name: 'Georgian', regex: /[\u10A0-\u10FF]/ },
    { code: 'hy', name: 'Armenian', regex: /[\u0530-\u058F]/ }
];

const LANGUAGE_STOPWORDS = {
    en: ['i', 'a', 'an', 'is', 'it', 'to', 'of', 'in', 'on', 'for', 'be', 'at', 'as', 'by', 'or', 'if', 'so', 'no', 'do', 'go', 'he', 'she', 'we', 'me', 'my', 'up', 'us', 'am', 'im', 'cant', 'dont', 'wont', 'the', 'and', 'you', 'that', 'with', 'have', 'this', 'from', 'they', 'will', 'would', 'there', 'their', 'what', 'about', 'which', 'when', 'make', 'like', 'time', 'just', 'know', 'take', 'into', 'your', 'some', 'them', 'than', 'then', 'only', 'come', 'over', 'also', 'back', 'after', 'use', 'two', 'how', 'our', 'work', 'first', 'well', 'way', 'even', 'new', 'want', 'because', 'any', 'these', 'give', 'day', 'most'],
    es: ['que', 'de', 'no', 'la', 'el', 'en', 'y', 'a', 'los', 'del', 'se', 'las', 'por', 'un', 'para', 'con', 'una', 'su', 'para', 'es', 'al', 'lo', 'como', 'más', 'pero', 'sus', 'le', 'ya', 'o', 'este', 'sí', 'porque', 'esta', 'entre', 'cuando', 'muy', 'sin', 'sobre', 'también', 'me', 'hasta', 'hay', 'donde', 'quien', 'desde', 'todo', 'nos', 'durante', 'todos', 'uno', 'les', 'ni', 'contra', 'otros', 'ese', 'eso', 'ante', 'ellos', 'e', 'esto', 'mí', 'antes', 'algunos', 'qué', 'unos', 'yo', 'otro', 'otras', 'otra', 'él', 'tanto', 'esa', 'estos', 'mucho', 'quienes', 'nada', 'muchos', 'cual', 'poco', 'ella', 'estar', 'estas', 'algunas', 'algo', 'nosotros'],
    fr: ['le', 'de', 'un', 'être', 'et', 'en', 'avoir', 'que', 'pour', 'dans', 'ce', 'il', 'qui', 'ne', 'sur', 'se', 'pas', 'plus', 'pouvoir', 'par', 'je', 'avec', 'tout', 'faire', 'son', 'mettre', 'autre', 'on', 'mais', 'nous', 'comme', 'ou', 'si', 'leur', 'y', 'dire', 'elle', 'devoir', 'avant', 'deux', 'même', 'prendre', 'aussi', 'celui', 'donner', 'bien', 'où', 'fois', 'vous', 'encore', 'aussi', 'celui', 'là', 'aller', 'sans', 'sous', 'être', 'peu', 'très'],
    de: ['der', 'die', 'und', 'in', 'den', 'von', 'zu', 'das', 'mit', 'sich', 'des', 'auf', 'für', 'ist', 'im', 'dem', 'nicht', 'ein', 'eine', 'als', 'auch', 'es', 'an', 'werden', 'aus', 'er', 'hat', 'dass', 'sie', 'nach', 'wird', 'bei', 'einer', 'um', 'am', 'sind', 'noch', 'wie', 'einem', 'über', 'einen', 'so', 'zum', 'war', 'haben', 'nur', 'oder', 'aber', 'vor', 'zur', 'bis', 'mehr', 'durch', 'man', 'sein', 'wurde', 'sei', 'in', 'dieser', 'dieses'],
    it: ['che', 'di', 'il', 'la', 'e', 'non', 'in', 'per', 'un', 'una', 'essere', 'sono', 'con', 'si', 'da', 'come', 'questo', 'ma', 'a', 'al', 'ha', 'le', 'si', 'anche', 'lo', 'hanno', 'o', 'più', 'suo', 'loro', 'se', 'essere', 'fare', 'avere', 'dove', 'quando', 'chi', 'che', 'perché', 'molto', 'tutti', 'essere', 'stato', 'solo', 'senza', 'sopra'],
    pt: ['de', 'a', 'o', 'que', 'e', 'do', 'da', 'em', 'um', 'para', 'é', 'com', 'não', 'uma', 'os', 'no', 'se', 'na', 'por', 'mais', 'as', 'dos', 'como', 'mas', 'foi', 'ao', 'ele', 'das', 'tem', 'à', 'seu', 'sua', 'ou', 'ser', 'quando', 'muito', 'há', 'nos', 'já', 'está', 'eu', 'também', 'só', 'pelo', 'pela', 'até', 'isso', 'ela', 'entre', 'era', 'depois', 'sem', 'mesmo', 'aos', 'ter', 'seus', 'quem', 'nas', 'me', 'esse', 'eles', 'estão', 'você', 'tinha', 'foram', 'essa', 'num', 'nem', 'suas', 'meu', 'às', 'minha', 'têm', 'numa', 'pelos', 'elas', 'havia', 'seja', 'qual', 'será', 'nós', 'tenho', 'lhe', 'deles', 'essas', 'esses', 'pelas', 'este', 'fosse', 'dele'],
    nl: ['de', 'en', 'van', 'ik', 'te', 'dat', 'die', 'in', 'een', 'hij', 'het', 'niet', 'zijn', 'is', 'was', 'op', 'aan', 'met', 'als', 'voor', 'had', 'er', 'maar', 'om', 'hem', 'dan', 'zou', 'of', 'wat', 'mijn', 'men', 'dit', 'zo', 'door', 'over', 'ze', 'zich', 'bij', 'ook', 'tot', 'je', 'mij', 'uit', 'der', 'daar', 'haar', 'naar', 'heb', 'hoe', 'heeft', 'hebben', 'deze', 'u', 'want', 'nog', 'zal', 'me', 'zij', 'nu', 'ge', 'geen', 'omdat', 'iets', 'worden', 'toch', 'al', 'waren', 'veel', 'meer', 'doen', 'toen', 'moet', 'ben', 'zonder', 'kan', 'hun', 'dus', 'alles', 'onder', 'ja', 'eens', 'hier', 'wie', 'werd', 'altijd', 'doch', 'wordt', 'wezen', 'kunnen', 'ons', 'zelf', 'tegen', 'na', 'reeds', 'wil', 'kon', 'niets', 'uw', 'iemand', 'geweest', 'andere'],
    sv: ['och', 'det', 'att', 'i', 'en', 'jag', 'hon', 'som', 'han', 'på', 'den', 'med', 'var', 'sig', 'för', 'så', 'till', 'är', 'men', 'ett', 'om', 'hade', 'de', 'av', 'icke', 'mig', 'du', 'henne', 'då', 'sin', 'nu', 'har', 'inte', 'hans', 'honom', 'skulle', 'hennes', 'där', 'min', 'man', 'ej', 'vid', 'kunde', 'något', 'från', 'ut', 'när', 'efter', 'upp', 'vi', 'dem', 'vara', 'vad', 'över', 'än', 'dig', 'kan', 'sina', 'här', 'ha', 'mot', 'alla', 'under', 'någon', 'eller', 'allt', 'mycket', 'sedan', 'ju', 'denna', 'själv', 'detta', 'åt', 'utan', 'varit', 'hur', 'ingen', 'mitt', 'ni', 'bli', 'blev', 'oss', 'din', 'dessa', 'några', 'deras', 'blir', 'mina', 'samma', 'vilken', 'er', 'sådan', 'vår', 'blivit', 'dess', 'inom', 'mellan', 'sådant', 'varför', 'varje', 'vilka', 'ditt', 'vem', 'vilket', 'sitta', 'sådana', 'vart', 'dina', 'vars', 'vårt', 'våra', 'ert', 'era', 'vilkas'],
    pl: ['i', 'w', 'nie', 'na', 'z', 'do', 'to', 'że', 'się', 'jest', 'jak', 'a', 'o', 'ale', 'tak', 'po', 'dla', 'od', 'co', 'za', 'ja', 'mnie', 'ty', 'go', 'już', 'on', 'ona', 'my', 'wy', 'oni', 'być', 'mieć', 'czy', 'tylko', 'gdy', 'gdzie', 'kto', 'coś', 'nic', 'ten', 'ta', 'te', 'tego', 'tej', 'tym', 'tych', 'ich', 'jego', 'jej', 'nas', 'was', 'wasz', 'nasz', 'ze', 'bez', 'przez', 'pod', 'nad', 'przed', 'między', 'bardzo', 'jeszcze', 'też', 'więc', 'albo', 'lub', 'jeśli', 'żeby', 'bo', 'ponieważ', 'który', 'która', 'które', 'którego', 'której', 'których', 'może', 'można', 'trzeba', 'są', 'był', 'była', 'było', 'byli', 'były', 'będzie', 'będą'],
    tr: ['ve', 'bir', 'bu', 'da', 'de', 'ne', 'o', 'ben', 'sen', 'için', 'ile', 'mi', 'mu', 'ama', 'daha', 'çok', 'az', 'her', 'hiç', 'var', 'yok', 'olan', 'olarak', 'gibi', 'kadar', 'sonra', 'önce', 'şey', 'ki', 'ya', 'hem', 'ya', 'ise', 'değil', 'oldu', 'olur', 'olduğu', 'olmak', 'yapmak', 'etmek', 'gelmek', 'gitmek', 'benim', 'senin', 'onun', 'bizim', 'sizin', 'onların'],
    id: ['yang', 'dan', 'di', 'itu', 'dengan', 'untuk', 'tidak', 'ini', 'dari', 'dalam', 'akan', 'pada', 'juga', 'saya', 'ke', 'karena', 'tersebut', 'bisa', 'ada', 'mereka', 'lebih', 'kata', 'tahun', 'sudah', 'harus', 'atau', 'saat', 'oleh', 'setelah', 'tapi', 'kami', 'kita', 'anda', 'dia', 'saja', 'belum', 'masih', 'hanya', 'sangat', 'semua', 'banyak']
};

const PERSIAN_DISTINCTIVE_WORDS = new Set([
    'كه', 'اين', 'با', 'رو', 'چي', 'چرا', 'كجا', 'ديگه', 'هيچي', 'بازم', 'هنوز',
    'بايد', 'شدم', 'كردم', 'ميشه', 'نميشه', 'نيستم', 'هستم', 'بودم', 'چيكار',
    'يعني', 'واسه', 'برام', 'بهش', 'ازش', 'باهاش', 'ميخوام', 'ميخواي', 'نميدونم',
    'ميدونم', 'دلم', 'دلت', 'خودت', 'خودم', 'ميكنم', 'ميكني', 'ميكنه', 'همش',
    'همين', 'چيه', 'كيه', 'نداره', 'داره', 'ميگم', 'ميگي', 'ميگه'
]);

function _normalizeArabicScript(text) {
    return String(text)
        .replace(/[\u06CC\u0649]/g, '\u064A')
        .replace(/\u06A9/g, '\u0643');
}

function _countPersianDistinctiveWords(sample) {
    const normalized = _normalizeArabicScript(sample);
    const tokens = normalized.match(/[\u0600-\u06FF]+/g) || [];
    let hits = 0;
    for (const token of tokens) {
        if (PERSIAN_DISTINCTIVE_WORDS.has(token)) hits++;
    }
    return hits;
}

function _countScriptMatches(text) {
    const counts = {};
    for (const { code, regex } of LANGUAGE_SCRIPT_RANGES) {
        const matches = text.match(new RegExp(regex.source, 'g'));
        if (matches && matches.length > 0) {
            counts[code] = matches.length;
        }
    }
    return counts;
}

function _countWordMatches(text) {
    const normalized = text
        .toLowerCase()
        .replace(/[\u2018\u2019\u02BC\u2032]/g, "'")
        .replace(/['']/g, "'");
    const tokens = normalized
        .replace(/[^a-zà-ÿ\s']/g, ' ')
        .replace(/'/g, '')
        .split(/\s+/)
        .filter(Boolean);
    if (tokens.length === 0) return { scores: {}, total: 0 };

    const scores = {};
    for (const [lang, words] of Object.entries(LANGUAGE_STOPWORDS)) {
        const set = new Set(words);
        let score = 0;
        for (const token of tokens) {
            if (!set.has(token)) continue;
            // Words shorter than 4 letters are shared across too many
            // languages to be a reliable signal. Half-weight them.
            score += token.length >= 4 ? 1 : 0.5;
        }
        if (score > 0) scores[lang] = score;
    }
    return { scores, total: tokens.length };
}

function _stripLrcTimestamps(text) {
    return String(text)
        .replace(/^\[(ti|ar|al|by|re|ve|length|offset|au|lyricist|composer|encoder|lyricsBy|tool):.*?\]$/gim, '')
        .replace(/\[\d{1,2}:\d{2}(?:[.:]\d{1,3})?\]/g, '');
}

function _getLyricsTextForSong(song) {
    if (!song) return '';

    if (typeof getSyncedLyricsForSong === 'function') {
        const synced = getSyncedLyricsForSong(song);
        if (synced && String(synced).trim() !== '') {
            return _stripLrcTimestamps(synced);
        }
    }

    if (typeof getLyricsForSong === 'function') {
        const plain = getLyricsForSong(song);
        if (plain && String(plain).trim() !== '') {
            return String(plain);
        }
    }

    if (song.lyrics && String(song.lyrics).trim() !== '') {
        return String(song.lyrics);
    }

    return '';
}

function detectLanguageFromText(text) {
    if (!text || String(text).trim() === '') {
        return { language: 'undetected', confidence: 0, source: 'none' };
    }

    const sample = String(text).slice(0, 4000);

    const scriptCounts = _countScriptMatches(sample);
    const scriptTotal = Object.values(scriptCounts).reduce((a, b) => a + b, 0);
    const scriptEntries = Object.entries(scriptCounts).sort((a, b) => b[1] - a[1]);

    const letterCount = (sample.match(/[\p{L}]/gu) || []).length;

    if (scriptTotal > 0 && letterCount > 0) {
        // Persian and Urdu are subsets of the Arabic block. If a specific
        // script shows up with at least 15% of the generic match count,
        // prefer the specific code.
        const SPECIFIC_OVERRIDES = { fa: 'ar', ur: 'ar' };
        let chosen = scriptEntries[0];
        for (const [specific, generic] of Object.entries(SPECIFIC_OVERRIDES)) {
            const specificCount = scriptCounts[specific] || 0;
            const genericCount = scriptCounts[generic] || 0;
            if (specificCount > 0 && specificCount >= genericCount * 0.15) {
                chosen = [specific, specificCount];
                break;
            }
        }
        let [topCode, topCount] = chosen;
        let scriptSource = 'script';

        if (topCode === 'ar' && _countPersianDistinctiveWords(sample) >= 2) {
            topCode = 'fa';
            scriptSource = 'script+stopwords';
        }

        // Ratio is measured against Latin-script content specifically, not
        // total letters, so English hooks/ad-libs in an otherwise
        // non-Latin song don't dilute the dominant script out of contention.
        const latinLetterCount = (sample.match(/[A-Za-zÀ-ÿ]/g) || []).length;
        const SCRIPT_RATIO_THRESHOLD = 0.35;
        const scriptRatio = topCount / Math.max(1, topCount + latinLetterCount);

        if (scriptRatio >= SCRIPT_RATIO_THRESHOLD) {
            return { language: topCode, confidence: scriptRatio, source: scriptSource };
        }
    }

    const { scores, total } = _countWordMatches(sample);
    const stopwordEntries = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    if (stopwordEntries.length === 0 || total === 0) {
        return { language: 'undetected', confidence: 0, source: 'none' };
    }

    const [topLang, topHits] = stopwordEntries[0];
    const confidence = topHits / total;

    // English is the most common Latin-script language in music libraries.
    // Require a non-English language to beat English by a clear margin,
    // otherwise prefer English. This kills the false positives from
    // short shared words like "a", "i", "o", "y".
    const ENGLISH_BIAS = 1.6;
    if (topLang !== 'en') {
        const englishHits = scores['en'] || 0;
        if (topHits < englishHits * ENGLISH_BIAS + 2) {
            return { language: 'en', confidence: englishHits / total, source: 'stopwords' };
        }
    }

    return { language: topLang, confidence, source: 'stopwords' };
}

function detectSongLanguage(song) {
    if (!song) return { language: 'undetected', confidence: 0, source: 'none' };
    if (song.instrumental === true) return { language: 'instrumental', confidence: 1, source: 'flag' };
    const text = _getLyricsTextForSong(song);
    return detectLanguageFromText(text);
}

function analyzeAllSongsLanguages(songsOverride) {
    const songs = songsOverride
        || (typeof getActiveSongs === 'function' ? getActiveSongs() : (typeof SONGS_DATA !== 'undefined' ? SONGS_DATA : []));

    const rows = [];
    const tally = {};

    for (const song of songs) {
        const result = detectSongLanguage(song);
        song._detectedLanguage = result.language;
        song._detectedLanguageConfidence = result.confidence;
        song._detectedLanguageSource = result.source;

        rows.push({
            id: song.id,
            title: song.title || '',
            artist: song.artist || '',
            language: result.language,
            confidence: Number.isFinite(result.confidence) ? Number(result.confidence.toFixed(2)) : 0,
            source: result.source
        });

        tally[result.language] = (tally[result.language] || 0) + 1;
    }

    return { rows, tally };
}

function smartShuffleLanguagePrepass(songsOverride) {
    const t0 = performance.now();
    const { rows, tally } = analyzeAllSongsLanguages(songsOverride);
    const elapsed = Math.round(performance.now() - t0);

    console.group(`%cLanguage prepass — ${rows.length} songs in ${elapsed}ms`, 'color:#1db954;font-weight:bold');
    console.log('Tally:', tally);
    try {
        console.table(rows);
    } catch (e) {
        console.log(rows);
    }
    console.groupEnd();

    return rows;
}

function ensureShuffleLanguages(songs) {
    if (!Array.isArray(songs) || songs.length === 0) return;
    let classified = 0;
    for (const song of songs) {
        if (!song || song._detectedLanguage) continue;
        const result = detectSongLanguage(song);
        song._detectedLanguage = result.language;
        song._detectedLanguageConfidence = result.confidence;
        song._detectedLanguageSource = result.source;
        classified++;
    }
    if (classified > 0 && typeof console !== 'undefined') {
        console.log(`[smart-shuffle] classified ${classified} song${classified === 1 ? '' : 's'}`);
    }
}

window.__language = {
    analyzeAll: analyzeAllSongsLanguages,
    prepass: smartShuffleLanguagePrepass,
    ensureShuffle: ensureShuffleLanguages,
    detectOne: (songId) => {
        const song = (typeof SONGS_DATA !== 'undefined' ? SONGS_DATA : []).find(s => s.id === songId);
        if (!song) return console.warn('song not found', songId);
        const result = detectSongLanguage(song);
        song._detectedLanguage = result.language;
        console.log(song.title, '->', result);
        return result;
    },
    tally: () => {
        const t = {};
        const songs = typeof SONGS_DATA !== 'undefined' ? SONGS_DATA : [];
        for (const s of songs) {
            const l = s._detectedLanguage || 'not analyzed';
            t[l] = (t[l] || 0) + 1;
        }
        console.log(t);
        return t;
    }
};