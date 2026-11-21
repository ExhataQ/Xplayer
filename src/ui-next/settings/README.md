# Settings: structure and how to add to it

```
section   a page in the left menu           General, Playback, Library, AI, Data
  part    a card on that page               Scrollbar, Transitions, Ratings ...
    row   one setting                       a label and its control
      children   rows that depend on it     the cat's skin, under "Cat scrollbar"
```

| File | What it does |
| --- | --- |
| `registry.js` | The list of sections, parts and rows, and the checks (a typo throws when Settings is built). |
| `kit.js` | Turns a row object into DOM: switch, choice, select, slider, number, action, info, custom. |
| `page.js` | The menu and the open section. Knows no setting by name. |
| `sections/*.js` | One file per section: plain objects. |
| `index.js` | The list of sections to register. |
| `mount.js`, `adopt.js` | Put the page where the engine drew Settings; move the three blocks the engine still owns (equalizer, music folders, download path) into it. |
| `settings.css` | All the styles. Tokens only. |

## Add a setting

Add one object to the `rows` of a part in `sections/<section>.js`:

```js
{ id: 'gapless', type: 'toggle', label: 'Gapless playback', hint: 'Optional, one short line.',
  get: () => audio().gaplessEnabled === true,
  set: (value) => setAudio('gaplessEnabled', value) }
```

Rows that depend on it go in `children` (a toggle shows them while it is on; any row can say `childrenWhen(value)`).
`when()` hides a row, `disabled()` greys it out, `subscribe(cb)` says when the value changes somewhere else.

## Add a card or a page

From any module, before Settings opens:

```js
registerPart('library', { id: 'cache', title: 'Cache', rows: [ ... ] }, { after: 'downloads' });
registerRow('library', 'cache', { ... });
registerSection({ id: 'stats', label: 'Stats', icon: 'folder', order: 35, parts: [ ... ] }); // then add it to the list in index.js
```

Row types and every field are described at the top of `kit.js`. Hints: one short line, or none.
