'use strict';

// Makes a made-up library to develop against: about 300 songs with covers, lyrics, favorites and a few playlists, so the screens can be
// looked at (long lists, many albums, empty tags) without opening the real library.
//
//   node tools/dev/make-sample-library.js [<data folder>] [--count=300] [--seed=1] [--force]
//
// The data folder defaults to XPLAYER_DATA, else Source/.dev-data/profiles/sample. Written there:
//
//   library/songs.json, library/covers/     the list and the covers, built by the app's own tag-builder, so they look scanned
//   sample-music/<artist>/<album>/*.mp3     silent files (2 to 4 seconds, and a few of 75) with real tags, so play, the metadata editor and a rescan work
//   settings/music-folders-config.json      the sample-music folder is the music folder
//   sample-seed.json                        playlists, favorites and lyrics, which the page keeps in localStorage (see electron/dev-tools.js)
//
// Nothing is downloaded and no real music is used; the covers are drawn here and the lyrics are written here (they belong to nobody). The same --seed gives the same library. Without --force an existing sample is kept.

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

const COVER_STYLES = 7;

// Seven plain sleeves, one color each with a single shape, so a grid of albums looks varied but calm. The color comes from the album's hue.
function coverSvg(hueA, hueB, letter, style = 0) {
    const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${COVER_PX}" height="${COVER_PX}" viewBox="0 0 100 100">`;
    const dark = `hsl(${hueA} 38% 20%)`;
    const mid = `hsl(${hueA} 45% 34%)`;
    const soft = `hsl(${hueA} 55% 66%)`;
    const pale = `hsl(${hueA} 30% 90%)`;
    const bg = (c) => `<rect width="100" height="100" fill="${c}"/>`;
    switch (((style % COVER_STYLES) + COVER_STYLES) % COVER_STYLES) {
        case 1: // a pale band across a dark ground
            return head + bg(dark) + `<rect y="38" width="100" height="24" fill="${soft}"/></svg>`;
        case 2: // one ring
            return head + bg(dark) + `<circle cx="50" cy="50" r="27" fill="none" stroke="${soft}" stroke-width="8"/></svg>`;
        case 3: // two overlapping circles
            return head + bg(mid) + `<circle cx="40" cy="50" r="24" fill="${pale}" opacity=".85"/><circle cx="60" cy="50" r="24" fill="${dark}" opacity=".7"/></svg>`;
        case 4: // pale ground, one block
            return head + bg(pale) + `<rect x="24" y="24" width="52" height="52" fill="${mid}"/></svg>`;
        case 5: // a diagonal bar
            return head + bg(dark) + `<rect x="-10" y="42" width="120" height="16" fill="${soft}" transform="rotate(-35 50 50)"/></svg>`;
        case 6: // a triangle
            return head + bg(mid) + `<path d="M50 24 L78 74 H22 Z" fill="${pale}"/></svg>`;
        default: // a half-hidden sun and the first letter
            return head + bg(dark) + `<circle cx="62" cy="68" r="30" fill="${soft}"/><text x="12" y="30" font-family="Arial, Helvetica, sans-serif" font-size="22" font-weight="700" fill="#fff" opacity=".85">${letter}</text></svg>`;
    }
}

// Lyrics written for this sample (they are nobody's): a verse, a chorus, another verse, the chorus again. {title} is the song's title.
const VERSES = [
    ['The streetlights hum a quiet tune', 'while the last bus rolls away', 'I count the windows, one by one', 'and wait for you to say'],
    ['Salt on the wind and a map in my hand', 'the harbor is waking up slow', 'every road that I have never been on', 'is calling me out to go'],
    ['We left the radio playing low', 'the dashboard glowing gold', 'you said the night would last forever', 'and I believed what I was told'],
    ['Paper boats on a river of rain', 'drifting past the station clock', 'I wrote your name on every one', 'and let the water talk'],
    ['Somewhere past the hill the lights go dim', 'the fields are turning blue', 'I carry all the little things', 'that used to remind me of you'],
    ['Morning spills across the floor', 'the kettle starts to sing', 'all the maps are folded up', 'and we are ready for anything']
];
const CHORUSES = [
    ['Oh, {title}, carry me home', 'through the noise and the empty rooms', 'Oh, {title}, I am not alone', 'as long as the dawn comes soon'],
    ['Hold on, {title}, hold on', 'the light is coming through', 'we will sing until the night is gone', 'and the sky remembers blue'],
    ['{title}, say it again', 'like the first time, soft and slow', 'wherever this road may end', 'I am glad that we let it go'],
    ['Take me back to {title}', 'where the evening never ends', 'we were young and the world was wide', 'and every stranger was a friend']
];
const PERSIAN_LYRICS = [['باران می‌بارد بر شیشه‌ی شب', 'من هنوز منتظر صدای تو هستم'], ['چراغ‌ها خاموش و جاده خالی است', 'دلم به خانه برمی‌گردد']];

// The lyrics of one song: plain text with a blank line between parts, and the lines for a synced version. `n` picks the verses and chorus.
function lyricsFor(title, n, { persian = false } = {}) {
    const parts = persian ? PERSIAN_LYRICS : [VERSES[n % VERSES.length], CHORUSES[n % CHORUSES.length], VERSES[(n + 3) % VERSES.length], CHORUSES[n % CHORUSES.length]];
    const fill = (line) => line.replace(/\{title\}/g, String(title).replace(/\s*\(Part \d\)$/, ''));
    const sections = parts.map((part) => part.map(fill));
    return { plain: sections.map((part) => part.join('\n')).join('\n\n'), lines: sections.flat() };
}

// LRC text for those lines, spread over a song of `seconds` (the first line after 5 seconds, the last about 6 seconds before the end).
function lrcFor(lines, seconds) {
    const start = 5;
    const step = Math.max(0.5, (seconds - start - 6) / Math.max(1, lines.length));
    const stamp = (t) => `[${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(2).padStart(5, '0')}]`;
    return lines.map((line, i) => `${stamp(start + i * step)}${line}`).join('\n');
}

// The plan: which albums, which songs. Pure (no files), so a test can look at it.
function planLibrary({ count = DEFAULT_COUNT, seed = 1 } = {}) {
    const r = rng(seed);
    const styleRng = rng(seed + 31); // its own sequence, so the names do not change when the sleeves do
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
        const album = { artist, title, genre: pick(r, GENRES), year: String(1975 + Math.floor(r() * 50)), hueA: Math.floor(r() * 360), hueB: Math.floor(r() * 360), style: Math.floor(styleRng() * COVER_STYLES), tracks: [] };
        const titles = new Set();
        while (album.tracks.length < size) {
            const t = r() < 0.25 ? `${pick(r, WORDS)} (Part ${1 + Math.floor(r() * 3)})` : `${pick(r, WORDS)} ${pick(r, WORDS)}`.replace(/^(\S+) \1$/, '$1');
            if (!titles.has(t)) { titles.add(t); album.tracks.push({ title: t, seconds: 2 + Math.floor(r() * 3) }); }
        }
        if (albums.length < 6) Object.assign(album.tracks[0], { seconds: 75, featured: true }); // long enough to watch synced lyrics move
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
        album.tracks.forEach((t, i) => jobs.push({ artist: album.artist, album: album.title, genre: album.genre, year: album.year, title: t.title, track: i + 1, seconds: t.seconds, albumRef: album, featured: Boolean(t.featured) }));
    }
    for (const e of plan.edge) jobs.push({ seconds: 3, ...e, albumRef: e.noCover ? null : { hueA: Math.floor(r() * 360), hueB: Math.floor(r() * 360), style: Math.floor(r() * COVER_STYLES), artist: e.artist, title: e.album } });

    const coverBuffers = new Map();
    async function coverFor(ref) {
        if (!ref) return null;
        if (!coverBuffers.has(ref)) {
            const letter = (ref.title || ref.artist || '?').replace(/[<>&]/g, '').trim().charAt(0).toUpperCase() || '?';
            const buffer = await sharp(Buffer.from(coverSvg(ref.hueA, ref.hueB, letter, ref.style))).jpeg({ quality: 82 }).toBuffer();
            const file = path.join(tmpCovers, `${coverBuffers.size}.jpg`);
            fs.writeFileSync(file, buffer);
            coverBuffers.set(ref, { buffer, file });
        }
        return coverBuffers.get(ref);
    }

    const songs = [];
    const customLyrics = {};
    const customSynced = {};
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
        const song = await buildSongFromTags({ filePath: file, metadata, coversFolder, id: songs.length });
        songs.push(song);
        // Lyrics: every song but the awkward ones and about one in ten; the long ones also get a synced version, the Persian songs Persian text.
        const persian = job.artist === PERSIAN.artist;
        if (job.title && job.title.length <= 40 && (persian || job.featured || songs.length % 10 !== 9)) {
            const lyrics = lyricsFor(job.title, songs.length, { persian });
            const key = song.url || String(song.id);
            customLyrics[key] = lyrics.plain;
            if (job.featured) customSynced[key] = { activeId: 'v-sample', variants: [{ id: 'v-sample', name: 'Sample 1', text: lrcFor(lyrics.lines, job.seconds), offset: 0, createdAt: Date.now() }] };
        }
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
    fs.writeFileSync(path.join(dataDir, 'sample-seed.json'), JSON.stringify({ localStorage: { playlists: JSON.stringify(playlists), favorites: JSON.stringify(favorites), customLyrics: JSON.stringify(customLyrics), customSyncedLyrics: JSON.stringify(customSynced) } }, null, 2));

    return { created: true, dataDir, songs: songs.length, albums: plan.albums.length, playlists: playlists.length, lyrics: Object.keys(customLyrics).length, synced: Object.keys(customSynced).length };
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

module.exports = { makeSampleLibrary, planLibrary, defaultDataDir, parseArgs, coverSvg, lyricsFor, lrcFor, COVER_STYLES, DEFAULT_COUNT };
