// A horizontal slider drawn like the bars of the player bar in the full app (views/playback, shell.css): a 4px track, a fill that turns to the accent
// under the pointer, a knob that shows on hover, and (with `preview`) the shared tooltip look above the pointer saying where a click would land.
// The light window is its own small page and does not load the shell's CSS, so the bar is built here; light.css styles .lp-slider with the same
// numbers. (The vertical volume bar is not here: it is components/volume-pop.js, the one the full app uses too.)
//
//   const bar = createSlider(element, { label, onInput, onChange, keyStep, valueText, preview })
//   bar.set(0.4)        move the fill (ignored while the person is dragging it)
//   bar.setDisabled(true)
//
// Values are fractions from 0 to 1. onInput runs on every step of a drag or key press, onChange when a drag ends or a key is pressed.
// `preview(fraction)` gives the text of the hover label (nothing: no label).

const clamp = (value) => Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0));

export function createSlider(element, { label = '', onInput = null, onChange = null, keyStep = 0.05, valueText = null, preview = null } = {}) {
    element.classList.add('lp-slider');
    element.setAttribute('role', 'slider');
    element.setAttribute('aria-label', label);
    element.setAttribute('aria-valuemin', '0');
    element.setAttribute('aria-valuemax', '100');
    element.tabIndex = 0;
    const fill = document.createElement('div');
    fill.className = 'lp-slider__fill';
    const knob = document.createElement('div');
    knob.className = 'lp-slider__knob';
    const tip = document.createElement('div');
    tip.className = 'lp-slider__tip';
    tip.setAttribute('aria-hidden', 'true');
    element.replaceChildren(fill, knob, ...(preview ? [tip] : []));

    let value = 0;
    let dragging = false;

    function paint() {
        const percent = value * 100;
        element.style.setProperty('--lp-value', `${percent}%`);
        element.setAttribute('aria-valuenow', String(Math.round(percent)));
        if (typeof valueText === 'function') element.setAttribute('aria-valuetext', valueText(value));
    }

    const fractionAt = (event) => {
        const box = element.getBoundingClientRect();
        return box.width > 0 ? clamp((event.clientX - box.left) / box.width) : 0;
    };

    // The label above the pointer: where it is, and what a click there would be
    function showTip(fraction) {
        if (!preview) return;
        element.style.setProperty('--lp-hover', `${fraction * 100}%`);
        tip.textContent = preview(fraction);
        element.classList.add('hovering');
    }

    function move(next) {
        value = clamp(next);
        paint();
        if (dragging) showTip(value);
        if (onInput) onInput(value);
    }

    element.addEventListener('pointerdown', (event) => {
        if (element.getAttribute('aria-disabled') === 'true' || event.button !== 0) return;
        dragging = true;
        element.classList.add('dragging');
        element.setPointerCapture(event.pointerId);
        move(fractionAt(event));
    });
    element.addEventListener('pointermove', (event) => {
        if (dragging) move(fractionAt(event));
        else if (preview && element.getAttribute('aria-disabled') !== 'true') showTip(fractionAt(event));
    });
    element.addEventListener('pointerleave', () => {
        if (!dragging) element.classList.remove('hovering');
    });
    const stop = () => {
        if (!dragging) return;
        dragging = false;
        element.classList.remove('dragging', 'hovering');
        if (onChange) onChange(value);
    };
    element.addEventListener('pointerup', stop);
    element.addEventListener('pointercancel', stop);

    element.addEventListener('keydown', (event) => {
        if (element.getAttribute('aria-disabled') === 'true' || event.ctrlKey || event.metaKey || event.altKey) return;
        const step = typeof keyStep === 'function' ? keyStep() : keyStep;
        const targets = { ArrowLeft: value - step, ArrowDown: value - step, ArrowRight: value + step, ArrowUp: value + step, PageDown: value - step * 2, PageUp: value + step * 2, Home: 0, End: 1 };
        if (!(event.key in targets)) return;
        event.preventDefault();
        move(targets[event.key]);
        if (onChange) onChange(value);
    });

    paint();
    return {
        element,
        set(next) {
            if (!dragging) {
                value = clamp(next);
                paint();
            }
        },
        get: () => value,
        isDragging: () => dragging,
        setDisabled(disabled) {
            element.setAttribute('aria-disabled', String(disabled));
            element.tabIndex = disabled ? -1 : 0;
        }
    };
}
