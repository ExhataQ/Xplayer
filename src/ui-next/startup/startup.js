// Startup view (task A-09): a plain full-screen view. One minimalist animated background, the X logo, a thin loading
// line and a status text. The logo menu and the window controls float on top. Only transform and opacity are animated.
//
// The background is the user's choice (Settings, "Startup screen"). The ids in STARTUP_OPTIONS must match
// STARTUP_BACKGROUNDS in src/js/library/03f-favorites-settings.js; tools/tests/ui-next-startup.test.js checks it.
import { logo } from './logo.js';
import { icon } from '../icons/icons.js';

export const STARTUP_OPTIONS = [
    { id: 'playhead', label: 'Playhead sweep' },
    { id: 'vinyl', label: 'Vinyl grooves' },
    { id: 'equalizer', label: 'Equalizer horizon' },
    { id: 'light', label: 'Light leaks' },
    { id: 'constellation', label: 'Constellation of songs' },
    { id: 'plain', label: 'Plain, no animation' }
];
export const STARTUP_VARIANTS = STARTUP_OPTIONS.map((o) => o.id);
export const DEFAULT_STARTUP_VARIANT = 'vinyl';

/**
 * Turns the saved choice into a background id. 'random' picks one animated background per start; an unknown or
 * missing value gives the default. `random` is injectable for tests.
 */
export function resolveStartupVariant(preference, random = Math.random) {
    if (preference === 'random') {
        const animated = STARTUP_VARIANTS.filter((id) => id !== 'plain');
        return animated[Math.min(animated.length - 1, Math.floor(random() * animated.length))];
    }
    return STARTUP_VARIANTS.includes(preference) ? preference : DEFAULT_STARTUP_VARIANT;
}

// ---------- background markup (all geometry is on a fixed 1280 x 720 canvas and cropped with "slice") ----------

const W = 1280;
const H = 720;
const CX = W / 2;
const CY = H / 2 - 20;

// Same picture on every start: a small seeded generator instead of Math.random.
function seeded(seed) {
    let s = seed;
    return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

function playhead() {
    let dim = '';
    let lit = '';
    for (let i = 0; i < 110; i++) {
        const x = 40 + i * 11.2;
        const h = 20 + (Math.abs(Math.sin(i * 0.37) * 90 + Math.sin(i * 0.91) * 60)) * 1.1;
        const bar = `<rect x="${x.toFixed(1)}" y="${(CY - h / 2).toFixed(1)}" width="4" height="${h.toFixed(1)}" rx="2"/>`;
        dim += bar;
        lit += bar;
    }
    const svg = (cls, bars) =>
        `<svg class="${cls}" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${bars}</svg>`;
    return `<div class="su-bg su-bg-playhead" aria-hidden="true">
        ${svg('su-wave-dim', dim)}
        <div class="su-lit">${svg('su-wave-lit', lit)}<i class="su-head"></i></div>
    </div>`;
}

function vinyl() {
    let rings = '';
    for (let r = 130; r < 980; r += 8) {
        rings += `<circle cx="${CX}" cy="${H / 2}" r="${r}" class="${(r / 8) % 6 === 0 ? 'su-groove su-groove-major' : 'su-groove'}"/>`;
    }
    return `<div class="su-bg su-bg-vinyl" aria-hidden="true">
        <svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${rings}
            <circle cx="${CX}" cy="${H / 2}" r="120" class="su-label-disc"/><circle cx="${CX}" cy="${H / 2}" r="124" class="su-label-edge"/></svg>
        <i class="su-sheen"></i>
    </div>`;
}

function equalizer() {
    const rnd = seeded(11);
    let bars = '';
    const n = 96;
    for (let i = 0; i < n; i++) {
        const d = (i - n / 2) / (n / 2);
        const h = (0.1 + Math.pow(1 - Math.abs(d), 1.6) * 0.9 * (0.55 + 0.45 * Math.abs(Math.sin(i * 1.3 + Math.cos(i * 0.4))))).toFixed(3);
        const center = Math.abs(d) < 0.12 ? ' class="is-center"' : '';
        bars += `<i${center} style="--h:${h};--t:${(3.4 + rnd() * 2.4).toFixed(2)}s;--d:${(-rnd() * 6).toFixed(2)}s"></i>`;
    }
    return `<div class="su-bg su-bg-equalizer" aria-hidden="true"><div class="su-eq">${bars}</div></div>`;
}

function light() {
    return `<div class="su-bg su-bg-light" aria-hidden="true"><i class="su-leak su-leak-a"></i><i class="su-leak su-leak-b"></i><i class="su-leak su-leak-c"></i><i class="su-leak su-leak-d"></i></div>`;
}

function constellation() {
    const rnd = seeded(7);
    const pts = [];
    for (let i = 0; i < 70; i++) {
        let x;
        let y;
        do {
            x = rnd() * W;
            y = rnd() * H;
        } while (Math.hypot(x - CX, y - CY) < 170);
        pts.push([x, y, rnd()]);
    }
    let lines = '';
    for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
            const d = Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]);
            if (d < 150) {
                lines += `<line x1="${pts[i][0].toFixed(1)}" y1="${pts[i][1].toFixed(1)}" x2="${pts[j][0].toFixed(1)}" y2="${pts[j][1].toFixed(1)}" style="opacity:${(1 - d / 150).toFixed(2)}"/>`;
            }
        }
    }
    let dots = '';
    pts.forEach(([x, y, k], i) => {
        const star = k > 0.85;
        dots += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${star ? 3.2 : 1.8}" class="${star ? 'su-star' : 'su-dot'}"${star ? ` style="--d:${(-(i % 7) * 0.9).toFixed(1)}s"` : ''}/>`;
    });
    return `<div class="su-bg su-bg-constellation" aria-hidden="true"><svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">${lines}${dots}</svg></div>`;
}

const BACKGROUNDS = { playhead, vinyl, equalizer, light, constellation, plain: () => '' };

/** Markup of one background (empty for 'plain'). Exported for tests. */
export function backgroundMarkup(variant) {
    const build = BACKGROUNDS[variant];
    if (!build) throw new Error(`Unknown startup background: ${variant}`);
    return build();
}

/**
 * Builds the startup view inside `host` (a positioned element that fills the window) and returns its controls.
 * `variant` is one of STARTUP_VARIANTS; pass the saved choice through resolveStartupVariant first.
 * progress: 0 to 100, or null for an indeterminate indicator.
 */
export function createStartup(host, { variant = DEFAULT_STARTUP_VARIANT, label = 'Starting' } = {}) {
    host.innerHTML = `
        <div class="startup" data-variant="${variant}" role="status" aria-live="polite">
            ${backgroundMarkup(variant)}
            <div class="su-vignette" aria-hidden="true"></div>
            <div class="su-titlebar">
                <button type="button" class="su-menu" aria-label="Application menu" aria-haspopup="menu">
                    ${logo('x', { size: 18 })}${icon('chevron-down', { size: 14 })}
                </button>
                <span class="su-drag"></span>
                <button type="button" class="su-win" aria-label="Minimize">${icon('minus', { size: 16 })}</button>
                <button type="button" class="su-win" aria-label="Maximize">${icon('square', { size: 14 })}</button>
                <button type="button" class="su-win su-close" aria-label="Close">${icon('x', { size: 16 })}</button>
            </div>
            <div class="su-mark">${logo('x', { size: 88 })}</div>
            <div class="su-foot">
                <div class="su-line" aria-hidden="true"><i></i></div>
                <p class="su-label"><span class="su-label-text">${label}</span><span class="su-percent"></span></p>
            </div>
        </div>`;

    const root = host.querySelector('.startup');
    const text = root.querySelector('.su-label-text');
    const percent = root.querySelector('.su-percent');
    const bar = root.querySelector('.su-line i');

    function setProgress(value, status) {
        if (status != null) text.textContent = status;
        root.classList.toggle('is-indeterminate', value == null);
        if (value == null) {
            percent.textContent = '';
            bar.style.transform = '';
            return;
        }
        const p = Math.max(0, Math.min(100, value));
        percent.textContent = `${Math.round(p)}%`;
        bar.style.transform = `scaleX(${p / 100})`;
    }

    /** Fades the startup view out. Resolves when it is gone so the caller can remove it. */
    function finish() {
        return new Promise((resolve) => {
            root.classList.add('is-done');
            const done = () => {
                root.removeEventListener('transitionend', done);
                resolve();
            };
            root.addEventListener('transitionend', done);
            setTimeout(done, 400); // reduced motion or a missed event
        });
    }

    setProgress(null);
    return { setProgress, finish, element: root };
}
