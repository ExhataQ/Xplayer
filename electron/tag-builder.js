const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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

const TAG_BUILD_PROFILES = Object.freeze({
    // This older rebuild path intentionally used only music-metadata common tags,
    // only format.duration, only common.picture, and did not strip URL controls.
    INCREMENTAL: Object.freeze({
        nativeFallbacks: false,
        nativeCoverFallback: false,
        sampleDurationFallback: false,
        sanitizeUrlControls: false,
        includeCover: true,
        ensureCoversFolder: false
    }),
    FULL: Object.freeze({
        nativeFallbacks: true,
        nativeCoverFallback: true,
        sampleDurationFallback: true,
        sanitizeUrlControls: true,
        includeCover: true,
        ensureCoversFolder: false
    }),
    FAST: Object.freeze({
        nativeFallbacks: true,
        nativeCoverFallback: false,
        sampleDurationFallback: true,
        sanitizeUrlControls: true,
        includeCover: false,
        ensureCoversFolder: false
    }),
    SINGLE: Object.freeze({
        nativeFallbacks: true,
        nativeCoverFallback: true,
        sampleDurationFallback: true,
        sanitizeUrlControls: true,
        includeCover: true,
        ensureCoversFolder: true
    })
});

async function buildCoverFromMetadata(metadata, coversFolder, Jimp, profile = TAG_BUILD_PROFILES.FULL) {
    const common = metadata.common || {};
    const coverPicture = pickPicture(common.picture);
    let coverData = coverPicture ? coverPicture.data : null;
    if (!coverData && profile.nativeCoverFallback) {
        coverData = extractCoverFromNative(metadata.native);
    }
    if (!coverData) return { cover: '', largeCover: '' };

    if (profile.ensureCoversFolder && !fs.existsSync(coversFolder)) {
        fs.mkdirSync(coversFolder, { recursive: true });
    }
    const hash = crypto.createHash('md5').update(coverData).digest('hex');
    const coverFileName = `cover_${hash}.${pickCoverExtension(coverPicture)}`;
    const coverPath = path.join(coversFolder, coverFileName);
    if (!fs.existsSync(coverPath)) writeFileAtomic(coverPath, coverData);
    if (!fs.existsSync(coverPath)) return { cover: '', largeCover: '' };

    const largeCover = `covers/${coverFileName}`;
    const thumbRel = await generateThumbnail(coverData, coversFolder, hash, Jimp);
    return { cover: thumbRel || largeCover, largeCover };
}

async function buildSongFromTags({ filePath, metadata, coversFolder, id = 0, profile = TAG_BUILD_PROFILES.FULL, Jimp = null }) {
    const fileName = path.basename(filePath, path.extname(filePath));
    const common = metadata && metadata.common ? metadata.common : {};
    const format = metadata && metadata.format ? metadata.format : {};
    const nativeTags = profile.nativeFallbacks && metadata ? extractAllNativeTags(metadata.native) : {};

    let title = common.title || nativeTags.title || '';
    let artist = common.artist || nativeTags.artist || '';
    let album = common.album || nativeTags.album || path.basename(path.dirname(filePath));
    let composer = (Array.isArray(common.composer) ? common.composer[0] : common.composer) || nativeTags.composer || '';
    let genre = Array.isArray(common.genre) && common.genre.length > 0
        ? common.genre[0]
        : common.genre || nativeTags.genre || '';
    const year = common.year ? String(common.year).substring(0, 4) : nativeTags.year || '';
    const track = common.track && common.track.no ? common.track.no : nativeTags.track || '';
    let duration = '0:00';

    if (format.duration && format.duration > 0) {
        duration = formatDuration(Math.round(format.duration));
    } else if (profile.sampleDurationFallback && format.numberOfSamples && format.sampleRate) {
        const seconds = format.numberOfSamples / format.sampleRate;
        if (seconds > 0) duration = formatDuration(Math.round(seconds));
    }

    if (!title) title = fileName;
    if (!artist) artist = 'Unknown Artist';
    composer = String(composer);
    genre = String(genre);

    let cover = '';
    let largeCover = '';
    if (profile.includeCover && metadata) {
        try {
            ({ cover, largeCover } = await buildCoverFromMetadata(metadata, coversFolder, Jimp, profile));
        } catch (e) {}
    }

    let cleanPath = filePath.replace(/\\/g, '/');
    if (profile.sanitizeUrlControls) cleanPath = cleanPath.replace(/[\x00-\x1F\x7F]/g, '');

    return {
        id,
        title: sanitizeString(title),
        artist: sanitizeString(artist),
        album: sanitizeString(album),
        composer: sanitizeString(composer),
        genre: sanitizeString(genre),
        year: sanitizeString(year),
        track: sanitizeString(track),
        url: 'file:///' + cleanPath,
        cover,
        largeCover,
        duration,
        ...extractExtendedMetadata(
            metadata ? common : null,
            metadata ? format : null,
            metadata ? metadata.native : null
        )
    };
}

module.exports = {
    TAG_BUILD_PROFILES,
    buildSongFromTags,
    buildCoverFromMetadata,
    logCoverError,
    sanitizeString,
    sanitizeLyrics,
    extractAllNativeTags,
    extractExtendedMetadata
};
