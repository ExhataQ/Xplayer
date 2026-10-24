// The result of an AI shuffle, shown in the chat and in a notification, with a way to keep it as a playlist.
// The play order itself only changes the queue; "Save as playlist" is a separate plan (create_playlist + add_to_playlist) that goes
// through the same runner, so it has a journal entry and an Undo like every other change.

import { el, textField, openDialog } from '../../components/index.js';
import { describeSongs } from '../../adapter/ai-bridge.js';
import { notify } from '../../shell/notify.js';
import { applyPlan } from './apply-plan.js';

/** The song ids of the plan's play order, or null when the plan has none. */
export function playOrderOf(plan) {
    const action = plan && plan.actions.find((a) => a.type === 'set_play_order');
    return action ? action.args.songs : null;
}

/** A numbered list of the songs, in play order. */
export function songList(ids) {
    const rows = describeSongs(ids);
    return el(
        'ol',
        { class: 'ai-songs', 'aria-label': `${rows.length} songs in play order` },
        ...rows.map((s) => el('li', { class: 'ai-songs__item', dir: 'auto' }, el('span', { class: 'ai-songs__title' }, s.title), s.artist ? el('span', { class: 'ai-songs__artist' }, s.artist) : ''))
    );
}

/** Asks for a name, then saves the songs as a playlist. Resolves true when it was saved. */
export async function saveAsPlaylist(ids, suggested = 'AI shuffle') {
    const name = textField({ label: 'Playlist name', value: suggested, hint: 'If a playlist with this name exists, the songs are added to it.' });
    const saved = await openDialog({
        title: 'Save as playlist',
        body: name.el,
        actions: [
            { label: 'Cancel', value: false },
            {
                label: 'Save',
                variant: 'primary',
                value: true,
                onClick: async () => {
                    const wanted = name.input.value.trim();
                    if (!wanted) throw new Error('Write a name first.');
                    const plan = { summary: `Save "${wanted}" as a playlist`, actions: [{ type: 'create_playlist', args: { name: wanted } }, { type: 'add_to_playlist', args: { playlist: wanted, songs: ids } }] };
                    const result = await applyPlan(plan, plan.summary);
                    if (!result.ok) throw new Error(result.failure ? result.failure.message : 'The playlist could not be saved.');
                }
            }
        ]
    });
    return saved === true;
}

/** The notification after a shuffle: the first songs, and the Save as playlist button. */
export function announceShuffle(ids, title = 'AI shuffle') {
    const rows = describeSongs(ids);
    const first = rows.slice(0, 3).map((s) => s.title).join(', ');
    return notify({
        title: `${title}: playing ${rows.length} song${rows.length === 1 ? '' : 's'}`,
        detail: first ? `Starting with ${first}${rows.length > 3 ? ', …' : ''}.` : '',
        kind: 'success',
        where: 'both',
        action: { label: 'Save as playlist', onClick: () => saveAsPlaylist(ids, title) }
    });
}
