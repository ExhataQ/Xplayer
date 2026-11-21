// AI: the section exists only once views/ai has registered its settings (shell/ai-slots.js). It brings its own cards.
import { el } from '../../components/index.js';
import { aiSettingsAvailable, mountAiSettings } from '../../shell/ai-slots.js';

export const ai = {
    id: 'ai',
    label: 'AI',
    icon: 'sparkles',
    order: 40,
    available: aiSettingsAvailable,
    parts: [
        {
            id: 'ai',
            title: 'AI',
            render: () => {
                const body = el('div', { class: 'ai-settings__body' });
                const root = el('div', { class: 'ai-settings', 'data-ai-settings': '' }, body);
                const mounted = mountAiSettings(body, root);
                return { el: root, destroy: () => mounted && mounted.destroy() }; // the page calls destroy() when it closes (settings/kit.js)
            }
        }
    ]
};
