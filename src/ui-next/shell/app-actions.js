// Something the Quick Player's menu asked of this app (electron/open-router.js, light:app-action): a page, the Play from URL dialog, the shortcuts.
// The main process brings this window forward and sends the name (or, when this window was not up yet, keeps it until it asks). Only these names run.

export const APP_ACTION_VIEWS = ['home', 'library', 'search', 'recent', 'lyrics', 'metadata', 'settings'];

/** Returns what the shell does for a name: `run(name)` is true when the name is known and was run. */
export function createAppActions({ selectView, showPlayFromUrl, openShortcuts, whenReady = (fn) => fn() }) {
    function run(name) {
        if (APP_ACTION_VIEWS.includes(name)) selectView(name);
        else if (name === 'play-url') showPlayFromUrl();
        else if (name === 'shortcuts') openShortcuts();
        else return false;
        return true;
    }

    /**
     * Takes the live ones (the full app was up) and the one that waited for it to start. `api` is the desktop bridge.
     * The one that waited is asked for while the shell is still being built, before the engine has loaded (it loads after the shell): the Play from URL
     * dialog is the engine's, so it would not be there yet and the action would be lost. `whenReady` runs it once the engine is up.
     */
    function install(api) {
        if (!api || typeof api.onAppAction !== 'function') return;
        api.onAppAction(run);
        if (typeof api.takeAppAction === 'function') {
            Promise.resolve(api.takeAppAction())
                .then((answer) => answer && answer.action && whenReady(() => run(answer.action)))
                .catch(() => {});
        }
    }

    return { run, install };
}
