// The first-use screen and the "what is sent" view (task PE-09). The text comes from the main process
// (electron/ai/privacy.js describePolicy), so it always matches what the code really sends.

import { el, openDialog } from '../../components/index.js';
import { describePrivacy, setSettings } from '../../adapter/ai-bridge.js';
import { refreshStatus } from './ai-state.js';

const list = (items) => el('ul', { class: 'ai-privacy__list' }, ...items.map((text) => el('li', {}, text)));

function policyBody(policy) {
    return el(
        'div',
        { class: 'ai-privacy' },
        el('h3', { class: 'ai-privacy__heading' }, 'What is sent'),
        el('ul', { class: 'ai-privacy__list' }, ...policy.tasks.map((t) => el('li', {}, el('strong', {}, `${t.task}: `), t.sends))),
        el('h3', { class: 'ai-privacy__heading' }, 'Never sent'),
        list(policy.neverSent),
        el('h3', { class: 'ai-privacy__heading' }, 'Good to know'),
        list(policy.notes),
        el('h3', { class: 'ai-privacy__heading' }, 'Example of one song, exactly as the AI receives it'),
        el('pre', { class: 'ai-privacy__example', dir: 'ltr' }, policy.example)
    );
}

/** Read-only view, used from Settings. */
export async function showWhatIsSent() {
    const policy = await describePrivacy();
    await openDialog({ title: 'What the AI receives', body: policyBody(policy), wide: true, actions: [{ label: 'Close', value: true, variant: 'primary' }] });
}

/** First-use screen. Resolves true when the person accepted (AI is then on), false otherwise. */
export async function askPrivacy() {
    const policy = await describePrivacy();
    const answer = await openDialog({
        title: 'Before you turn on AI',
        body: policyBody(policy),
        wide: true,
        actions: [
            { label: 'Not now', value: false },
            {
                label: 'I understand, turn it on',
                variant: 'primary',
                value: true,
                onClick: async () => {
                    await setSettings({ privacyAccepted: true, enabled: true });
                    await refreshStatus();
                }
            }
        ]
    });
    return answer === true;
}
