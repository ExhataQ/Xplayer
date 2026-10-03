// ==============================================================================
// LEGACY BRIDGE
// ==============================================================================
// Two things that let files become modules without breaking the HTML that still calls them
// by name, and let inline on...= handlers be replaced one view at a time. Full guide:
// core/LEGACY.md.
//
//   registerLegacyGlobals({ fn, other })  put names on window so inline handlers and classic
//                                         scripts can still call them
//   registerActions({ fn, other })        name the functions that data-action="fn" may call
//   actionAttrs('fn', [args], options)    build the attribute string for a data-action element
//
// One delegated listener per event type on document runs the actions. It needs only
// `document`, so it works as soon as this file has loaded.

(function () {
    'use strict';

    const IDENTIFIER = /^[A-Za-z_$][\w$]*$/;

    const legacyGlobals = new Set();
    const actions = new Map();

    function assertIdentifier(name, what) {
        if (typeof name !== 'string' || !IDENTIFIER.test(name)) {
            throw new Error(`${what}: "${String(name)}" is not a valid name`);
        }
    }

    // Assign each entry onto window. Registering the same value again is fine; replacing a
    // different value with the same name is refused, because it means a name is defined twice.
    function registerLegacyGlobals(entries) {
        for (const [name, value] of Object.entries(entries)) {
            assertIdentifier(name, 'registerLegacyGlobals');
            if (value === undefined) throw new Error(`registerLegacyGlobals: "${name}" is undefined`);
            if (name in window && window[name] !== value) {
                throw new Error(`registerLegacyGlobals: window.${name} already exists with a different value`);
            }
            window[name] = value;
            legacyGlobals.add(name);
        }
    }

    function registerActions(entries) {
        for (const [name, fn] of Object.entries(entries)) {
            assertIdentifier(name, 'registerActions');
            if (typeof fn !== 'function') throw new Error(`registerActions: "${name}" is not a function`);
            if (actions.has(name) && actions.get(name) !== fn) {
                throw new Error(`registerActions: action "${name}" is already registered with a different function`);
            }
            actions.set(name, fn);
        }
    }

    function legacyGlobalNames() {
        return [...legacyGlobals].sort();
    }

    function registeredActionNames() {
        return [...actions.keys()].sort();
    }

    // Event types handled, with the attribute suffix used for each. Click uses no suffix:
    //   data-action, data-args, data-stop                  (click)
    //   data-action-change, data-args-change, ...          (change)
    // focusout is used for blur because blur does not bubble to document.
    const EVENT_TYPES = {
        click: '',
        dblclick: '-dblclick',
        contextmenu: '-contextmenu',
        mousedown: '-mousedown',
        change: '-change',
        input: '-input',
        keydown: '-keydown',
        focusout: '-blur',
        error: '-error'
    };
    // These do not bubble natively, so only the element that received them is considered.
    const NON_BUBBLING = new Set(['focusout', 'error']);
    const CAPTURING = new Set(['error']);

    // Strings in data-args that stand for something only known at click time.
    function resolveArg(arg, element, event) {
        if (arg === '$this') return element;
        if (arg === '$event') return event;
        if (arg === '$value') return element.value;
        if (arg === '$checked') return element.checked;
        return arg;
    }

    function reportProblem(error) {
        if (typeof window.reportError === 'function') window.reportError(error);
        else console.error(error);
    }

    function runAction(element, suffix, event) {
        const name = element.getAttribute('data-action' + suffix);
        if (!name) return;
        const fn = actions.get(name);
        if (!fn) {
            console.error(`data-action="${name}" has no registered action (use registerActions)`);
            return;
        }
        try {
            const raw = element.getAttribute('data-args' + suffix);
            const args = raw === null ? [] : JSON.parse(raw);
            if (!Array.isArray(args)) throw new Error(`data-args${suffix} must be a JSON array`);
            const result = fn.apply(element, args.map((arg) => resolveArg(arg, element, event)));
            // An inline handler that returns false cancels the default action; keep that.
            if (result === false) event.preventDefault();
        } catch (error) {
            // A failing handler must not stop the elements above it, as with inline handlers.
            reportProblem(error);
        }
    }

    function dispatch(event) {
        const suffix = EVENT_TYPES[event.type];
        if (suffix === undefined) return;
        const path = NON_BUBBLING.has(event.type) ? [event.target] : event.composedPath();
        for (const node of path) {
            if (!(node instanceof Element)) continue;
            runAction(node, suffix, event);
            if (node.hasAttribute('data-stop' + suffix)) event.stopPropagation();
            // cancelBubble turns true once anyone called stopPropagation, even this late.
            if (event.cancelBubble) break;
        }
    }

    for (const type of Object.keys(EVENT_TYPES)) {
        document.addEventListener(type, dispatch, CAPTURING.has(type));
    }

    // Build the attributes for an element:  `<button ${actionAttrs('openArtist', [name])}>`
    // options.event: 'click' (default), 'change', 'input', 'contextmenu', 'dblclick', 'mousedown',
    // 'keydown', 'blur', 'error'.  options.stop: also stop the event reaching elements above.
    function actionAttrs(name, args, options) {
        assertIdentifier(name, 'actionAttrs');
        const eventName = (options && options.event) || 'click';
        const suffix = eventName === 'click' ? '' : '-' + eventName;
        if (eventName !== 'click' && !Object.values(EVENT_TYPES).includes(suffix)) {
            throw new Error(`actionAttrs: unsupported event "${eventName}"`);
        }
        const escape = (text) => text.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
        let out = `data-action${suffix}="${name}"`;
        if (args && args.length) out += ` data-args${suffix}="${escape(JSON.stringify(args))}"`;
        if (options && options.stop) out += ` data-stop${suffix}`;
        return out;
    }

    registerLegacyGlobals({ registerLegacyGlobals, registerActions, actionAttrs, legacyGlobalNames, registeredActionNames });
})();
