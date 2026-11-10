// The Rating system section of Settings, in the Library group (task B3). One switch for the whole system (off by default: off means no
// stars, no menu item, no Home playlists, no shuffle weight, and the AI is not told). While it is on, a second switch: Smart Shuffle
// uses ratings. `el` and `segmented` come from components.
import { getRatingSettings, setRatingSetting } from '../../adapter/ratings-bridge.js';

const ONOFF = [
    { value: 'off', label: 'Off' },
    { value: 'on', label: 'On' }
];

export function buildRatingSection({ el, segmented }) {
    const title = () => el('div', { class: 'settings-section-title' }, 'Rating system');
    const section = el('div', { class: 'settings-section appearance', 'data-rating-setting': '' });

    function row(name, hint, key, value) {
        const control = segmented({
            label: name,
            value: value ? 'on' : 'off',
            items: ONOFF,
            onChange: (next) => {
                setRatingSetting(key, next === 'on');
                draw();
                const again = [...section.querySelectorAll('.appearance__row')].find((r) => r.dataset.key === key);
                const checked = again && again.querySelector('[aria-checked="true"]');
                if (checked) checked.focus(); // the section was drawn again: keep the keyboard where it was
            }
        });
        const node = el('div', { class: 'appearance__row' }, el('div', { class: 'appearance__label' }, el('div', { class: 'appearance__title' }, name), el('div', { class: 'appearance__hint' }, hint)), control.el);
        node.dataset.key = key;
        return node;
    }

    function draw() {
        const settings = getRatingSettings();
        const rows = [row('Rating system', 'Give songs 0.5 to 5 stars, in half star steps: in the song list and the song menu, with the playlists Top rated and Not rated kept for you. Off hides all of it and removes those two playlists; your ratings stay saved.', 'enabled', settings.enabled)];
        if (settings.enabled) rows.push(row('Smart Shuffle uses ratings', 'Songs with more stars come up more often. Songs with no rating count as neutral, never as bad.', 'shuffleWeight', settings.shuffleWeight));
        section.replaceChildren(title(), ...rows);
    }

    draw();
    return section;
}
