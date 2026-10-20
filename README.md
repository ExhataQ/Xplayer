# Xplayer

Xplayer is a desktop music player built with Electron, JavaScript, and a small Python-based build/backend component. The project focuses on local music-library management and playback, with supporting tools for lyrics and audio metadata.

> **Project status:** Under active development. Features, setup steps, and internal modules may change.

## Features

- Import and scan music folders and dropped audio files.
- Maintain a local song library and playback-related data.
- Read and edit audio metadata and embedded cover art.
- Search for online metadata and lyrics.
- Manage lyrics files and downloaded audio.
- Use a modular renderer and Electron main-process code.

Feature availability and behavior may change as development continues.

## Technology

- **Electron** for the desktop application.
- **JavaScript / Node.js** for the application and development tooling.
- **Python** for build and audio-related support scripts.
- **music-metadata**, **Jimp**, and **Sharp** for media metadata and image processing.
- **Node.js test runner** and **Playwright** for automated tests.

## Development

You will need a recent version of Node.js and npm. Some build or media workflows may also require Python.

Install the Node.js dependencies:

```powershell
npm install
```

Run the test suite:

```powershell
npm test
```

Run specific checks:

```powershell
npm run test:unit
npm run test:browser
npm run test:quick
npm run lint
```

Additional test-runner options:

```powershell
npm run test:list
npm run test:timing
npm run lint:strict
```

The repository does not currently define a standard `npm start` or packaging script in `package.json`. Consult the project scripts and source before attempting to launch or package the application.

## Two interfaces

Xplayer ships two interfaces. Both are in the app and you can switch between them.

- **Current interface** (`music_player.html`): the original screen.
- **New interface** (`src/ui-next/`): the redesigned shell.

How the app chooses at launch:

1. `--ui=next` or `XPLAYER_UI=next` opens the new interface.
2. `--ui=current` (or `--ui=old`, or `XPLAYER_UI=current`) opens the current interface.
3. Otherwise the last choice you made in Settings is used, and the default is the current interface.

To switch while the app is open, go to **Settings > Interface** (in either interface) and click the switch button. The window reloads into the other interface and the choice is saved in `ui-choice.json` in the settings folder. `Launch-Xplayer-UI-Next.bat` always starts the new interface.

## Repository layout

- `electron/` — Electron main-process code and desktop integrations.
- `src/` — renderer interface, styles, assets, and script manifest.
- `build/` — Python build and deployment support.
- `tools/tests/` — automated tests and test runner.
- `tools/` — development checks and supporting scripts.
- `.agent/` — project plans, task tracking, and agent reports.
- `.claude/` — Claude Code skills and project-specific guidance.

## Security

The application is configured to use Electron's context isolation and disable renderer Node.js integration. Changes to IPC handlers, preload APIs, file access, or external-content handling should preserve these security boundaries and be covered by tests where practical.

## Contributing

Before submitting changes:

1. Keep changes focused and preserve existing application behavior.
2. Run the relevant tests and lint checks.
3. Review `git diff --check` and `git status --short`.
4. Document meaningful architectural or workflow changes.

## License

The `package.json` currently declares the ISC license. Check the repository's dependency licenses and project files before redistributing a packaged build.
