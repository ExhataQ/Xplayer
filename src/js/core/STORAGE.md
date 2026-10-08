# Storage

`core/storage.js` is the only file that touches `localStorage`. It is a classic script loaded first in `src/manifest.json`, because `00-state.js` and `01-sizes.js` read saved values while they load. Keys are the `STORAGE_KEYS` values from `00-state.js`; stored values keep the format they always had, so data saved by older builds loads.

## API (globals)

| Function | Returns |
|---|---|
| `storageRead(key, fallback = null)` | stored string, or `fallback` when the key is missing or storage cannot be read |
| `storageWrite(key, value)` | stores `String(value)`; `true` or `false` |
| `storageRemove(key)` | `true` or `false` |
| `storageReadBool(key, fallback = false)` | `'true'` -> true, `'false'` -> false, else `fallback` |
| `storageWriteBool(key, value)` | stores `'true'` / `'false'`; `true` or `false` |
| `storageReadJson(key, fallback, normalize?)` | parsed value, or `fallback` when missing, empty or invalid JSON; `normalize(parsed)` may repair it (a throw or `undefined` gives `fallback`) |
| `storageWriteJson(key, value)` | stores `JSON.stringify(value)`; `true` or `false` |

Nothing throws. A failed write logs a warning and returns `false`. Reads never change what is stored: a repaired value only reaches storage when the caller saves it.

## Validators (`core/storage-schema.js`, an ES module registered through `registerLegacyGlobals`)

Pass one as the third argument of `storageReadJson`:

| Validator | Use for |
|---|---|
| `normalizeIdList` | favorites, pinned items (strings and numbers kept, everything else dropped) |
| `normalizeStringList` | played-item order, expanded folder keys |
| `normalizeObjectList` | recently played, play history, search history |
| `normalizePlaylists` | playlists: entries need an `id`; `name` and `songs` get defaults |
| `normalizeFolders` | folders: entries need an `id`; `name` and `children` get defaults; children need `id` and `type` |
| `normalizePinnedMap` | pinned items per folder |
| `normalizeSettings(value, defaults)` | settings objects: a key with a default is kept only if it has that default's type |
| `normalizePanelWidths` | `{ left, right }` or `null` |

Modules are not available while classic scripts load, so code that reads at load time (00, 01) checks the value inline.

## Adding a saved value

```js
function getThing() { return storageReadJson(STORAGE_KEYS.THING, [], normalizeIdList); }
function saveThing(list) { storageWriteJson(STORAGE_KEYS.THING, list); }
```

Do not use `localStorage` anywhere else; `tools/tests/storage-core.test.js` fails if a file other than `core/storage.js` does (the files of other agents are listed there until their storage step lands).

## Direct `localStorage` use

None. Every file that used to read or write `localStorage` (`16-context-menu-actions.js`, `05a-lazy-load-main-list.js`, `08f-panel-extended-metadata.js`, `18-lyrics-editor.js`, `08a-panel-layout.js`) now goes through `core/storage.js`, and the `notYet` list in `storage-core.test.js` is empty. Keep it that way: the test fails for any other file that mentions `localStorage`.
