// Developer preview for task A-09 (startup screen options). Not part of the app UI.
import { createStartup, resolveStartupVariant, STARTUP_OPTIONS, DEFAULT_STARTUP_VARIANT } from '../startup/startup.js';

const root = document.documentElement;
const THEMES = ['warm-graphite', 'deep-forest', 'espresso-copper'];
const ACCENTS = ['theme', 'green', 'pink', 'purple', 'yellow', 'white'];
const CHOICES = [...STARTUP_OPTIONS, { id: 'random', label: 'Random each start' }];
const STEPS = [
    [0, 'Starting'],
    [20, 'Reading your library'],
    [55, 'Checking music folders'],
    [85, 'Preparing the player'],
    [100, 'Ready']
];

const state = { choice: DEFAULT_STARTUP_VARIANT };
let startup = null;
let timer = 0;

function group(id, items, current, apply) {
    const container = document.getElementById(id);
    const buttons = items.map(({ value, label }) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'pill';
        b.textContent = label;
        b.setAttribute('aria-pressed', String(value === current));
        b.addEventListener('click', () => {
            apply(value);
            buttons.forEach((x, i) => x.setAttribute('aria-pressed', String(items[i].value === value)));
        });
        container.appendChild(b);
        return b;
    });
}

function mount() {
    clearInterval(timer);
    const frame = document.getElementById('frame');
    frame.innerHTML = '<div class="app-shell">The app appears here when loading finishes</div><div id="su-host" style="position:absolute;inset:0"></div>';
    startup = createStartup(document.getElementById('su-host'), { variant: resolveStartupVariant(state.choice) });
}

function play({ indeterminate = false } = {}) {
    mount();
    if (indeterminate) return;
    let p = 0;
    timer = setInterval(() => {
        p += 0.5;
        const step = [...STEPS].reverse().find(([at]) => p >= at) || STEPS[0];
        startup.setProgress(Math.min(p, 100), step[1]);
        if (p >= 100) {
            clearInterval(timer);
            setTimeout(() => startup.finish(), 500);
        }
    }, 60);
}

group('variants', CHOICES.map((c) => ({ value: c.id, label: c.label })), state.choice, (v) => { state.choice = v; play(); });
group('themes', THEMES.map((t) => ({ value: t, label: t.replace(/-/g, ' ') })), 'warm-graphite', (v) => root.setAttribute('data-theme', v));
group('accents', ACCENTS.map((a) => ({ value: a, label: a })), 'theme', (v) => (v === 'theme' ? root.removeAttribute('data-accent') : root.setAttribute('data-accent', v)));
document.getElementById('fullscreen').addEventListener('click', () => document.getElementById('frame').requestFullscreen());
document.getElementById('replay').addEventListener('click', () => play());
document.getElementById('indeterminate').addEventListener('click', () => play({ indeterminate: true }));

play();
