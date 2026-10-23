'use strict';

// views/tools/song-info-model.js: what the Track information pop-up shows. Run: node --test tools/tests/song-info-model.test.js

const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');

const load = () => import(pathToFileURL(path.join(__dirname, '..', '..', 'src', 'ui-next', 'views', 'tools', 'song-info-model.js')).href);

const FIELDS = [
    { key: 'albumArtist', label: 'Album Artist', group: 'People' },
    { key: 'conductor', label: 'Conductor', group: 'People' },
    { key: 'discNumber', label: 'Disc Number', group: 'Structure' },
    { key: 'label', label: 'Label', group: 'Publishing' },
    { key: 'secret', label: 'Secret', group: 'Misc', hidden: true },
    { key: 'sortTitle', label: 'Sort Title', group: 'Sort' }
];
const ON = { albumArtist: true, conductor: true, discNumber: true, label: true, secret: true, sortTitle: false };

test('groups in the old order, skips empty, switched-off and hidden fields', async () => {
    const { groupInfo } = await load();
    const groups = groupInfo({ song: { albumArtist: 'Artist 0', discNumber: 1, secret: 'x', sortTitle: 'S', conductor: '  ' }, fields: FIELDS, settings: ON });
    assert.deepEqual(groups.map((g) => g.group), ['People', 'Structure']);
    assert.deepEqual(groups[0].rows, [{ key: 'albumArtist', label: 'Album Artist', value: 'Artist 0' }]);
    assert.equal(groups[1].rows[0].value, '1');
});

test('the file\'s tags fill what the library does not hold, and win when both have a value', async () => {
    const { groupInfo } = await load();
    const groups = groupInfo({ song: { albumArtist: 'Old' }, tags: { albumArtist: ['New', 'Other'], conductor: ['J. Smith'], label: 'Example' }, fields: FIELDS, settings: ON });
    const flat = Object.fromEntries(groups.flatMap((g) => g.rows).map((r) => [r.key, r.value]));
    assert.deepEqual(flat, { albumArtist: 'New; Other', conductor: 'J. Smith', label: 'Example' });
});

test('nothing to show gives an empty list; the picker lists every non-hidden field by group', async () => {
    const { groupInfo, pickerGroups } = await load();
    assert.deepEqual(groupInfo({ song: {}, fields: FIELDS, settings: ON }), []);
    assert.deepEqual(pickerGroups(FIELDS).map((g) => [g.group, g.fields.length]), [['People', 2], ['Structure', 1], ['Publishing', 1], ['Sort', 1]]);
});
