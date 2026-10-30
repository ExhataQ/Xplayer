// Read-only report: how many songs in YOUR library have a missing artist, album or title, and what the offline suggestions
// (electron/tag-guess.js) would offer for them. Nothing is written or changed.
//   node tools/tag-guess-report.js "<folder that holds songs.json>" --root "D:\Music" [--root "E:\More"] [--examples 15]
// The folder is the output folder of the app (the one with songs.json and covers\).
const fs = require('fs');
const path = require('path');
const { guessTags, GENERIC_FOLDERS } = require('../electron/tag-guess');

const args = process.argv.slice(2);
const roots = [];
let examples = 15;
let target = '';
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--root') roots.push(args[++i]);
    else if (args[i] === '--examples') examples = Number(args[++i]) || 15;
    else if (!target) target = args[i];
}
if (!target) {
    console.log('Usage: node tools/tag-guess-report.js "<folder with songs.json>" --root "D:\\Music" [--examples 15]');
    process.exit(1);
}
const file = fs.existsSync(target) && fs.statSync(target).isDirectory() ? path.join(target, 'songs.json') : target;
let parsed;
try {
    parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
} catch (e) {
    console.log(`Cannot read ${file}: ${e.message}`);
    process.exit(1);
}
const songs = Array.isArray(parsed) ? parsed : parsed && Array.isArray(parsed.songs) ? parsed.songs : [];

const toPath = (url) => {
    try {
        return decodeURIComponent(String(url).replace(/^file:\/\/\//i, ''));
    } catch (e) {
        return String(url || '');
    }
};
const dirOf = (p) => p.replace(/[\\/][^\\/]*$/, '').toLowerCase();
const lastDir = (p) => (p.split(/[\\/]+/).filter(Boolean).slice(-2, -1)[0] || '').toLowerCase();

const byDir = new Map();
for (const s of songs) {
    const d = dirOf(toPath(s.url));
    if (!byDir.has(d)) byDir.set(d, []);
    byDir.get(d).push(s);
}

const missingArtist = (s) => !s.artist || s.artist === 'Unknown Artist';
const plain = (x) => String(x || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
// The old scan saved the folder name as the album. A real album is often stored in a folder of the same name, so that alone proves nothing:
// it only counts as a gap when the folder is a generic one ("Downloads", "New folder", ...), which is never an album.
const isFolderAlbum = (s) => s.album && plain(s.album) === plain(lastDir(toPath(s.url)));
const missingAlbum = (s) => !s.album || (isFolderAlbum(s) && GENERIC_FOLDERS.has(plain(s.album)));
const missingTitle = (s) => Array.isArray(s.missingTags) && s.missingTags.includes('title');

const tally = {};
const sample = [];
let withGap = 0;
let folderAlbums = 0;
for (const s of songs) {
    const gaps = [];
    if (missingArtist(s)) gaps.push('artist');
    if (missingAlbum(s)) gaps.push('album');
    if (missingTitle(s)) gaps.push('title');
    if (isFolderAlbum(s)) folderAlbums++;
    if (gaps.length === 0) continue;
    withGap++;
    const p = toPath(s.url);
    const have = { title: missingTitle(s) ? '' : s.title, artist: missingArtist(s) ? '' : s.artist, album: missingAlbum(s) ? '' : s.album };
    const siblings = (byDir.get(dirOf(p)) || []).filter((o) => o !== s).map((o) => ({ artist: missingArtist(o) ? '' : o.artist, album: missingAlbum(o) ? '' : o.album }));
    const guess = guessTags(p, { have, roots, siblings });
    for (const field of gaps) {
        const g = guess[field];
        const key = g ? `${field}: ${g.from} (${g.confidence})` : `${field}: nothing to suggest`;
        tally[key] = (tally[key] || 0) + 1;
    }
    if (sample.length < examples && Object.keys(guess).length > 0) sample.push({ p, gaps, guess });
}

console.log(`${songs.length} songs, ${withGap} with a missing artist, album or title (${folderAlbums} have an album equal to their folder name: often real, and the old scan's invented ones are cleared by the next scan)\n`);
for (const key of Object.keys(tally).sort()) console.log(`${String(tally[key]).padStart(7)}  ${key}`);
console.log('\nExamples:');
for (const e of sample) {
    console.log(`  ${e.p}   [missing: ${e.gaps.join(', ')}]`);
    for (const [field, g] of Object.entries(e.guess)) console.log(`      ${field.padEnd(6)} ${g.value}   <- ${g.from}, ${g.confidence}`);
}
