// A few blocks of Settings are still drawn by the engine (the equalizer's ten sliders, the list of music folders, the path of the download
// folder): the engine keeps them in step with its own state, by element id. The new page does not redraw them; it moves the engine's own
// elements into its layout and styles them to match (settings/settings.css, under .sp). settings/mount.js hands them over here each time
// the engine draws the page; a row asks for one by name.
const nodes = new Map();

export function setAdopted(name, node) {
    if (node) nodes.set(name, node);
    else nodes.delete(name);
}

/** The engine's element for `name`, or null when the engine has not drawn it (a plain browser, a test). */
export const takeAdopted = (name) => nodes.get(name) || null;

export function clearAdopted() {
    nodes.clear();
}
