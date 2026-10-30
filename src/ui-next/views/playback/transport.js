// Player controls (task C-01, part 2): tooltips with state and shortcut, accessible names and values, and the "nothing
// loaded" marker the stylesheet uses. Elements come from adapter/player-parts.js, never by id. Space and Enter on a focused
// control are the shell's shared rule (shell/space-key.js).
//
// What this does not change: what a click or a key does. The engine owns that (ui/06k shortcuts, playback/15x buttons).

import { attachTooltip } from '../../components/index.js';
import { playerPart, onTime } from '../../adapter/player-parts.js';

export const formatTime = (seconds) => {
    const whole = Math.max(0, Math.floor(Number(seconds) || 0));
    return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

const isOn = (node) => node.classList.contains('active');
const percentOf = (fill) => Math.max(0, Math.min(100, Math.round(parseFloat(fill && fill.style.width) || 0)));

// Shortcut labels are the engine's own (ui/06k): Space, S, R, M, L, Left and Right (5 s), Ctrl+Up and Down (volume).
// Previous and next have no keyboard shortcut in the renderer, so none is shown.
function repeatState(node) {
    const badge = node.querySelector('.repeat-one');
    if (!isOn(node)) return 'Off';
    return badge && badge.style.display !== 'none' ? 'One song' : 'All songs';
}

/** The engine's old tooltip system (ui/06d) shows any element that has a title. These elements have their own tooltip. */
function dropTitles(node) {
    const strip = () => {
        node.removeAttribute('title');
        node.removeAttribute('data-original-title');
    };
    strip();
    new MutationObserver(strip).observe(node, { attributes: true, attributeFilter: ['title', 'data-original-title'] });
}

function watch(node, callback, options = { attributes: true, attributeFilter: ['class', 'style'] }) {
    new MutationObserver(callback).observe(node, options);
}

export function enhanceTransport() {
    const state = { playing: false, src: '' };
    const parts = Object.fromEntries(['shuffle', 'prev', 'play', 'next', 'repeat', 'volume-icon', 'lyrics', 'seek', 'seek-fill', 'volume', 'volume-fill', 'time-current', 'time-total', 'song-info'].map((name) => [name, playerPart(name)]));
    if (!parts.play || !parts.seek || !parts.volume) return () => {};

    // With no song loaded, previous, next and the seek bar do nothing: they get no tooltip and no hover (player-bar.css) and are announced as unavailable.
    const idle = () => !(parts['song-info'] && parts['song-info'].classList.contains('has-song'));

    // ---- buttons: name, state, shortcut ----
    const buttons = [
        ['shuffle', () => ({ name: 'Shuffle', state: isOn(parts.shuffle) ? 'On' : 'Off', shortcut: 'S' }), true],
        ['prev', () => (idle() ? null : { name: 'Previous song' }), false],
        ['play', () => ({ name: state.playing ? 'Pause' : 'Play', shortcut: 'Space' }), true],
        ['next', () => (idle() ? null : { name: 'Next song' }), false],
        ['repeat', () => ({ name: 'Repeat', state: repeatState(parts.repeat), shortcut: 'R' }), true],
        ['volume-icon', () => ({ name: parts['volume-icon'].getAttribute('aria-label') || 'Mute', shortcut: 'M' }), true]
    ];
    const tips = {};
    for (const [name, content, toggle] of buttons) {
        const node = parts[name];
        if (!node) continue;
        dropTitles(node);
        tips[name] = attachTooltip(node, content, { stayOnPress: toggle });
    }

    // The volume icon is a div in the engine's markup: make it a button for the keyboard and for screen readers.
    const mute = parts['volume-icon'];
    mute.setAttribute('role', 'button');
    mute.tabIndex = 0;

    // ---- labels that follow the engine's state ----
    const syncLabels = () => {
        parts.play.setAttribute('aria-label', state.playing ? 'Pause' : 'Play');
        parts.shuffle.setAttribute('aria-pressed', String(isOn(parts.shuffle)));
        parts.repeat.setAttribute('aria-label', `Repeat: ${repeatState(parts.repeat).toLowerCase()}`);
        const hasSong = !idle();
        const host = parts.play.closest('.player-host');
        if (host) host.toggleAttribute('data-empty', !hasSong);
        for (const name of ['prev', 'next']) if (parts[name]) parts[name].setAttribute('aria-disabled', String(!hasSong));
        if (parts.seek) {
            parts.seek.setAttribute('aria-disabled', String(!hasSong));
            parts.seek.tabIndex = hasSong ? 0 : -1;
        }
        for (const tip of Object.values(tips)) tip.refresh();
    };
    watch(parts.shuffle, syncLabels);
    watch(parts.repeat, syncLabels, { attributes: true, subtree: true, attributeFilter: ['class', 'style'] });
    if (parts['song-info']) watch(parts['song-info'], syncLabels, { attributes: true, attributeFilter: ['class'] });

    // ---- seek bar: a slider for assistive technology; the engine keeps the pointer behavior ----
    const seek = parts.seek;
    seek.setAttribute('role', 'slider');
    seek.tabIndex = 0;
    seek.setAttribute('aria-label', 'Seek');
    seek.setAttribute('aria-keyshortcuts', 'ArrowLeft ArrowRight');
    seek.setAttribute('aria-valuemin', '0');
    let lastSecond = -1;
    let lastDuration = -1;
    const stopTime = onTime((time) => {
        const playingChanged = time.playing !== state.playing;
        state.playing = time.playing;
        state.src = time.src;
        const second = Math.floor(time.currentTime);
        if (second !== lastSecond || time.duration !== lastDuration) {
            lastSecond = second;
            lastDuration = time.duration;
            seek.setAttribute('aria-valuemax', String(Math.round(time.duration)));
            seek.setAttribute('aria-valuenow', String(second));
            seek.setAttribute('aria-valuetext', time.duration ? `${formatTime(time.currentTime)} of ${formatTime(time.duration)}` : 'No song');
        }
        if (playingChanged) syncLabels();
    });

    // ---- volume slider ----
    const volume = parts.volume;
    volume.setAttribute('role', 'slider');
    volume.tabIndex = 0;
    volume.setAttribute('aria-label', 'Volume');
    volume.setAttribute('aria-keyshortcuts', 'Control+ArrowUp Control+ArrowDown');
    volume.setAttribute('aria-valuemin', '0');
    volume.setAttribute('aria-valuemax', '100');
    const volumeTip = attachTooltip(volume, () => ({ name: 'Volume', state: `${percentOf(parts['volume-fill'])}%`, shortcut: 'Ctrl+Up / Down' }), { stayOnPress: true });
    const syncVolume = () => {
        const value = percentOf(parts['volume-fill']);
        volume.setAttribute('aria-valuenow', String(value));
        volume.setAttribute('aria-valuetext', value === 0 ? 'Muted' : `${value}%`);
        volumeTip.refresh();
    };
    if (parts['volume-fill']) watch(parts['volume-fill'], syncVolume, { attributes: true, attributeFilter: ['style'] });
    syncVolume();

    // ---- the elapsed-time label switches to remaining time on click (engine); say so ----
    if (parts['time-current']) attachTooltip(parts['time-current'], { name: 'Time', description: 'Click to switch between elapsed and remaining time' });

    syncLabels();
    return () => stopTime();
}
