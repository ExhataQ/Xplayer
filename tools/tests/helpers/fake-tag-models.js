'use strict';

// In-memory stand-ins for one file's tags, with the semantics tag-rules.js expects (see the header of electron/tag-rules.js).
// They test OUR rules; they cannot prove how the real library behaves (tag-parity.test.js does that, on real files).

function id3Model(frames = [], comments = []) {
    const state = { frames: frames.map((f) => ({ key: f.key, values: [...f.values] })), comments: comments.map((c) => ({ ...c })) };
    const model = {
        state,
        get: (key) => { const f = state.frames.find((x) => x.key === key); return f ? [...f.values] : []; },
        del: (key) => { state.frames = state.frames.filter((x) => x.key !== key); },
        set(key, values) { this.del(key); if (values.length) state.frames.push({ key, values: [...values] }); },
        comments: () => state.comments.map((c) => ({ ...c })),
        removeComment: (desc) => { state.comments = state.comments.filter((c) => c.desc !== desc); },
        addComment: (c) => { state.comments.push({ ...c }); },
        entries: () => [...state.frames.map((f) => ({ key: f.key, values: f.values })), ...state.comments.map((c) => ({ key: `COMM:${c.desc}`, values: [c.text] }))]
    };
    return model;
}

function vorbisModel(map = {}) {
    const state = {};
    for (const [k, v] of Object.entries(map)) state[k.toLowerCase()] = [...v];
    return {
        state,
        get: (key) => [...(state[key.toLowerCase()] || [])],
        set: (key, values) => { state[key.toLowerCase()] = [...values]; },
        del: (key) => { delete state[key.toLowerCase()]; },
        entries: () => Object.entries(state).map(([key, values]) => ({ key, values }))
    };
}

// The same file the Python logic test uses (tools/tests/metadata_backend_logic.py, id3_file()).
function sampleId3() {
    return id3Model([
        { key: 'TIT2', values: ['Old title'] }, { key: 'TPE1', values: ['Earth, Wind & Fire'] }, { key: 'TALB', values: ['Jazz'] },
        { key: 'TCOP', values: ['(c) EMI'] }, { key: 'TPUB', values: ['EMI'] }, { key: 'TENC', values: ['LAME'] },
        { key: 'TRCK', values: ['7/13'] }, { key: 'TEXT', values: ['Freddie'] }, { key: 'TSOT', values: ['Old title, The'] }
    ], [
        { desc: 'iTunNORM', lang: 'eng', text: '0000 00000A 000' },
        { desc: '', lang: 'eng', text: 'my comment' }
    ]);
}

module.exports = { id3Model, vorbisModel, sampleId3 };
