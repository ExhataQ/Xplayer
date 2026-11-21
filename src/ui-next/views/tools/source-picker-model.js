// Source picker model: what the "Add songs from…" picker lists when something is typed. Pure functions, no DOM.
//
//   GROUPS                          the sections, in the order they show: Now, Library, Playlists, Albums, Artists
//   filterSources(sources, query)   -> [{ ...source, group, match: [start, end] | null }]
//                                   every word typed has to be in the name (any order, any case, accents ignored); names that start with the
//                                   first word come first inside their section. Sections keep their order. With nothing typed, every source.
//                                   `match` is where the first word sits in the label, so the row can mark it.

export const GROUPS = [
    { id: 'now', label: 'Now' },
    { id: 'library', label: 'Library' },
    { id: 'playlist', label: 'Playlists' },
    { id: 'album', label: 'Albums' },
    { id: 'artist', label: 'Artists' }
];

// Lower case without accents, one character in and one out, so a position found in the clean text is a position in the original.
const fold = (text) =>
    Array.from(String(text ?? ''), (ch) => {
        const plain = ch.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
        return plain.length === 1 ? plain : ch.toLowerCase().slice(0, 1) || ch;
    }).join('');

export function filterSources(sources, query) {
    const words = fold(query).split(/\s+/).filter(Boolean);
    const out = [];
    for (const group of GROUPS) {
        const inGroup = sources.filter((s) => s.group === group.id);
        if (!words.length) {
            out.push(...inGroup.map((s) => ({ ...s, match: null })));
            continue;
        }
        const starts = [];
        const inside = [];
        for (const source of inGroup) {
            const name = fold(source.label);
            if (!words.every((w) => name.includes(w))) continue;
            const at = name.indexOf(words[0]);
            const row = { ...source, match: [at, at + words[0].length] };
            (at === 0 ? starts : inside).push(row);
        }
        out.push(...starts, ...inside);
    }
    return out;
}
