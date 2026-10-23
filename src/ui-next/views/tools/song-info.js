// Track information pop-up (task PD-09, finding 5; the owner chose to keep the pop-up). Read-only list of the playing song's extra
// tags in groups, with a "Fields" picker that replaces the old Settings toggles.
//
//   openSongInfo()   opens the pop-up for the playing song (says so if nothing is playing). Agent A can call it from a player-bar button.
//   canOpenSongInfo()  true when a song is playing

import { el, openDialog } from '../../components/index.js';
import { infoModel, notify, readTags, setInfoField } from '../../adapter/tag-sheet-bridge.js';
import { groupInfo, pickerGroups } from './song-info-model.js';

export const canOpenSongInfo = () => !!infoModel().song;

export async function openSongInfo() {
    const first = infoModel();
    if (!first.song) {
        notify('Play a song to see its track information.', 'info', 3000);
        return false;
    }
    const body = el('div', { class: 'song-info' });
    let tags = null;
    const draw = () => {
        const { song, fields, settings } = infoModel();
        const groups = groupInfo({ song, tags, fields, settings });
        const picker = el('details', { class: 'song-info__picker' }, el('summary', {}, 'Fields'), el('div', { class: 'song-info__picker-list' },
            pickerGroups(fields).map(({ group, fields: list }) => el('fieldset', {}, el('legend', {}, group), list.map((field) => el('label', {}, el('input', { type: 'checkbox', checked: !!settings[field.key], onchange: (event) => {
                setInfoField(field.key, event.target.checked);
                draw();
                body.querySelector('.song-info__picker')?.setAttribute('open', '');
            } }), field.label))))));
        body.replaceChildren(
            el('p', { class: 'song-info__song' }, song?.title || 'Song'),
            ...(groups.length ? groups.map(({ group, rows }) => el('section', { class: 'song-info__group' }, el('h3', {}, group), rows.map((row) => el('div', { class: 'song-info__row' }, el('span', { class: 'song-info__label' }, row.label), el('span', { class: 'song-info__value' }, row.value))))) : [el('p', { class: 'song-info__empty' }, tags === null ? 'Reading the tags…' : 'No extended metadata available for this track.')]),
            picker);
    };
    draw();
    const shown = openDialog({ title: 'Track information', body, wide: true, actions: [{ label: 'Close', value: true, variant: 'primary' }] });
    const url = first.song.url || first.song.path;
    if (url) {
        readTags(url).then((result) => {
            tags = result?.success ? result.metadata : {};
            if (body.isConnected) draw();
        });
    } else tags = {};
    await shown;
    return true;
}
