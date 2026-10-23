# Report: PB-06 Create button, request to Agent A (no code changed)

**Task:** PB-06 | **Agent:** B | **Date:** 2026-10-21 | **Status:** Blocked

## Summary
The owner chose option A: a plus button in the Library panel header, next to the collapse arrow. Running the app confirmed that the new Library panel has no create control. I did not build it: the header is built in a file Agent A owns.

## Findings
- The "Library" title and the collapse arrow are built in `shell/shell.js` (A). `views/library/library-panel.js` (B) builds only the chips, find box and sort control below it. *Read, and seen running*
- The engine dialog is `showCreateItemDialog` (`js/ui/06b-modals.js:588`), exposed to the old screen as the action `showCreateItemDialog` (`js/ui/07a-ui-actions.js:50`). It asks Playlist or Folder, then runs the existing flow. *Read*
- `adapter/engine-api.js` already has `engineAction(name, ...args)`, which calls an engine function by name. `engineAction('showCreateItemDialog')` therefore needs no new adapter code. (My first version of this report said a new action was needed; that was wrong.) *Read*

## Request to Agent A
1. Panel header slot: let a view put one icon button before the collapse arrow (part of PA-04, the panel slot API), or add the button in the header in `shell/shell.js` and call a function B provides.
2. Rules for the plus: shown only for Library (collapse is Library only, PB-04); tooltip "New playlist or folder"; hidden in the collapsed strip.

## Decisions needed
None for the owner. The button is ready to build once A provides the header slot.

## Checks
Screenshot of the running app on the pristine copy (no create control). No code written, so no tests.

## Not run
Nothing to run yet.

## Environment
Same as PB-11.

## Manual checklist for the owner
None yet.

## Open issues and follow-ups
Context menu entries (second half of PB-06, and PB-07) can be done by B once the action exists.

## Patch
None.
