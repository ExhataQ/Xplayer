// The "AI" section of Settings (task PE-09): on/off, the person's own OpenRouter key, the model, what is sent, the free quota,
// and the list of recent AI changes with Undo. Mounted by shell/ai-slots.js through register.js; it draws into `container`.
// The key is never shown again after saving (only its last four characters), and nothing is kept in the page.

import { el, button, chip, textField } from '../../components/index.js';
import { getStatus, setSettings, setKey, clearKey, keyInfo, journalList } from '../../adapter/ai-bridge.js';
import { refreshStatus } from './ai-state.js';
import { askPrivacy, showWhatIsSent } from './privacy-dialog.js';
import { undoById } from './apply-plan.js';
import { explain } from './ai-messages.js';
import { createModelPicker, loadModels } from './model-picker.js';
import { LANGUAGES } from './lyrics-bar.js';

const setLabel = (node, text) => {
    const label = node.querySelector('.btn__label');
    if (label) label.textContent = text;
};

function group(title, ...children) {
    return el('section', { class: 'ai-group' }, el('h3', { class: 'ai-group__title' }, title), ...children);
}

export function buildAiSettings(container, ctx) {
    // ---- on / off
    const toggle = button({
        label: 'Turn on AI',
        pressed: false,
        variant: 'outline',
        onClick: async () => {
            const status = await getStatus();
            if (status.enabled) await setSettings({ enabled: false });
            else if (!status.privacyAccepted) await askPrivacy();
            else await setSettings({ enabled: true });
            await refreshStatus();
        }
    });
    const state = el('p', { class: 'ai-group__text', role: 'status' });

    // ---- key
    const keyField = textField({ label: 'OpenRouter key', type: 'password', placeholder: 'Paste your key here', hint: 'Get a free key at openrouter.ai. It is stored encrypted on this computer and never shown again.' });
    keyField.input.autocomplete = 'off';
    const saveKey = button({
        label: 'Save key',
        variant: 'primary',
        onClick: async () => {
            const result = await setKey(keyField.input.value);
            if (!result.ok) return keyField.setError(explain(result));
            keyField.setValue('');
            await refreshStatus();
        }
    });
    const removeKey = button({
        label: 'Remove key',
        variant: 'outline',
        onClick: async () => {
            await clearKey();
            await refreshStatus();
        }
    });

    // ---- model
    const picker = createModelPicker();
    const modelField = textField({ label: 'Other model name', placeholder: 'openrouter/free', hint: 'Choose a model above, or type any model name from openrouter.ai.' });
    let freeOnly = true;
    const freeChip = chip({
        label: 'Free models only',
        pressed: true,
        onClick: () => {
            freeOnly = !freeOnly;
            freeChip.setAttribute('aria-pressed', String(freeOnly));
        }
    });
    const modelNote = el('p', { class: 'ai-group__text', role: 'status' });
    const reloadModels = button({
        label: 'Load model list',
        onClick: async () => {
            modelNote.textContent = 'Loading…';
            const result = await loadModels({ freeOnly, force: true });
            modelNote.textContent = result.ok ? `${result.models.length} ${freeOnly ? 'free ' : ''}models loaded from OpenRouter. They are in the list above; the ones that follow the reply format best come first.` : explain(result);
        }
    });
    const saveModel = button({
        label: 'Use this model',
        variant: 'primary',
        onClick: async () => {
            const wanted = modelField.input.value.trim();
            const status = await setSettings({ model: wanted });
            if (status.model !== wanted) return modelField.setError('That is not a valid model name.');
            modelField.setSuccess(`Using ${status.model}.`);
            await refreshStatus();
        }
    });

    // ---- default translation language and auto-translate
    const langField = textField({ label: 'Default translation language', placeholder: 'For example: English', hint: 'Used by the Translate button in the lyrics bar and by auto-translate.' });
    const langChips = LANGUAGES.map((name) => chip({ label: name, onClick: () => langField.setValue(name) }));
    const saveLang = button({
        label: 'Save language',
        variant: 'primary',
        onClick: async () => {
            const wanted = langField.input.value.trim();
            const status = await setSettings({ translateLanguage: wanted });
            if (status.translateLanguage !== wanted) return langField.setError('Write the language as a plain name, for example French.');
            langField.setSuccess(wanted ? `Translating into ${wanted}.` : 'No default language.');
            await refreshStatus();
        }
    });
    const autoToggle = button({
        label: 'Translate lyrics automatically',
        variant: 'outline',
        pressed: false,
        onClick: async () => {
            const status = await getStatus();
            if (!status.autoTranslate && !status.translateLanguage) return langField.setError('Choose a default language first.');
            await setSettings({ autoTranslate: !status.autoTranslate });
            await refreshStatus();
        }
    });

    // ---- quota and privacy
    const quotaOut = el('p', { class: 'ai-group__text', role: 'status' });
    const quota = button({
        label: 'Check my limits',
        onClick: async () => {
            const result = await keyInfo();
            if (!result.ok) return quotaOut.replaceChildren(explain(result));
            const info = result.info || {};
            const parts = [];
            const free = info.free_model_daily_requests;
            if (free) parts.push(`free requests today: ${free.used} of ${free.limit} used, ${free.remaining} left (resets at 00:00 UTC)`);
            if (info.usage !== undefined && info.usage !== null) parts.push(`credit used: $${Number(info.usage).toFixed(4)}`);
            if (info.limit_remaining !== undefined && info.limit_remaining !== null) parts.push(`credit left on this key: $${Number(info.limit_remaining).toFixed(2)}`);
            if (typeof info.is_free_tier === 'boolean') parts.push(info.is_free_tier ? 'free tier key' : 'key with purchased credit');
            quotaOut.replaceChildren(parts.length ? parts.join(' · ') : 'OpenRouter did not report any limits for this key.');
        }
    });
    const sent = button({ label: 'See what is sent', onClick: showWhatIsSent });

    // ---- recent changes
    const history = el('ul', { class: 'ai-history', 'aria-label': 'Recent AI changes' });
    async function paintHistory() {
        let entries = [];
        try {
            entries = await journalList();
        } catch (error) {
            entries = [];
        }
        history.replaceChildren(
            ...(entries.length
                ? entries.slice(0, 10).map((e) =>
                      el(
                          'li',
                          { class: 'ai-history__item', 'data-status': e.status },
                          el('span', { class: 'ai-history__text', dir: 'auto' }, `${new Date(e.at).toLocaleString()}: ${e.summary || 'AI change'} (${e.changeCount})`),
                          e.status === 'done'
                              ? button({
                                    label: 'Undo',
                                    size: 'sm',
                                    onClick: async () => {
                                        await undoById(e.id);
                                        await paintHistory();
                                    }
                                })
                              : el('span', { class: 'ai-history__done' }, 'Undone')
                      )
                  )
                : [el('li', { class: 'ai-history__empty' }, 'Nothing yet. Changes the AI makes will be listed here.')])
        );
    }

    function paint(status) {
        if (!status) return; // no answer from the main process (a plain browser, a test stub): leave the section as it is
        const on = Boolean(status.enabled);
        toggle.setAttribute('aria-pressed', String(on));
        setLabel(toggle, on ? 'Turn off AI' : 'Turn on AI');
        state.textContent = on ? 'AI is on.' : status.privacyAccepted ? 'AI is off.' : 'AI is off. Turning it on shows what is sent first.';
        keyField.setHint(status.hasKey ? `A key is saved (ends in ${status.last4}). Paste a new one to replace it.` : 'Get a free key at openrouter.ai. It is stored encrypted on this computer and never shown again.');
        removeKey.disabled = !status.hasKey;
        if (status.encryptionAvailable === false) keyField.setError('This computer cannot store a key safely, so AI cannot be used here.');
        picker.paint(status);
        autoToggle.setAttribute('aria-pressed', String(Boolean(status.autoTranslate)));
        if (!langField.input.matches(':focus')) langField.setValue(status.translateLanguage || '');
        if (!modelField.input.matches(':focus')) modelField.setValue(status.model || '');
    }

    container.append(
        el('p', { class: 'ai-group__text' }, 'An assistant that can build playlists, tidy folders, fix tags, shuffle by mood and translate lyrics. It only suggests; you approve every change and can undo it.'),
        group('Use AI', toggle, state),
        group('Your OpenRouter key', keyField.el, el('div', { class: 'ai-group__row' }, saveKey, removeKey)),
        group('Model', picker.el, modelNote, modelField.el, el('div', { class: 'ai-group__row' }, freeChip, reloadModels, saveModel)),
        group('Lyrics and translation', langField.el, el('div', { class: 'ai-group__row' }, ...langChips), el('div', { class: 'ai-group__row' }, saveLang), autoToggle, el('p', { class: 'ai-group__text' }, 'Auto-translate makes at least one request for every song that starts, so it uses the free daily limit quickly. A translation is saved as an extra version of the lyrics: switch with Original and Translated in the lyrics bar.')),
        group('Limits', quota, quotaOut),
        group('Privacy', el('p', { class: 'ai-group__text' }, 'See exactly what leaves this computer, and what never does.'), sent),
        group('Recent AI changes', history)
    );

    ctx.onStatus((status) => {
        paint(status);
        paintHistory();
    });
    getStatus().then((status) => {
        if (!status) return state.replaceChildren('AI is not available here.');
        paint(status);
        paintHistory();
    }, () => state.replaceChildren('AI is not available here.'));
}
