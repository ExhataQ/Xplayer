// Recents panel (tasks PB-02, PB-20): the left panel for the Recents rail item. The last 5 playlists you played, with a Load more
// button for 5 more; the arrow on a row shows the songs of it that were played, and when, each with its cover. Under them, the last
// songs played from anywhere. A song opens through openSong() (its album, or its own page).

import { el, emptyState } from '../../components/index.js';
import { recentPlaylists, recentSongs, whenPlayed } from '../../adapter/panel-lists-bridge.js';
import { engineEvent } from '../../adapter/engine-api.js';
import { songRow, itemRow, toggleButton } from './panel-rows.js';

export const PLAYLIST_STEP = 5;

/** Builds the panel inside `body`. `ctx.open(item)` opens a playlist; `ctx.openSong(id)` opens a song. */
export function mountRecentsPanel(body, ctx) {
    const list = el('div', { class: 'plist-results' });
    const root = el('div', { class: 'plist-panel', 'data-panel-kind': 'recent' }, list);
    body.classList.add('panel-host__body--lists');
    body.append(root);
    const expanded = new Set(); // playlist ids; kept while the panel repaints
    let visible = PLAYLIST_STEP; // how many playlists are shown

    const openSong = (entry) => ctx.openSong(entry.id);

    function playlistBlock(p) {
        const open = expanded.has(p.id);
        const item = { kind: 'playlist', id: p.id, viewId: p.viewId, title: p.title, cover: p.cover, subtitle: `${p.plays.length} of ${p.songCount} played · ${whenPlayed(p.lastPlayed)}` };
        const toggle = toggleButton(`${open ? 'Hide' : 'Show'} songs played from ${p.title}`, open, () => {
            if (expanded.has(p.id)) expanded.delete(p.id);
            else expanded.add(p.id);
            paint();
        });
        const block = el('li', { class: 'plist-block', 'data-open': String(open) }, el('ul', { class: 'plist-list' }, itemRow(item, { onActivate: () => ctx.open(item), trailing: toggle })));
        if (open) block.append(el('ul', { class: 'plist-list plist-list--nested' }, ...p.plays.map((entry) => songRow(entry, { onActivate: openSong, time: whenPlayed(entry.playedAt) }))));
        return block;
    }

    function paint() {
        const playlists = recentPlaylists();
        const songs = recentSongs(20);
        if (!playlists.length && !songs.length) return void list.replaceChildren(emptyState({ icon: 'clock', title: 'Nothing played yet', text: 'Playlists and songs you play will show up here.' }));
        const parts = [];
        if (playlists.length) {
            const shown = playlists.slice(0, visible);
            const section = el('section', { class: 'plist-section' }, el('h3', { class: 'plist-section__title' }, 'Playlists'), el('ul', { class: 'plist-list plist-list--blocks' }, ...shown.map(playlistBlock)));
            if (playlists.length > shown.length) {
                const more = el('button', { type: 'button', class: 'plist-more' }, `Load more (${playlists.length - shown.length} left)`);
                more.addEventListener('click', () => {
                    visible += PLAYLIST_STEP;
                    paint();
                });
                section.append(more);
            }
            parts.push(section);
        }
        if (songs.length) parts.push(el('section', { class: 'plist-section' }, el('h3', { class: 'plist-section__title' }, 'Songs'), el('ul', { class: 'plist-list' }, ...songs.map((s) => songRow(s, { onActivate: openSong, time: whenPlayed(s.playedAt) })))));
        list.replaceChildren(...parts);
    }

    paint();
    let shown = true;
    const refresh = () => shown && paint();
    engineEvent('history:added', refresh);
    engineEvent('playlist:listChanged', refresh);
    return {
        root,
        show() {
            shown = true;
            visible = PLAYLIST_STEP;
            root.hidden = false;
            body.classList.add('panel-host__body--lists');
            paint();
        },
        hide() {
            shown = false;
            root.hidden = true;
            body.classList.remove('panel-host__body--lists');
        }
    };
}
