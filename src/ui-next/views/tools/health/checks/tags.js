// Library health: checks about tags and covers. Pure: they read song records and answer [{ songId, note }].

const lacks = (song, tag) => Array.isArray(song.missingTags) && song.missingTags.includes(tag);

function missing(tag, title, hint) {
    return {
        id: `missing-${tag}`,
        group: 'tags',
        title,
        hint,
        find(songs) {
            const out = [];
            for (const song of songs) if (lacks(song, tag)) out.push({ songId: song.id, note: '' });
            return out;
        },
        fixes: ['hide', 'trash']
    };
}

export const missingTitle = missing('title', 'No title', 'The file has no title tag, so the app shows its file name.');
export const missingArtist = missing('artist', 'No artist', 'The file has no artist tag.');
export const missingAlbum = missing('album', 'No album', 'The file has no album tag.');

export const noCover = {
    id: 'no-cover',
    group: 'tags',
    title: 'No cover',
    hint: 'Songs with no cover picture.',
    find(songs) {
        const out = [];
        for (const song of songs) if (!song.cover) out.push({ songId: song.id, note: '' });
        return out;
    },
    fixes: ['hide', 'trash']
};

const baseName = (url) => {
    const path = decodeURIComponent(String(url || '').replace(/[?#].*$/, ''));
    return path.slice(path.lastIndexOf('/') + 1).replace(/\.[a-z0-9]+$/i, '');
};
const TRACK_PREFIX = /^\d{1,3}\s*[-._)]\s*\S/;

export const fileNameAsTitle = {
    id: 'file-name-as-title',
    group: 'tags',
    title: 'Title looks like a file name',
    hint: 'The title is the file name or starts with a track number.',
    find(songs) {
        const out = [];
        for (const song of songs) {
            const title = String(song.title || '').trim();
            if (!title || lacks(song, 'title')) continue;
            if (title.toLowerCase() === baseName(song.url).trim().toLowerCase()) out.push({ songId: song.id, note: 'Same as the file name' });
            else if (TRACK_PREFIX.test(title)) out.push({ songId: song.id, note: 'Starts with a track number' });
        }
        return out;
    },
    fixes: ['hide', 'trash']
};
