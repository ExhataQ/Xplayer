// The "AI" section of Settings: on/off, the person's own OpenRouter key, the model, what is sent, the free quota,
// and the list of recent AI changes with Undo. Mounted by settings/sections/ai.js through shell/ai-slots.js; it draws into `container`.
// It is built from the same parts and rows as every other Settings section (settings/kit.js), so it looks and behaves like them.
// The key is never shown again after saving (only its last four characters), and nothing is kept in the page.

import { el, button, openPicker } from '../../components/index.js';
import { createContext, buildPart } from '../../settings/kit.js';
import { getStatus, setSettings, setKey, clearKey, keyInfo, journalList } from '../../adapter/ai-bridge.js';
import { refreshStatus } from './ai-state.js';
import { askPrivacy, showWhatIsSent } from './privacy-dialog.js';
import { undoById } from './apply-plan.js';
import { explain } from './ai-messages.js';
import { createModelPicker, loadModels } from './model-picker.js';
import { LANGUAGES } from './lyrics-bar.js';

const input = (props) => el('input', { class: 'sp-input', dir: 'auto', autocomplete: 'off', ...props });

export function buildAiSettings(container, ctx) {
    let status = ctx.getStatus() || {};
    let freeOnly = true;
    let limits = '';
    const sctx = createContext({
        // The container is not on the page yet while it is being built; it only counts as gone once it has been there and left.
        isLive: (() => {
            let seen = false;
            return () => (container.isConnected ? (seen = true) : !seen);
        })()
    });

    const picker = createModelPicker();

    // ---- rows
    const keyRow = {
        id: 'ai-key',
        type: 'custom',
        label: 'OpenRouter key',
        layout: 'inline',
        hint: () => (status.encryptionAvailable === false ? 'This computer cannot store a key safely, so AI cannot be used here.' : status.hasKey ? `Saved, ends in ${status.last4}. Paste a new one to replace it.` : 'Free at openrouter.ai. Stored encrypted on this computer and never shown again.'),
        render: (_, { note }) => {
            const field = input({ type: 'password', placeholder: 'Paste your key', 'aria-label': 'OpenRouter key' });
            const save = button({
                label: 'Save',
                variant: 'primary',
                onClick: async () => {
                    const result = await setKey(field.value);
                    if (!result.ok) return note(explain(result), 'error');
                    field.value = '';
                    note('Saved');
                    await refreshStatus();
                }
            });
            const remove = button({
                label: 'Remove',
                onClick: async () => {
                    await clearKey();
                    await refreshStatus();
                }
            });
            return { el: el('div', { class: 'sp-inputrow' }, field, save, remove), update: () => (remove.disabled = !status.hasKey) };
        }
    };

    const modelNameRow = {
        id: 'ai-model-name',
        type: 'custom',
        label: 'Other model',
        layout: 'inline',
        hint: 'Any model name from openrouter.ai.',
        render: (_, { note }) => {
            const field = input({ placeholder: 'openrouter/free', 'aria-label': 'Model name' });
            const use = button({
                label: 'Use',
                variant: 'primary',
                onClick: async () => {
                    const wanted = field.value.trim();
                    const next = await setSettings({ model: wanted });
                    if (next.model !== wanted) return note('That is not a valid model name.', 'error');
                    note(`Using ${next.model}`);
                    await refreshStatus();
                }
            });
            return { el: el('div', { class: 'sp-inputrow' }, field, use), update: () => (document.activeElement === field ? undefined : (field.value = status.model || '')) };
        }
    };

    // The default language: a button that opens the same searchable list as "Add to playlist". Pick a common language, or type any name and use it.
    const languageRow = {
        id: 'ai-language',
        type: 'custom',
        label: 'Default language',
        hint: 'Used by Translate in the lyrics bar and by auto-translate.',
        layout: 'inline',
        render: (_, { note }) => {
            const choose = button({ label: 'Choose language', variant: 'outline' });
            const save = async (wanted) => {
                const next = await setSettings({ translateLanguage: wanted });
                if (next.translateLanguage !== wanted) return note('Write the language as a plain name, for example French.', 'error');
                note(wanted ? `Translating into ${wanted}` : 'No default language');
                await refreshStatus();
            };
            choose.addEventListener('click', () => {
                const current = status.translateLanguage || '';
                openPicker({
                    rect: choose.getBoundingClientRect(),
                    below: true,
                    width: 280,
                    label: 'Languages',
                    placeholder: 'Search or type a language',
                    items: (query) => {
                        const q = query.trim().toLowerCase();
                        return LANGUAGES.map((name) => ({ id: name, label: name, mark: name === current, at: name.toLowerCase().indexOf(q) }))
                            .filter((row) => !q || row.at >= 0)
                            .map(({ at, ...row }) => (q ? { ...row, match: [at, at + q.length] } : row));
                    },
                    actions: (query) => {
                        const typed = query.trim();
                        const rows = [];
                        if (typed && !LANGUAGES.some((name) => name.toLowerCase() === typed.toLowerCase())) rows.push({ id: 'custom', label: `Use “${typed}”`, icon: 'plus' });
                        if (current && !typed) rows.push({ id: 'none', label: 'No default language', icon: 'x' });
                        return rows;
                    },
                    empty: () => 'Type a language name',
                    onPick: (row, query) => {
                        save(row.id === 'custom' ? query.trim() : row.id === 'none' ? '' : row.id);
                    }
                });
            });
            return { el: choose, update: () => (choose.querySelector('.btn__label').textContent = status.translateLanguage || 'Choose language') };
        }
    };

    const history = el('ul', { class: 'ai-history', 'aria-label': 'Recent AI changes' });
    async function paintHistory() {
        let entries = [];
        try {
            entries = await journalList();
        } catch (_) {
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
                : [el('li', { class: 'ai-history__empty' }, 'Nothing yet.')])
        );
    }

    const parts = [
        {
            id: 'ai-assistant',
            title: 'Assistant',
            hint: 'Builds playlists, fixes tags, shuffles by mood and translates lyrics. You approve every change and can undo it.',
            rows: [
                {
                    id: 'ai-enabled',
                    type: 'toggle',
                    label: 'Use AI',
                    hint: () => (!status.enabled && !status.privacyAccepted ? 'Turning it on shows what is sent first.' : ''),
                    get: () => Boolean(status.enabled),
                    set: async () => {
                        const now = await getStatus();
                        if (now.enabled) await setSettings({ enabled: false });
                        else if (!now.privacyAccepted) await askPrivacy();
                        else await setSettings({ enabled: true });
                        await refreshStatus();
                    }
                }
            ]
        },
        { id: 'ai-connection', title: 'Connection', rows: [keyRow] },
        {
            id: 'ai-model',
            title: 'Model',
            rows: [
                {
                    id: 'ai-model-picker',
                    type: 'custom',
                    render: () => ({ el: picker.el, update: () => picker.paint(status) })
                },
                {
                    id: 'ai-free-only',
                    type: 'toggle',
                    label: 'Free models only',
                    get: () => freeOnly,
                    set: (value) => (freeOnly = value)
                },
                {
                    id: 'ai-model-list',
                    type: 'action',
                    label: 'Model list',
                    actions: [
                        {
                            label: 'Load list',
                            run: async () => {
                                const result = await loadModels({ freeOnly, force: true });
                                return result.ok ? `${result.models.length} ${freeOnly ? 'free ' : ''}models loaded` : explain(result);
                            }
                        }
                    ]
                },
                modelNameRow
            ]
        },
        {
            id: 'ai-translation',
            title: 'Translation',
            rows: [
                languageRow,
                {
                    id: 'ai-auto-translate',
                    type: 'toggle',
                    label: 'Translate lyrics automatically',
                    hint: () => (!status.translateLanguage && !status.autoTranslate ? 'Choose a default language first.' : 'At least one request per song, so the free daily limit goes fast. Translations are saved as extra versions of the lyrics.'),
                    disabled: () => !status.translateLanguage && !status.autoTranslate,
                    get: () => Boolean(status.autoTranslate),
                    set: async (value) => {
                        await setSettings({ autoTranslate: value });
                        await refreshStatus();
                    }
                }
            ]
        },
        {
            id: 'ai-usage',
            title: 'Usage and privacy',
            rows: [
                {
                    id: 'ai-limits',
                    type: 'action',
                    label: 'Your limits',
                    hint: () => limits,
                    actions: [
                        {
                            label: 'Check',
                            run: async () => {
                                const result = await keyInfo();
                                if (!result.ok) {
                                    limits = explain(result);
                                } else {
                                    const info = result.info || {};
                                    const parts = [];
                                    const free = info.free_model_daily_requests;
                                    if (free) parts.push(`free requests today: ${free.used} of ${free.limit} used (resets at 00:00 UTC)`);
                                    if (info.usage !== undefined && info.usage !== null) parts.push(`credit used: $${Number(info.usage).toFixed(4)}`);
                                    if (info.limit_remaining !== undefined && info.limit_remaining !== null) parts.push(`credit left: $${Number(info.limit_remaining).toFixed(2)}`);
                                    if (typeof info.is_free_tier === 'boolean') parts.push(info.is_free_tier ? 'free tier key' : 'key with purchased credit');
                                    limits = parts.length ? parts.join(' · ') : 'OpenRouter reported no limits for this key.';
                                }
                                sctx.refresh();
                            }
                        }
                    ]
                },
                { id: 'ai-privacy', type: 'action', label: 'What is sent', hint: 'What leaves this computer, and what never does.', actions: [{ label: 'See details', run: () => showWhatIsSent() }] }
            ]
        },
        { id: 'ai-history', title: 'Recent changes', rows: [{ id: 'ai-history-list', type: 'custom', render: () => ({ el: history }) }] }
    ];

    for (const part of parts) container.append(buildPart(part, sctx).el);

    const changed = (next) => {
        if (!next) return; // no answer from the main process (a plain browser, a test stub): leave the section as it is
        status = next;
        sctx.refresh();
    };
    ctx.onStatus((next) => {
        changed(next);
        paintHistory();
    });
    // What the page calls when the section is torn down (shell/ai-slots.js mountAiSettings): the model picker and the rows leave the shared lists.
    const handle = {
        destroy() {
            picker.destroy();
            sctx.destroy();
        }
    };
    getStatus().then(
        (next) => {
            if (!next) return;
            changed(next);
            paintHistory();
        },
        () => container.prepend(el('p', { class: 'sp-row__hint' }, 'AI is not available here.'))
    );
    return handle;
}
