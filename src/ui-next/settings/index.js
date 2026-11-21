// Registers the sections of Settings, once. The order of the menu is each section's `order`, not the order here.
// To add a page: write a file in settings/sections/ that exports one section object and add it to the list below.
// To add a card or a setting to a page that exists, call registerPart / registerRow (settings/registry.js) from the module that owns it.
import { registerSection } from './registry.js';
import { general } from './sections/general.js';
import { playback } from './sections/playback.js';
import { library } from './sections/library.js';
import { ai } from './sections/ai.js';
import { data } from './sections/data.js';

let done = false;

export function registerSettings() {
    if (done) return;
    done = true;
    for (const section of [general, playback, library, ai, data]) registerSection(section);
}

registerSettings(); // at import, so a module that adds a part or a row only has to import this file first
