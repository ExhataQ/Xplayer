# Agent C, patch 0002: EB-C2 settings panel (`08e`)

Apply after C-0001. No app code changed: only `tools/event-allowlist.json`, `tools/change.log.txt` and this report.

## Judgment, call by call
All 11 audit hits in `08e-panel-settings.js` were read in context.

| Function in `08e` | Calls | Verdict | Why |
|---|---|---|---|
| `openSettingsPanel` | `setSubheroVisibility`, `updateActiveHighlight(null)` | view entry | Sets up the settings view the user just opened, next to `showHeroSection(false)`, `resetLeftPanelActiveState()`, `pushViewToHistory` (all already allowlisted navigation) |
| `enterSettingsFromHistory` | `setSubheroVisibility`, `updateHeroCover` | view entry | Same block, reached from the History view |
| `enterAdvancedSettingsFromHistory` | `setSubheroVisibility`, `updateHeroCover` | view entry | Same, for Advanced settings |
| `toggleSettingsPanel` | `clearAllSelections`, `setSubheroVisibility`, `updateHeroCover` | view entry | The user clicked Settings; the function sets `currentView`, pushes history, then arranges the screen |

None of these respond to a data change. The sequence is ordered with navigation steps (`currentView = ...` first, `openSettingsPanel()` in the middle), so an event would add a hop without a second subscriber.

## Allowlist change (added to `navigation`)
- `setSubheroVisibility`, `updateHeroCover`, `clearAllSelections`: part of "open this view". D, please review.

**Side effect, because the allowlist is by name, not by file.** The audit now also hides these calls in other agents' files:
- Agent A: `09` (`setSubheroVisibility` 1, `updateHeroCover` 1, `clearAllSelections` 2) and `99-player.js` (`updateHeroCover` 1). Audit A: 41 -> 36. EB-A5/A6 should still judge them; they look like `openPlaylist`/`openFolder` and start-up.
- Agent C: `08h-panel-search.js:81` `updateHeroCover(VIEWS.SEARCH_ITEMS)`. I will re-read it in EB-C3 even though the audit no longer lists it.

## Not allowlisted: `updateActiveHighlight` (2 calls in `08e`)
In `openSettingsPanel` it clears the highlight when settings opens, so it is view setup like the rest. I did not allowlist it because the name is also called 20 times in `13-song-highlight.js` and 2 times in `17-song-selection.js` (Agent B, EB-B5, a pending decision). Allowlisting it here would settle that decision silently and hide those 22 calls.
Options (human/D decide): (1) allowlist it after B writes EB-B5, covering all three files; (2) add file-scoped entries to `event-allowlist.json` and `tools/event-audit.js` so a name can be allowed in one file only (changes a tool I do not own).
Until then C stays at 2 open calls in `08e`.

## Results
- `node tools/event-audit.js C`: 26 -> 16 (`08e` 11 -> 2, `08h` 11 -> 10 from the side effect above).
- `events-c`, `manifest`, `events-wiring`: 24 pass, 0 fail. No scenario added: no behavior changed, so there is no call sequence to pin.
- Not run: full suite, the app in Electron.

## Needs from other agents
- D: approve the three allowlist names; decide option 1 or 2 for `updateActiveHighlight`.
- B: EB-B5 write-up (affects the 2 remaining `08e` calls).
- A: be aware the allowlist now hides 5 of your calls (list above).

## Manual test checklist
1. Click the Settings button from a song list: settings opens, hero hidden, subhero hidden, no song highlighted.
2. Click it again: returns to the previous view.
3. Open Settings, go to History (or Search History) and back via Back: settings re-appear correctly, including Advanced settings.
4. Open Advanced settings, close it: settings page returns.
5. Open Settings while songs are selected: selection is cleared.
6. Open Settings from the Lyrics view: lyrics view closes cleanly.
