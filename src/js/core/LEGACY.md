# Legacy bridge (`core/legacy.js`)

Two jobs, both so that files can become modules without breaking the HTML that calls them by name:

1. **`registerLegacyGlobals`**: a module puts its public names on `window`, so `onclick="doThing()"` strings and classic scripts keep working.
2. **`data-action`**: replaces the inline `on...=` strings, one view at a time. One listener per event type on `document` runs the action.

`core/legacy.js` loads right after `00b-events.js`, so every later file can call it while it loads. It is covered by `tools/tests/legacy-bridge.test.js` (14 tests; run in Chromium and also checked in Electron 44.5.1).

## API

| Call | What it does |
|---|---|
| `registerActions({ fnA, fnB })` | Names the functions `data-action` may call. The key is the name used in the HTML. Registering the same function twice is fine; a different function under the same name throws. |
| `actionAttrs('fnA', [arg, ...], { event, stop })` | Returns the attribute string for an element: `` `<button ${actionAttrs('openArtist', [name])}>` ``. Escapes quotes, `<`, `>` and `&` for you. Use it whenever an argument comes from data. |
| `registerLegacyGlobals({ fnA, constB })` | Assigns each entry onto `window`. Throws if `window` already has a different value under that name (a name defined twice). Used by a file that has become a module, for names that inline handlers or classic scripts still use. |
| `legacyGlobalNames()` | Sorted list of names registered so far. This is the inventory of what is still bridged; the bridge is finished when nothing needs it. |
| `registeredActionNames()` | Sorted list of registered actions. |

## Writing a data-action by hand

```html
<button data-action="openArtist" data-args='["Daft Punk"]'>Daft Punk</button>
```

- `data-action="name"` runs on **click**. Other events add a suffix to every attribute: `data-action-change`, `data-args-change`, `data-stop-change`. Supported: `click` (no suffix), `dblclick`, `contextmenu`, `mousedown`, `change`, `input`, `keydown`, `blur`, `error`.
- `data-args` is a JSON array of the arguments, in order.
- Strings that stand for something known only at click time: `"$this"` the element, `"$event"` the event, `"$value"` `this.value`, `"$checked"` `this.checked`. (A real value that is exactly one of these four strings cannot be passed; write a small wrapper function.)
- Inside the handler, `this` is the element that has the attribute, as with an inline handler. `window.event` is the current event.
- The handler returning `false` calls `preventDefault()`, as `onclick="...; return false"` did.
- `data-stop` stops the event from reaching `data-action` elements above it. On its own (no `data-action`) it replaces an inline `event.stopPropagation()`.
- A handler that throws is reported in the console and the elements above still run, as with inline handlers.
- An action name that was never registered is a console error (`data-action="x" has no registered action`).

## Converting an inline handler: recipes

| Inline | Converted |
|---|---|
| `onclick="closeFolder()"` | `data-action="closeFolder"` and, once in the file, `registerActions({ closeFolder })` |
| `onclick="openArtist('${name}')"` | `${actionAttrs('openArtist', [name])}` |
| `onclick="syncMiniSeekBy(-5)"` | `data-action="syncMiniSeekBy" data-args="[-5]"` |
| `onclick="removeMetadataValue(this)"` | `data-action="removeMetadataValue" data-args='["$this"]'` |
| `onclick="selectSongItem(this, 3, 'x', 4, event)"` | `data-args='["$this", 3, "x", 4, "$event"]'` |
| `onchange="setX('key', this.checked)"` | `data-action-change="setX" data-args-change='["key", "$checked"]'` |
| `oninput="handleSearch(this.value)"` | `data-action-input="handleSearch" data-args-input='["$value"]'` |
| `onclick="event.stopPropagation()"` | `data-stop` |
| `onclick="event.stopPropagation(); openArtist('x')"` | `data-action="openArtist" data-args='["x"]' data-stop` |
| `oncontextmenu="showMenu(event, 3); return false;"` | `data-action-contextmenu="showMenu" data-args-contextmenu='["$event", 3]'` and make `showMenu` return `false` (or call `event.preventDefault()`) |
| `onerror="this.onerror=null; this.src=X"` | write `useFallbackImage(img)` as a function (it clears the handler and sets `src`) and use `data-action-error="useFallbackImage" data-args-error='["$this"]'` |
| `onclick="a(); b();"` (several statements) | write one small named function that calls both, and register that |
| `onclick="switchView(VIEWS.FAVORITES)"` | write the value: `data-args='["favorites"]'` (look it up in `VIEWS`), or build it with `actionAttrs('switchView', [VIEWS.FAVORITES])` |

## Things that behave differently, so convert carefully

1. **Delegated handlers run last.** They run when the event reaches `document`, after every inline handler on the way up. A converted child inside an **unconverted** parent that has its own inline `onclick` will see the parent's handler run first, and `data-stop` on the child cannot stop it. Convert a nested group (parent and children) in the same patch. Between delegated elements the order is the same as native bubbling: child, then parent.
2. **`event.currentTarget` is `document`**, not the element. Use `this`.
3. **`blur` and `error` do not bubble**, so only the element itself is considered for them.
4. **Names must be written out.** `data-action="${x}"` with a variable is rejected by the test, so the check below can verify every name. Put the variable part in `data-args`.
5. **Handlers must be registered before they are used.** Call `registerActions` in the same file as the function (top level, after the function is defined or declared). A function declaration is hoisted, so `registerActions({ fn })` may be at the top.
6. Elements created by `innerHTML` need nothing extra: the listener is on `document`.

## The guard test

`tools/tests/legacy-bridge.test.js` reads every `src/js` file and `build/music_player.html` and fails if:

- a `data-action...="name"` or `actionAttrs('name')` refers to a name that no `registerActions({...})` call in `src/js` registers, or
- an action name is not a fixed string.

So a typo, or a forgotten `registerActions`, fails the test instead of being a button that does nothing.

## Status

No inline handler has been converted yet; the bridge exists and is tested. About 300 inline handlers remain (`onclick` 247, `onchange` 20, `onmousedown` 13, `oninput` 10, `oncontextmenu` 9, `onerror` 7 plus 5 in the template, `ondblclick` 7, `onkeydown` 3, `onblur` 2). The conversion order and owners are in `.agent/PLAN.md` (B-07, C-04, D-05).
