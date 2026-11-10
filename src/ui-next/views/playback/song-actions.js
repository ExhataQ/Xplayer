// Two buttons after the title and artist in the player bar: a heart that adds the playing song to the favorites (or takes it out), and an
// info button that opens the song's metadata (the same window as "Show metadata" in a song's menu). A right click on the small cover opens the
// song's menu too. They follow the playing song and the favorites, and the engine does the work: this only calls its own functions.
//
// The shell starts before the engine's modules have run, so nothing here may ask the engine for state when it mounts: it asks with the safe
// lookups (nowPlaying answers null until there is a song), and subscribes to the events when the engine is there (engineEvent waits for it).

import { iconButton, iconEl, el } from '../../components/index.js';
import { playerPart } from '../../adapter/player-parts.js';
import { isFavorite } from '../../adapter/store.js';
import { toggleFavorite, showSongMetadata, showSongMenu } from '../../adapter/actions.js';
import { engineEvent, nowPlaying } from '../../adapter/engine-api.js';

export function mountSongActions() {
    const text = playerPart('song-info') && playerPart('song-info').querySelector('.player-text-info');
    if (!text) return () => {};

    const like = iconButton({
        icon: 'heart',
        label: 'Add to favorites',
        size: 'sm',
        pressed: false,
        tooltip: () => ({}), // the name follows the label, which follows the state
        className: 'player-like',
        onClick: () => {
            const song = nowPlaying();
            if (song) toggleFavorite(song.id);
        }
    });
    const info = iconButton({
        icon: 'info',
        label: 'Show metadata',
        size: 'sm',
        className: 'player-info',
        onClick: () => {
            const song = nowPlaying();
            if (song) showSongMetadata(song.id);
        }
    });
    const actions = el('div', { class: 'player-song-actions' }, like, info);
    actions.hidden = true;
    text.after(actions);

    function sync() {
        const song = nowPlaying();
        actions.hidden = !song;
        const liked = Boolean(song) && isFavorite(song.id);
        like.setAttribute('aria-pressed', String(liked));
        like.setAttribute('aria-label', liked ? 'Remove from favorites' : 'Add to favorites');
        like.replaceChildren(iconEl('heart', { size: 18, filled: liked })); // a filled heart while it is a favorite
    }

    // A right click on the small cover opens the playing song's menu, the same one a song row has.
    const cover = playerPart('cover');
    const menu = (event) => {
        const song = nowPlaying();
        if (song) showSongMenu(event, song.id);
    };
    if (cover) cover.addEventListener('contextmenu', menu);

    const stops = ['favorites:changed', 'queue:indexChanged', 'playback:stateChanged'].map((name) => engineEvent(name, sync));
    window.addEventListener('load', sync, { once: true }); // a song the engine restored before the first event
    sync();
    return () => {
        stops.forEach((stop) => stop());
        window.removeEventListener('load', sync);
        if (cover) cover.removeEventListener('contextmenu', menu);
        actions.remove();
    };
}
