// The preview of a plan: what the AI wants to do, in plain lines, shown before anything runs (plan rule 9).
// `preview` comes from electron/ai/actions.js buildPreview: { summary, lines: [{ title, text, changesData }], changesData }.

import { el, iconEl } from '../../components/index.js';

export function planPreview(preview) {
    const root = el('div', { class: 'ai-preview' });
    if (preview.summary) root.append(el('p', { class: 'ai-preview__summary', dir: 'auto' }, preview.summary));
    if (!preview.lines.length) {
        root.append(el('p', { class: 'ai-preview__none' }, 'Nothing to do. The assistant could not do this with the actions it has.'));
        return root;
    }
    root.append(
        el(
            'ol',
            { class: 'ai-preview__list', 'aria-label': 'Planned steps' },
            ...preview.lines.map((line) => el('li', { class: 'ai-preview__item', 'data-changes': String(line.changesData) }, el('span', { class: 'ai-preview__kind' }, line.title), el('span', { class: 'ai-preview__text', dir: 'auto' }, line.text)))
        )
    );
    root.append(
        el(
            'p',
            { class: 'ai-preview__note', 'data-warn': String(preview.changesData) },
            preview.changesData ? iconEl('circle-alert', { size: 14 }) : iconEl('info', { size: 14 }),
            preview.changesData ? 'This changes your library or the tags in your files. You can undo it afterwards.' : 'This does not change your library or your files.'
        )
    );
    return root;
}
