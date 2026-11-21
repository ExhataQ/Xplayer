// Right panel content: the lyrics and the big cover in the right panel. Its classes (.rp-now, .rp-line) are styled in player-bar.css.
// The cover (a click opens the big picture), the header with the translation and size buttons, then the lyrics: timed lines follow the song (past,
// active, coming) and a click on one moves the song there; plain lyrics are shown in the same line style. With no lyrics the cover and the track
// info stay alone. When the person scrolls away, "Follow lyrics" brings the active line back.
// The engine is reached only through adapter/playback-bridge.js, adapter/player-parts.js and adapter/engine-api.js.
import { el, iconEl, iconButton, setLoading, reducedMotion, openMenu } from '../../components/index.js';
import { registerRightPanel } from '../../shell/right-panel.js';
import { currentCover, currentLyrics, hasCoverArt, seekTo } from '../../adapter/playback-bridge.js';
import { onTime } from '../../adapter/player-parts.js';
import { engineCall, engineEvent, nowPlaying } from '../../adapter/engine-api.js';
import { notify } from '../../shell/notify.js';
import { showSongMenu } from '../../adapter/actions.js';
import { bigCoverSource, openBigPicture } from './cover-viewer.js';
import { defaultCover } from '../../adapter/default-cover.js';
import { translationPair } from '../../adapter/ai-lyrics.js';
import { lyricsVersions, chooseLyricsVersion } from '../../adapter/lyrics-versions.js';
import { textDirection } from '../../shell/lyrics-direction.js';
import { displayChoice, onDisplayChange, pairLines } from '../../shell/lyrics-display.js';
import { dominantDirection } from '../../shell/lyrics-direction.js';
import { mountAiLyricsBar } from '../../shell/ai-slots.js';
import { scrollShadow } from '../../components/scroll-shadow.js';

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
// A timed line with no words (LRC files mark instrumental breaks, intros and sound logos this way) lasting at least this long shows as an
// interlude (a music note that brightens as the break passes). Shorter ones stay a small gap. A first line this late gets an interlude before it.
const INTERLUDE_MIN_SECONDS = 4;

/** Seconds from line `i` to the next timed line, or 0 for the last line (its end is not known). */
export function lineSpan(lines, i) {
    return i + 1 < lines.length ? Math.max(0, lines[i + 1].time - lines[i].time) : 0;
}

/** Lines with an interlude in front when the song starts with a long wait before the first words. */
export function withIntro(lines) {
    if (!lines || !lines.length || lines[0].time < INTERLUDE_MIN_SECONDS) return lines;
    if (!lines[0].text && !lines[0].instrumental) return lines; // the file already marks the intro
    return [{ time: 0, text: '', instrumental: false, intro: true }, ...lines];
}

/**
 * The side a break's note sits on: the way the line above it runs (the reader comes from the top), or the line below it when the break is the
 * intro; `fallback` (the song's direction) when no line near it has letters.
 */
export function interludeDirection(lines, i, fallback = 'ltr') {
    for (let k = i - 1; k >= 0; k--) {
        const d = textDirection(lines[k].text);
        if (d) return d;
    }
    for (let k = i + 1; k < lines.length; k++) {
        const d = textDirection(lines[k].text);
        if (d) return d;
    }
    return fallback;
}

/** True for a line that shows as an interlude: no words (or the [instrumental] marker) and a long enough stretch before the next line. */
export function isInterlude(lines, i) {
    const line = lines[i];
    return Boolean(line && (!line.text || line.instrumental) && lineSpan(lines, i) >= INTERLUDE_MIN_SECONDS);
}

// Placeholders. With nothing playing the cover spot shows a blank cover (a music note on a tile in the theme's colors), and wherever there are no
// lyrics to show (nothing playing, a song without lyrics, an instrumental) the lyrics area shows a faint preview of lyric lines, one of them lit
// like the line that is playing. Both are only pictures: the note under the cover says what is going on in words.
const SVG_NS = 'http://www.w3.org/2000/svg';
const NOTE_PATH = 'M13.75 2C13.75 4.8995 16.1005 7.25 19 7.25C19.4142 7.25 19.75 7.58579 19.75 8C19.75 8.41421 19.4142 8.75 19 8.75C16.8795 8.75 14.9875 7.77225 13.75 6.243V18C13.75 20.6234 11.6234 22.75 9 22.75C6.37665 22.75 4.25 20.6234 4.25 18C4.25 15.3766 6.37665 13.25 9 13.25C10.2572 13.25 11.4003 13.7384 12.25 14.5359V2H13.75ZM12.25 18C12.25 16.2051 10.7949 14.75 9 14.75C7.20507 14.75 5.75 16.2051 5.75 18C5.75 19.7949 7.20507 21.25 9 21.25C10.7949 21.25 12.25 19.7949 12.25 18Z';
const SKELETON_LINES = [72, 90, 58, 84, 66, 92, 50, 78, 62, 88, 54, 82, 70, 94, 60, 76, 86, 56, 80, 68, 90, 52]; // widths in %; the fourth is the lit "playing" line. More than a small panel shows: a tall screen fills with them, and the box clips the rest (player-bar.css)

function coverPlaceholder() {
    const svg = document.createElementNS(SVG_NS, 'svg');
    svg.setAttribute('viewBox', '3 1 18 23');
    svg.setAttribute('class', 'rp-now__cover-note');
    const path = document.createElementNS(SVG_NS, 'path');
    path.setAttribute('d', NOTE_PATH);
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('fill-rule', 'evenodd');
    svg.append(path);
    return el('div', { class: 'rp-now__cover-empty', 'aria-hidden': 'true' }, svg);
}

// An instrumental song has no lyrics to preview, so it gets one large note and a line of words instead of the lyric bars.
function instrumentalPlaceholder() {
    return el('div', { class: 'rp-instr' }, el('span', { class: 'rp-instr__note', 'aria-hidden': 'true' }, '\u266A'), el('p', { class: 'rp-instr__hint' }, 'This song has no words.'));
}

function lyricsPlaceholder() {
    const lines = SKELETON_LINES.map((width, i) => {
        const line = el('span', { class: i === 3 ? 'rp-skel__line rp-skel__line--on' : 'rp-skel__line' });
        line.style.width = `${width}%`;
        return line;
    });
    return el('div', { class: 'rp-skel', 'aria-hidden': 'true' }, ...lines);
}
const ICON_FILL = { out: 'corners-out', in: 'corners-in' }; // four corners, apart and together: fill the whole app
const ICON_ONLY = { out: 'maximize-2', in: 'minimize-2' }; // the two diagonal arrows, apart and together: lyrics only

// The "Find lyrics online" button: one press searches LRCLIB for the playing song and saves the synced lyrics (plain text when that is all there is).
// It is off while the song already has synced lyrics (LRC): there is nothing to find.
// The engine says "LRC saved to song" itself when it works; every other answer is told here, so a press never ends in silence.
async function findLyrics(button, redraw) {
    const song = nowPlaying();
    if (!song) return;
    if (song.hasSynced) return; // the button is off for such a song; this only covers a press that raced the redraw
    const name = song.artist ? `${song.title} by ${song.artist}` : song.title;
    setLoading(button, true);
    let answer = null;
    try {
        answer = await engineCall('findLyricsForSong', song.id);
    } catch (error) {
        answer = { status: 'error', error: error && error.message };
    } finally {
        setLoading(button, false);
    }
    const status = answer && answer.status;
    if (status === 'saved' || status === 'instrumental') redraw(); // the engine's lyrics:changed only fires on its own Lyrics page, so this panel redraws itself
    if (status === 'saved') return;
    if (status === 'none') notify({ kind: 'warning', title: 'No lyrics found', detail: `Nothing online matches ${name}. Check its title and artist, or search by hand in Lyrics.` });
    else if (status === 'instrumental') notify({ kind: 'info', title: 'Marked as instrumental', detail: `${name} has no words, according to LRCLIB.` });
    else if (status === 'kept') notify({ kind: 'info', title: 'Synced lyrics kept', detail: 'Only plain lyrics were found online, so the synced lyrics of this song were not replaced.' });
    else {
        // A network failure says "getaddrinfo ENOTFOUND lrclib.net" or "fetch failed": say what to do instead. Any other reason is shown as it came.
        const why = (answer && answer.error) || '';
        const offline = !why || /ENOTFOUND|EAI_AGAIN|ECONN|ETIMEDOUT|ENETUNREACH|fetch failed|network/i.test(why);
        notify({ kind: 'error', title: 'Could not search for lyrics', detail: offline ? 'LRCLIB could not be reached. Check your internet connection and try again.' : why });
    }
}

function build(body, controls) {
    body.classList.add('rp-now');
    const picture = el('img', { class: 'rp-now__cover', alt: '' });
    const coverButton = el('button', { class: 'rp-now__cover-button', type: 'button', 'aria-label': 'View cover large' }, picture);
    const frame = el('div', { class: 'rp-now__cover-frame' }, coverButton);
    const coverEmpty = coverPlaceholder();
    const title = el('div', { class: 'rp-now__title', dir: 'auto' });
    const artist = el('div', { class: 'rp-now__artist', dir: 'auto' });
    const note = el('p', { class: 'rp-now__note' });
    const lyrics = el('div', { class: 'rp-now__lyrics', tabindex: '0', 'aria-label': 'Lyrics' });
    scrollShadow(lyrics); // marks the lyrics as scrolled; the header draws the shadow under its line (shell.css)
    const follow = el('button', { class: 'rp-now__follow', type: 'button' }, 'Follow');
    follow.hidden = true;
    // The header: the title, and the two size buttons on its right. Four corners out (in while it is on) for filling the
    // app with the lyrics, and two diagonal arrows apart (together while it is on) for lyrics only.
    const find = iconButton({ icon: 'text-search', label: 'Find lyrics online', size: 'sm', onClick: () => findLyrics(find, () => refresh()) });
    const fill = iconButton({ icon: ICON_FILL.out, label: 'Full screen lyrics', size: 'sm', pressed: false, onClick: () => controls && controls.setFull(!controls.state().full) });
    const lyricsOnly = iconButton({ icon: ICON_ONLY.out, label: 'Lyrics only', size: 'sm', pressed: false, onClick: () => controls && controls.setLyricsOnly(!controls.state().lyricsOnly) });
    // Left of the size buttons: the translation controls (translate, and one view button). Drawn by the AI part, and only
    // when there is something to do: AI set up, or a song with a translation.
    const aiTools = el('div', { class: 'rp-now__ai' });
    mountAiLyricsBar(aiTools);
    // Find sits with the lyrics buttons (translation), apart from the two size buttons: [translate, view, find] | [fill, lyrics only].
    const lyricTools = el('div', { class: 'rp-now__lyric-tools' }, aiTools, find);
    // A small arrow after the title, shown only when the song has more than one saved synced version: it opens the list to pick one from.
    const pick = iconButton({ icon: 'chevron-down', label: 'Choose lyrics version', size: 'sm', onClick: () => openVersions() });
    pick.classList.add('rp-now__versions');
    pick.setAttribute('aria-haspopup', 'menu');
    pick.hidden = true;
    const header = el('div', { class: 'rp-now__header' }, el('span', { class: 'rp-now__header-title' }, 'Lyrics', pick), el('div', { class: 'rp-now__tools' }, lyricTools, fill, lyricsOnly));
    // The header sits under the cover. The song's name is not repeated here (the player bar shows it); only the note about the lyrics is.
    body.append(frame, header, el('div', { class: 'rp-now__info' }, note), lyrics, follow);
    const syncTools = () => {
        const state = controls ? controls.state() : { lyricsOnly: false, full: false };
        lyricsOnly.setAttribute('aria-pressed', String(state.lyricsOnly));
        lyricsOnly.setAttribute('aria-label', state.lyricsOnly ? 'Show the cover' : 'Lyrics only');
        fill.setAttribute('aria-pressed', String(state.full));
        fill.setAttribute('aria-label', state.full ? 'Back to the panel' : 'Full screen lyrics');
        lyricsOnly.hidden = state.full; // in full view the cover is not shown either way
        fill.replaceChildren(iconEl(state.full ? ICON_FILL.in : ICON_FILL.out, { size: 18 })); // back from full: the arrows point in
        lyricsOnly.replaceChildren(iconEl(state.lyricsOnly ? ICON_ONLY.in : ICON_ONLY.out, { size: 18 }));
    };
    frame.after(coverEmpty); // beside the real cover, shown instead of it when nothing is playing
    syncTools();

    let lines = null;
    let nodes = [];
    let active = -1;
    let pausedAt = 0; // when the person last scrolled the lyrics themselves
    let lastTime = 0; // the song's position at the last time event, to place the highlight again after a redraw
    let ownScrollUntil = 0; // scroll events before this time come from the panel's own centering, not from the person

    const following = () => Date.now() - pausedAt > FOLLOW_PAUSE_MS;

    function centerActive(smooth) {
        const node = nodes[active];
        if (!node) return;
        const top = node.offsetTop - lyrics.clientHeight / 2 + node.offsetHeight / 2;
        ownScrollUntil = Date.now() + 900;
        lyrics.scrollTo({ top: Math.max(0, top), behavior: smooth && !reducedMotion() ? 'smooth' : 'auto' });
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

    // The note of the interlude that is playing brightens with the time that has passed in it (--p from 0 to 1).
    function fillInterlude(time) {
        const node = nodes[active];
        if (!node || !node.classList.contains('rp-line--interlude')) return;
        const span = lineSpan(lines, active);
        const p = span > 0 ? Math.min(1, Math.max(0, (time - lines[active].time) / span)) : 0;
        node.style.setProperty('--p', p.toFixed(3));
    }

    function openVersions() {
        const song = currentLyrics();
        const versions = song ? lyricsVersions(song.id) : [];
        if (versions.length < 2) return;
        openMenu({
            anchor: pick,
            items: [{ type: 'heading', label: 'Lyrics version' }, ...versions.map((v) => ({ label: v.label, radio: true, checked: v.active, onSelect: () => !v.active && chooseLyricsVersion(song.id, v.id) }))]
        });
    }

    function refresh() {
        const song = currentLyrics();
        pick.hidden = !song || lyricsVersions(song.id).length < 2;
        // Off with nothing playing, and off while the song has synced lyrics (LRC); the name says which.
        const hasLrc = Boolean(song && song.synced && song.synced.length);
        find.disabled = !song || hasLrc;
        find.setAttribute('aria-label', hasLrc ? 'Find lyrics online (this song already has synced lyrics)' : 'Find lyrics online');
        if (hasLrc) find.title = 'This song already has synced lyrics (LRC)';
        else find.removeAttribute('title');
        const art = currentCover();
        const small = art && (art.small || art.large);
        const real = Boolean(small && hasCoverArt(small));
        // A song with no cover shows the default one; only with nothing playing is the cover left out.
        frame.hidden = !song;
        coverEmpty.hidden = Boolean(song);
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
            lyrics.append(lyricsPlaceholder());
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
            lines = withIntro(lines);
            // One direction for the whole song (shell/lyrics-direction.js): a line with no letters (the note, a blank line) has none of its own.
            const direction = dominantDirection(lines.map((line) => line.text)) || 'auto';
            nodes = lines.map((line, i) => {
                if (isInterlude(lines, i)) return el('div', { class: 'rp-line rp-line--interlude', dir: interludeDirection(lines, i, direction === 'auto' ? 'ltr' : direction), 'aria-hidden': 'true', onClick: () => seekTo(line.time) }, el('span', { class: 'rp-gap' }, '\u266A'));
                const shown = line.instrumental ? '\u266A' : line.text;
                const go = () => shown && seekTo(line.time);
                const klass = !shown ? 'rp-line rp-line--empty' : line.instrumental ? 'rp-line rp-line--instrumental' : 'rp-line';
                if (!both || !line.translation) return el('div', { class: klass, dir: direction, onClick: go }, shown ? el('bdi', {}, shown) : '');
                return el('div', { class: `${klass} rp-line--pair`, dir: direction, onClick: go }, el('span', { class: 'rp-line__orig' }, el('bdi', {}, shown)), el('span', { class: 'rp-line__tr' }, el('bdi', {}, line.translation)));
            });
            lyrics.append(...nodes);
            setActive(activeLineIndex(lines, lastTime));
            fillInterlude(lastTime);
        } else if (song.plain) {
            note.textContent = '';
            // Plain lyrics use the same line model and style as synced ones (rp-line): one line each, a blank line stays a gap. They have no
            // time, so a line is not a button, and none is the active one.
            const plainLines = song.plain.split(/\r?\n/);
            const plainDirection = dominantDirection(plainLines) || 'auto';
            lyrics.append(...plainLines.map((text) => el('div', { class: text.trim() ? 'rp-line rp-line--plain' : 'rp-line rp-line--empty', dir: plainDirection }, text.trim() ? el('bdi', {}, text) : '')));
        } else {
            note.textContent = song.instrumental ? 'Instrumental' : 'No lyrics for this song';
            lyrics.append(song.instrumental ? instrumentalPlaceholder() : lyricsPlaceholder());
        }
    }

    // A right click on the cover opens the playing song's menu, the same one a song row has.
    coverButton.addEventListener('contextmenu', (event) => {
        const song = nowPlaying();
        if (song) showSongMenu(event, song.id);
    });
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
                if (lines) {
                    setActive(activeLineIndex(lines, lastTime));
                    fillInterlude(lastTime);
                }
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
    const stops = [controls ? controls.onChange(syncTools) : () => {}, () => clearInterval(check), engineEvent('queue:indexChanged', refresh), engineEvent('songs:changed', refresh), engineEvent('lyrics:changed', refresh), onDisplayChange(refresh), () => stopTime()];
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
