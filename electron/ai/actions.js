// The fixed list of things the AI may ask the app to do (plan PE-03).
//
// The model never writes code. It replies with { summary, actions: [{ type, args }] }; this file
// checks every action against the list below, turns the song numbers it used back into real song
// ids, and builds the preview the person sees before anything runs. Anything not on the list is
// rejected, not guessed at.
//
// `changesData` marks actions that change what the person owns (they need a preview and a journal
// entry so they can be undone). `owner` says which code carries the action out.

const { validate } = require('./schema');

const NAME = { type: 'string', minLength: 1, maxLength: 80 };
const SONG_REFS = { type: 'array', minItems: 1, maxItems: 500, items: { type: 'integer', minimum: 1 } };
const TAG_TEXT = { type: 'string', maxLength: 300 };
// The tag names the engine and the tag writer already use (electron/main.js, library/20-metadata-editor.js).
const TAG_PROPERTIES = {};
for (const f of ['title', 'artist', 'album', 'albumArtist', 'composer', 'genre', 'label', 'publisher', 'comment', 'conductor', 'remixer', 'grouping', 'description', 'mood', 'language', 'isrc', 'producer', 'lyricist', 'writer', 'musicBrainzTrackId', 'musicBrainzAlbumId', 'musicBrainzOriginalAlbumId', 'musicBrainzReleaseGroupId', 'musicBrainzArtistId']) TAG_PROPERTIES[f] = TAG_TEXT;
TAG_PROPERTIES.year = { type: 'integer', minimum: 1000, maximum: 2999 };
for (const f of ['track', 'trackTotal', 'discNumber', 'discTotal']) TAG_PROPERTIES[f] = { type: 'integer', minimum: 1, maximum: 999 };
TAG_PROPERTIES.bpm = { type: 'integer', minimum: 1, maximum: 400 };
TAG_PROPERTIES.compilation = { type: 'boolean' };

const ACTIONS = {
    create_playlist: {
        title: 'Create playlist',
        changesData: true,
        owner: 'library',
        schema: { type: 'object', required: ['name'], additionalProperties: false, properties: { name: NAME } },
        describe: (a) => `Create the playlist "${a.name}"`
    },
    create_folder: {
        title: 'Create folder',
        changesData: true,
        owner: 'library',
        schema: { type: 'object', required: ['name'], additionalProperties: false, properties: { name: NAME } },
        describe: (a) => `Create the folder "${a.name}"`
    },
    add_to_playlist: {
        title: 'Add songs to a playlist',
        changesData: true,
        owner: 'library',
        refs: ['songs'],
        schema: { type: 'object', required: ['playlist', 'songs'], additionalProperties: false, properties: { playlist: NAME, songs: SONG_REFS } },
        describe: (a) => `Add ${a.songs.length} song${a.songs.length === 1 ? '' : 's'} to the playlist "${a.playlist}"`
    },
    remove_from_playlist: {
        title: 'Remove songs from a playlist',
        changesData: true,
        owner: 'library',
        refs: ['songs'],
        schema: { type: 'object', required: ['playlist', 'songs'], additionalProperties: false, properties: { playlist: NAME, songs: SONG_REFS } },
        describe: (a) => `Remove ${a.songs.length} song${a.songs.length === 1 ? '' : 's'} from the playlist "${a.playlist}"`
    },
    put_playlist_in_folder: {
        title: 'Put a playlist in a folder',
        changesData: true,
        owner: 'library',
        schema: { type: 'object', required: ['playlist', 'folder'], additionalProperties: false, properties: { playlist: NAME, folder: NAME } },
        describe: (a) => `Move the playlist "${a.playlist}" into the folder "${a.folder}"`
    },
    set_tags: {
        title: 'Change tags',
        changesData: true,
        owner: 'tags',
        refs: ['songs'],
        schema: {
            type: 'object',
            required: ['songs', 'tags'],
            additionalProperties: false,
            properties: {
                songs: SONG_REFS,
                tags: { type: 'object', additionalProperties: false, properties: TAG_PROPERTIES }
            }
        },
        extra: (a) => (Object.keys(a.tags).length ? [] : ['set_tags needs at least one tag']),
        describe: (a) => `Set ${Object.entries(a.tags).map(([k, v]) => `${k} = ${String(v).slice(0, 60)}`).join(', ')} on ${a.songs.length} song${a.songs.length === 1 ? '' : 's'}`
    },
    player_control: {
        title: 'Control playback',
        changesData: false,
        owner: 'player',
        schema: { type: 'object', required: ['command'], additionalProperties: false, properties: { command: { type: 'string', enum: ['play', 'pause', 'toggle', 'next', 'previous'] } } },
        describe: (a) => ({ play: 'Resume playback', pause: 'Pause playback', toggle: 'Play or pause', next: 'Skip to the next song', previous: 'Go back to the previous song' })[a.command]
    },
    open_panel: {
        title: 'Open a screen',
        changesData: false,
        owner: 'shell',
        schema: { type: 'object', required: ['panel'], additionalProperties: false, properties: { panel: { type: 'string', enum: ['queue', 'library', 'search', 'recents', 'lyrics', 'metadata', 'settings'] } } },
        describe: (a) => `Open ${a.panel === 'queue' ? 'the queue' : `the ${a.panel} screen`}`
    },
    play_next: {
        title: 'Queue songs to play next',
        changesData: false,
        owner: 'player',
        refs: ['songs'],
        schema: { type: 'object', required: ['songs'], additionalProperties: false, properties: { songs: SONG_REFS } },
        describe: (a) => `Play ${a.songs.length} song${a.songs.length === 1 ? '' : 's'} next, after the one playing`
    },
    set_play_order: {
        title: 'Build a play order',
        changesData: false,
        owner: 'player',
        refs: ['songs'],
        schema: { type: 'object', required: ['songs'], additionalProperties: false, properties: { songs: SONG_REFS, reason: { type: 'string', maxLength: 300 } } },
        describe: (a) => `Play ${a.songs.length} song${a.songs.length === 1 ? '' : 's'} in a new order`
    }
};

const MAX_ACTIONS = 500;

// What the model is asked to return. Sent as the response_format schema.
const PLAN_SCHEMA = {
    type: 'object',
    required: ['actions'],
    additionalProperties: false,
    properties: {
        reply: { type: 'string', maxLength: 4000 },
        summary: { type: 'string', maxLength: 500 },
        actions: {
            type: 'array',
            maxItems: MAX_ACTIONS,
            items: {
                type: 'object',
                required: ['type', 'args'],
                additionalProperties: false,
                properties: { type: { type: 'string', enum: Object.keys(ACTIONS) }, args: { type: 'object' } }
            }
        }
    }
};

// Models often wrap JSON in a code fence or add a sentence around it. Take the first {...} block.
function extractJson(text) {
    if (typeof text !== 'string') return null;
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const candidates = [fenced ? fenced[1] : null, text].filter(Boolean);
    for (const candidate of candidates) {
        const start = candidate.indexOf('{');
        const end = candidate.lastIndexOf('}');
        if (start < 0 || end <= start) continue;
        try {
            return JSON.parse(candidate.slice(start, end + 1));
        } catch (e) {
            // Try the next candidate.
        }
    }
    return null;
}

// Checks a model reply. `songMap` maps the numbers the model saw to real song ids (from
// privacy.buildSongTable). Returns { ok:true, plan } or { ok:false, errors }.
function validatePlan(raw, songMap) {
    const data = typeof raw === 'string' ? extractJson(raw) : raw;
    if (!data) return { ok: false, errors: ['The reply is not valid JSON'] };
    const errors = validate(data, PLAN_SCHEMA, 'plan');
    if (errors.length) return { ok: false, errors };

    const actions = [];
    data.actions.forEach((item, i) => {
        const def = ACTIONS[item.type];
        const where = `actions[${i}] (${item.type})`;
        const problems = validate(item.args, def.schema, `${where}.args`);
        if (!problems.length && def.extra) problems.push(...def.extra(item.args).map((m) => `${where}: ${m}`));
        const args = { ...item.args };
        if (!problems.length) {
            for (const field of def.refs || []) {
                const ids = [];
                for (const ref of args[field]) {
                    if (songMap && songMap.has(ref)) ids.push(songMap.get(ref));
                    else problems.push(`${where}: song number ${ref} is not in the list that was sent`);
                }
                args[field] = [...new Set(ids)];
            }
        }
        errors.push(...problems);
        if (!problems.length) actions.push({ type: item.type, args });
    });
    if (errors.length) return { ok: false, errors };
    return { ok: true, plan: { summary: data.summary || '', reply: data.reply || '', actions } };
}

// What the person reads before approving. `titleOf(id)` is optional and names songs.
function buildPreview(plan) {
    const lines = plan.actions.map((a, i) => ({
        index: i,
        type: a.type,
        title: ACTIONS[a.type].title,
        text: ACTIONS[a.type].describe(a.args),
        changesData: ACTIONS[a.type].changesData
    }));
    return {
        summary: plan.summary,
        lines,
        changesData: lines.some((l) => l.changesData),
        counts: lines.reduce((acc, l) => ((acc[l.type] = (acc[l.type] || 0) + 1), acc), {})
    };
}

// Lines for the system prompt, built from the list above so the two cannot drift apart.
function describeActionsForPrompt() {
    return Object.entries(ACTIONS).map(([type, def]) => `- ${type}: ${def.title}. args: ${JSON.stringify(def.schema.properties)}`).join('\n');
}

module.exports = { TAG_PROPERTIES, ACTIONS, PLAN_SCHEMA, MAX_ACTIONS, extractJson, validatePlan, buildPreview, describeActionsForPrompt };
