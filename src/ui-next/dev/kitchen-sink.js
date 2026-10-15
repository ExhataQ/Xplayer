// Developer preview of the ui-next tokens and icons. Not part of the app UI.
import { ICONS, icon } from '../icons/icons.js';

const root = document.documentElement;

const THEMES = ['warm-graphite', 'deep-forest', 'espresso-copper'];
const ACCENTS = ['theme', 'green', 'pink', 'purple', 'yellow', 'white'];

const SWATCHES = [
    ['surface-ground', '--surface-ground'],
    ['surface-panel', '--surface-panel'],
    ['surface-raised', '--surface-raised'],
    ['surface-selected', '--surface-selected'],
    ['border-subtle', '--border-subtle'],
    ['border-strong', '--border-strong'],
    ['text-primary', '--text-primary'],
    ['text-secondary', '--text-secondary'],
    ['text-tertiary', '--text-tertiary'],
    ['accent', '--accent'],
    ['accent-hover', '--accent-hover'],
    ['accent-soft', '--accent-soft'],
    ['danger', '--danger']
];

function pressedGroup(containerId, values, current, apply) {
    const container = document.getElementById(containerId);
    const buttons = values.map((value) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'pill';
        button.textContent = value.replace(/-/g, ' ');
        button.setAttribute('aria-pressed', String(value === current));
        button.addEventListener('click', () => {
            apply(value);
            buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(values[i] === value)));
        });
        container.appendChild(button);
        return button;
    });
}

pressedGroup('themes', THEMES, 'warm-graphite', (value) => root.setAttribute('data-theme', value));
pressedGroup('accents', ACCENTS, 'theme', (value) => {
    if (value === 'theme') root.removeAttribute('data-accent');
    else root.setAttribute('data-accent', value);
});

document.getElementById('swatches').innerHTML = SWATCHES.map(
    ([name, variable]) => `<div class="swatch"><i style="background: var(${variable})"></i><span>${name}</span></div>`
).join('');

document.getElementById('icons').innerHTML = Object.keys(ICONS)
    .map((name) => `<div>${icon(name, { size: 20 })}<span>${name}</span></div>`)
    .join('');
