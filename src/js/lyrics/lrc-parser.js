// ==============================================================================
// LRC PARSING
// ==============================================================================
// Turns the text of an .lrc file into timed lines. Pure: no DOM, no state.

export function parseLrcLine(rawLine) {
    const line = String(rawLine).trim();
    if (!line) return null;
    if (/^\[(ti|ar|al|by|re|ve|length|offset):/i.test(line)) return null;

    const timestampRegex = /\[(\d+):(\d+)(?:[.:](\d{1,3}))?\]/g;
    timestampRegex.lastIndex = 0;
    const times = [];
    let m;
    let lastIndex = 0;

    while ((m = timestampRegex.exec(line)) !== null) {
        const minutes = parseInt(m[1], 10);
        const seconds = parseInt(m[2], 10);
        let frac = m[3] || '0';
        if (frac.length === 1) frac = frac + '00';
        else if (frac.length === 2) frac = frac + '0';
        const centis = parseInt(frac, 10);
        times.push(minutes * 60 + seconds + centis / 1000);
        lastIndex = timestampRegex.lastIndex;
    }

    if (times.length === 0) return null;

    const rawText = line.substring(lastIndex).trim();
    const isInstrumentalMarker = /^\[instrumental\]$/i.test(rawText);
    const text = isInstrumentalMarker ? '' : rawText;
    return {
        times: times,
        text: text,
        instrumental: isInstrumentalMarker
    };
}

export function parseLRC(lrcText) {
    if (!lrcText) return null;

    const lines = String(lrcText).replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
    const entries = [];

    for (const rawLine of lines) {
        const parsed = parseLrcLine(rawLine);
        if (!parsed) continue;
        for (const t of parsed.times) {
            entries.push({
                time: t,
                text: parsed.text,
                instrumental: parsed.instrumental
            });
        }
    }

    if (entries.length === 0) return null;

    entries.sort((a, b) => a.time - b.time);
    return entries;
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ parseLrcLine, parseLRC });
}
