'use strict';

// Makes a made-up library to develop against: about 300 songs with covers, favorites and a few playlists, so the screens can be
// looked at (long lists, many albums, empty tags) without opening the real library.
//
//   node tools/dev/make-sample-library.js [<data folder>] [--count=300] [--seed=1] [--force]
//
// The data folder defaults to XPLAYER_DATA, else Source/.dev-data/profiles/sample. Written there:
//
//   library/songs.json, library/covers/     the list and the covers, built by the app's own tag-builder, so they look scanned
//   sample-music/<artist>/<album>/*.mp3     silent files (2 to 4 seconds) with real tags, so play, the metadata editor and a rescan work
//   settings/music-folders-config.json      the sample-music folder is the music folder
//   sample-seed.json                        playlists and favorites, which the page keeps in localStorage (see electron/dev-tools.js)
//
// Nothing is downloaded and no real music is used. The same --seed gives the same library. Without --force an existing sample is kept.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const DEFAULT_COUNT = 300;
const COVER_PX = 600;

function rng(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const FIRST = ['Silver', 'Quiet', 'Neon', 'Paper', 'Golden', 'Hollow', 'Velvet', 'Distant', 'Amber', 'Glass', 'Northern', 'Midnight', 'Little', 'Wild', 'Pale', 'Electric', 'Slow', 'Burning', 'Winter', 'Broken'];
const SECOND = ['Harbor', 'Echoes', 'Garden', 'Tide', 'Signals', 'Lanterns', 'Rivers', 'Machines', 'Parade', 'Static', 'Orchard', 'Horizon', 'Sparrows', 'Engines', 'Mirrors', 'Fields', 'Satellites', 'Embers', 'Roads', 'Choir'];
const WORDS = ['Morning', 'Rain', 'Window', 'Highway', 'Salt', 'Letters', 'Shadow', 'Summer', 'Carousel', 'Static', 'Anchor', 'Daylight', 'Paper Moon', 'Runaway', 'Blue Hour', 'Stairs', 'Lighthouse', 'Compass', 'Ember', 'Skyline', 'Cassette', 'Orbit', 'Postcard', 'Ferris Wheel', 'Thunder', 'Safe Harbor', 'Open Road', 'Glow', 'Afterglow', 'Mirage'];
const GENRES = ['Pop', 'Rock', 'Indie', 'Electronic', 'Jazz', 'Folk', 'Ambient', 'Hip-Hop', 'Classical', 'Soul'];
const PERSIAN = { artist: 'ستاره', album: 'شب‌های تهران', titles: ['باران', 'خانه', 'مهتاب', 'جاده'] };

function pick(r, list) {
    return list[Math.floor(r() * list.length)];
}

function safeName(text) {
    return String(text).replace(/[\\/:*?"<>|]/g, '_').replace(/[. ]+$/, '') || '_';
}

function mp3Bytes(seconds) {
    // Silent MPEG-1 Layer 3 frames: 128 kbit/s, 44.1 kHz, 417 bytes and 26.1 ms each, all zero after the header.
    const frames = Math.max(1, Math.round(seconds / 0.026122));
    const frame = Buffer.alloc(417);
    frame[0] = 0xff; frame[1] = 0xfb; frame[2] = 0x90; frame[3] = 0x00;
    return Buffer.concat(Array.from({ length: frames }, () => frame));
}

function coverSvg(hueA, hueB, letter) {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_PX}" height="${COVER_PX}" viewBox="0 0 100 100">`
        + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hueA} 62% 46%)"/><stop offset="1" stop-color="hsl(${hueB} 58% 24%)"/></linearGradient></defs>`
        + `<rect width="100" height="100" fill="url(#g)"/><circle cx="72" cy="30" r="22" fill="hsl(${hueB} 70% 70%)" opacity=".28"/>`
        + `<rect x="-10" y="68" width="130" height="16" fill="#000" opacity=".16" transform="rotate(-8 50 76)"/>`
        + `<text x="14" y="86" font-family="Arial, Helvetica, sans-serif" font-size="46" font-weight="700" fill="#fff" opacity=".9">${letter}</text></svg>`;
}

// The plan: which albums, which songs. Pure (no files), so a test can look at it.
function planLibrary({ count = DEFAULT_COUNT, seed = 1 } = {}) {
    const r = rng(seed);
    const artists = [];
    const used = new Set();
    while (artists.length < Math.max(6, Math.ceil(count / 14))) {
        const name = `${pick(r, FIRST)} ${pick(r, SECOND)}`;
        if (!used.has(name)) { used.add(name); artists.push(name); }
    }
    const albums = [];
    let songs = 0;
    let a = 0;
    while (songs < count) {
        const artist = artists[a++ % artists.length];
        const title = `${pick(r, WORDS)} ${pick(r, ['Sessions', 'Stories', 'Days', 'Letters', 'Tapes', 'Nights', 'Colors'])}`;
        const size = Math.min(count - songs, 6 + Math.floor(r() * 9));
        const album = { artist, title, genre: pick(r, GENRES), year: String(1975 + Math.floor(r() * 50)), hueA: Math.floor(r() * 360), hueB: Math.floor(r() * 360), tracks: [] };
        const titles = new Set();
        while (album.tracks.length < size) {
            const t = r() < 0.25 ? `${pick(r, WORDS)} (Part ${1 + Math.floor(r() * 3)})` : `${pick(r, WORDS)} ${pick(r, WORDS)}`.replace(/^(\S+) \1$/, '$1');
            if (!titles.has(t)) { titles.add(t); album.tracks.push({ title: t, seconds: 2 + Math.floor(r() * 3) }); }
        }
        albums.push(album);
        songs += size;
    }
    // Cases the screens have to survive: long names, right-to-left text, a missing album or artist, a missing cover, a very long title.
    const edge = [
        { artist: PERSIAN.artist, album: PERSIAN.album, title: PERSIAN.titles[0], genre: 'Folk', year: '1999', track: 1 },
        { artist: PERSIAN.artist, album: PERSIAN.album, title: PERSIAN.titles[1], genre: 'Folk', year: '1999', track: 2 },
        { artist: PERSIAN.artist, album: PERSIAN.album, title: PERSIAN.titles[2], genre: 'Folk', year: '1999', track: 3 },
        { artist: '', album: '', title: 'Untitled recording 04', genre: '', year: '', track: 0, noCover: true },
        { artist: 'A Band With An Unreasonably Long Name That Keeps Going And Going', album: 'An Album Title That Is Also Far Too Long To Fit In One Row Of The List', title: 'A Song Title Long Enough To Test Ellipsis In Every Row, Panel And Notification', genre: 'Rock', year: '2010', track: 1 },
        { artist: 'No Cover Trio', album: 'Plain Sleeve', title: 'Without Artwork', genre: 'Jazz', year: '1984', track: 1, noCover: true },
        { artist: 'Silver Harbor', album: '', title: 'Single, no album', genre: 'Pop', year: '2021', track: 0 }
    ];
    return { albums, edge, artists };
}

async function makeSampleLibrary({ dataDir, count = DEFAULT_COUNT, seed = 1, force = false, log = () => {} } = {}) {
    if (!dataDir) throw new Error('makeSampleLibrary needs a data folder');
    const libraryDir = path.join(dataDir, 'library');
    const settingsDir = path.join(dataDir, 'settings');
    const musicDir = path.join(dataDir, 'sample-music');
    const songsFile = path.join(libraryDir, 'songs.json');
    if (fs.existsSync(songsFile) && !force) return { created: false, dataDir, songs: null };
    if (force) for (const dir of [libraryDir, musicDir]) fs.rmSync(dir, { recursive: true, force: true });
    for (const dir of [libraryDir, settingsDir, musicDir]) fs.mkdirSync(dir, { recursive: true });

    const sharp = require('sharp');
    const { buildSongFromTags } = require('../../electron/tag-builder');
    const { writeSongs } = require('../../electron/songs-store');
    const { createNodeBackend } = require('../../electron/tag-node-backend');
    const backend = createNodeBackend({ toPath: (p) => p });
    const r = rng(seed + 7);
    const plan = planLibrary({ count, seed });
    const coversFolder = path.join(libraryDir, 'covers');
    fs.mkdirSync(coversFolder, { recursive: true });
    const tmpCovers = fs.mkdtempSync(path.join(require('os').tmpdir(), 'xplayer-sample-'));

    const jobs = [];
    for (const album of plan.albums) {
        album.tracks.forEach((t, i) => jobs.push({ artist: album.artist, album: album.title, genre: album.genre, year: album.year, title: t.title, track: i + 1, seconds: t.seconds, albumRef: album }));
    }
    for (const e of plan.edge) jobs.push({ seconds: 3, ...e, albumRef: e.noCover ? null : { hueA: Math.floor(r() * 360), hueB: Math.floor(r() * 360), artist: e.artist, title: e.album } });

    const coverBuffers = new Map();
    async function coverFor(ref) {
        if (!ref) return null;
        if (!coverBuffers.has(ref)) {
            const letter = (ref.title || ref.artist || '?').replace(/[<>&]/g, '').trim().charAt(0).toUpperCase() || '?';
            const buffer = await sharp(Buffer.from(coverSvg(ref.hueA, ref.hueB, letter))).jpeg({ quality: 82 }).toBuffer();
            const file = path.join(tmpCovers, `${coverBuffers.size}.jpg`);
            fs.writeFileSync(file, buffer);
            coverBuffers.set(ref, { buffer, file });
        }
        return coverBuffers.get(ref);
    }

    const songs = [];
    let done = 0;
    for (const job of jobs) {
        const dir = path.join(musicDir, safeName(job.artist || 'Unsorted'), safeName(job.album || 'Singles'));
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `${String(job.track || 0).padStart(2, '0')} ${safeName(job.title)}.mp3`);
        fs.writeFileSync(file, mp3Bytes(job.seconds));
        const cover = await coverFor(job.albumRef);
        const tags = { title: job.title, artist: job.artist, album: job.album, genre: job.genre, year: job.year, track: job.track ? String(job.track) : '' };
        // Real tags in the file, so a rescan gives back what is in the list. The cover is embedded too when the tag library accepts it.
        let saved = cover ? await backend.saveAudioMetadata(file, tags, cover.file) : null;
        if (!saved || !saved.success) saved = await backend.saveAudioMetadata(file, tags);
        const metadata = {
            common: { title: job.title, artist: job.artist, album: job.album, genre: job.genre ? [job.genre] : [], year: Number(job.year) || undefined, track: { no: job.track || null }, picture: cover ? [{ data: cover.buffer, format: 'image/jpeg' }] : [] },
            format: { duration: job.seconds }
        };
        songs.push(await buildSongFromTags({ filePath: file, metadata, coversFolder, id: songs.length }));
        if (++done % 50 === 0) log(`sample library: ${done} of ${jobs.length} songs`);
    }
    fs.rmSync(tmpCovers, { recursive: true, force: true });

    writeSongs(libraryDir, songs);
    fs.writeFileSync(path.join(settingsDir, 'music-folders-config.json'), JSON.stringify({ folders: [musicDir], folderMetadata: { [musicDir]: { addedTime: new Date().toISOString(), songCount: songs.length } } }, null, 2));
    fs.writeFileSync(path.join(settingsDir, 'music-folder-config.json'), JSON.stringify({ musicFolder: musicDir }));

    // Favorites and playlists: the page keeps them in localStorage, so they travel in a seed file the app applies once in dev runs.
    const ids = (filter) => songs.filter(filter).map((s) => s.id);
    const everyNth = (n, from = 0) => songs.filter((s, i) => i % n === from).map((s) => s.id);
    const stamp = new Date().toLocaleString();
    const playlists = [
        { id: 'sample-road-trip', name: 'Road trip', songs: everyNth(7), createdAt: stamp },
        { id: 'sample-late-night', name: 'Late night', songs: ids((s) => s.genre === 'Jazz' || s.genre === 'Ambient'), createdAt: stamp },
        { id: 'sample-focus', name: 'Focus', songs: everyNth(11, 3), createdAt: stamp },
        { id: 'sample-empty', name: 'An empty playlist', songs: [], createdAt: stamp },
        { id: 'sample-everything', name: 'Everything, in order', songs: songs.map((s) => s.id), createdAt: stamp }
    ];
    const favorites = everyNth(9, 2);
    fs.writeFileSync(path.join(dataDir, 'sample-seed.json'), JSON.stringify({ localStorage: { playlists: JSON.stringify(playlists), favorites: JSON.stringify(favorites) } }, null, 2));

    return { created: true, dataDir, songs: songs.length, albums: plan.albums.length, playlists: playlists.length };
}

function parseArgs(argv) {
    const out = { dataDir: null, count: DEFAULT_COUNT, seed: 1, force: false };
    for (const a of argv) {
        if (a === '--force') out.force = true;
        else if (a.startsWith('--count=')) out.count = Math.max(10, Number(a.slice(8)) || DEFAULT_COUNT);
        else if (a.startsWith('--seed=')) out.seed = Number(a.slice(7)) || 1;
        else if (!a.startsWith('--')) out.dataDir = path.resolve(a);
    }
    return out;
}

function defaultDataDir() {
    return process.env.XPLAYER_DATA ? path.resolve(process.env.XPLAYER_DATA) : path.join(ROOT, '.dev-data', 'profiles', 'sample');
}

if (require.main === module) {
    const args = parseArgs(process.argv.slice(2));
    makeSampleLibrary({ ...args, dataDir: args.dataDir || defaultDataDir(), log: console.log }).then((result) => {
        console.log(result.created ? `sample library: ${result.songs} songs, ${result.albums} albums, ${result.playlists} playlists in ${result.dataDir}` : `sample library already there (${result.dataDir}); --force makes it again`);
    }, (e) => { console.error(e); process.exit(1); });
}

module.exports = { makeSampleLibrary, planLibrary, defaultDataDir, parseArgs, DEFAULT_COUNT };
