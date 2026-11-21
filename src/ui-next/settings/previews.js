// The small pictures drawn in the choice boxes of Settings (kit.js, choice style 'preview'). Static markup, colors from tokens, so they follow the theme.
// Each is 56 x 34. To add a picture for a new option, add its id here and give the option `preview: PREVIEWS.<group>.<id>` in its section file.
const svg = (inner) => `<svg viewBox="0 0 56 34" width="56" height="34" focusable="false">${inner}</svg>`;
const line = (x, y, w, h = 3) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" style="fill:var(--text-tertiary)"/>`;

export const PREVIEWS = {
    openMode: {
        mini: svg('<rect x="19" y="5" width="18" height="24" rx="3" style="fill:none;stroke:var(--text-secondary);stroke-width:1.5"/><rect x="22" y="8" width="12" height="9" rx="1.5" style="fill:var(--accent)"/>' + line(22, 21, 12, 2)),
        quick: svg('<rect x="6" y="9" width="44" height="16" rx="3" style="fill:none;stroke:var(--text-secondary);stroke-width:1.5"/><rect x="10" y="12" width="10" height="10" rx="1.5" style="fill:var(--accent)"/>' + line(24, 14, 20, 2) + line(24, 19, 14, 2)),
        full: svg('<rect x="4" y="3" width="48" height="28" rx="3" style="fill:none;stroke:var(--text-secondary);stroke-width:1.5"/><rect x="7" y="6" width="9" height="22" rx="1.5" style="fill:var(--text-tertiary)"/><rect x="19" y="6" width="30" height="10" rx="1.5" style="fill:var(--accent)"/>' + line(19, 20, 30, 2) + line(19, 24, 22, 2))
    }
};
