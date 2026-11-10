'use strict';

// Read-only check of the multi tag finder on YOUR songs (task PD-04: "original" and "most popular" release, and the live MusicBrainz field
// names). It takes a spread of songs from your library, asks MusicBrainz and ListenBrainz through the same code the app uses, and prints for
// each song what the "original" rule and the "most popular" rule pick, how sure each is, and why. NOTHING is written: no tag, no file, no library.
//
//   node tools/dev/finder-report.js "<folder that holds songs.json>" [--count 20] [--seed 1] [--out report.md]
//
// Needs the internet. MusicBrainz allows about one request a second, so 20 songs take a few minutes. It runs in plain Node, not in the app: the
// one thing the finder asks Electron for (a folder for its small cache of MusicBrainz answers) is answered with a folder in the temp directory,
// so the app's own cache is not touched either. What to look at:
//   - "original" should be the album the song first came out on, not a compilation, a live album or a reissue.
//   - "popular" differs from "original" only where a later release is the one people listen to; where it does not, the reasons say why
//     ("no popularity data, used the original rule" means ListenBrainz gave nothing: then the popularity source is not working for you).
//   - A pick marked "auto" that you disagree with is the finding that matters most: it is what would be applied without asking.
// If a column is empty for every song, a MusicBrainz field name is wrong: send the output.

const fs = require('fs');
const os = require('os');
const path = require('path');
const Module = require('module');

/**
 * The finder's cache code asks `require('electron').app.getPath('userData')`. Outside Electron, `require('electron')` is either missing or (when the
 * package is installed) just the path of the Electron program as a string, so `.app` is undefined and every song fails. This answers that one
 * request, for any code loaded after it, with a folder in the temp directory. Returns the folder.
 */
function installElectronStub(folder = path.join(os.tmpdir(), 'xplayer-finder-report')) {
    const stub = { app: { getPath: () => folder } };
    const load = Module._load;
    Module._load = function (request, ...rest) {
        return request === 'electron' ? stub : load.call(this, request, ...rest);
    };
    return folder;
}

/** Songs with a title and a known artist, `count` of them spread evenly over the library (or shuffled by `seed`). Pure. */
function selectSample(songs, count = 20, seed = null) {
    const usable = (Array.isArray(songs) ? songs : []).filter((s) => s && String(s.title || '').trim() && String(s.artist || '').trim() && s.artist !== 'Unknown Artist' && (s.url || s.fileUrl));
    if (usable.length <= count) return usable.slice();
    if (seed === null || seed === undefined) {
        const step = usable.length / count;
        return Array.from({ length: count }, (_, i) => usable[Math.floor(i * step)]);
    }
    let state = (Number(seed) || 1) >>> 0; // mulberry32: a small deterministic generator, so the same seed gives the same sample
    const random = () => {
        state = (state + 0x6d2b79f5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    const pool = usable.slice();
    for (let i = pool.length - 1; i > 0; i--) {
        const j = Math.floor(random() * (i + 1));
        [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, count);
}

const year = (date) => String(date || '').slice(0, 4) || '?';
const describe = (r) => (r.release ? `${r.release.title} (${year(r.release.date)}) ${Math.round(r.confidence * 100)}% ${r.decision}` : `${r.decision}${r.reasons && r.reasons[0] ? `: ${r.reasons[0]}` : ''}`);

/** One report row for a song, from the answers of the two rules. Pure. */
function reportRow(song, original, popular) {
    const same = original.release && popular.release ? original.release.id === popular.release.id : original.decision === popular.decision;
    return {
        song: `${song.title} - ${song.artist}`,
        inFile: song.album || '(no album)',
        original: describe(original),
        popular: describe(popular),
        why: (original.reasons || []).join('; '),
        popularWhy: (popular.reasons || []).filter((x) => /popularity|no popularity/.test(x)).join('; '),
        same
    };
}

/**
 * What MusicBrainz offered for a song, in two lines: how many releases and of which kinds, and the earliest three. When the finder says "none"
 * this is what shows whether nothing was offered or only compilations were. `candidates` are the search results the finder was given. Pure.
 */
function summarizeCandidates(candidates) {
    const list = Array.isArray(candidates) ? candidates : [];
    if (list.length === 0) return { count: 0, kinds: '', earliest: '' };
    const kind = (c) => [c.primaryType || '?', ...(c.secondaryTypes || [])].join('+');
    const counts = new Map();
    for (const c of list) counts.set(kind(c), (counts.get(kind(c)) || 0) + 1);
    const kinds = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([name, n]) => `${name} x${n}`).join(', ');
    const earliest = list
        .filter((c) => c.date)
        .sort((a, b) => String(a.date).localeCompare(String(b.date)))
        .slice(0, 3)
        .map((c) => `${c.title} (${year(c.date)}, ${kind(c)}, ${c.status || '?'})`)
        .join('; ');
    return { count: list.length, kinds, earliest };
}

function toMarkdown(rows) {
    const cell = (x) => String(x).replace(/\|/g, '/');
    const lines = ['| Song | Album in the file | Original rule | Most popular rule | Same? | Why (original) |', '|---|---|---|---|---|---|'];
    for (const r of rows) lines.push(`| ${cell(r.song)} | ${cell(r.inFile)} | ${cell(r.original)} | ${cell(r.popular)} | ${r.same ? 'yes' : '**no**'} | ${cell(r.why)}${r.popularWhy ? ` / ${cell(r.popularWhy)}` : ''} |`);
    return lines.join('\n');
}

async function main(argv) {
    const args = argv.slice();
    let count = 20;
    let seed = null;
    let out = '';
    let target = '';
    for (let i = 0; i < args.length; i++) {
        if (args[i] === '--count') count = Math.max(1, Number(args[++i]) || 20);
        else if (args[i] === '--seed') seed = Number(args[++i]) || 1;
        else if (args[i] === '--out') out = args[++i] || '';
        else if (!target) target = args[i];
    }
    if (!target) {
        console.log('Usage: node tools/dev/finder-report.js "<folder with songs.json>" [--count 20] [--seed 1] [--out report.md]');
        return 1;
    }
    const file = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.join(target, 'songs.json') : target;
    let parsed;
    try {
        parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
        console.log(`Cannot read ${file}: ${error.message}`);
        return 1;
    }
    const songs = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.songs) ? parsed.songs : [];
    const sample = selectSample(songs, count, seed);
    if (sample.length === 0) {
        console.log('No songs with a title and an artist were found in that file.');
        return 1;
    }

    installElectronStub(); // before anything that needs the app's folders is loaded
    const { createTagFinder } = require('../../electron/tag-finder');
    const { searchOnlineMetadata, getOnlineMetadata } = require('../../electron/online-metadata');
    // Both rules ask MusicBrainz the same question, so it is asked once per song.
    const searches = new Map();
    let offered = []; // what the searches for the song being checked returned, in order
    const search = (query) => {
        const key = JSON.stringify([query.title, query.artist, query.album, query.scope]);
        if (!searches.has(key)) searches.set(key, searchOnlineMetadata(query));
        return searches.get(key).then((answer) => { offered.push({ title: query.title, results: (answer && answer.results) || [] }); return answer; });
    };
    const finder = createTagFinder({ search, getMetadata: getOnlineMetadata });

    console.log(`Checking ${sample.length} of ${songs.length} songs. This writes nothing. About a few seconds per song.\n`);
    const rows = [];
    let failuresInARow = 0;
    for (const song of sample) {
        try {
            offered = [];
            const original = await finder.findOne(song, { rule: 'original' });
            const popular = await finder.findOne(song, { rule: 'popular' });
            failuresInARow = 0;
            const row = reportRow(song, original, popular);
            const seen = offered.filter((o, i) => offered.findIndex((x) => x.title === o.title) === i).map((o) => ({ title: o.title, ...summarizeCandidates(o.results) }));
            row.offered = seen;
            rows.push(row);
            console.log(`${row.song}\n   in the file : ${row.inFile}\n   original    : ${row.original}\n   most popular: ${row.popular}${row.same ? '' : '   <- differs'}\n   why         : ${row.why}${row.popularWhy ? ` | ${row.popularWhy}` : ''}\n${row.offered.map((o) => `   MusicBrainz offered${row.offered.length > 1 ? ` for "${o.title}"` : ''}: ${o.count} releases${o.kinds ? ` (${o.kinds})` : ''}${o.earliest ? `\n      earliest: ${o.earliest}` : ''}\n`).join('')}`);
        } catch (error) {
            failuresInARow += 1;
            console.log(`${song.title} - ${song.artist}\n   FAILED: ${error && error.message ? error.message : error}\n`);
            if (failuresInARow >= 3) {
                console.log('Three failures in a row: stopping. Is the internet connection working?');
                break;
            }
        }
    }
    const differ = rows.filter((r) => !r.same).length;
    console.log(`Done: ${rows.length} songs, ${differ} where "most popular" differs from "original".`);
    if (out) {
        fs.writeFileSync(out, `${toMarkdown(rows)}\n`, 'utf8');
        console.log(`The table is in ${out}`);
    }
    return 0;
}

module.exports = { selectSample, reportRow, summarizeCandidates, toMarkdown, installElectronStub };

if (require.main === module) {
    main(process.argv.slice(2)).then((code) => process.exit(code), (error) => { console.log(error && error.stack ? error.stack : String(error)); process.exit(1); });
}
