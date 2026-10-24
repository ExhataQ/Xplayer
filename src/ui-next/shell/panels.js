// Panel slots (task PA-04): the left panel is one slot, and each panel item on the rail owns what is drawn in it.
//
//   registerPanel(id, { mount(body) -> { show(), hide() }, collapsible? })
//       `id` is the `panel` field of a rail item in shell.js (library, search, recent). `mount` runs once, the first time the item is
//       chosen; `show` and `hide` run each time the panel switches to or away from it. `collapsible: true` gives the panel its
//       collapse arrow and the compact strip (Library only for now, PB-04). `headerAction: { icon, label, onClick }` puts one icon
//       button in the panel header, before the collapse arrow (the Library's plus, PB-06); it is hidden in the compact strip.
//   showPanel(id, body) -> { collapsible, registered, headerAction }   switches the slot to `id`; a panel that was never registered is reported
//       with registered: false, and the shell draws its placeholder note
//   hasPanel(id)
//
// A panel never edits shell.js: it registers itself, and a shell import line (the board lists the request) loads its module.

const specs = new Map();
const live = new Map(); // id -> { show, hide }
let current = null;

export function registerPanel(id, spec) {
    if (!id || typeof spec?.mount !== 'function') throw new Error('registerPanel needs an id and a mount function');
    specs.set(id, spec);
}

export const hasPanel = (id) => specs.has(id);

export function showPanel(id, body) {
    if (current && current !== id) live.get(current)?.hide();
    current = id;
    const spec = specs.get(id);
    if (!spec) return { collapsible: false, registered: false, headerAction: null };
    if (!live.has(id)) live.set(id, spec.mount(body));
    else live.get(id).show();
    return { collapsible: Boolean(spec.collapsible), registered: true, headerAction: spec.headerAction || null };
}

export const currentPanel = () => current;
