// Home hero: the big card at the top of Home (design board C, "Xplayer Home, new looks"). It shows the song that plays now, or the song that
// is loaded and paused, or, after the app was closed in the middle of a song, that song with a Resume button. With nothing to show it is
// not drawn. The colour behind it is the cover's. What it reads comes from adapter/last-session.js.
import { el, iconButton } from '../../components/index.js';
import { currentHero, resumeSession } from '../../adapter/last-session.js';
import { togglePlayback } from '../../adapter/actions.js';
import { engineEvent } from '../../adapter/engine-api.js';
import { onTime } from '../../adapter/player-parts.js';
import { defaultCover } from '../../adapter/default-cover.js';
import { formatTime, progressShare, glowFromPixels } from './hero-math.js';

const LABEL = { playing: 'Now playing', paused: 'Paused', resume: 'Pick up where you left off' };

function cover(song) {
    const fallback = defaultCover('song');
    const image = el('img', { src: song.cover || fallback, alt: '', draggable: 'false' });
    image.addEventListener('error', () => {
        if (image.getAttribute('src') !== fallback) image.setAttribute('src', fallback);
    });
    return image;
}

// The cover's colour, from a 16 by 16 copy of it. A picture the page may not read (the canvas refuses it) just leaves the accent.
function glowOf(image, apply) {
    const run = () => {
        try {
            const canvas = document.createElement('canvas');
            canvas.width = canvas.height = 16;
            const ctx = canvas.getContext('2d', { willReadFrequently: true });
            ctx.drawImage(image, 0, 0, 16, 16);
            const rgb = glowFromPixels(ctx.getImageData(0, 0, 16, 16).data);
            apply(rgb ? `rgb(${rgb[0]} ${rgb[1]} ${rgb[2]})` : '');
        } catch (_) {
            apply('');
        }
    };
    if (image.complete && image.naturalWidth) run();
    else image.addEventListener('load', run, { once: true });
}

export function mountHero(host, { read = currentHero, resume = resumeSession, toggle = togglePlayback } = {}) {
    const root = el('section', { class: 'hero', dataset: { hero: '' }, 'aria-label': 'Now playing' });
    root.hidden = true;
    host.prepend(root);
    let shown = '';
    let time = null; // the time text and the bar, updated without drawing the card again
    let stopTime = null;

    function draw(state) {
        const key = JSON.stringify([state.mode, state.song.id, state.mode === 'resume' ? Math.floor(state.position) : 0]);
        if (key === shown) return;
        shown = key;
        root.hidden = false;
        root.dataset.mode = state.mode;
        const image = cover(state.song);
        const frame = el('span', { class: 'hero__cover', 'aria-hidden': 'true' }, image);
        glowOf(image, (colour) => (colour ? root.style.setProperty('--hero-glow', colour) : root.style.removeProperty('--hero-glow')));
        const bars = el('span', { class: 'hero__bars', 'aria-hidden': 'true' }, el('i'), el('i'), el('i'));
        const label = el('div', { class: 'hero__label' }, state.mode === 'playing' ? bars : '', LABEL[state.mode]);
        const place = state.mode === 'resume' ? ` \u00b7 you closed Xplayer at ${formatTime(state.position)}` : '';
        const sub = el('div', { class: 'hero__sub', dir: 'auto' }, [state.song.artist, state.song.album].filter(Boolean).join(', ') + place);
        const bar = el('span', { class: 'hero__fill' });
        const now = el('span', { class: 'hero__time' }, formatTime(state.position));
        const total = el('span', { class: 'hero__time hero__time--end' }, state.duration ? formatTime(state.duration) : '');
        time = { bar, now, total, resume: state.mode === 'resume' };
        const progress = el('div', { class: 'hero__progress' }, now, el('span', { class: 'hero__track' }, bar), total);
        bar.style.width = `${progressShare(state.position, state.duration) * 100}%`;
        // Round icon buttons, the same as the player bar's: the main one plays or pauses, and a picked-up song also has "Start over".
        const mode = state.mode;
        const playLabel = mode === 'playing' ? 'Pause' : mode === 'resume' && state.position > 0 ? `Resume from ${formatTime(state.position)}` : 'Play';
        const primary = iconButton({ icon: mode === 'playing' ? 'pause' : 'play', label: playLabel, variant: 'solid', className: 'hero__play', onClick: () => (mode === 'resume' ? resume(state, true) : toggle()) });
        const startOver = mode === 'resume' && state.position > 0 ? iconButton({ icon: 'skip-back', label: 'Start over', className: 'hero__restart', onClick: () => resume(state, false) }) : '';
        const actions = el('div', { class: 'hero__actions' }, primary, startOver);
        root.replaceChildren(frame, el('div', { class: 'hero__body' }, label, el('div', { class: 'hero__title', dir: 'auto' }, state.song.title), sub, progress, actions));
    }

    function refresh() {
        const state = read();
        if (!state) {
            shown = '';
            root.hidden = true;
            root.replaceChildren();
            return;
        }
        draw(state);
    }

    refresh();
    stopTime = onTime((s) => {
        if (!time || time.resume) return;
        time.now.textContent = formatTime(s.currentTime);
        if (s.duration) time.total.textContent = formatTime(s.duration);
        time.bar.style.width = `${progressShare(s.currentTime, s.duration) * 100}%`;
    });
    const stops = ['playback:stateChanged', 'queue:indexChanged'].map((name) => engineEvent(name, () => root.isConnected && refresh()));
    return {
        refresh,
        destroy() {
            stops.forEach((stop) => stop());
            stopTime();
            root.remove();
        }
    };
}
