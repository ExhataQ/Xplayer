// Puts the new Settings page on screen. The engine still draws its own Settings page every time Settings opens (and again after some
// actions); that page is the source of three blocks that the engine keeps in step by element id (the equalizer, the music folders, the
// download folder path). This takes those three out, hides the rest, and puts settings/page.js in its place. A small observer, alive only
// while Settings is shown, does it again when the engine redraws.
import { engineAction } from '../adapter/engine-api.js';
import { registerSettings } from './index.js';
import { buildSettingsPage, resetSettingsSection } from './page.js';
import { setAdopted, clearAdopted } from './adopt.js';

let observer = null;
let page = null;

function stop() {
    if (observer) observer.disconnect();
    observer = null;
    if (page) page.destroy();
    page = null;
    clearAdopted();
}

function inject(host) {
    const content = host.querySelector('.settings-panel-content');
    if (!content || content.dataset.replaced) return;
    // The engine's second page (Advanced Settings) is gone from the new screen: its settings are in Library and Data. Back to the first.
    if (content.querySelector('.settings-advanced-header')) return void engineAction('closeAdvancedSettings');
    content.dataset.replaced = 'true';
    content.hidden = true;
    setAdopted('equalizer', content.querySelector('#equalizer-section'));
    setAdopted('library-folders', content.querySelector('.library-locations-section'));
    setAdopted('download-path', content.querySelector('#url-save-path-display'));
    if (page) page.destroy();
    page = buildSettingsPage();
    content.after(page.el);
}

/** Called after the engine has drawn Settings into `host` (shell.js, the settings view). */
export function mountSettings(host) {
    stop();
    registerSettings();
    resetSettingsSection(); // opening Settings from the rail starts on the first section; a redraw by the engine keeps the one that was open
    inject(host);
    observer = new MutationObserver(() => (host.dataset.view === 'settings' ? inject(host) : stop()));
    observer.observe(host, { childList: true, subtree: true });
}
