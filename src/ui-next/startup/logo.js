// Xplayer logo mark (task A-09, approved by the owner: the X). Mark only, no tile and no app name (D8).
// Colors come from tokens, so a theme or accent change recolors it. Drawn on a 48 x 48 grid; stays readable from
// 16 px (title bar menu button) up to 96 px (startup view).
//
// Two crossing strokes: one warm white, one amber (the lamp). Reads as an X and as a play-head crossing a wave.

const MARKS = {
    x: `
        <path d="M11 11 L20 20 M28 28 L37 37" stroke="var(--text-primary)" stroke-width="6" stroke-linecap="round" fill="none"/>
        <path d="M37 11 L11 37" stroke="var(--accent)" stroke-width="6" stroke-linecap="round" fill="none"/>`
};

export const LOGO_NAMES = Object.keys(MARKS);

/** Markup for a logo mark. Pass `label` when the mark stands alone, otherwise it is decorative. */
export function logo(name = 'x', { size = 48, label = '' } = {}) {
    const inner = MARKS[name];
    if (!inner) throw new Error(`Unknown logo: ${name}`);
    const a11y = label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"';
    return `<svg class="logo" xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48" ${a11y}>${inner}</svg>`;
}
