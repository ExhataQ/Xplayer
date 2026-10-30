// Home (task PB-15): a stack of shelves. What is on Home is the SHELVES list below: a shelf is { id, title, items(data) }, and a shelf
// with no items is not drawn. To add one later (for example "Recently added"), add an entry here and, if it needs a new kind of
// data, one list in adapter/home-bridge.js. Nothing else changes.
import { el, emptyState } from '../../components/index.js';
import { homeData, openHomeItem } from '../../adapter/home-bridge.js';
import { engineEvent } from '../../adapter/engine-api.js';
import { shelf } from './shelf.js';

const LIMIT = 20;

export const SHELVES = [
    { id: 'recent-songs', title: 'Recently played', items: (d) => d.songs },
    { id: 'playlists', title: 'Your playlists', items: (d) => d.playlists },
    { id: 'recent-albums', title: 'Recent albums', items: (d) => d.albums.filter((i) => i.played) },
    { id: 'recent-artists', title: 'Recent artists', items: (d) => d.artists.filter((i) => i.played) }
];

// The empty Home (PB-23): never a dead end. With a library it offers the quick actions and the library's numbers; with no music at
// all it offers one clear action, to the music folders. `actions` comes from the shell (it owns the views and the AI chat).
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
function emptyHome(data, actions) {
    const { playlists, albums, artists } = data;
    const hasMusic = albums.length || artists.length || playlists.length || data.songs.length;
    if (!hasMusic) {
        return emptyState({
            icon: 'folder',
            title: 'Add your music',
            text: 'Choose the folders your music is in, and the library fills in here.',
            actions: actions.folders ? [{ label: 'Music folders', icon: 'folder', onClick: actions.folders }] : []
        });
    }
    const quick = [
        actions.newPlaylist && { label: 'New playlist', icon: 'plus', onClick: actions.newPlaylist },
        actions.playFromUrl && { label: 'Play from URL', icon: 'link', onClick: actions.playFromUrl },
        actions.askAi && { label: 'Ask the AI', icon: 'sparkles', onClick: actions.askAi }
    ].filter(Boolean);
    const numbers = [plural(albums.length, 'album'), plural(artists.length, 'artist'), plural(playlists.length, 'playlist')].join(' · ');
    return el(
        'div',
        { class: 'home-start' },
        emptyState({ icon: 'house', title: 'Nothing played yet', text: `Your library has ${numbers}. Songs, albums and playlists you play show up here.`, actions: quick.slice(0, 3) })
    );
}

export function mountHome(host, { shelves = SHELVES, read = homeData, open = openHomeItem, actions = {} } = {}) {
    const root = el('div', { class: 'home' });
    host.append(root);
    let shown = '';

    function refresh() {
        const data = read();
        const lists = shelves.map((s) => ({ s, items: s.items(data).slice(0, LIMIT) })).filter(({ items }) => items.length);
        const counts = [data.albums.length, data.artists.length, data.playlists.length, data.songs.length]; // the empty Home shows them
        const signature = JSON.stringify([lists.map(({ s, items }) => [s.id, items.map((i) => [i.kind, i.id, i.title, i.subtitle])]), counts]);
        if (signature === shown) return; // nothing changed: keep the rows where the person scrolled them
        shown = signature;
        root.replaceChildren(
            ...(lists.length
                ? lists.map(({ s, items }) => shelf({ id: s.id, title: s.title, items, onOpen: open }))
                : [emptyHome(data, actions)])
        );
    }

    refresh();
    const stop = engineEvent('queue:indexChanged', () => root.isConnected && refresh());
    return {
        refresh,
        destroy() {
            stop();
            root.remove();
        }
    };
}
