# Agent <X> report NNNN: <short title>

Steps: <step IDs, for example B-02>. Applies on top of: <patch or zip this was made against>.
Archive (.agent/AGENTS.md section 1): <done / not done and why>.

## Changes

- <file>: <what changed and why, one line each>

## Numbers

`node tools/dep-map.js` before and after: mutable globals written from other files, file-level cycles, load-time cross-file references.
`node tools/event-audit.js --strict`: <exit code and the three totals>.

## Tests actually run

- <command>: <pass / fail / skipped counts>
- Not run, and why: <list>

## Needs from other agents

- <agent>: <what, in which file, and why it is not yours to change> (or "none")

## Not done

- <anything the step asked for that is still open, and why>

## For you (manual checks)

1. <what to do in the app> -> <what you should see>

## Next step

<the step ID this unblocks, or what the same agent should do next>
