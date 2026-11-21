// The page Electron's loading window shows while the library is scanned. Pure strings, no Electron, so a test can read it.
//
// The loading window shows the X mark in a ring, on the Warm Graphite ground, with the amber accent: the same picture as the startup view that follows it
// (src/ui-next/startup). The window cannot read the person's theme (it lives in the page's storage), so it uses the default theme.
// tools/tests/electron/loading-page.test.js compares the colors below with src/ui-next/tokens.css.
//
// The page keeps the ids #progress-fill (a ring of circumference 213.6), #progress-text, #step-title and #step-count, which
// updateLoadingProgress in loading-window.js writes to.

const NEXT_LOOK = Object.freeze({
    ground: '#0e1013', // --c-ground, Warm Graphite
    line: '#242932', // --c-line (the ring's track)
    ink: '#ece9e3', // --c-ink
    inkDim: '#959aa5', // --c-ink-dim
    accent: '#eba43a' // --c-accent
});
// The X mark of src/ui-next/startup/logo.js with its two colors filled in (tokens are not available here).
const xMark = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48" aria-hidden="true"><path d="M11 11 L20 20 M28 28 L37 37" stroke="${NEXT_LOOK.ink}" stroke-width="6" stroke-linecap="round" fill="none"/><path d="M37 11 L11 37" stroke="${NEXT_LOOK.accent}" stroke-width="6" stroke-linecap="round" fill="none"/></svg>`;

function nextPage() {
    return `
        <html>
        <head>
            <meta charset="utf-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">
            <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100vh;
                    background: ${NEXT_LOOK.ground};
                    color: ${NEXT_LOOK.ink};
                    font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, sans-serif;
                    -webkit-app-region: drag;
                    user-select: none;
                }
                .ring { position: relative; width: 80px; height: 80px; margin-bottom: 18px; }
                .ring svg.track { transform: rotate(-90deg); }
                .ring .bg { fill: none; stroke: ${NEXT_LOOK.line}; stroke-width: 3; }
                .ring .fill { fill: none; stroke: ${NEXT_LOOK.accent}; stroke-width: 3; stroke-linecap: round; transition: stroke-dashoffset 0.3s ease; }
                .ring .mark { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); display: flex; }
                .title { font-size: 14px; font-weight: 600; margin-bottom: 4px; }
                .step { display: flex; gap: 8px; font-size: 11px; color: ${NEXT_LOOK.inkDim}; }
            </style>
        </head>
        <body>
            <div class="ring">
                <svg class="track" width="80" height="80" viewBox="0 0 80 80">
                    <circle class="bg" cx="40" cy="40" r="34"/>
                    <circle class="fill" id="progress-fill" cx="40" cy="40" r="34"
                        stroke-dasharray="213.6" stroke-dashoffset="213.6"/>
                </svg>
                <div class="mark">${xMark(34)}</div>
            </div>
            <div class="title" id="step-title">Preparing...</div>
            <div class="step"><span id="progress-text">0%</span><span id="step-count"></span></div>
        </body>
        </html>
    `;
}

/** The HTML of the loading window. */
function loadingPageHtml() {
    return nextPage();
}

/** The loading window's own background (shown before the page paints). */
const loadingBackground = () => NEXT_LOOK.ground;

module.exports = { loadingPageHtml, loadingBackground, NEXT_LOOK };
