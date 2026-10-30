// Right panel content (task PC-13; written by Agent A as a stand-in for the file missing from the owner's tree. Agent C's styles are
// already in player-bar.css (.rp-now, .rp-line), so this file follows those class names and Agent C's version can replace it).
// The cover (a click opens the big picture), the header with the translation and size buttons, then the lyrics: timed lines follow the song (past,
// active, coming) and a click on one moves the song there; plain lyrics are shown as text. With no lyrics the cover and the track
// info stay alone (DP11a). When the person scrolls away, "Follow lyrics" brings the active line back.
// The engine is reached only through adapter/playback-bridge.js, adapter/player-parts.js and adapter/engine-api.js.
import { el, iconEl, iconButton } from '../../components/index.js';
import { registerRightPanel } from '../../shell/right-panel.js';
import { currentCover, currentLyrics, hasCoverArt, seekTo } from '../../adapter/playback-bridge.js';
import { onTime } from '../../adapter/player-parts.js';
import { engineEvent } from '../../adapter/engine-api.js';
import { bigCoverSource, openBigPicture } from './cover-viewer.js';
import { defaultCover } from '../../adapter/default-cover.js';
import { translationPair } from '../../adapter/ai-lyrics.js';
import { displayChoice, onDisplayChange, pairLines } from '../../shell/lyrics-display.js';
import { mountAiLyricsBar } from '../../shell/ai-slots.js';

/** Index of the timed line that is playing at `time`, or -1 before the first line. */
export function activeLineIndex(lines, time) {
    let found = -1;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].time <= time + 0.05) found = i;
        else break;
    }
    return found;
}

const FOLLOW_PAUSE_MS = 4000;
const ICON_FILL = { out: 'corners-out', in: 'corners-in' }; // four corners, apart and together: fill the whole app
const ICON_ONLY = { out: 'maximize-2', in: 'minimize-2' }; // the two diagonal arrows, apart and together: lyrics only

function build(body, controls) {
    body.classList.add('rp-now');
    const picture = el('img', { class: 'rp-now__cover', alt: '' });
    const coverButton = el('button', { class: 'rp-now__cover-button', type: 'button', 'aria-label': 'View cover large' }, picture);
    const frame = el('div', { class: 'rp-now__cover-frame' }, coverButton);
    const title = el('div', { class: 'rp-now__title', dir: 'auto' });
    const artist = el('div', { class: 'rp-now__artist', dir: 'auto' });
    const note = el('p', { class: 'rp-now__note' });
    const lyrics = el('div', { class: 'rp-now__lyrics', tabindex: '0', 'aria-label': 'Lyrics' });
    const follow = el('button', { class: 'rp-now__follow', type: 'button' }, 'Follow lyrics');
    follow.hidden = true;
    // The header: the title, and the two size buttons on its right. Four corners out (in while it is on) for filling the
    // app with the lyrics, and two diagonal arrows apart (together while it is on) for lyrics only.
    const fill = iconButton({ icon: ICON_FILL.out, label: 'Fill the app with the lyrics', size: 'sm', pressed: false, onClick: () => controls && controls.setFull(!controls.state().full) });
    const lyricsOnly = iconButton({ icon: ICON_ONLY.out, label: 'Lyrics only', size: 'sm', pressed: false, onClick: () => controls && controls.setLyricsOnly(!controls.state().lyricsOnly) });
    // Left of the size buttons: the translation controls (translate, and one view button). Drawn by the AI part, and only
    // when there is something to do: AI set up, or a song with a translation.
    const aiTools = el('div', { class: 'rp-now__ai' });
    mountAiLyricsBar(aiTools);
    const header = el('div', { class: 'rp-now__header' }, el('span', { class: 'rp-now__header-title' }, 'Lyrics'), el('div', { class: 'rp-now__tools' }, aiTools, fill, lyricsOnly));
    // The header sits under the cover. The song's name is not repeated here (the player bar shows it); only the note about the lyrics is.
    body.append(frame, header, el('div', { class: 'rp-now__info' }, note), lyrics, follow);
    const syncTools = () => {
        const state = controls ? controls.state() : { lyricsOnly: false, full: false };
        lyricsOnly.setAttribute('aria-pressed', String(state.lyricsOnly));
        lyricsOnly.setAttribute('aria-label', state.lyricsOnly ? 'Show the cover' : 'Lyrics only');
        fill.setAttribute('aria-pressed', String(state.full));
        fill.setAttribute('aria-label', state.full ? 'Back to the panel' : 'Fill the app with the lyrics');
        lyricsOnly.hidden = state.full; // in full view the cover is not shown either way
        fill.replaceChildren(iconEl(state.full ? ICON_FILL.in : ICON_FILL.out, { size: 18 })); // back from full: the arrows point in
        lyricsOnly.replaceChildren(iconEl(state.lyricsOnly ? ICON_ONLY.in : ICON_ONLY.out, { size: 18 }));
    };
    syncTools();

    let lines = null;
    let nodes = [];
    let active = -1;
    let pausedAt = 0; // when the person last scrolled the lyrics themselves
    let lastTime = 0; // the song's position at the last time event, to place the highlight again after a redraw
    let ownScrollUntil = 0; // scroll events before this time come from the panel's own centering, not from the person

    const following = () => Date.now() - pausedAt > FOLLOW_PAUSE_MS;
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

    function centerActive(smooth) {
        const node = nodes[active];
        if (!node) return;
        const top = node.offsetTop - lyrics.clientHeight / 2 + node.offsetHeight / 2;
        ownScrollUntil = Date.now() + 900;
        lyrics.scrollTo({ top: Math.max(0, top), behavior: smooth && !reduced() ? 'smooth' : 'auto' });
        follow.hidden = true;
    }

    function setActive(index) {
        if (index === active) return;
        active = index;
        nodes.forEach((node, i) => {
            node.classList.toggle('rp-line--active', i === index);
            node.classList.toggle('rp-line--past', i < index);
            if (i === index) node.setAttribute('aria-current', 'true');
            else node.removeAttribute('aria-current');
        });
        if (following()) centerActive(true);
        else if (nodes[index]) follow.hidden = false;
    }

    function refresh() {
        const song = currentLyrics();
        const art = currentCover();
        const small = art && (art.small || art.large);
        const real = Boolean(small && hasCoverArt(small));
        // A song with no cover shows the default one; only with nothing playing is the cover left out.
        frame.hidden = !song;
        frame.toggleAttribute('data-default', !real);
        // A default cover is not worth a big picture: the button stays but does nothing.
        if (real) coverButton.removeAttribute('aria-disabled');
        else coverButton.setAttribute('aria-disabled', 'true');
        // The full-size cover (the one the big picture mode shows), the small one when the song has none or it cannot be read, then the default one.
        const standIn = defaultCover('song');
        const { src, fallback } = real ? bigCoverSource(small) : { src: standIn, fallback: '' };
        if (!frame.hidden && picture.dataset.source !== src) {
            picture.dataset.source = src;
            picture.onerror = () => {
                const shown = picture.getAttribute('src');
                const next = fallback && shown !== fallback ? fallback : shown !== standIn ? standIn : '';
                if (next) picture.src = next;
            };
            picture.src = src;
        }
        title.textContent = song ? song.title : '';
        artist.textContent = song ? song.artist || 'Unknown Artist' : '';
        lines = null;
        nodes = [];
        active = -1;
        follow.hidden = true;
        ownScrollUntil = Date.now() + 300;
        lyrics.scrollTop = 0;
        lyrics.replaceChildren();
        if (!song) {
            note.textContent = 'Nothing is playing';
            return;
        }
        // A song with a translation shows both texts, or one of them, in the layout the person chose (shell/lyrics-display.js).
        const pair = translationPair(song);
        const choice = displayChoice();
        const both = Boolean(pair && pair.translated.length && choice.mode === 'both');
        const synced = pair && pair.original.length ? (choice.mode === 'translated' && pair.translated.length ? pair.translated : both ? pairLines(pair.original, pair.translated) : pair.original) : song.synced;
        if (synced && synced.length) {
            note.textContent = '';
            lines = synced;
            // An instrumental marker ([instrumental]) shows as a note, like the old lyrics page did; a blank line stays a gap.
            nodes = lines.map((line) => {
                const shown = line.instrumental ? '\u266A' : line.text;
                const go = () => shown && seekTo(line.time);
                const klass = !shown ? 'rp-line rp-line--empty' : line.instrumental ? 'rp-line rp-line--instrumental' : 'rp-line';
                if (!both || !line.translation) return el('div', { class: klass, dir: 'auto', onClick: go }, shown || '');
                return el('div', { class: `${klass} rp-line--pair`, dir: 'auto', onClick: go }, el('span', { class: 'rp-line__orig', dir: 'auto' }, shown), el('span', { class: 'rp-line__tr', dir: 'auto' }, line.translation));
            });
            lyrics.append(...nodes);
            setActive(activeLineIndex(lines, lastTime));
        } else if (song.plain) {
            note.textContent = '';
            lyrics.append(el('div', { class: 'rp-plain', dir: 'auto' }, song.plain));
        } else {
            note.textContent = song.instrumental ? 'Instrumental' : 'No lyrics for this song';
        }
    }

    coverButton.addEventListener('click', () => {
        const art = currentCover();
        if (!art || frame.hasAttribute('data-default')) return;
        openBigPicture({ ...bigCoverSource(art.small || art.large), title: title.textContent || 'Cover', artist: artist.textContent });
    });
    const userScroll = () => {
        pausedAt = Date.now();
        if (nodes[active]) follow.hidden = false;
    };
    // Any scroll the panel did not start itself counts: the wheel, a touch, the keys, and a drag on the scrollbar thumb (which sends no wheel event).
    lyrics.addEventListener('scroll', () => Date.now() > ownScrollUntil && userScroll(), { passive: true });
    follow.addEventListener('click', () => {
        pausedAt = 0;
        centerActive(true);
    });

    let stopTime = () => {};
    const watchTime = () => {
        stopTime();
        stopTime = onTime(
            (time) => {
                lastTime = time.currentTime;
                if (lines) setActive(activeLineIndex(lines, lastTime));
            },
            { immediate: true }
        );
    };
    // Lyrics added, edited or removed while the song plays: the engine says so with lyrics:changed; as a second check the text is compared once a second.
    const signature = () => {
        const song = currentLyrics();
        const pair = song ? translationPair(song) : null;
        const shown = pair ? `${displayChoice().mode}|${pair.language}|${pair.translated.map((l) => `${l.time}:${l.text}`).join('\n')}` : '';
        return song ? `${song.id}|${song.plain}|${song.synced ? song.synced.map((l) => `${l.time}:${l.text}`).join('\n') : ''}|${shown}` : '';
    };
    let seen = signature();
    const check = setInterval(() => {
        const now = signature();
        if (now !== seen) {
            seen = now;
            refresh();
        }
    }, 1000);
    const stops = [controls ? controls.onChange(syncTools) : () => {}, () => clearInterval(check), engineEvent('queue:indexChanged', refresh), engineEvent('lyrics:changed', refresh), onDisplayChange(refresh), () => stopTime()];
    watchTime();
    refresh();
    seen = signature();
    // the player may start after the panel opens: ask again for a short while until a song is there
    const started = Boolean(currentLyrics());
    const retry = started ? 0 : setInterval(() => {
        if (currentLyrics()) {
            clearInterval(retry);
            watchTime();
            refresh();
        }
    }, 500);
    setTimeout(() => clearInterval(retry), 10000);
    return () => {
        clearInterval(retry);
        stops.forEach((stop) => typeof stop === 'function' && stop());
    };
}

export function mountRightPanelContent() {
    let stop = null;
    registerRightPanel({
        label: 'Lyrics and cover',
        mount(body, controls) {
            stop = build(body, controls);
            return { show() {}, hide() {} };
        }
    });
    return () => {
        if (typeof stop === 'function') stop();
        stop = null;
    };
}
