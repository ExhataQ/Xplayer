// Chooses which page the main window loads. The current interface and the new one ("ui-next") both ship and can be switched in the app.
//
//   --ui=next  or  XPLAYER_UI=next      ui-next/index.html     (new interface, built from src/ui-next/)
//   --ui=current or XPLAYER_UI=current  music_player.html      (current interface)
//   otherwise                           the choice saved by the in-app switch (Settings), else music_player.html
//
// A flag or variable only decides the first load: switching inside the app is saved and wins from then on, until the next launch with a flag.
// The result is a forward-slash path relative to the output folder (getOutputDir() in storage-paths.js).

const CURRENT_ENTRY = 'music_player.html';
const NEXT_ENTRY = 'ui-next/index.html';

function normalizeChoice(value) {
    if (value === 'next') return 'next';
    if (value === 'current' || value === 'old') return 'current';
    return null;
}

function forcedChoice({ argv = [], env = {} } = {}) {
    if (argv.includes('--ui=next')) return 'next';
    if (argv.includes('--ui=current') || argv.includes('--ui=old')) return 'current';
    return normalizeChoice(env.XPLAYER_UI);
}

function entryFor(choice) {
    return choice === 'next' ? NEXT_ENTRY : CURRENT_ENTRY;
}

// saved: 'next' | 'current' | undefined, read by the caller from the settings file (see readSavedChoice).
function resolveUiEntry({ argv = [], env = {}, saved } = {}) {
    return entryFor(forcedChoice({ argv, env }) || normalizeChoice(saved) || 'current');
}

function readSavedChoice() {
    try {
        const fs = require('fs');
        const { configPath } = require('./storage-paths');
        const file = configPath('uiChoice');
        if (!fs.existsSync(file)) return undefined;
        return normalizeChoice(JSON.parse(fs.readFileSync(file, 'utf-8')).ui) || undefined;
    } catch (e) {
        return undefined;
    }
}

function writeSavedChoice(choice) {
    const normalized = normalizeChoice(choice);
    if (!normalized) return false;
    try {
        const fs = require('fs');
        const { configPath } = require('./storage-paths');
        fs.writeFileSync(configPath('uiChoice'), JSON.stringify({ ui: normalized }), 'utf-8');
        return true;
    } catch (e) {
        return false;
    }
}

// What this run is showing right now. Set by the first load and by every switch, so the loading window and the
// main window always agree.
let active = null;

function activeChoice({ argv = process.argv, env = process.env } = {}) {
    if (!active) active = forcedChoice({ argv, env }) || readSavedChoice() || 'current';
    return active;
}

function setActiveChoice(choice) {
    const normalized = normalizeChoice(choice);
    if (!normalized) return null;
    active = normalized;
    writeSavedChoice(normalized);
    return normalized;
}

function activeEntry(options) {
    return entryFor(activeChoice(options));
}

module.exports = { resolveUiEntry, activeChoice, activeEntry, setActiveChoice, readSavedChoice, writeSavedChoice, CURRENT_ENTRY, NEXT_ENTRY };
