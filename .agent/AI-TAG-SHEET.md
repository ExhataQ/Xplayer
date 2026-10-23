# Tag sheet: guide for the AI (Agent E)

The tag sheet is the "Many songs" screen in Metadata. It is a table: rows are songs, columns are tags. The AI works on the very same sheet the person sees, through `tagSheetApi` in `src/ui-next/views/tools/tag-sheet-actions.js`. Everything the AI changes shows up on screen at once.

## Rules
1. Every call returns plain data `{ ok, ... }` and never throws. `{ ok: false, error }` says what to fix.
2. The AI never writes to a file by itself. `requestApply()` opens the review for the person, who presses Apply or Cancel. The answer comes back to the AI.
3. Edits are staged first. Call `preview()` and tell the person what will change before `requestApply()`.
4. `add` is the default mode and keeps old values. `replace` and `remove` must be asked for.
5. Removing a row only takes the song out of the sheet. Files are never deleted.

## Typical use ("put Pop on every song of the Gym playlist that has no genre")
```js
const a = tagSheetApi;
a.listSources();                         // find the playlist id
a.loadSongs('playlist-p123');
a.setColumns(['title', 'artist', 'genre']);
await a.readTags();                      // reads tags the library does not hold
const none = a.getSheet({ limit: 500 }).rows.filter((r) => r.values.genre?.length === 0).map((r) => r.id);
a.checkRows(none);
a.applyTag({ column: 'genre', value: 'Pop' });   // mode 'add'
a.preview();                             // show the person what changes
await a.requestApply();                  // the person reviews and applies
```

## Calls
`listSources()`, `listColumns()`, `loadSongs(sourceId)`, `setColumns(keys)`, `readTags()`, `getSheet({ offset, limit })`, `findRows({ column, text })`, `checkRows(ids)`, `checkAll()`, `uncheckAll()`, `removeRows(ids)`, `setCell({ id, key, value })`, `applyTag({ column, value, mode, ids })`, `preview()`, `discardChanges()`, `requestApply()`, `undoLast()`. The comment at the top of the file lists what each returns.

## Limits
- Multi-value tags (artist, genre, composer...) are separated by `;`. A comma never splits a name.
- `requestApply()` only works while the sheet is open (Metadata, Many songs). Otherwise it says so.
- Undo covers the last apply only and is kept until the app closes.
- Not connected to any chat or model yet: wiring the AI to `tagSheetApi` is Agent E's task.
