// Song page (task PB-17): the main view for one song that is in no album. Same look as the album, artist and playlist pages (a header
// with the cover, then a list), with one row. A song that is in an album opens that album instead (adapter/song-open.js).

import { el, iconButton } from '../../components/index.js';
import { playSongFromList, openArtist } from '../../adapter/actions.js';

const DEFAULT_COVER = '../assets/default-cover.svg';
const engine = () => window;

function minutes(seconds) {
    const total = Math.max(0, Math.round(Number(seconds) || 0));
    return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

/** Draws the page for options.songId into `host`. */
export function mountSongPage(host, options = {}) {
    // The id may come back from the shell's history as text, so look for it by its text too.
    const wanted = options.songId;
    const song = (typeof engine().getSongById === 'function' && engine().getSongById(wanted)) || (typeof engine().getActiveSongs === 'function' ? engine().getActiveSongs().find((s) => String(s.id) === String(wanted)) : null) || null;
    host.dataset.song = String(options.songId ?? ''); // the shell's back and forward history reads it
    const page = el('section', { class: 'song-page', 'aria-label': 'Song' });
    if (!song) {
        page.append(el('p', { class: 'song-page__missing', role: 'status' }, 'This song is not in your library any more.'));
        host.append(page);
        return;
    }
    const image = el('img', { class: 'song-page__cover', src: song.largeCover || song.cover || DEFAULT_COVER, alt: '' });
    image.addEventListener('error', () => image.setAttribute('src', DEFAULT_COVER));
    const artist = el('button', { type: 'button', class: 'song-page__artist', dir: 'auto' }, String(song.artist || 'Unknown artist'));
    artist.addEventListener('click', () => {
        const match = typeof engine().getArtists === 'function' ? engine().getArtists().find((a) => (a.songs || []).includes(song.id)) : null;
        if (match) openArtist(match.id);
    });
    const play = iconButton({ icon: 'play', label: `Play ${song.title || 'song'}`, onClick: () => playSongFromList(song.id, 'all-songs') });
    const header = el('header', { class: 'song-page__header' }, image, el('div', { class: 'song-page__meta' }, el('span', { class: 'song-page__kind' }, 'Song'), el('h1', { class: 'song-page__title', dir: 'auto' }, String(song.title || 'Untitled')), el('div', { class: 'song-page__line' }, artist, song.year ? el('span', { class: 'song-page__year' }, String(song.year)) : '')), play);
    const rowButton = el('button', { type: 'button', class: 'song-page__row' }, el('span', { class: 'song-page__index' }, '1'), el('span', { class: 'song-page__row-text' }, el('span', { class: 'song-page__row-title', dir: 'auto' }, String(song.title || 'Untitled')), el('span', { class: 'song-page__row-artist', dir: 'auto' }, String(song.artist || ''))), el('time', { class: 'song-page__time' }, minutes(song.duration)));
    rowButton.addEventListener('click', () => playSongFromList(song.id, 'all-songs'));
    page.append(header, el('div', { class: 'song-page__list', role: 'list' }, el('div', { role: 'listitem' }, rowButton)));
    host.append(page);
}
