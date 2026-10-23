// Track information pop-up, the logic (task PD-09, finding 5). No DOM, no engine: which extended tags to show for a song, grouped.
// Same groups and order as the old "Track Information" window; the old window read only what the library holds, this one also uses
// the file's tags when the library has none (the library does not keep conductor, label, ISRC and the like).

export const GROUP_ORDER = ['People', 'Structure', 'Publishing', 'Identifiers', 'Technical', 'Misc', 'Sort'];

const asText = (value) => (Array.isArray(value) ? value.join('; ') : String(value ?? '')).trim();

/** fields: [{ key, label, group, hidden }]; settings: { [key]: boolean }; song: library song; tags: the file's tags or null.
 *  Returns [{ group, rows: [{ key, label, value }] }] without empty values, switched-off fields and hidden fields. */
export function groupInfo({ song, tags = null, fields = [], settings = {} }) {
    const groups = new Map();
    for (const field of fields) {
        if (field.hidden || !settings[field.key]) continue;
        const value = asText(tags && asText(tags[field.key]) ? tags[field.key] : song?.[field.key]);
        if (!value) continue;
        if (!groups.has(field.group)) groups.set(field.group, []);
        groups.get(field.group).push({ key: field.key, label: field.label, value });
    }
    const known = GROUP_ORDER.filter((group) => groups.has(group));
    const other = [...groups.keys()].filter((group) => !GROUP_ORDER.includes(group));
    return [...known, ...other].map((group) => ({ group, rows: groups.get(group) }));
}

/** The fields the person can switch on or off, by group, in the same order. */
export function pickerGroups(fields = []) {
    const groups = new Map();
    for (const field of fields) {
        if (field.hidden) continue;
        if (!groups.has(field.group)) groups.set(field.group, []);
        groups.get(field.group).push(field);
    }
    return [...GROUP_ORDER.filter((g) => groups.has(g)), ...[...groups.keys()].filter((g) => !GROUP_ORDER.includes(g))].map((group) => ({ group, fields: groups.get(group) }));
}
