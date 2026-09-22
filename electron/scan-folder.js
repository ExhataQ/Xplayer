const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const SUPPORTED_FORMATS = [
    '.mp3',
    '.flac',
    '.m4a',
    '.mp4',
    '.aac',
    '.ogg',
    '.opus',
    '.wma',
    '.wav',
    '.aiff',
    '.aif',
    '.ape',
    '.wv'
];

function pickCoverExtension(picture) {
    const fmt = picture && picture.format ? String(picture.format).toLowerCase() : '';
    if (fmt.includes('png')) return 'png';
    if (fmt.includes('webp')) return 'webp';
    if (fmt.includes('bmp')) return 'bmp';
    if (fmt.includes('gif')) return 'gif';
    if (fmt.includes('tiff')) return 'tiff';
    return 'jpg';
}

// Row/list thumbnails. Size is 4x the largest on-screen use (40px row) so it stays sharp on HiDPI.
// The version in the file name doubles as a cache-buster: bump THUMB_VERSION whenever the
// generation recipe changes and every library rescan produces fresh URLs.
const THUMB_SIZE = 160;
const THUMB_QUALITY = 80;
const THUMB_VERSION = 2;

let jimpPromise = null;
function loadJimp() {
    if (!jimpPromise) {
        jimpPromise = import('jimp')
            .then((m) => m.Jimp || m.default || m)
            .catch(() => null);
    }
    return jimpPromise;
}

// Preferred engine: sharp (native libvips). Jimp remains the per-image fallback.
// Optional: if it is not installed or cannot load (wrong platform / old Node), Jimp is used instead.
let sharpPromise = null;
let sharpLoadError = null;
function loadSharp() {
    if (!sharpPromise) {
        sharpPromise = import('sharp')
            .then((m) => {
                const sharp = m.default || m;
                if (typeof sharp !== 'function') throw new Error('sharp export is not a function');
                sharp.cache(false); // we only ever feed it one-off buffers
                sharp.concurrency(1); // tiny resizes: no point spawning libvips threads per image
                return sharp;
            })
            .catch((e) => {
                sharpLoadError = e;
                return null;
            });
    }
    return sharpPromise;
}

async function thumbnailWithSharp(sharp, coverData) {
    return sharp(Buffer.from(coverData))
        .rotate() // honour EXIF orientation, like the browser does for the full-size cover
        .flatten({ background: '#ffffff' }) // transparency -> white, not black
        .resize(THUMB_SIZE, THUMB_SIZE, { fit: 'cover', position: 'centre' })
        .jpeg({ quality: THUMB_QUALITY })
        .toBuffer();
}

async function thumbnailWithJimp(Jimp, coverData) {
    const image = await Jimp.read(Buffer.from(coverData));
    flattenOntoWhite(image);
    image.cover({ w: THUMB_SIZE, h: THUMB_SIZE });
    return image.getBuffer('image/jpeg', { quality: THUMB_QUALITY });
}

let thumbEngineLogged = false;
function logThumbEngine(coversFolder, sharp, Jimp) {
    if (thumbEngineLogged) return;
    thumbEngineLogged = true;
    let line;
    if (sharp) {
        const ver = sharp.versions && sharp.versions.sharp ? ' ' + sharp.versions.sharp : '';
        line = `thumbnail engine: sharp${ver}` + (Jimp ? ' (Jimp available as fallback)' : ' (no Jimp fallback)');
    } else {
        line =
            `thumbnail engine: Jimp (sharp unavailable: ${sharpLoadError ? sharpLoadError.message.split('\n')[0] : 'unknown'})` +
            (Jimp ? '' : ' - Jimp is unavailable too, thumbnails disabled');
    }
    try {
        fs.appendFileSync(path.join(coversFolder, 'thumb-debug.log'), `${new Date().toISOString()} ${line}\n`);
    } catch (e) {}
}

function thumbFileNameFor(hash) {
    return `thumb${THUMB_VERSION}_${hash}.jpg`;
}

// Alpha-blend onto white in place, so transparent PNG/WebP covers do not turn black in the JPEG.
function flattenOntoWhite(image) {
    const data = image.bitmap.data;
    for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3];
        if (a === 255) continue;
        const k = a / 255;
        data[i] = Math.round(data[i] * k + 255 * (1 - k));
        data[i + 1] = Math.round(data[i + 1] * k + 255 * (1 - k));
        data[i + 2] = Math.round(data[i + 2] * k + 255 * (1 - k));
        data[i + 3] = 255;
    }
}
// Prefer the embedded "front cover" picture; many files carry a back cover / booklet first.
function pickPicture(pictures) {
    if (!pictures || pictures.length === 0) return null;
    const front = pictures.find((p) => p && p.data && /front/i.test(String(p.type || '')));
    if (front) return front;
    return pictures.find((p) => p && p.data) || null;
}

// Write to a temp name, then rename: an app close / crash mid-write can never leave a truncated
// cover_<hash> file behind (which existsSync() would otherwise treat as valid forever).
function writeFileAtomic(filePath, data) {
    const tmpPath = `${filePath}.${process.pid}.tmp`;
    fs.writeFileSync(tmpPath, data);
    fs.renameSync(tmpPath, filePath);
}

function logCoverError(coversFolder, what, err) {
    try {
        fs.appendFileSync(
            path.join(coversFolder, 'thumb-debug.log'),
            `${what}: ${err && err.stack ? err.stack : err}\n`
        );
    } catch (e2) {}
}

async function generateThumbnail(coverData, coversFolder, hash, Jimp) {
    const sharp = await loadSharp();
    Jimp = Jimp || (await loadJimp());
    logThumbEngine(coversFolder, sharp, Jimp);
    if (!sharp && !Jimp) {
        try {
            fs.appendFileSync(
                path.join(coversFolder, 'thumb-debug.log'),
                `${hash}: no thumbnail engine loaded\n`
            );
        } catch (e2) {}
        return null;
    }
    try {
        const thumbFileName = thumbFileNameFor(hash);
        const thumbPath = path.join(coversFolder, thumbFileName);
        let usable = false;
        try {
            usable = fs.statSync(thumbPath).size > 0;
        } catch (e) {}
        if (!usable) {
            let buffer = null;
            let sharpError = null;
            if (sharp) {
                try {
                    buffer = await thumbnailWithSharp(sharp, coverData);
                } catch (e) {
                    sharpError = e; // e.g. BMP (unsupported by sharp) or a corrupt image: try Jimp for this one
                }
            }
            if (!buffer) {
                if (!Jimp) throw sharpError || new Error('no thumbnail engine available');
                buffer = await thumbnailWithJimp(Jimp, coverData);
            }
            // Write to a temp name first so nothing can ever load a half-written thumbnail.
            const tmpPath = `${thumbPath}.${process.pid}.tmp`;
            fs.writeFileSync(tmpPath, buffer);
            fs.renameSync(tmpPath, thumbPath);
        }
        // The old un-resized thumbs (thumb_<hash>.jpg) are never referenced again: drop the twin.
        try {
            fs.unlinkSync(path.join(coversFolder, `thumb_${hash}.jpg`));
        } catch (e) {}
        return `covers/${thumbFileName}`;
    } catch (e) {
        try {
            fs.appendFileSync(
                path.join(coversFolder, 'thumb-debug.log'),
                `${hash}: ${e && e.stack ? e.stack : e}\n`
            );
        } catch (e2) {}
        return null;
    }
}

let silentMode = false;

let activeFolders = [];
let foldersConfigPath = null;

function sanitizeString(str) {
    if (!str) return '';
    let cleaned = String(str);
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    cleaned = cleaned.replace(/\\/g, '/');
    return cleaned.trim();
}

function sanitizeLyrics(str) {
    if (!str) return '';
    let cleaned = String(str);
    cleaned = cleaned.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    cleaned = cleaned.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
    cleaned = cleaned.replace(/\u0000/g, '');
    return cleaned;
}

function getFoldersConfigPath() {
    if (!foldersConfigPath) {
        foldersConfigPath = path.join(__dirname, 'music-folders-config.json');
    }
    return foldersConfigPath;
}

function loadMusicFolders() {
    const configPath = getFoldersConfigPath();
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf-8');
            const parsed = JSON.parse(data);
            activeFolders = parsed.folders || [];
            return activeFolders;
        }
    } catch (e) {}
    activeFolders = [];
    return activeFolders;
}

function saveMusicFolders(folders) {
    const configPath = getFoldersConfigPath();
    fs.writeFileSync(
        configPath,
        JSON.stringify(
            {
                folders: folders
            },
            null,
            2
        ),
        'utf-8'
    );
    activeFolders = folders;
}

function addMusicFolder(folderPath) {
    let folders = loadMusicFolders();
    if (!folders.includes(folderPath)) {
        folders.push(folderPath);
        saveMusicFolders(folders);
        return true;
    }
    return false;
}

function removeMusicFolder(folderPath) {
    let folders = loadMusicFolders();
    const index = folders.indexOf(folderPath);
    if (index !== -1) {
        folders.splice(index, 1);
        saveMusicFolders(folders);
        return true;
    }
    return false;
}

async function scanAllFolders(coversFolder, mm) {
    const folders = loadMusicFolders();

    if (folders.length === 0) {
        return [];
    }

    let allSongs = [];

    for (let idx = 0; idx < folders.length; idx++) {
        if (!silentMode) {
            console.log(`\n  📁 Scanning folder ${idx + 1}/${folders.length}: ${folders[idx]}`);
        }

        let songs;
        try {
            songs = await scanMusicFolderSync(folders[idx], coversFolder, mm);
        } catch (err) {
            songs = [];
        }

        if (songs && Array.isArray(songs)) {
            for (const song of songs) {
                song.id = allSongs.length;
                allSongs.push(song);
            }
        }
    }
    return allSongs;
}

async function scanMusicFolderSync(folderPath, coversFolder, mm) {
    const songs = [];
    const allFiles = [];

    try {
        walkDir(folderPath, allFiles);
    } catch (err) {
        return [];
    }

    for (let fileIndex = 0; fileIndex < allFiles.length; fileIndex++) {
        const filePath = allFiles[fileIndex];
        const fileName = path.basename(filePath, path.extname(filePath));
        let title = '';
        let artist = '';
        let album = path.basename(path.dirname(filePath));
        let composer = '';
        let genre = '';
        let year = '';
        let track = '';
        let cover = '';
        let largeCover = '';
        let duration = '0:00';
        let extendedMeta = extractExtendedMetadata(null, null, null);

        try {
            const metadata = await mm.parseFile(filePath, {
                duration: true,
                skipCovers: false
            });
            const common = metadata.common;
            const format = metadata.format;

            title = common.title || '';
            artist = common.artist || '';
            if (common.album) album = common.album;
            if (common.composer)
                composer = (Array.isArray(common.composer) ? common.composer[0] : common.composer);
            if (common.genre) genre = (Array.isArray(common.genre) ? common.genre[0] : common.genre);
            if (common.year) year = String(common.year).substring(0, 4);
            if (common.track && common.track.no) track = common.track.no;

            if (format.duration && format.duration > 0) {
                duration = formatDuration(Math.round(format.duration));
            }

            extendedMeta = extractExtendedMetadata(common, format, metadata.native);

            const picture = pickPicture(common.picture);
            if (picture && picture.data) {
                const coverData = picture.data;
                const hash = crypto.createHash('md5').update(coverData).digest('hex');
                const coverFileName = `cover_${hash}.${pickCoverExtension(picture)}`;
                const coverPath = path.join(coversFolder, coverFileName);

                if (!fs.existsSync(coverPath)) {
                    writeFileAtomic(coverPath, coverData);
                }
                if (fs.existsSync(coverPath)) {
                    largeCover = `covers/${coverFileName}`;
                    const thumbRel = await generateThumbnail(coverData, coversFolder, hash);
                    cover = thumbRel || largeCover;
                }
            }
        } catch (err) {}

        if (!title) title = fileName;
        if (!artist) artist = 'Unknown Artist';

        songs.push({
            id: 0,
            title: sanitizeString(title),
            artist: sanitizeString(artist),
            album: sanitizeString(album),
            composer: sanitizeString(composer),
            genre: sanitizeString(genre),
            year: sanitizeString(year),
            track: sanitizeString(track),
            url: 'file:///' + filePath.replace(/\\/g, '/'),
            cover: cover,
            largeCover: largeCover,
            duration: duration,
            ...extendedMeta
        });

        if (fileIndex % 10 === 0 && !silentMode) {
            printProgress(fileIndex + 1, allFiles.length, 'Scanning songs');
        }
    }

    return songs;
}

function printProgress(current, total, prefix) {
    if (silentMode) return;
    const percent = total > 0 ? Math.round((current / total) * 100) : 0;
    process.stderr.write(`PROGRESS:${percent}:${prefix}\n`);
}

function formatDuration(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${minutes}:${String(secs).padStart(2, '0')}`;
}

function extractAllNativeTags(native) {
    const result = {
        title: '',
        artist: '',
        album: '',
        composer: '',
        genre: '',
        year: '',
        track: ''
    };
    if (!native) return result;

    for (const tagType of Object.keys(native)) {
        const tags = native[tagType];
        if (!Array.isArray(tags)) continue;

        for (const tag of tags) {
            const id = tag.id;
            const val = tag.value;
            if (!val) continue;

            if (!result.title && (id === 'TIT2' || id === 'TITLE' || id === 'TT2')) {
                result.title = String(val).trim();
            }
            if (!result.artist && (id === 'TPE1' || id === 'ARTIST' || id === 'TP1')) {
                result.artist = String(val).trim();
            }
            if (!result.album && (id === 'TALB' || id === 'ALBUM' || id === 'TAL')) {
                result.album = String(val).trim();
            }
            if (!result.composer && (id === 'TCOM' || id === 'COMPOSER' || id === 'TCM')) {
                result.composer = String(val).trim();
            }
            if (!result.genre && (id === 'TCON' || id === 'GENRE' || id === 'TCO')) {
                let g = String(val).trim();
                if (g.startsWith('(') && g.includes(')')) {
                    g = g.substring(g.indexOf(')') + 1).trim();
                }
                result.genre = g;
            }
            if (!result.year && (id === 'TYER' || id === 'TDRC' || id === 'YEAR' || id === 'TORY')) {
                result.year = String(val).trim().substring(0, 4);
            }
            if (!result.track && (id === 'TRCK' || id === 'TRACK' || id === 'TRK')) {
                const t = String(val).trim().split('/')[0];
                const num = parseInt(t);
                result.track = isNaN(num) ? t : num;
            }
        }
    }
    return result;
}

function extractExtendedMetadata(common, format, native) {
    const result = {
        albumArtist: '',
        discNumber: '',
        discTotal: '',
        trackTotal: '',
        comment: '',
        lyrics: '',
        bpm: '',
        bitrate: '',
        sampleRate: '',
        channels: '',
        encoder: '',
        copyright: '',
        label: '',
        language: '',
        conductor: '',
        remixer: '',
        isrc: '',
        replayGainTrack: '',
        replayGainAlbum: '',
        rating: '',
        playCount: '',
        titleSort: '',
        artistSort: '',
        albumSort: '',
        musicBrainzTrackId: '',
        musicBrainzAlbumId: '',
        musicBrainzArtistId: '',
        musicBrainzReleaseGroupId: ''
    };

    if (common) {
        if (common.albumartist) result.albumArtist = String(common.albumartist);
        if (common.disk && common.disk.no) result.discNumber = String(common.disk.no);
        if (common.disk && common.disk.of) result.discTotal = String(common.disk.of);
        if (common.track && common.track.of) result.trackTotal = String(common.track.of);
        if (common.comment) {
            const c = Array.isArray(common.comment) ? common.comment[0] : common.comment;
            result.comment = String(c).substring(0, 500);
        }
        if (common.lyrics) {
            const l = Array.isArray(common.lyrics) ? common.lyrics[0] : common.lyrics;
            const text = typeof l === 'object' && l.text ? l.text : l;
            result.lyrics = sanitizeLyrics(String(text)).substring(0, 10000);
        }
        if (common.bpm) result.bpm = String(Math.round(common.bpm));
        if (common.encodedby || common.encoder)
            result.encoder = String(common.encodedby || common.encoder).substring(0, 60);
        if (common.copyright) result.copyright = String(common.copyright).substring(0, 100);
        if (common.label) {
            const lb = Array.isArray(common.label) ? common.label[0] : common.label;
            result.label = String(lb).substring(0, 60);
        }
        if (common.language) result.language = String(common.language).substring(0, 30);
        if (common.conductor) {
            const c = Array.isArray(common.conductor) ? common.conductor[0] : common.conductor;
            result.conductor = String(c).substring(0, 60);
        }
        if (common.remixer) {
            const r = Array.isArray(common.remixer) ? common.remixer[0] : common.remixer;
            result.remixer = String(r).substring(0, 60);
        }
        if (common.isrc) {
            const i = Array.isArray(common.isrc) ? common.isrc[0] : common.isrc;
            result.isrc = String(i).substring(0, 20);
        }
        if (common.replaygain_track_gain)
            result.replayGainTrack = String(common.replaygain_track_gain.dB || common.replaygain_track_gain).substring(
                0,
                30
            );
        if (common.replaygain_album_gain)
            result.replayGainAlbum = String(common.replaygain_album_gain.dB || common.replaygain_album_gain).substring(
                0,
                30
            );
        if (common.rating) {
            const r = Array.isArray(common.rating) ? common.rating[0] : common.rating;
            result.rating = String(r.rating !== undefined ? r.rating : r).substring(0, 20);
        }
        if (common.playCount) result.playCount = String(common.playCount);
        if (common.titlesort) result.titleSort = String(common.titlesort).substring(0, 100);
        if (common.artistsort) result.artistSort = String(common.artistsort).substring(0, 100);
        if (common.albumsort) result.albumSort = String(common.albumsort).substring(0, 100);
        if (common.musicbrainz_trackid) result.musicBrainzTrackId = String(common.musicbrainz_trackid).substring(0, 60);
        if (common.musicbrainz_albumid) result.musicBrainzAlbumId = String(common.musicbrainz_albumid).substring(0, 60);
        if (common.musicbrainz_artistid) {
            const a = Array.isArray(common.musicbrainz_artistid)
                ? common.musicbrainz_artistid[0]
                : common.musicbrainz_artistid;
            result.musicBrainzArtistId = String(a).substring(0, 60);
        }
        if (common.musicbrainz_releasegroupid)
            result.musicBrainzReleaseGroupId = String(common.musicbrainz_releasegroupid).substring(0, 60);
    }

    if (format) {
        if (format.bitrate) result.bitrate = String(Math.round(format.bitrate / 1000));
        if (format.sampleRate) result.sampleRate = String(format.sampleRate);
        if (format.numberOfChannels) result.channels = String(format.numberOfChannels);
    }

    if (native) {
        for (const tagType of Object.keys(native)) {
            const tags = native[tagType];
            if (!Array.isArray(tags)) continue;
            for (const tag of tags) {
                const id = tag.id;
                const val = tag.value;
                if (!val) continue;

                if (!result.isrc && (id === 'TSRC' || id === 'ISRC')) {
                    result.isrc = String(val).substring(0, 20);
                }
                if (
                    !result.replayGainTrack &&
                    (id === 'TXXX:replaygain_track_gain' || id === 'REPLAYGAIN_TRACK_GAIN')
                ) {
                    result.replayGainTrack = String(val).substring(0, 30);
                }
                if (
                    !result.replayGainAlbum &&
                    (id === 'TXXX:replaygain_album_gain' || id === 'REPLAYGAIN_ALBUM_GAIN')
                ) {
                    result.replayGainAlbum = String(val).substring(0, 30);
                }
                if (!result.bpm && (id === 'TBPM' || id === 'BPM')) {
                    const n = parseFloat(val);
                    if (!isNaN(n)) result.bpm = String(Math.round(n));
                }
                if (!result.comment && (id === 'COMM' || id === 'COMMENT')) {
                    const text = typeof val === 'object' && val.text ? val.text : val;
                    result.comment = String(text).substring(0, 500);
                }
                if (!result.copyright && (id === 'TCOP' || id === 'COPYRIGHT')) {
                    result.copyright = String(val).substring(0, 100);
                }
                if (!result.label && (id === 'TPUB' || id === 'LABEL' || id === 'PUBLISHER')) {
                    result.label = String(val).substring(0, 60);
                }
                if (!result.language && (id === 'TLAN' || id === 'LANGUAGE')) {
                    result.language = String(val).substring(0, 30);
                }
                if (!result.conductor && (id === 'TPE3' || id === 'CONDUCTOR')) {
                    result.conductor = String(val).substring(0, 60);
                }
                if (!result.remixer && (id === 'TPE4' || id === 'REMIXER' || id === 'MIXARTIST')) {
                    result.remixer = String(val).substring(0, 60);
                }
                if (
                    !result.albumArtist &&
                    (id === 'TPE2' || id === 'ALBUMARTIST' || id === 'ALBUM ARTIST' || id === 'aART')
                ) {
                    result.albumArtist = String(val);
                }
                if (!result.discNumber && (id === 'TPOS' || id === 'DISCNUMBER')) {
                    result.discNumber = String(val).trim().split('/')[0];
                }
                if (!result.titleSort && (id === 'TSOT' || id === 'TITLESORT')) {
                    result.titleSort = String(val).substring(0, 100);
                }
                if (!result.artistSort && (id === 'TSOP' || id === 'ARTISTSORT')) {
                    result.artistSort = String(val).substring(0, 100);
                }
                if (!result.albumSort && (id === 'TSOA' || id === 'ALBUMSORT')) {
                    result.albumSort = String(val).substring(0, 100);
                }
                if (!result.encoder && (id === 'TENC' || id === 'ENCODEDBY' || id === 'TSSE')) {
                    result.encoder = String(val).substring(0, 60);
                }
            }
        }
    }

    return result;
}

function extractCoverFromNative(native) {
    if (!native) return null;
    for (const tagType of Object.keys(native)) {
        const tags = native[tagType];
        if (!Array.isArray(tags)) continue;
        for (const tag of tags) {
            if (tag.id === 'APIC' && tag.data) {
                return tag.data;
            }
        }
    }
    return null;
}

function walkDir(dir, fileList) {
    const entries = fs.readdirSync(dir, {
        withFileTypes: true
    });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            walkDir(fullPath, fileList);
        } else if (SUPPORTED_FORMATS.includes(path.extname(entry.name).toLowerCase())) {
            fileList.push(fullPath);
        }
    }
}

async function extractCoverData(filePath, mm) {
    try {
        const metadata = await mm.parseFile(filePath, {
            skipCovers: false
        });
        const pictures = metadata.common.picture;
        if (pictures && pictures.length > 0) {
            return pictures[0].data;
        }
    } catch (e) {}
    return null;
}

async function extractCovers(folderPath, coversFolder, mm) {
    console.log('\n' + '─'.repeat(60));
    console.log('📸  STEP 1: EXTRACTING COVER ART');
    console.log('─'.repeat(60));

    let extracted = 0;
    let skipped = 0;
    const allFiles = [];

    try {
        walkDir(folderPath, allFiles);
    } catch (err) {
        return;
    }

    const total = allFiles.length;
    let processed = 0;

    for (const filePath of allFiles) {
        try {
            const coverData = await extractCoverData(filePath, mm);
            if (coverData) {
                const hash = crypto.createHash('md5').update(coverData).digest('hex');
                const filename = `cover_${hash}.jpg`;
                const destPath = path.join(coversFolder, filename);
                if (!fs.existsSync(destPath)) {
                    writeFileAtomic(destPath, coverData);
                    extracted++;
                } else {
                    skipped++;
                }
            }
        } catch (err) {}

        processed++;
        printProgress(processed, total, 'Extracting covers');
    }

    console.log(`\n  ✅  ${extracted} new covers  •  ${skipped} already exist`);
}

async function scanMusicFolder(folderPath, coversFolder, mm) {
    const songs = [];
    const allFiles = [];
    walkDir(folderPath, allFiles);
    const total = allFiles.length;
    let processed = 0;

    for (const filePath of allFiles) {
        const fileName = path.basename(filePath, path.extname(filePath));
        let title = '';
        let artist = '';
        let album = path.basename(path.dirname(filePath));
        let composer = '';
        let genre = '';
        let year = '';
        let track = '';
        let cover = '';
        let largeCover = '';
        let duration = '0:00';
        let extendedMeta = extractExtendedMetadata(null, null, null);

        try {
            const metadata = await mm.parseFile(filePath, {
                duration: true,
                skipCovers: false
            });
            const common = metadata.common;
            const format = metadata.format;
            const nativeTags = extractAllNativeTags(metadata.native);

            title = common.title || nativeTags.title || '';
            artist = common.artist || nativeTags.artist || '';
            album = common.album || nativeTags.album || album;
            composer =
                (Array.isArray(common.composer) ? common.composer[0] : common.composer) || nativeTags.composer || '';
            composer = String(composer);
            genre =
                Array.isArray(common.genre) && common.genre.length > 0
                    ? common.genre[0]
                    : common.genre || nativeTags.genre || '';
            genre = String(genre);
            year = common.year ? String(common.year).substring(0, 4) : nativeTags.year || '';
            if (common.track && common.track.no) {
                track = common.track.no;
            } else if (nativeTags.track) {
                track = nativeTags.track;
            }
            if (format.duration && format.duration > 0) {
                duration = formatDuration(Math.round(format.duration));
            } else if (format.numberOfSamples && format.sampleRate) {
                const dur = format.numberOfSamples / format.sampleRate;
                if (dur > 0) duration = formatDuration(Math.round(dur));
            }

            extendedMeta = extractExtendedMetadata(common, format, metadata.native);

            const pictures = common.picture;
            let coverPicture = pickPicture(pictures);
            let coverData = coverPicture ? coverPicture.data : null;
            if (!coverData) {
                coverData = extractCoverFromNative(metadata.native);
            }
            if (coverData) {
                const hash = crypto.createHash('md5').update(coverData).digest('hex');
                const coverFileName = `cover_${hash}.${pickCoverExtension(coverPicture)}`;
                const coverPath = path.join(coversFolder, coverFileName);
                if (!fs.existsSync(coverPath)) {
                    writeFileAtomic(coverPath, coverData);
                }
                if (fs.existsSync(coverPath)) {
                    largeCover = `covers/${coverFileName}`;
                    const thumbRel = await generateThumbnail(coverData, coversFolder, hash);
                    cover = thumbRel || largeCover;
                }
            }
        } catch (e) {}

        if (!title) title = fileName;
        if (!artist) artist = 'Unknown Artist';

        songs.push({
            id: songs.length,
            title: sanitizeString(title),
            artist: sanitizeString(artist),
            album: sanitizeString(album),
            composer: sanitizeString(composer),
            genre: sanitizeString(genre),
            year: sanitizeString(year),
            track: sanitizeString(track),
            url: 'file:///' + filePath.replace(/\\/g, '/').replace(/[\x00-\x1F\x7F]/g, ''),
            cover: cover,
            largeCover: largeCover,
            duration: duration,
            ...extendedMeta
        });

        processed++;
        printProgress(processed, total, 'Scanning songs');
    }

    return songs;
}

async function scanCoversConcurrently(allFiles, coversFolder, mm, concurrency, songs, Jimp, onBatch) {
    let index = 0;
    let completed = 0;
    let foundCount = 0;
    let pending = [];
    const total = allFiles.length;

    async function worker() {
        while (index < allFiles.length) {
            const i = index++;
            const filePath = allFiles[i];
            let update = null;
            try {
                const metadata = await mm.parseFile(filePath, { duration: false, skipCovers: false });
                const pictures = metadata.common.picture;
                const coverPicture = pickPicture(pictures);
                let coverData = coverPicture ? coverPicture.data : null;
                if (!coverData) {
                    coverData = extractCoverFromNative(metadata.native);
                }
                if (coverData) {
                    const hash = crypto.createHash('md5').update(coverData).digest('hex');
                    const coverFileName = `cover_${hash}.${pickCoverExtension(coverPicture)}`;
                    const coverPath = path.join(coversFolder, coverFileName);
                    if (!fs.existsSync(coverPath)) {
                        writeFileAtomic(coverPath, coverData);
                    }
                    const largeCoverRel = `covers/${coverFileName}`;
                    const thumbRel = await generateThumbnail(coverData, coversFolder, hash, Jimp);
                    update = { id: i, cover: thumbRel || largeCoverRel, largeCover: largeCoverRel };
                }
            } catch (e) {
                logCoverError(coversFolder, `cover extraction failed for ${filePath}`, e);
            }

            completed++;
            if (update) {
                foundCount++;
                pending.push(update);
                if (songs[update.id]) {
                    songs[update.id].cover = update.cover;
                    songs[update.id].largeCover = update.largeCover;
                }
            }
            printProgress(completed, total, 'Extracting covers');

            if (completed % 25 === 0 || completed === total) {
                onBatch({ processed: completed, total, found: foundCount, updates: pending });
                pending = [];
            }
        }
    }

    const workers = [];
    for (let w = 0; w < concurrency; w++) workers.push(worker());
    await Promise.all(workers);
}

async function scanFilesStreamed(allFiles, coversFolder, mm, Jimp, onFastPass) {
    const total = allFiles.length;
    const songs = new Array(total);
    let index = 0;
    let processed = 0;

    async function worker() {
        while (index < allFiles.length) {
            const i = index++;
            const filePath = allFiles[i];
            const fileName = path.basename(filePath, path.extname(filePath));
            let title = '';
            let artist = '';
            let album = path.basename(path.dirname(filePath));
            let composer = '';
            let genre = '';
            let year = '';
            let track = '';
            let duration = '0:00';
            let extendedMeta = extractExtendedMetadata(null, null, null);

            try {
                const metadata = await mm.parseFile(filePath, { duration: true, skipCovers: true });
                const common = metadata.common;
                const format = metadata.format;
                const nativeTags = extractAllNativeTags(metadata.native);

                title = common.title || nativeTags.title || '';
                artist = common.artist || nativeTags.artist || '';
                album = (common.album || nativeTags.album || album);
                composer =
                    (Array.isArray(common.composer) ? common.composer[0] : common.composer) ||
                    nativeTags.composer ||
                    '';
                composer = String(composer);
                genre =
                    Array.isArray(common.genre) && common.genre.length > 0
                        ? common.genre[0]
                        : common.genre || nativeTags.genre || '';
                genre = String(genre);
                year = common.year ? String(common.year).substring(0, 4) : nativeTags.year || '';
                if (common.track && common.track.no) {
                    track = common.track.no;
                } else if (nativeTags.track) {
                    track = nativeTags.track;
                }
                if (format.duration && format.duration > 0) {
                    duration = formatDuration(Math.round(format.duration));
                } else if (format.numberOfSamples && format.sampleRate) {
                    const dur = format.numberOfSamples / format.sampleRate;
                    if (dur > 0) duration = formatDuration(Math.round(dur));
                }

                extendedMeta = extractExtendedMetadata(common, format, metadata.native);
            } catch (e) {}

            if (!title) title = fileName;
            if (!artist) artist = 'Unknown Artist';

            songs[i] = {
                id: i,
                title: sanitizeString(title),
                artist: sanitizeString(artist),
                album: sanitizeString(album),
                composer: sanitizeString(composer),
                genre: sanitizeString(genre),
                year: sanitizeString(year),
                track: sanitizeString(track),
                url: 'file:///' + filePath.replace(/\\/g, '/').replace(/[\x00-\x1F\x7F]/g, ''),
                cover: '',
                largeCover: '',
                duration: duration,
                ...extendedMeta
            };

            processed++;
            printProgress(processed, total, 'Scanning songs');
        }
    }

    const workers = [];
    const concurrency = 6;
    for (let w = 0; w < concurrency; w++) workers.push(worker());
    await Promise.all(workers);

    process.stderr.write('FASTRESULT:' + JSON.stringify(songs) + '\n');
    if (onFastPass) onFastPass(songs);

    await scanCoversConcurrently(allFiles, coversFolder, mm, 5, songs, Jimp, (batch) => {
        process.stderr.write('COVERBATCH:' + JSON.stringify(batch) + '\n');
    });

    return songs;
}

async function scanMusicFolderStreamed(folderPath, coversFolder, mm, Jimp, onFastPass) {
    const allFiles = [];
    walkDir(folderPath, allFiles);
    return scanFilesStreamed(allFiles, coversFolder, mm, Jimp, onFastPass);
}

async function scanAllFoldersStreamed(coversFolder, mm, Jimp, onFastPass) {
    const folders = loadMusicFolders();
    const allFiles = [];
    for (const folder of folders) {
        walkDir(folder, allFiles);
    }
    return scanFilesStreamed(allFiles, coversFolder, mm, Jimp, onFastPass);
}

async function main(folderPath, outputDir, mode, specificFile) {
    const mm = await import('music-metadata');
    let Jimp = null;
    try {
        const jimpModule = await import('jimp');
        Jimp = jimpModule.Jimp || jimpModule.default || jimpModule;
    } catch (e) {
        Jimp = null;
        try {
            fs.appendFileSync(path.join(outputDir, 'jimp-debug.log'), `Jimp failed to load: ${e && e.stack ? e.stack : e}\n`);
        } catch (e2) {}
    }

    if (mode === 'rebuild-all') {
        silentMode = false;
        const coversFolder = path.join(outputDir, 'covers');

        if (!fs.existsSync(coversFolder)) {
            fs.mkdirSync(coversFolder, {
                recursive: true
            });
        }

        const folders = loadMusicFolders();

        if (folders.length === 0) {
            process.stdout.write(
                JSON.stringify({
                    success: true,
                    songs: []
                })
            );
            return;
        }

        console.log(`\n📁 Output: ${outputDir}`);
        console.log(`🎶 Sources: ${folders.length} folder(s)`);
        for (const f of folders) {
            console.log(`     - ${f}`);
        }

        console.log('\n' + '─'.repeat(60));
        console.log('📀  SCANNING SONGS & COVERS');
        console.log('─'.repeat(60));

        const allSongs = await scanAllFolders(coversFolder, mm);

        if (allSongs.length === 0) {
            console.log('  ℹ️  No supported audio files found');
        }

        console.log(`\n  ✅  Found ${allSongs.length} songs`);

        console.log('\n' + '─'.repeat(60));
        console.log('🎵  STEP 3: GENERATING MUSIC PLAYER');
        console.log('─'.repeat(60));

        const jsPath = path.join(outputDir, 'player.js');
        const songsJson = JSON.stringify(allSongs);

        if (fs.existsSync(jsPath)) {
            let existingContent = fs.readFileSync(jsPath, 'utf-8');
            existingContent = existingContent.replace(
                /const SONGS_DATA = \[.*?\];/s,
                'const SONGS_DATA = ' + songsJson + ';'
            );
            fs.writeFileSync(jsPath, existingContent, 'utf-8');
        } else {
            fs.writeFileSync(jsPath, 'const SONGS_DATA = ' + songsJson + ';', 'utf-8');
        }

        console.log(`  ✅  ${jsPath}`);
        console.log(`  ✅  ${allSongs.length} songs written`);

        const resultJson = JSON.stringify({
            success: true,
            songs: allSongs
        });

        try {
            JSON.parse(resultJson);
        } catch (e) {
            let fixedJson = resultJson.replace(/[\x00-\x1F\x7F]/g, '');
            fixedJson = fixedJson.replace(/\\/g, '/');
            fixedJson = fixedJson.replace(/""/g, '"');
            try {
                JSON.parse(fixedJson);
                process.stdout.write(fixedJson);
                return;
            } catch (e2) {
                process.stdout.write(
                    JSON.stringify({
                        success: false,
                        error: 'Invalid character in song data'
                    })
                );
                return;
            }
        }
        process.stdout.write(resultJson);
        return;
    }

    if (mode === 'rebuild-all-streamed') {
        silentMode = false;
        const streamedCoversFolder = path.join(outputDir, 'covers');
        if (!fs.existsSync(streamedCoversFolder)) {
            fs.mkdirSync(streamedCoversFolder, { recursive: true });
        }

        const folders = loadMusicFolders();
        if (folders.length === 0) {
            process.stdout.write(JSON.stringify({ success: true, songs: [] }));
            return;
        }

        console.log(`\n📁 Output: ${outputDir}`);
        console.log(`🎶 Sources: ${folders.length} folder(s)`);
        console.log('\n' + '─'.repeat(60));
        console.log('📀  SCANNING SONGS (FAST PASS)');
        console.log('─'.repeat(60));

        const jsPath = path.join(outputDir, 'player.js');
        function writePlayerJsRebuild(songsToWrite) {
            const songsJson = JSON.stringify(songsToWrite);
            if (fs.existsSync(jsPath)) {
                let existingContent = fs.readFileSync(jsPath, 'utf-8');
                existingContent = existingContent.replace(
                    /const SONGS_DATA = \[.*?\];/s,
                    'const SONGS_DATA = ' + songsJson + ';'
                );
                fs.writeFileSync(jsPath, existingContent, 'utf-8');
            } else {
                fs.writeFileSync(jsPath, `const SONGS_DATA = ${songsJson};`, 'utf-8');
            }
        }

        const allSongs = await scanAllFoldersStreamed(streamedCoversFolder, mm, Jimp, writePlayerJsRebuild);

        if (allSongs.length === 0) {
            console.log('  ℹ️  No supported audio files found');
        }

        writePlayerJsRebuild(allSongs);

        process.stdout.write(
            JSON.stringify({
                success: true,
                songs: allSongs
            })
        );
        return;
    }

    if (!folderPath || !fs.existsSync(folderPath)) {
        process.stdout.write('ERROR: Folder does not exist\n');
        process.exit(1);
    }

    if (mode === 'metadata-only') {
        silentMode = true;
        if (specificFile && fs.existsSync(specificFile)) {
            const song = await scanSingleFile(specificFile, path.join(outputDir, 'covers'), mm, Jimp);
            process.stdout.write(JSON.stringify(song ? [song] : []));
        } else {
            const songs = await scanMusicFolder(folderPath, path.join(outputDir, 'covers'), mm, Jimp);
            process.stdout.write(JSON.stringify(songs));
        }
        return;
    }

    if (mode === 'full-streamed') {
        const streamedCoversFolder = path.join(outputDir, 'covers');
        if (!fs.existsSync(streamedCoversFolder)) {
            fs.mkdirSync(streamedCoversFolder, { recursive: true });
        }

        console.log(`\n📁 Output: ${outputDir}`);
        console.log(`🎶 Source: ${folderPath}`);
        console.log('\n' + '─'.repeat(60));
        console.log('📀  SCANNING SONGS (FAST PASS)');
        console.log('─'.repeat(60));

        const jsPath = path.join(outputDir, 'player.js');
        function writePlayerJs(songsToWrite) {
            const songsJson = JSON.stringify(songsToWrite);
            if (fs.existsSync(jsPath)) {
                let existingContent = fs.readFileSync(jsPath, 'utf-8');
                existingContent = existingContent.replace(
                    /const SONGS_DATA = \[.*?\];/s,
                    'const SONGS_DATA = ' + songsJson + ';'
                );
                fs.writeFileSync(jsPath, existingContent, 'utf-8');
            } else {
                fs.writeFileSync(jsPath, `const SONGS_DATA = ${songsJson};`, 'utf-8');
            }
        }

        const allSongs = await scanMusicFolderStreamed(folderPath, streamedCoversFolder, mm, Jimp, writePlayerJs);

        if (allSongs.length === 0) {
            process.stdout.write('ERROR: No supported audio files found\n');
            process.exit(1);
        }

        writePlayerJs(allSongs);

        process.stdout.write(
            JSON.stringify({
                success: true,
                songs: allSongs
            })
        );
        return;
    }

    const coversFolder = path.join(outputDir, 'covers');
    if (!fs.existsSync(coversFolder))
        fs.mkdirSync(coversFolder, {
            recursive: true
        });

    console.log(`\n📁 Output: ${outputDir}`);
    console.log(`🎶 Source: ${folderPath}`);

    console.log('\n' + '─'.repeat(60));
    console.log('📀  SCANNING SONGS & COVERS');
    console.log('─'.repeat(60));

    const allSongs = await scanMusicFolder(folderPath, coversFolder, mm);

    if (allSongs.length === 0) {
        process.stdout.write('ERROR: No supported audio files found\n');
        process.exit(1);
    }

    console.log(`\n  ✅  Found ${allSongs.length} songs`);

    console.log('\n' + '─'.repeat(60));
    console.log('🎵  STEP 3: GENERATING MUSIC PLAYER');
    console.log('─'.repeat(60));

    const jsPath = path.join(outputDir, 'player.js');

    if (fs.existsSync(jsPath)) {
        let existingContent = fs.readFileSync(jsPath, 'utf-8');
        const songsJson = JSON.stringify(allSongs);
        existingContent = existingContent.replace(
            /const SONGS_DATA = \[.*?\];/s,
            'const SONGS_DATA = ' + songsJson + ';'
        );
        fs.writeFileSync(jsPath, existingContent, 'utf-8');
    } else {
        const songsJson = JSON.stringify(allSongs);
        const jsContent = `const SONGS_DATA = ${songsJson};`;
        fs.writeFileSync(jsPath, jsContent, 'utf-8');
    }

    console.log(`  ✅  ${jsPath}`);
    console.log(`  ✅  ${allSongs.length} songs written`);

    process.stdout.write(
        JSON.stringify({
            success: true,
            songs: allSongs
        })
    );
}

// This file doubles as a CLI script (spawned by scanner.js) and, below, as a module that
// tests can require() for its pure helpers. Only run the CLI dispatch when invoked directly
// (`node scan-folder.js ...`), never when require()'d, so requiring it in a test doesn't
// read process.argv or call process.exit.
if (require.main === module) {
    const folderPath = process.argv[2];
    const outputDir = process.argv[3];
    const mode = process.argv[4] || 'full';
    const specificFile = process.argv[5] || null;

    if (!folderPath || !outputDir) {
        process.stdout.write('ERROR: Missing arguments\n');
        process.exit(1);
    }

    if (folderPath === '__files__') {
        import('music-metadata')
            .then((mm) => {
                return scanMultipleFiles(process.argv.slice(5), outputDir, mm);
            })
            .then((songs) => {
                process.stdout.write(JSON.stringify(songs));
            })
            .catch((err) => {
                process.stdout.write(JSON.stringify([]));
                process.exit(1);
            });
    } else if (folderPath === '__rebuild__') {
        import('music-metadata')
            .then((mm) => {
                return main(folderPath, outputDir, mode, specificFile);
            })
            .catch((err) => {
                process.stdout.write(
                    JSON.stringify({
                        success: false,
                        error: err.message
                    })
                );
                process.exit(1);
            });
    } else {
        main(folderPath, outputDir, mode, specificFile).catch((err) => {
            process.stdout.write(
                JSON.stringify({
                    success: false,
                    error: err.message
                })
            );
            process.exit(1);
        });
    }
}

async function scanMultipleFiles(filePaths, outputDir, mm) {
    const coversFolder = path.join(outputDir, 'covers');
    if (!fs.existsSync(coversFolder))
        fs.mkdirSync(coversFolder, {
            recursive: true
        });

    const songs = [];
    for (const filePath of filePaths) {
        if (!fs.existsSync(filePath)) continue;
        const song = await scanSingleFile(filePath, coversFolder, mm);
        if (song) {
            song.id = songs.length;
            songs.push(song);
        }
    }
    return songs;
}

async function scanSingleFile(filePath, coversFolder, mm) {
    const fileName = path.basename(filePath, path.extname(filePath));
    let title = '';
    let artist = '';
    let album = path.basename(path.dirname(filePath));
    let composer = '';
    let genre = '';
    let year = '';
    let track = '';
    let cover = '';
    let largeCover = '';
    let duration = '0:00';
    let extendedMeta = extractExtendedMetadata(null, null, null);

    try {
        const metadata = await mm.parseFile(filePath, {
            duration: true,
            skipCovers: false
        });
        const common = metadata.common;
        const format = metadata.format;
        const nativeTags = extractAllNativeTags(metadata.native);

        title = common.title || nativeTags.title || '';
        artist = common.artist || nativeTags.artist || '';
        album = common.album || nativeTags.album || album;
        composer = (Array.isArray(common.composer) ? common.composer[0] : common.composer) || nativeTags.composer || '';
        composer = String(composer);
        genre =
            Array.isArray(common.genre) && common.genre.length > 0
                ? common.genre[0]
                : common.genre || nativeTags.genre || '';
        genre = String(genre);
        year = common.year ? String(common.year).substring(0, 4) : nativeTags.year || '';
        if (common.track && common.track.no) {
            track = common.track.no;
        } else if (nativeTags.track) {
            track = nativeTags.track;
        }
        if (format.duration && format.duration > 0) {
            duration = formatDuration(Math.round(format.duration));
        } else if (format.numberOfSamples && format.sampleRate) {
            const dur = format.numberOfSamples / format.sampleRate;
            if (dur > 0) duration = formatDuration(Math.round(dur));
        }

        extendedMeta = extractExtendedMetadata(common, format, metadata.native);

        const pictures = common.picture;
        const coverPicture = pickPicture(pictures);
        let coverData = coverPicture ? coverPicture.data : null;
        if (!coverData) {
            coverData = extractCoverFromNative(metadata.native);
        }
        if (coverData) {
            if (!fs.existsSync(coversFolder))
                fs.mkdirSync(coversFolder, {
                    recursive: true
                });
            const hash = crypto.createHash('md5').update(coverData).digest('hex');
            const coverFileName = `cover_${hash}.${pickCoverExtension(coverPicture)}`;
            const coverPath = path.join(coversFolder, coverFileName);
            if (!fs.existsSync(coverPath)) {
                writeFileAtomic(coverPath, coverData);
            }
            if (fs.existsSync(coverPath)) {
                largeCover = `covers/${coverFileName}`;
                const thumbRel = await generateThumbnail(coverData, coversFolder, hash);
                cover = thumbRel || largeCover;
            }
        }
    } catch (e) {}

    if (!title) title = fileName;
    if (!artist) artist = 'Unknown Artist';

    return {
        id: 0,
        title: sanitizeString(title),
        artist: sanitizeString(artist),
        album: sanitizeString(album),
        composer: sanitizeString(composer),
        genre: sanitizeString(genre),
        year: sanitizeString(year),
        track: sanitizeString(track),
        url: 'file:///' + filePath.replace(/\\/g, '/').replace(/[\x00-\x1F\x7F]/g, ''),
        cover: cover,
        largeCover: largeCover,
        duration: duration,
        ...extendedMeta
    };
}

module.exports = {
    sanitizeString,
    sanitizeLyrics,
    extractAllNativeTags,
    extractExtendedMetadata,
    scanSingleFile,
    scanMultipleFiles
};
