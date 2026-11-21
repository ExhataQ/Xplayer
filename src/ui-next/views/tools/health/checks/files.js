// Library health: checks about the files themselves. Pure: they read song records and answer [{ songId, note }].
import { secondsOf } from '../../duplicates-core.js';

export const TINY_BYTES = 100 * 1024;
export const TINY_SECONDS = 5;
export const LOW_KBPS = 96;
const LOSSLESS = new Set(['flac', 'wav', 'aiff', 'aif', 'alac', 'ape', 'wv', 'tta']);

const extensionOf = (url) => (/\.([a-z0-9]+)(?:[?#].*)?$/i.exec(String(url || '')) || [, ''])[1].toLowerCase();

export const tinyFiles = {
    id: 'tiny-files',
    group: 'files',
    title: 'Tiny files',
    hint: 'Under 100 KB or 5 seconds: often a broken download or a sound effect.',
    find(songs) {
        const out = [];
        for (const song of songs) {
            const bytes = Number(song.size) || 0;
            const seconds = secondsOf(song.duration);
            if (bytes > 0 && bytes < TINY_BYTES) out.push({ songId: song.id, note: `${Math.max(1, Math.round(bytes / 1024))} KB` });
            else if (seconds > 0 && seconds < TINY_SECONDS) out.push({ songId: song.id, note: `${Math.round(seconds)} s` });
        }
        return out;
    },
    fixes: ['hide', 'trash']
};

export const lowQuality = {
    id: 'low-quality',
    group: 'files',
    title: 'Low quality',
    hint: 'Lossy files under 96 kbps.',
    find(songs) {
        const out = [];
        for (const song of songs) {
            const kbps = Number(song.bitrate) || 0;
            if (kbps > 0 && kbps < LOW_KBPS && !LOSSLESS.has(extensionOf(song.url))) out.push({ songId: song.id, note: `${Math.round(kbps)} kbps` });
        }
        return out;
    },
    fixes: ['hide', 'trash']
};
