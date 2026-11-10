# Known problems

Pre-release: these are known and not hidden.

- Windows 10 and 11, 64-bit only. Nothing else was tried.
- The build is not signed, so Windows SmartScreen shows a warning the first time (More info, then Run anyway). That is expected, not a sign of a problem.
- There is no automatic update and no update notice yet. To update: install the new installer over the old one, or replace the portable folder keeping `Xplayer-Data`.
- Tags can be edited for MP3, FLAC, OGG, Opus and M4A/MP4. Other formats (WMA, APE, WavPack and the rest) play but their tags cannot be edited, and the app says so.
- The old interface is still in the app, behind a switch in Settings. The new interface is the default and the one being finished.
- A few automatic tests fail on known cases (listed in `.agent/archive/dev-plan/DEV-PLAN.md`, "Baseline"); none is known to affect playback.
- Lyrics and tag lookups use online services and need a connection; the AI features need your own key (kept on your computer).
