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
    // An instrumental break is written "[instrumental]", "(instrumental)" or as music notes alone (the Sync editor writes a note): all of them
    // read as an instrumental line with no words. A line that only starts with the word ("instrumental break") is just text.
    const isInstrumentalMarker = /^\[instrumental\]$/i.test(rawText) || /^[\s\u266a\u266b\u266c\u{1F3B5}\u{1F3B6}]+$/u.test(rawText) || /^[\s\u266a\u266b\u266c\u{1F3B5}\u{1F3B6}]*[([]instrumental[)\]][\s\u266a\u266b\u266c\u{1F3B5}\u{1F3B6}]*$/iu.test(rawText);
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

/** True when pasted text is LRC: at least two timed lines ("[00:12.30] words"). One stray timestamp stays plain text. */
export function looksLikeLrc(text) {
    const entries = parseLRC(text);
    return Boolean(entries && entries.length >= 2);
}

if (typeof registerLegacyGlobals === 'function') {
    registerLegacyGlobals({ parseLrcLine, parseLRC, looksLikeLrc });
}
