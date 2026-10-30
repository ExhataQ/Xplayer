# Views: how the shell shows one, and how to add one

The main area of the window (`.view-host`) shows one view at a time. Three files decide everything about that, so a new view is **one line**
and nothing else has to learn about it:

| File | What it owns |
| --- | --- |
| `shell.js` (`VIEWS`) | The list of views: one object per view. |
| `view-registry.js` | What a view definition may say, checked when the app starts (a typo throws at once, not at the first click). It also answers "which view owns this engine page?". |
| `view-router.js` | The one path every change of view takes: rail, menu, hotkey, notification, Home cards, mouse back/forward, and the engine changing page by itself. |

## Adding a view

Add one line to `VIEWS` in `shell.js`:

```js
{ id: 'stats', label: 'Stats', icon: 'chart', note: 'What you played.', own: true, mount: mountStats, leave: leaveStats }
```

| Field | Meaning |
| --- | --- |
| `id`, `label`, `icon`, `note` | The rail button (and the tooltip). |
| `rail: false` | No rail button: opened from somewhere else (the song page, the AI chat). |
| `end: true`, `solo: true` | Bottom group of the rail; a rule under the button. |
| `panel`, `panelOnly`, `hostedBy` | The left panel the item owns. A `panelOnly` item only fills the panel; `hostedBy` names the main view that shows its engine pages. |
| `engine` / `enginePanel` | An engine page (or engine right-panel tab) to move into the host. |
| `songlist`, `search` | Attach the song list toolbar / the search field above the engine page. |
| `own: true` + `mount(host, options)` | The shell draws it itself. |
| `engineViews: [...]` | The engine's own page names this view shows: a string, a RegExp or `(name) => boolean`. When the engine changes page by itself, the shell follows to the owner, and the rail marks it. **Without it the engine can change page under your view and the toolbar and styles of one view stay over another.** |
| `canEnter(ctx)` | `true`, `false`, or `{ redirect: 'other-id' }`. Checked before anything is drawn (the AI chat sends you to Settings when its screens are missing). |
| `leave()` | Called before another view replaces this one. Return `false` to stay (unsaved text), or a **Promise** of `true`/`false` when the person has to answer first (a dialog). The change they asked for is carried out when the answer is yes. A throw never traps the person. |
| `reenter: 'keep' \| 'rebuild'` | What choosing the view you are on does. Default: `keep` when the view has a `leave()`, `rebuild` otherwise. |

Keep each definition on **one line**: `ui-next-rail-order.test.js` and `ui-next-lyrics-rail-sync.test.js` read this table as text.

## What the shell guarantees (so a view does not have to)

1. **A clean host.** Before a view is drawn, every `data-*` attribute the previous view left on `.view-host` is removed (only `data-view` and the
   engine's own survive). A view may set `host.dataset.something` for its CSS and does not have to clean it up. (`data-lyrics-mode="sync"` used to stay and
   hide the engine's content: Library and Settings came back blank.)
2. **Questions can be answered later.** `leave()` may return a Promise; nothing changes while the question is open, a second choice only replaces
   the target (the person is never asked twice), choosing the view you are on cancels the change.
3. **A bug in one view cannot trap the person.** A `leave()` or `canEnter()` that throws is logged and the change goes on. A view that throws while it
   is drawn is replaced by a plain "could not be shown" page, and choosing it again draws it again.
4. **Changes never nest.** A change asked for while another is being drawn waits until it is done.
5. **The shell follows the engine.** When the engine changes page by itself (the lyrics button, the end of a song, "go to the playing song", its own Back
   button, a click on a Library panel row when the engine was already on that page), the view that owns the new page comes to the front.
6. **Mouse back/forward go through the same router**, so they ask the same questions (a Sync editor with timings asks "Discard Sync?") and wait for the
   answer; a second press while a question is open does nothing.

`router.go(id, options)` returns `'shown'`, `'unavailable'`, `'stayed'`, `'refused'`, `'failed'` or `'queued'` (or a Promise of one while a view asks).
`options.after` runs once the view is shown, also after an answer: use it instead of "show the view, then drive the engine on the next line".

The rules are tested without a browser in `tools/tests/ui-next-view-router.test.js` and in the real shell in `tools/tests/ui-next-view-switching.test.js`.
