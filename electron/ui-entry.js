// Chooses which page the main window loads, so the current interface and the new one ("ui-next") can both ship.
//
//   default                          music_player.html            (current interface)
//   --ui=next  or  XPLAYER_UI=next   ui-next/index.html           (new interface, built from src/ui-next/)
//
// The result is a forward-slash path relative to the output folder (getOutputDir() in storage-paths.js).

const CURRENT_ENTRY = 'music_player.html';
const NEXT_ENTRY = 'ui-next/index.html';

function resolveUiEntry({ argv = [], env = {} } = {}) {
    if (argv.includes('--ui=next') || env.XPLAYER_UI === 'next') return NEXT_ENTRY;
    return CURRENT_ENTRY;
}

module.exports = { resolveUiEntry, CURRENT_ENTRY, NEXT_ENTRY };
