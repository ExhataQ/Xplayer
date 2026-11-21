// Library: where the music is, and how it is rated, checked and described.
//   Music folders     (the list is drawn by the engine; settings/adopt.js)
//   Downloads         where Play from URL saves
//   Ratings           the rating system and what depends on it
//   Library health    the page that finds what is worth fixing
//   Song info         which extra tags the Track Info pop-up shows
import { el, button, chip } from '../../components/index.js';
import { engineCall, engineAction, engineEvent } from '../../adapter/engine-api.js';
import { getRatingSettings, setRatingSetting, writeAllRatings } from '../../adapter/ratings-bridge.js';
import { decisions, showSongs, onDuplicatesChanged } from '../../adapter/duplicates-bridge.js';
import { healthInRail, setHealthInRail } from '../../shell/health-rail.js';
import { takeAdopted } from '../adopt.js';

const empty = () => document.createElement('div');

function foldersRow() {
    return { id: 'folders', type: 'custom', render: () => ({ el: takeAdopted('library-folders') || empty() }) };
}

function downloadFolderRow() {
    return {
        id: 'download-folder',
        type: 'custom',
        label: 'Play from URL saves to',
        render: () => {
            const path = takeAdopted('download-path') || el('div', { class: 'settings-url-save-path', id: 'url-save-path-display' }, '—');
            const change = button({ label: 'Change', icon: 'folder', onClick: () => engineAction('changeUrlSaveFolder') });
            const reset = button({ label: 'Reset', variant: 'ghost', onClick: () => engineAction('resetUrlSaveFolder') });
            return { el: el('div', { class: 'sp-pathbox' }, path, el('div', { class: 'sp-actions' }, change, reset)) };
        }
    };
}

const ratingToggle = (id, label, key, hint, children) => ({
    id,
    type: 'toggle',
    label,
    hint,
    get: () => getRatingSettings()[key] === true,
    set: (value) => setRatingSetting(key, value),
    subscribe: (cb) => engineEvent('ratingSettings:changed', cb),
    children
});

const hiddenCount = () => decisions().hidden.length;

// Which extra tags the Track Info pop-up shows, grouped as the engine groups them. Drawn when the page is drawn, because the engine's list is not there before it starts.
function songInfoRow() {
    return {
        id: 'song-info-fields',
        type: 'custom',
        render: () => {
            const fields = Array.isArray(window.EXTENDED_METADATA_FIELDS) ? window.EXTENDED_METADATA_FIELDS.filter((f) => !f.hidden) : [];
            const groups = new Map();
            for (const f of fields) groups.set(f.group, [...(groups.get(f.group) || []), f]);
            const order = ['People', 'Structure', 'Publishing', 'Identifiers', 'Technical', 'Misc', 'Sort'];
            const names = [...groups.keys()].sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
            const saved = () => engineCall('getExtendedMetadataSettings') || {};
            const chips = [];
            const root = el('div', { class: 'sp-fields' });
            for (const name of names) {
                const row = el('div', { class: 'sp-chips', role: 'group', 'aria-label': name });
                for (const f of groups.get(name)) {
                    const node = chip({
                        label: f.label,
                        pressed: saved()[f.key] === true,
                        onClick: () => {
                            const on = node.getAttribute('aria-pressed') !== 'true';
                            node.setAttribute('aria-pressed', String(on));
                            engineAction('toggleExtendedMetadataField', f.key, on);
                        }
                    });
                    chips.push({ node, key: f.key });
                    row.append(node);
                }
                root.append(el('div', { class: 'sp-fieldgroup' }, el('div', { class: 'sp-fieldgroup__name' }, name), row));
            }
            if (!names.length) root.append(el('div', { class: 'sp-row__hint' }, 'Not available here.'));
            return {
                el: root,
                update() {
                    const now = saved();
                    for (const { node, key } of chips) node.setAttribute('aria-pressed', String(now[key] === true));
                }
            };
        }
    };
}

export const library = {
    id: 'library',
    label: 'Library',
    icon: 'folder',
    order: 30,
    parts: [
        { id: 'folders', title: 'Music folders', rows: [foldersRow()] },
        { id: 'downloads', title: 'Downloads', rows: [downloadFolderRow()] },
        {
            id: 'ratings',
            title: 'Ratings',
            rows: [
                ratingToggle('rating-system', 'Rating system', 'enabled', 'Half-star ratings in lists and the song menu. Keys 1 to 5 rate, 0 clears. Off hides them; your ratings stay saved.', [
                    ratingToggle('rating-shuffle', 'Smart Shuffle favors higher ratings', 'shuffleWeight', 'Unrated songs count as neutral.'),
                    ratingToggle('rating-tags', 'Write ratings to file tags', 'writeTags', 'MP3, WAV and AIFF only. Uses the tag editor’s safe write.', [
                        {
                            id: 'rating-write-now',
                            type: 'action',
                            label: 'Write existing ratings now',
                            actions: [
                                {
                                    label: 'Write now',
                                    failed: 'Could not write the ratings',
                                    confirm: { title: 'Write all ratings into the files?', message: 'Every rated MP3, WAV and AIFF song gets its rating saved in the file. A copy is made first and checked after. A big library can take a while; you can keep using the app.', confirmLabel: 'Write ratings' },
                                    run: () => writeAllRatings()
                                }
                            ]
                        }
                    ])
                ])
            ]
        },
        {
            id: 'health',
            title: 'Library health (beta)',
            rows: [
                {
                    id: 'health-open',
                    type: 'action',
                    label: 'Check your library',
                    hint: 'Duplicates, missing tags and covers, broken files.',
                    actions: [{ label: 'Open Library health', icon: 'heart-pulse', run: () => window.dispatchEvent(new CustomEvent('xplayer:open-health')) }]
                },
                {
                    id: 'health-rail',
                    type: 'toggle',
                    label: 'Show in the rail',
                    hint: 'A button below Metadata.',
                    get: healthInRail,
                    set: setHealthInRail,
                    subscribe: (cb) => {
                        window.addEventListener('xplayer:health-rail', cb);
                        return () => window.removeEventListener('xplayer:health-rail', cb);
                    }
                },
                {
                    id: 'health-hidden',
                    type: 'action',
                    label: 'Hidden songs',
                    hint: () => `${hiddenCount()} ${hiddenCount() === 1 ? 'song is' : 'songs are'} hidden from your lists.`,
                    when: () => hiddenCount() > 0,
                    subscribe: (cb) => onDuplicatesChanged(cb),
                    actions: [
                        {
                            label: 'Show all',
                            icon: 'eye',
                            confirm: { title: 'Show all hidden songs?', message: 'They will appear in your lists again.', confirmLabel: 'Show all' },
                            run: () => showSongs()
                        }
                    ]
                }
            ]
        },
        { id: 'song-info', title: 'Song info', hint: 'Extra tags to show under Track Info.', rows: [songInfoRow()] }
    ]
};
