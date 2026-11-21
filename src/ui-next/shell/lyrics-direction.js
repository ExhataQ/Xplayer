// Which way a song's lyrics run. A line that has no letters (a blank line, the note that marks an instrumental part, a line of digits or dots)
// has nothing to choose a direction from, so dir="auto" gave it the page's own direction: left, in a Persian song, between lines on the right.
// The direction is chosen once for the whole song instead, from the letters in all of its lines, and every line gets it.
//
//   textDirection(text)          'rtl', 'ltr', or null when the text has no letters
//   dominantDirection(texts)     the direction most of the letters in the lines run: 'rtl' or 'ltr'; null when there are no letters at all
//
// A line in the other script keeps its own text order inside its line (the line's words are wrapped in <bdi>, which isolates them), and sits on
// the song's side.

// Hebrew, Arabic and its supplements and presentation forms, Syriac, Thaana, N'Ko: the scripts that run right to left.
const RTL_LETTER = /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u07C0-\u07FF\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
const LETTER = /\p{L}/u;

function counts(text) {
    let rtl = 0;
    let ltr = 0;
    for (const ch of String(text ?? '')) {
        if (RTL_LETTER.test(ch) && LETTER.test(ch)) rtl += 1;
        else if (LETTER.test(ch)) ltr += 1;
    }
    return { rtl, ltr };
}

export function textDirection(text) {
    const { rtl, ltr } = counts(text);
    if (!rtl && !ltr) return null;
    return rtl > ltr ? 'rtl' : 'ltr';
}

export function dominantDirection(texts) {
    let rtl = 0;
    let ltr = 0;
    for (const text of texts || []) {
        const c = counts(text);
        rtl += c.rtl;
        ltr += c.ltr;
    }
    if (!rtl && !ltr) return null;
    return rtl > ltr ? 'rtl' : 'ltr';
}
