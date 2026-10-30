// A drop-down of models, used in the chat box and in Settings, so the model can be changed where the person is working.
// The list is OpenRouter's own (GET /models): free models by default, the ones that follow the reply format best first. It is
// loaded once per session and shared by every picker; Settings can reload it (free only, or all). Choosing one saves it as the
// model for every AI request. Typing any other model name is still possible in Settings.

import { el } from '../../components/index.js';
import { listModels, setSettings } from '../../adapter/ai-bridge.js';
import { refreshStatus } from './ai-state.js';
import { explain } from './ai-messages.js';

const AUTO = 'openrouter/free';
export const AUTO_MODEL = AUTO;
let cache = null; // models loaded this session
let loading = null;
const pickers = new Set(); // repaint functions of the pickers on the page

function announce() {
    for (const repaint of [...pickers]) repaint();
}

/** Loads the list (once, unless `force`). Resolves { ok, models } or { ok: false, error, ... }. */
export function loadModels({ freeOnly = true, force = false } = {}) {
    if (cache && !force) return Promise.resolve({ ok: true, models: cache });
    if (!loading || force) {
        loading = listModels(freeOnly)
            .then((result) => {
                if (result && result.ok) {
                    cache = result.models;
                    announce();
                }
                return result;
            })
            .catch(() => ({ ok: false, error: 'unexpected' }))
            .finally(() => {
                loading = null;
            });
    }
    return loading;
}

/** The models loaded this session, or null before the first load. */
export const cachedModels = () => cache;

export function createModelPicker({ label = 'Model', compact = false } = {}) {
    const id = `ai-model-${Math.random().toString(36).slice(2, 8)}`;
    const select = el('select', { id, class: 'ai-model__select' });
    const message = el('span', { class: 'ai-model__message', role: 'status' });
    const root = el('div', { class: `ai-model${compact ? ' ai-model--compact' : ''}` }, el('label', { class: 'ai-model__label', for: id }, label), select, message);
    let current = AUTO;
    let enabled = true;

    function fill() {
        const models = cache || [];
        const rows = [{ id: AUTO, name: 'Automatic (a free model is picked for you)' }, ...models.filter((m) => m.id !== AUTO)];
        if (!rows.some((m) => m.id === current)) rows.splice(1, 0, { id: current, name: current });
        select.replaceChildren(...rows.map((m) => el('option', { value: m.id }, m.id === AUTO ? m.name : `${m.name}${m.free ? '' : ' (paid)'}${m.structured === false ? ' (may not follow the format)' : ''}`)));
        select.value = current;
        select.disabled = !enabled;
    }

    const repaint = () => (root.isConnected ? fill() : pickers.delete(repaint));
    pickers.add(repaint);

    select.addEventListener('change', async () => {
        message.textContent = '';
        const wanted = select.value;
        let status = null;
        try {
            status = await setSettings({ model: wanted });
        } catch (error) {
            status = null;
        }
        if (!status || status.model !== wanted) {
            message.textContent = 'That model could not be chosen.';
            select.value = current;
            return;
        }
        current = wanted;
        await refreshStatus();
        message.textContent = 'Saved.';
    });

    fill();
    return {
        el: root,
        select,
        /** Call with the AI status whenever it changes. */
        paint(status) {
            current = (status && status.model) || AUTO;
            enabled = Boolean(status && status.hasKey);
            fill();
            message.textContent = enabled ? '' : 'Add your OpenRouter key in Settings to see the models.';
            if (enabled && !cache) {
                loadModels().then((result) => {
                    if (!result.ok) message.textContent = `Could not load the model list. ${explain(result)}`;
                });
            }
        }
    };
}
