// Text field: label, hint, error and success messages, search variant with a clear button.
// States: hover, focus (:focus-within), disabled, read-only, error, success.
import { el, iconEl, uid } from './dom.js';
import { iconButton } from './button.js';

/**
 * Returns { el, input, setError(message), setSuccess(message), setHint(text), setDisabled(bool), setValue(text) }.
 * `search: true` adds the search icon, a clear button (also Escape) and type="search".
 * Text typed here can be in any script, so the input uses dir="auto".
 */
export function textField({ label, value = '', placeholder = '', hint = '', type = 'text', multiline = false, search = false, disabled = false, readOnly = false, name, onInput, onSubmit } = {}) {
    if (!label) throw new Error('textField() needs a label (use hideLabel in a later task if it must be invisible)');
    const id = uid('field');
    const messageId = `${id}-message`;
    const input = el(multiline ? 'textarea' : 'input', {
        id,
        class: 'field__input',
        name,
        dir: 'auto',
        placeholder,
        disabled,
        readonly: readOnly,
        'aria-describedby': messageId,
        ...(multiline ? {} : { type: search ? 'search' : type })
    });
    input.value = value;

    const message = el('div', { class: 'field__message', id: messageId, 'aria-live': 'polite' });
    const stateIcon = el('span', { class: 'field__state' });
    const clear = search
        ? iconButton({ icon: 'x', label: 'Clear', size: 'sm', tooltip: false, onClick: () => reset(true) })
        : null;
    if (clear) clear.hidden = !value;
    const control = el('div', { class: 'field__control' }, search ? iconEl('search', { size: 16 }) : '', input, clear, stateIcon);
    const root = el('div', { class: `field${multiline ? ' field--multiline' : ''}`, 'data-state': 'idle' }, el('label', { class: 'field__label', for: id }, label), control, message);
    if (disabled) root.dataset.disabled = 'true';
    if (readOnly) root.dataset.readonly = 'true';

    let hintText = hint;
    const showMessage = (text, iconName) => {
        message.replaceChildren(...(iconName && text ? [iconEl(iconName, { size: 14 })] : []), text ? document.createTextNode(text) : '');
    };
    showMessage(hintText);

    function reset(focus) {
        input.value = '';
        if (clear) clear.hidden = true;
        if (onInput) onInput('');
        if (focus) input.focus();
    }

    input.addEventListener('input', () => {
        if (clear) clear.hidden = !input.value;
        if (root.dataset.state !== 'idle') api.setError('');
        if (onInput) onInput(input.value);
    });
    input.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && search && input.value) {
            event.stopPropagation();
            reset(false);
        } else if (event.key === 'Enter' && !multiline && onSubmit) {
            onSubmit(input.value);
        }
    });

    const api = {
        el: root,
        input,
        /** A non-empty message marks the field invalid. The icon means the state is not shown by color alone. */
        setError(text) {
            root.dataset.state = text ? 'error' : 'idle';
            if (text) input.setAttribute('aria-invalid', 'true');
            else input.removeAttribute('aria-invalid');
            stateIcon.replaceChildren();
            showMessage(text || hintText, text ? 'circle-alert' : '');
        },
        setSuccess(text = '') {
            root.dataset.state = 'success';
            input.removeAttribute('aria-invalid');
            stateIcon.replaceChildren(iconEl('check', { size: 16 }));
            showMessage(text || hintText);
        },
        setHint(text) {
            hintText = text;
            if (root.dataset.state === 'idle') showMessage(text);
        },
        setDisabled(on) {
            input.disabled = on;
            if (on) root.dataset.disabled = 'true';
            else delete root.dataset.disabled;
        },
        setValue(text) {
            input.value = text;
            if (clear) clear.hidden = !text;
        }
    };
    return api;
}
