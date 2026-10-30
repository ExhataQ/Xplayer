// The model choice as a small pop-over that opens from a button inside the chat box (a list with a search field, free models first).
// The list is the one model-picker.js loads and shares with Settings. Choosing a row saves it as the model for every AI request,
// the same as the drop-down in Settings does, and closes the window.

import { el, iconEl } from '../../components/index.js';
import { setSettings } from '../../adapter/ai-bridge.js';
import { openAiSettings } from '../../shell/ai-slots.js';
import { refreshStatus } from './ai-state.js';
import { explain } from './ai-messages.js';
import { loadModels, cachedModels, AUTO_MODEL } from './model-picker.js';

/** "google/gemma-4-31b-it:free" -> "gemma-4-31b-it"; the automatic choice -> "Auto". */
export function shortModelName(id) {
    if (!id || id === AUTO_MODEL) return 'Auto';
    return String(id).split('/').pop().replace(/:free$/, '');
}

export function createModelPopover() {
    let status = null;
    let open = false;
    let message = '';

    const label = el('span', { class: 'ai-pill__label' });
    const button = el('button', { type: 'button', class: 'ai-pill ai-pill--model', 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, iconEl('cpu', { size: 14 }), label, iconEl('chevron-down', { size: 12 }));
    const search = el('input', { type: 'search', class: 'ai-modelwin__search', placeholder: 'Search models', 'aria-label': 'Search models', autocomplete: 'off', spellcheck: 'false' });
    const list = el('ul', { class: 'ai-modelwin__list', role: 'listbox', 'aria-label': 'Models' });
    const note = el('p', { class: 'ai-modelwin__note', role: 'status' });
    const win = el('div', { class: 'ai-modelwin', role: 'dialog', 'aria-label': 'Choose the model', hidden: true }, el('div', { class: 'ai-modelwin__head' }, el('span', { class: 'ai-modelwin__title' }, 'Model'), search), list, note);

    const current = () => (status && status.model) || AUTO_MODEL;

    function rows() {
        const models = cachedModels() || [];
        const auto = { id: AUTO_MODEL, name: 'Automatic', free: true, hint: 'A free model is picked for you' };
        const all = [auto, ...models.filter((m) => m.id !== AUTO_MODEL)];
        if (!all.some((m) => m.id === current())) all.splice(1, 0, { id: current(), name: current(), free: current().endsWith(':free') });
        const query = search.value.trim().toLowerCase();
        return query ? all.filter((m) => `${m.name} ${m.id}`.toLowerCase().includes(query)) : all;
    }

    function fill() {
        const enabled = Boolean(status && status.hasKey);
        label.textContent = shortModelName(current());
        button.setAttribute('aria-label', `Model: ${shortModelName(current())}. Change the model`);
        if (!open) return;
        if (!enabled) {
            list.replaceChildren(el('li', { class: 'ai-modelwin__empty' }, 'Add your OpenRouter key in Settings to see the models. ', el('button', { type: 'button', class: 'ai-modelwin__link', onclick: () => (close(), openAiSettings()) }, 'Open Settings')));
            note.textContent = '';
            return;
        }
        const shown = rows();
        list.replaceChildren(
            ...(shown.length
                ? shown.map((m) => {
                      const chosen = m.id === current();
                      const tags = [m.hint, m.id === AUTO_MODEL ? '' : m.free ? 'Free' : 'Paid', m.structured === false ? 'may not follow the format' : ''].filter(Boolean).join(' · ');
                      const row = el('button', { type: 'button', class: 'ai-modelwin__row', role: 'option', 'aria-selected': String(chosen), 'data-model': m.id }, el('span', { class: 'ai-modelwin__name' }, m.name), tags ? el('span', { class: 'ai-modelwin__tags' }, tags) : '', chosen ? iconEl('check', { size: 14 }) : '');
                      row.addEventListener('click', () => choose(m.id));
                      return el('li', { role: 'none' }, row);
                  })
                : [el('li', { class: 'ai-modelwin__empty' }, cachedModels() ? 'No model matches.' : 'Loading the models…')])
        );
        note.textContent = message;
    }

    async function choose(id) {
        message = '';
        let saved = null;
        try {
            saved = await setSettings({ model: id });
        } catch (error) {
            saved = null;
        }
        if (!saved || saved.model !== id) {
            message = 'That model could not be chosen.';
            return fill();
        }
        status = saved;
        await refreshStatus();
        close();
    }

    // Clicking anywhere else moves the focus away from the window (and from its button): that closes it.
    function onFocusOut(event) {
        const next = event.relatedTarget;
        if (next && (win.contains(next) || button.contains(next))) return;
        close();
    }
    function onKey(event) {
        if (event.key !== 'Escape') return;
        event.stopPropagation(); // closes this window, not the chat around it
        close();
        button.focus();
    }

    function show() {
        open = true;
        message = '';
        win.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        win.addEventListener('focusout', onFocusOut);
        win.addEventListener('keydown', onKey);
        fill();
        search.focus();
        if (status && status.hasKey && !cachedModels()) {
            loadModels().then((result) => {
                if (!result.ok) message = `Could not load the model list. ${explain(result)}`;
                fill();
            });
        }
    }

    function close() {
        if (!open) return;
        open = false;
        win.hidden = true;
        search.value = '';
        button.setAttribute('aria-expanded', 'false');
        win.removeEventListener('focusout', onFocusOut);
        win.removeEventListener('keydown', onKey);
    }

    button.addEventListener('click', () => (open ? close() : show()));
    button.addEventListener('focusout', (event) => {
        if (open && !(event.relatedTarget && win.contains(event.relatedTarget))) close();
    });
    search.addEventListener('input', fill);
    search.addEventListener('keydown', (event) => {
        if (event.key !== 'Escape') event.stopPropagation(); // typing must not trigger the player's single-key shortcuts; Escape still reaches the window
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            const first = list.querySelector('.ai-modelwin__row');
            if (first) first.focus();
        }
    });
    list.addEventListener('keydown', (event) => {
        const rowsNow = [...list.querySelectorAll('.ai-modelwin__row')];
        const at = rowsNow.indexOf(win.getRootNode().activeElement);
        if (event.key === 'ArrowDown' && at < rowsNow.length - 1) (event.preventDefault(), rowsNow[at + 1].focus());
        else if (event.key === 'ArrowUp') (event.preventDefault(), at > 0 ? rowsNow[at - 1].focus() : search.focus());
    });
    fill();

    return {
        button,
        panel: win,
        close,
        isOpen: () => open,
        /** Call with the AI status whenever it changes. */
        paint(next) {
            status = next || null;
            fill();
        },
        destroy: close
    };
}
