// View registry: the one place that says what a shell view is. The rail, the panel, the history and the router
// (shell/view-router.js) all read the same definitions, so a new view is one object in the VIEWS table of shell/shell.js and
// nothing else has to learn about it. No DOM here: this file is tested in plain Node.
//
// A view definition (every field except `id` and `label` is optional):
//
//   Identity   id, label, icon, note        what the rail button is called, drawn with and what its tooltip says
//   Rail       rail: false                  no rail button (a view opened from somewhere else)
//              end: true                    belongs to the bottom group of the rail
//              solo: true                   a rule is drawn under the button (Home is not a place in the library)
//   Panel      panel: 'library'             the left panel this item owns; a main-view item leaves the panel as it is
//              panelOnly: true              the item only fills the panel, it never becomes the main view
//              hostedBy: 'library'          (panelOnly) which main view shows this item's engine pages
//   Surface    engine: 'all-songs'          the engine page to draw in the view host (its content is moved there, never copied)
//              enginePanel: 'metadata'      the engine right-panel tab to move into the view host
//              songlist, search             attach the song list toolbar / the search field above the engine page
//              own: true, mount(host, o)    the shell draws it itself
//              leave()                      called before another view replaces this one. Return false to stay (unsaved text), or a
//                                           Promise of false/true when the person has to answer first (a dialog). A throw never
//                                           traps the person: the router logs it and goes on.
//   Conditions engineViews: [...]           the engine's own page names that belong to this view: a string, a RegExp or a function
//                                           (name) => boolean. When the engine changes page by itself, the shell follows to the view
//                                           that owns the new page, and the rail marks it.
//              canEnter(ctx)                true | false | { redirect: 'other-id' }. Checked before the view is drawn.
//              reenter: 'keep' | 'rebuild'  what choosing the view you are already on does. Default: 'keep' when the view has a
//                                           leave() (a form with unsaved text must not be rebuilt), otherwise 'rebuild'.
//
// Adding a view: add one line to VIEWS in shell/shell.js. See shell/VIEWS.md.

const FIELDS = new Set(['id', 'label', 'icon', 'note', 'rail', 'end', 'solo', 'panel', 'panelOnly', 'hostedBy', 'engine', 'enginePanel', 'songlist', 'search', 'own', 'mount', 'leave', 'engineViews', 'canEnter', 'reenter']);

const matches = (matcher, name) => {
    if (typeof matcher === 'string') return matcher === name;
    if (matcher instanceof RegExp) return matcher.test(name);
    if (typeof matcher === 'function') return Boolean(matcher(name));
    return false;
};

/** True when a view shows one of the engine's pages in the view host (so the engine changing page is visible there). Metadata only
 *  moves an engine panel tab in: the engine's page behind it is not on screen. */
export const showsEnginePage = (view) => Boolean(view && view.engine);

export function createViewRegistry(definitions) {
    if (!Array.isArray(definitions) || definitions.length === 0) throw new Error('A view registry needs at least one view');
    const byId = new Map();
    for (const definition of definitions) {
        if (!definition || typeof definition.id !== 'string' || definition.id === '') throw new Error('A view needs an id');
        if (byId.has(definition.id)) throw new Error(`Two views have the id "${definition.id}"`);
        if (typeof definition.label !== 'string') throw new Error(`The view "${definition.id}" needs a label`);
        for (const key of Object.keys(definition)) if (!FIELDS.has(key)) throw new Error(`The view "${definition.id}" has an unknown field "${key}"`);
        if (definition.own && typeof definition.mount !== 'function') throw new Error(`The view "${definition.id}" draws itself (own) but has no mount()`);
        if (definition.canEnter !== undefined && typeof definition.canEnter !== 'function') throw new Error(`The view "${definition.id}": canEnter must be a function`);
        if (definition.leave !== undefined && typeof definition.leave !== 'function') throw new Error(`The view "${definition.id}": leave must be a function`);
        if (definition.reenter !== undefined && definition.reenter !== 'keep' && definition.reenter !== 'rebuild') throw new Error(`The view "${definition.id}": reenter must be 'keep' or 'rebuild'`);
        byId.set(definition.id, Object.freeze({ ...definition }));
    }
    const all = [...byId.values()];
    for (const view of all) {
        if (view.hostedBy && !byId.has(view.hostedBy)) throw new Error(`The view "${view.id}" is hosted by "${view.hostedBy}", which does not exist`);
        if (view.panelOnly && !view.hostedBy && view.engineViews) throw new Error(`The view "${view.id}" is panelOnly and claims engine pages, so it needs hostedBy`);
    }
    const fallback = all[0];

    return {
        all: () => all.slice(),
        get: (id) => byId.get(id) || null,
        /** The view to show for an id nobody knows (the first one, as before). */
        fallback,
        /** The views that get a rail button, in order. */
        railItems: () => all.filter((view) => view.rail !== false),
        /** The view that owns the engine's page `name` (it marks the rail), or null. */
        forEngine(name) {
            if (typeof name !== 'string' || name === '') return null;
            return all.find((view) => (view.engineViews || []).some((matcher) => matches(matcher, name))) || null;
        },
        /** The view that must be in the view host to show the engine's page `name`: the owner, or the owner's host for a panel-only item. */
        hostFor(name) {
            const owner = this.forEngine(name);
            if (!owner) return null;
            return owner.panelOnly ? byId.get(owner.hostedBy) || null : owner;
        },
        /** What choosing `view` while it is already shown does. */
        reenter: (view) => view.reenter || (view.leave ? 'keep' : 'rebuild')
    };
}
