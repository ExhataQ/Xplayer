// The find control of the Library panel, in the old screen's way: a search button that opens into a field, and shuts again when it is empty
// and loses focus. Better than the old one: the field grows to fill the row (the old one was a fixed 150 px), Escape clears and then closes,
// and the clear button keeps focus in the field.
import { el, iconEl, iconButton } from '../../components/index.js';
import { growWidth } from '../../components/reveal.js';

const SELF_CLOSE_DELAY = 120; // lets a click on the clear button land before the blur decides to close

/**
 * { label, placeholder, onInput(text) }. Returns { el, input, open(), close(), clear(), value() }.
 * `data-open` on the root is 'true' while the field is shown.
 */
export function panelSearch({ label = 'Find', placeholder = 'Find', onInput } = {}) {
    const button = iconButton({ icon: 'search', label, size: 'sm', tooltip: false, className: 'panel-search__button' });
    const input = el('input', { class: 'panel-search__input', type: 'search', placeholder, 'aria-label': label, autocomplete: 'off', spellcheck: 'false', tabindex: '-1' });
    const clear = iconButton({ icon: 'x', label: 'Clear', size: 'sm', tooltip: false, className: 'panel-search__clear' });
    clear.hidden = true;
    const field = el('div', { class: 'panel-search__field' }, el('div', { class: 'panel-search__inner' }, input, clear));
    const root = el('div', { class: 'panel-search', 'data-open': 'false' }, button, field);
    button.setAttribute('aria-expanded', 'false');

    const isOpen = () => root.dataset.open === 'true';
    const setOpen = (on) => {
        // The box grows from the button's width to the row (or back): measured before and after the change, animated in between.
        const before = on !== isOpen() ? root.getBoundingClientRect().width : NaN;
        root.dataset.open = String(on);
        button.setAttribute('aria-expanded', String(on));
        input.tabIndex = on ? 0 : -1;
        if (!Number.isNaN(before)) growWidth(root, before, { flex: true });
    };
    const sync = () => {
        clear.hidden = input.value === '';
        if (onInput) onInput(input.value);
    };
    function open() {
        setOpen(true);
        input.focus();
    }
    function close() {
        if (input.value !== '') return; // a search that is still in use stays visible
        setOpen(false);
    }

    button.addEventListener('click', () => (isOpen() && input.value === '' ? (input.focus(), undefined) : open()));
    input.addEventListener('input', sync);
    input.addEventListener('focus', () => setOpen(true));
    input.addEventListener('blur', () => setTimeout(() => !root.contains(document.activeElement) && close(), SELF_CLOSE_DELAY));
    clear.addEventListener('click', () => {
        input.value = '';
        sync();
        input.focus();
    });
    input.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        if (input.value) {
            input.value = '';
            sync();
        } else {
            setOpen(false);
            input.blur();
            button.focus();
        }
    });

    return {
        el: root,
        input,
        open,
        close,
        clear() {
            input.value = '';
            sync();
        },
        value: () => input.value
    };
}
